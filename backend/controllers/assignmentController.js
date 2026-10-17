const mongoose = require('mongoose');
const { Assignment, Submission, Class, User, Course, TaskGroup } = require('../models/db');
const { cloudinary, getResourceType } = require('../middleware/upload');
const { notifyAssignmentPosted, notifyAssignmentSubmitted, notifyDeadlineExtended } = require('../services/emailService');
const { createInAppNotification, createDirectNotification, getStudentEmails, getTeacherEmail } = require('../services/notificationHelpers');
const { buildDownloadFilename, streamWithFilename } = require('../utils/downloadFilename');
const {
  MAX_TASK_FILES, LEGACY_FILE_ID,
  uploadedFiles, resolveFiles, findFile, legacyMirror, parseIdArray,
  allStoredFiles, destroyStoredFiles,
} = require('../utils/taskFiles');


// ── Task kinds ─────────────────────────────────────────────────────────────
// task_type: 'assignment' | 'homework'   mode: 'individual' | 'discussion'
// Documents created before these fields existed have neither, and are treated
// as individual assignments — the Mongo filters below match that explicitly.
const LEGACY_TYPE_ASSIGNMENT = { $or: [{ task_type: 'assignment' }, { task_type: { $exists: false } }, { task_type: null }] };
const LEGACY_MODE_INDIVIDUAL = { $or: [{ mode: 'individual' }, { mode: { $exists: false } }, { mode: null }] };

function taskKindFilter(taskType, mode) {
  const and = [];
  if (taskType === 'homework') and.push({ task_type: 'homework' });
  else if (taskType === 'assignment') and.push(LEGACY_TYPE_ASSIGNMENT);
  if (mode === 'discussion') and.push({ mode: 'discussion' });
  else if (mode === 'individual') and.push(LEGACY_MODE_INDIVIDUAL);
  return and;
}

// Parse the groupIds field, which arrives as a JSON string (multipart form),
// a comma list, or an already-parsed array.
function parseIdList(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = raw.split(','); }
  }
  if (!Array.isArray(list)) list = [list];
  return [...new Set(list.map(x => String(x).trim()).filter(x => mongoose.isValidObjectId(x)))];
}

// Normalise + validate the task kind fields. Returns { taskType, mode, groupIds }
// or { error } with a message suitable for a 400.
async function resolveTaskKind({ taskType, mode, groupIds }, classId, teacherId) {
  const type = taskType === 'homework' ? 'homework' : 'assignment';
  const m = type === 'homework' ? 'individual' : (mode === 'discussion' ? 'discussion' : 'individual');
  if (m !== 'discussion') return { taskType: type, mode: m, groupIds: [] };

  const ids = parseIdList(groupIds);
  if (ids.length === 0) return { error: 'Choose at least one group for a discussion task' };
  const found = await TaskGroup.countDocuments({ _id: { $in: ids }, class_id: classId, teacher_id: teacherId });
  if (found !== ids.length) return { error: 'One or more selected groups do not belong to this class' };
  return { taskType: type, mode: m, groupIds: ids };
}

// Ids of every TaskGroup the student belongs to.
async function getStudentGroupIds(studentId) {
  const groups = await TaskGroup.find({ members: studentId }, '_id').lean();
  return groups.map(g => g._id);
}

// May this student see / download / submit this task? Enforces enrolment and,
// for discussion tasks, membership of one of the target groups — a student in
// another group never gets the task.
async function studentCanAccess(a, studentId) {
  const enrolled = await Class.exists({ _id: a.class_id, students: studentId });
  if (!enrolled) return false;
  if (a.mode !== 'discussion') return true;
  const gids = (a.group_ids || []).map(String);
  if (gids.length === 0) return false;
  return !!(await TaskGroup.exists({ _id: { $in: gids }, members: studentId }));
}

// Students a task is addressed to: the whole class, or the union of its groups.
async function getTaskAudienceIds(a) {
  if (a.mode === 'discussion') {
    const groups = await TaskGroup.find({ _id: { $in: a.group_ids || [] } }, 'members').lean();
    return [...new Set(groups.flatMap(g => (g.members || []).map(String)))];
  }
  const cls = await Class.findById(a.class_id, 'students').lean();
  return (cls?.students || []).map(String);
}

const TASK_LABEL = { assignment: 'assignment', homework: 'homework' };

// Helper: check if assignment is currently accessible to students
function isAssignmentAccessible(a) {
  return !!a.is_active;
}

// The deadline the task was first posted with — the oldest 'from' in the history,
// or the current deadline when it has never been extended.
function originalDeadlineOf(a) {
  const h = a.deadline_history || [];
  return h.length ? h[0].from : a.deadline;
}

// Download name for one of several files: use the file's own name so a list of
// attachments doesn't all save as the same title.
function nameForFile(title, file, total) {
  if (total > 1) {
    const base = (file.original_name || '').replace(/\.[^/.]+$/, '');
    return buildDownloadFilename(base || title, file.original_name);
  }
  return buildDownloadFilename(title, file.original_name);
}

const getAssignments = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, classId, courseId, taskType, mode, groupId, status } = req.query;
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;
    const searchRegex = new RegExp(search, 'i');
    const kindFilter = taskKindFilter(taskType, mode);

    if (role === 'teacher') {
      // Find all classes this teacher is assigned to (as class teacher OR extra teacher)
      const assignedClasses = await Class.find({
        $or: [{ teacher_id: userId }, { extra_teachers: userId }]
      }, '_id').lean();
      const assignedClassIds = assignedClasses.map(c => c._id);

      const classFilter = classId ? { class_id: classId } : { class_id: { $in: assignedClassIds } };
      const filter = {
        ...classFilter,
        $and: [
          { $or: [{ title: searchRegex }, { description: searchRegex }] },
          ...kindFilter,
        ],
      };
      if (courseId) filter.course_id = new mongoose.Types.ObjectId(courseId);
      if (groupId && mongoose.isValidObjectId(groupId)) filter.group_ids = new mongoose.Types.ObjectId(groupId);
      const [assignments, total] = await Promise.all([
        Assignment.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
          .populate('class_id', 'name').populate('course_id', 'name code category')
          .populate('group_ids', 'name members').lean(),
        Assignment.countDocuments(filter),
      ]);

      const result = await Promise.all(assignments.map(async (a) => {
        const [submission_count, cls] = await Promise.all([
          Submission.countDocuments({ assignment_id: a._id }),
          Class.findById(a.class_id, 'students').lean(),
        ]);
        const groups = (a.group_ids || []).map(g => ({ id: g._id, name: g.name, member_count: (g.members || []).length }));
        const total_students = a.mode === 'discussion'
          ? new Set((a.group_ids || []).flatMap(g => (g.members || []).map(String))).size
          : (cls?.students?.length || 0);
        return {
          ...a, id: a._id,
          class_id: a.class_id?._id || a.class_id,
          task_type: a.task_type || 'assignment',
          mode: a.mode || 'individual',
          groups,
          group_ids: groups.map(g => g.id),
          class_name: a.class_id?.name,
          course_name: a.course_id?.name,
          course_code: a.course_id?.code,
          course_category: a.course_id?.category,
          file_url: a.file_url,
          attachments: resolveFiles(a, 'attachments'),
          original_deadline: originalDeadlineOf(a),
          deadline_extended: (a.deadline_history || []).length > 0,
          submission_count,
          total_students,
          is_accessible: isAssignmentAccessible(a),
        };
      }));
      return res.json({ assignments: result, total, page: parseInt(page), limit: parseInt(limit) });
    }

    // Student view — only return active tasks the student is entitled to.
    // Note: do NOT filter by class is_active here — a class being inactive
    // should not hide assignments that are themselves active.
    const enrolledClasses = await Class.find({ students: userId }, '_id').lean();
    const enrolledClassIds = enrolledClasses.map(c => c._id);

    // If a classId filter is requested, scope it within the student's enrolled
    // classes rather than overwriting the enrollment guard entirely.
    const classIdFilter = classId
      ? enrolledClassIds.filter(id => id.toString() === classId)
      : enrolledClassIds;

    // Discussion tasks are visible ONLY to members of the target groups.
    const myGroupIds = await getStudentGroupIds(userId);
    const and = [
      { $or: [{ title: searchRegex }, { description: searchRegex }] },
      { $or: [{ mode: { $ne: 'discussion' } }, { group_ids: { $in: myGroupIds } }] },
      ...kindFilter,
    ];

    // Submission-status tabs (all / pending / submitted / graded).
    if (status === 'pending' || status === 'submitted' || status === 'graded') {
      const mine = await Submission.find({ student_id: userId }, 'assignment_id score').lean();
      const submittedIds = mine.map(x => x.assignment_id);
      if (status === 'pending') and.push({ _id: { $nin: submittedIds } });
      else if (status === 'submitted') and.push({ _id: { $in: submittedIds } });
      else and.push({ _id: { $in: mine.filter(x => x.score !== null && x.score !== undefined).map(x => x.assignment_id) } });
    }

    const filter = { class_id: { $in: classIdFilter }, is_active: true, $and: and };
    if (courseId) filter.course_id = new mongoose.Types.ObjectId(courseId);
    const [assignments, total] = await Promise.all([
      Assignment.find(filter).sort({ deadline: 1 }).skip(skip).limit(parseInt(limit))
        .populate('class_id', 'name').populate('teacher_id', 'name')
        .populate('course_id', 'name code category').lean(),
      Assignment.countDocuments(filter),
    ]);

    // Group details (name + teammates) for the discussion tasks in this page.
    const groupDocs = await TaskGroup.find(
      { _id: { $in: assignments.flatMap(a => a.group_ids || []) }, members: userId }
    ).populate('members', 'name').lean();

    const result = await Promise.all(assignments.map(async (a) => {
      const sub = await Submission.findOne(
        { assignment_id: a._id, student_id: userId },
        'submitted_at score feedback notes filename original_name file_url files _id'
      ).lean();
      const myGroup = a.mode === 'discussion'
        ? groupDocs.find(g => (a.group_ids || []).some(id => String(id) === String(g._id)))
        : null;
      return {
        ...a, id: a._id,
        task_type: a.task_type || 'assignment',
        mode: a.mode || 'individual',
        group_ids: undefined,
        group: myGroup
          ? { id: myGroup._id, name: myGroup.name, members: (myGroup.members || []).map(m => ({ id: m._id, name: m.name })) }
          : null,
        class_name: a.class_id?.name,
        teacher_name: a.teacher_id?.name,
        course_name: a.course_id?.name,
        course_code: a.course_id?.code,
        course_category: a.course_id?.category,
        file_url: a.file_url,
        attachments: resolveFiles(a, 'attachments'),
        original_deadline: originalDeadlineOf(a),
        deadline_extended: (a.deadline_history || []).length > 0,
        deadline_history: undefined,
        submission_files: resolveFiles(sub, 'files'),
        submission_id: sub?._id || null,
        submitted_at: sub?.submitted_at || null,
        submission_notes: sub?.notes || null,
        submission_file_name: sub?.original_name || null,
        has_submission_file: !!sub?.filename,
        submission_file_url: sub?.file_url || null,
        score: sub?.score ?? null,
        feedback: sub?.feedback || null,
      };
    }));
    res.json({ assignments: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createAssignment = async (req, res) => {
  try {
    const { title, description, deadline, classId, courseId, max_score, is_active } = req.body;
    if (!title || !deadline || !classId) return res.status(400).json({ message: 'Title, deadline, and class are required' });
    // A teacher may post an assignment into a class either as the class
    // teacher / a class-level co-teacher, OR as the assigned teacher of the
    // specific MODULE it's posted under — e.g. a subject teacher who
    // teaches "Website Development" in this class but isn't its class
    // teacher. Previously this always required class-level access first,
    // so a module-only teacher was rejected before their courseId was even
    // considered.
    const [teacherClass, teacherCourse] = await Promise.all([
      Class.findOne({
        _id: classId,
        $or: [{ teacher_id: req.session.user.id }, { extra_teachers: req.session.user.id }],
      }).lean(),
      courseId
        ? Course.findOne({
            _id: courseId,
            teacher_id: req.session.user.id,
            $or: [{ class_id: classId }, { class_ids: classId }],
          }).lean()
        : null,
    ]);
    if (!teacherClass && !teacherCourse) return res.status(403).json({ message: 'You are not assigned to this class.' });
    const kind = await resolveTaskKind(req.body, classId, req.session.user.id);
    if (kind.error) return res.status(400).json({ message: kind.error });
    const attachments = uploadedFiles(req);
    if (attachments.length > MAX_TASK_FILES) {
      await destroyStoredFiles(attachments, cloudinary, getResourceType);
      return res.status(400).json({ message: `You can attach at most ${MAX_TASK_FILES} files.` });
    }
    const a = await Assignment.create({
      title, description, deadline,
      task_type: kind.taskType, mode: kind.mode, group_ids: kind.groupIds,
      is_active: (is_active === undefined || is_active === null || is_active === "") ? true : (is_active === true || is_active === "true"),
      class_id: classId, course_id: courseId || null, teacher_id: req.session.user.id,
      max_score: max_score || 100,
      attachments,
      ...legacyMirror(attachments),
    });
    // ── Notifications run BEFORE responding ────────────────────────────
    // On serverless (Vercel) the function is frozen as soon as the response
    // ends, which silently killed in-flight emails.
    if (a.is_active) {
      try {
        const [cls, teacherEmail] = await Promise.all([
          Class.findById(classId).lean(),
          getTeacherEmail(req.session.user.id),
        ]);
        const teacher = await User.findById(req.session.user.id, 'name').lean();
        const label = TASK_LABEL[a.task_type] || 'assignment';
        const noteTitle = `New ${label === 'homework' ? 'Homework' : 'Assignment'}: ${title}`;
        const noteMsg = `${teacher?.name || 'Your teacher'} posted new ${label} "${title}" in ${cls?.name || 'your class'}. Deadline: ${new Date(deadline).toLocaleDateString()}.`;

        let studentEmails;
        if (a.mode === 'discussion') {
          // Group task: only the members of the chosen groups hear about it.
          const memberIds = await getTaskAudienceIds(a);
          const members = await User.find({ _id: { $in: memberIds } }, 'email').lean();
          studentEmails = members.map(m => m.email).filter(Boolean);
          await Promise.all(memberIds.map(rid => createDirectNotification({
            title: noteTitle,
            message: `${noteMsg} (group task)`,
            type: 'info',
            classId,
            teacherId: req.session.user.id,
            recipientId: rid,
            linkType: 'assignment',
            linkId: a._id,
          })));
        } else {
          const populated = await Class.findById(classId).populate('students', 'email').lean();
          studentEmails = populated?.students?.map(s => s.email).filter(Boolean) || [];
          await createInAppNotification({
            title: noteTitle,
            message: noteMsg,
            type: 'info',
            classId: classId,
            teacherId: req.session.user.id,
            linkType: 'assignment',
            linkId: a._id,
            courseId: a.course_id || null,
          });
        }

        // Email
        if (studentEmails.length) {
          await notifyAssignmentPosted({
            studentEmails,
            teacherEmail,
            assignmentTitle: title,
            className: cls?.name || '',
            deadline,
            teacherName: teacher?.name || 'Your teacher',
          }).catch(err => console.error('Email send error:', err.message));
        }
      } catch (err) {
        console.error('Notification error (assignment create):', err.message);
      }
    }
    res.status(201).json({ message: 'Assignment created', id: a._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateAssignment = async (req, res) => {
  try {
    const { title, description, deadline, classId, courseId, max_score, is_active } = req.body;
    const existing = await Assignment.findOne({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!existing) return res.status(404).json({ message: 'Assignment not found' });

    const kind = await resolveTaskKind(req.body, existing.class_id, req.session.user.id);
    if (kind.error) return res.status(400).json({ message: kind.error });

    // Attachments: keep what the teacher didn't remove, add what they just uploaded.
    const removeIds = new Set(parseIdArray(req.body.removeAttachmentIds));
    const current = resolveFiles(existing, 'attachments');
    const kept = current.filter(f => !removeIds.has(f.id));
    const removed = current.filter(f => removeIds.has(f.id));
    const added = uploadedFiles(req);
    if (kept.length + added.length > MAX_TASK_FILES) {
      await destroyStoredFiles(added, cloudinary, getResourceType);
      return res.status(400).json({ message: `A task can have at most ${MAX_TASK_FILES} attachments.` });
    }
    // Kept files retain their ids; a legacy single file is promoted into the array.
    const nextAttachments = [
      ...kept.map(f => (f.id === LEGACY_FILE_ID ? { ...f, id: undefined } : { ...f, _id: f.id })),
      ...added,
    ].map(({ id, ...rest }) => rest);

    // Pushing the deadline later is an extension — keep the trail.
    const ops = {
      $set: {
        title, description, deadline, class_id: classId, course_id: courseId || null, max_score: max_score || 100,
        task_type: kind.taskType, mode: kind.mode, group_ids: kind.groupIds,
        is_active: is_active === true || is_active === 'true',
        attachments: nextAttachments,
        ...legacyMirror(nextAttachments),
      },
    };
    const newDeadline = new Date(deadline);
    if (!isNaN(newDeadline) && newDeadline > new Date(existing.deadline)) {
      ops.$push = { deadline_history: { from: existing.deadline, to: newDeadline, by: req.session.user.id, reason: null } };
    }
    await Assignment.updateOne({ _id: req.params.id }, ops);
    await destroyStoredFiles(removed.filter(f => f.filename), cloudinary, getResourceType);
    res.json({ message: 'Assignment updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const toggleAssignmentStatus = async (req, res) => {
  try {
    const a = await Assignment.findOne({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    a.is_active = !a.is_active;
    await a.save();
    res.json({ message: `Assignment ${a.is_active ? 'activated' : 'deactivated'}`, is_active: a.is_active });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteAssignment = async (req, res) => {
  try {
    const a = await Assignment.findOneAndDelete({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    await destroyStoredFiles(allStoredFiles(a, 'attachments'), cloudinary, getResourceType);

    // Cascade: every student submission for this assignment also has uploaded
    // files in Cloudinary — clean those up too, then remove the now-orphaned
    // Submission records themselves.
    const submissions = await Submission.find({ assignment_id: a._id }, 'filename original_name files').lean();
    await Promise.all(submissions.map(s => destroyStoredFiles(allStoredFiles(s, 'files'), cloudinary, getResourceType)));
    await Submission.deleteMany({ assignment_id: a._id });

    res.json({ message: 'Assignment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Students only get active tasks they are entitled to; teachers always may.
async function assertCanReadTask(req, res, a) {
  if (req.session.user.role !== 'student') return true;
  if (!isAssignmentAccessible(a)) { res.status(403).json({ message: 'This assignment is not currently active.' }); return false; }
  if (!(await studentCanAccess(a, req.session.user.id))) { res.status(403).json({ message: 'This task was not assigned to you.' }); return false; }
  return true;
}

// Serves one teacher attachment (the first one when no fileId is given, which
// keeps the old /:id/download and /:id/view URLs working).
const serveAssignmentFile = (disposition) => async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ message: 'File not found' });
    const file = findFile(a, 'attachments', req.params.fileId);
    if (!file || !file.file_url) return res.status(404).json({ message: 'File not found' });
    if (!(await assertCanReadTask(req, res, a))) return;
    const total = resolveFiles(a, 'attachments').length;
    await streamWithFilename(res, file.file_url, nameForFile(a.title, file, total), disposition);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
const downloadAssignment = serveAssignmentFile('attachment');
const viewAssignment = serveAssignmentFile('inline');
const downloadAssignmentFile = serveAssignmentFile('attachment');
const viewAssignmentFile = serveAssignmentFile('inline');

const submitAssignment = async (req, res) => {
  try {
    const { notes } = req.body;
    const studentId = req.session.user.id;
    const assignmentId = req.params.id;

    const a = await Assignment.findById(assignmentId);
    if (!a) return res.status(404).json({ message: 'Assignment not found' });

    // Block submission if assignment is inactive or outside window
    if (!isAssignmentAccessible(a)) {
      return res.status(403).json({ message: 'This assignment is not currently active and cannot be submitted.' });
    }

    if (!(await studentCanAccess(a, studentId))) {
      return res.status(403).json({ message: 'This task was not assigned to you.' });
    }

    if (new Date() > new Date(a.deadline)) {
      return res.status(400).json({ message: 'Submission deadline has expired. Resubmission is no longer allowed.' });
    }

    // A submission can hold several files. On a resubmit the student keeps the
    // files they didn't remove and adds the ones they just picked.
    const incoming = uploadedFiles(req);
    const existing = await Submission.findOne({ assignment_id: assignmentId, student_id: studentId });
    const removeIds = new Set(parseIdArray(req.body.removeFileIds));
    const current = resolveFiles(existing, 'files');
    const kept = current.filter(f => !removeIds.has(f.id));
    const removed = current.filter(f => removeIds.has(f.id));

    if (kept.length + incoming.length > MAX_TASK_FILES) {
      await destroyStoredFiles(incoming, cloudinary, getResourceType);
      return res.status(400).json({ message: `You can submit at most ${MAX_TASK_FILES} files.` });
    }
    if (kept.length + incoming.length === 0 && !(notes || '').trim()) {
      return res.status(400).json({ message: 'Attach at least one file or write a note.' });
    }

    const nextFiles = [
      ...kept.map(f => (f.id === LEGACY_FILE_ID ? { ...f, id: undefined } : { ...f, _id: f.id })),
      ...incoming,
    ].map(({ id, ...rest }) => rest);

    if (existing) {
      await Submission.updateOne({ _id: existing._id }, {
        $set: { notes, submitted_at: new Date(), files: nextFiles, ...legacyMirror(nextFiles) },
      });
      await destroyStoredFiles(removed.filter(f => f.filename), cloudinary, getResourceType);
      return res.json({ message: 'Submission updated successfully' });
    }

    await Submission.create({
      assignment_id: assignmentId, student_id: studentId,
      files: nextFiles, ...legacyMirror(nextFiles),
      notes,
    });
    // ── Notify teacher BEFORE responding (serverless freezes after the response) ──
    try {
      const [student, cls, teacherEmail] = await Promise.all([
        User.findById(studentId, 'name').lean(),
        Class.findById(a.class_id, 'name teacher_id').lean(),
        getTeacherEmail(a.teacher_id),
      ]);

      // In-app notification for teacher (use teacher_id as the pivot).
      // audience: 'teacher' — this event is about a student's submission and must
      // never be visible to any student, including the one who submitted it.
      await createInAppNotification({
        title: `Submission: ${a.title}`,
        message: `${student?.name || 'A student'} submitted "${a.title}"${nextFiles.length > 1 ? ` (${nextFiles.length} files)` : ''}. Ready to review.`,
        type: 'success',
        classId: a.class_id,
        teacherId: a.teacher_id,
        audience: 'teacher',
        linkType: 'submission',
        linkId: a._id,
        courseId: a.course_id || null,
      });

      // Email teacher
      if (teacherEmail) {
        await notifyAssignmentSubmitted({
          teacherEmail,
          studentName: student?.name || 'A student',
          assignmentTitle: a.title,
          className: cls?.name || '',
          submittedAt: new Date(),
        }).catch(err => console.error('Email send error:', err.message));
      }
    } catch (err) {
      console.error('Notification error (submission):', err.message);
    }
    res.status(201).json({ message: 'Assignment submitted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ assignment_id: req.params.id })
      .sort({ submitted_at: -1 })
      .populate('student_id', 'name email level trade')
      .lean();
    const result = submissions.map(s => ({
      ...s, id: s._id,
      student_name:  s.student_id?.name,
      student_email: s.student_id?.email,
      level: s.student_id?.level,
      trade: s.student_id?.trade,
      file_url: s.file_url,
      files: resolveFiles(s, 'files'),
    }));
    res.json({ submissions: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Serves one file of a student's submission (the first one when no fileId is
// given, which keeps the old .../download and .../view URLs working).
const serveSubmissionFile = (disposition) => async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.submissionId)
      .populate('assignment_id', 'title')
      .populate('student_id', 'name')
      .lean();
    if (!sub) return res.status(404).json({ message: 'File not found' });
    const file = findFile(sub, 'files', req.params.fileId);
    if (!file || !file.file_url) return res.status(404).json({ message: 'File not found' });
    const studentName = sub.student_id?.name;
    const suffix = studentName ? ` - ${studentName}` : '';
    const total = resolveFiles(sub, 'files').length;
    // One file: "<task title> - <student>". Several: the file's own name, so
    // they don't all save under the same title.
    const base = total > 1
      ? (file.original_name || '').replace(/\.[^/.]+$/, '')
      : sub.assignment_id?.title;
    const title = base ? `${base}${suffix}` : null;
    await streamWithFilename(res, file.file_url, buildDownloadFilename(title, file.original_name), disposition);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
const downloadSubmission = serveSubmissionFile('attachment');
const viewSubmission = serveSubmissionFile('inline');
const downloadSubmissionFile = serveSubmissionFile('attachment');
const viewSubmissionFile = serveSubmissionFile('inline');

const gradeSubmission = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const result = await Submission.findByIdAndUpdate(
      req.params.submissionId,
      { score, feedback: feedback || null, graded_at: new Date() }
    );
    if (!result) return res.status(404).json({ message: 'Submission not found' });
    res.json({ message: 'Submission graded' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getGradesReport = async (req, res) => {
  try {
    const { studentId } = req.query;
    const assignmentId = req.params.id;

    const a = await Assignment.findById(assignmentId)
      .populate('class_id', 'name students')
      .populate('course_id', 'name code category')
      .lean();
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    // Allow access to assignment owner OR extra teachers of the class
    const teacherId = req.session.user.id;
    const isOwner = a.teacher_id?.toString() === teacherId;
    const isExtraTeacher = a.class_id?.extra_teachers?.some?.(id => id?.toString() === teacherId);
    if (!isOwner && !isExtraTeacher) return res.status(404).json({ message: 'Assignment not found' });

    // Roster = the whole class for individual tasks, or only the members of
    // the chosen groups for a discussion task.
    const audienceIds = a.mode === 'discussion' ? await getTaskAudienceIds(a) : a.class_id.students;
    let students = await User.find(
      { _id: { $in: audienceIds }, role: 'student', ...(studentId && { _id: studentId }) },
      'name email level trade'
    ).lean();

    const groupByStudent = {};
    if (a.mode === 'discussion') {
      const groups = await TaskGroup.find({ _id: { $in: a.group_ids || [] } }, 'name members').lean();
      groups.forEach(g => (g.members || []).forEach(m => { groupByStudent[String(m)] = g.name; }));
    }

    const grades = await Promise.all(students.map(async (s) => {
      const sub = await Submission.findOne({ assignment_id: assignmentId, student_id: s._id }, 'score feedback submitted_at graded_at filename original_name file_url files notes _id').lean();
      return {
        student_id:    s._id,
        student_name:  s.name,
        student_email: s.email,
        level: s.level,
        trade: s.trade,
        group_name:    groupByStudent[String(s._id)] || null,
        submission_id: sub?._id || null,
        filename:      sub?.filename || null,
        original_name: sub?.original_name || null,
        file_url:      sub?.file_url || null,
        files:         resolveFiles(sub, 'files'),
        notes:         sub?.notes || null,
        score:         sub?.score ?? null,
        feedback:      sub?.feedback || null,
        submitted_at:  sub?.submitted_at || null,
        graded_at:     sub?.graded_at || null,
        max_score:     a.max_score,
        assignment_title: a.title,
        class_name:    a.class_id?.name,
      };
    }));

    grades.sort((a, b) => a.student_name.localeCompare(b.student_name));
    res.json({ assignment: a, grades });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Teacher pushes the submission deadline later. Students (the whole class, or the
// members of the chosen groups) are told, and anyone who was locked out by the
// old deadline can submit again — the submit check compares against the live
// deadline, so no other state needs touching.
const extendDeadline = async (req, res) => {
  try {
    const { deadline, reason = '', notify = true } = req.body;
    const a = await Assignment.findById(req.params.id);
    if (!a) return res.status(404).json({ message: 'Assignment not found' });

    const teacherId = String(req.session.user.id);
    let allowed = String(a.teacher_id) === teacherId;
    if (!allowed) {
      allowed = !!(await Class.exists({ _id: a.class_id, $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] }));
    }
    if (!allowed) return res.status(404).json({ message: 'Assignment not found' });

    const next = new Date(deadline);
    if (!deadline || isNaN(next)) return res.status(400).json({ message: 'Choose a valid new deadline.' });
    if (next <= new Date(a.deadline)) return res.status(400).json({ message: 'The new deadline must be later than the current one.' });
    if (next <= new Date()) return res.status(400).json({ message: 'The new deadline must be in the future.' });

    const cleanReason = String(reason || '').trim().slice(0, 300) || null;
    const previous = a.deadline;
    a.deadline_history.push({ from: previous, to: next, by: teacherId, reason: cleanReason });
    a.deadline = next;
    await a.save();

    // Notifications run BEFORE responding (serverless freezes after the response).
    const wantsNotify = !(notify === false || notify === 'false');
    if (wantsNotify && a.is_active) {
      try {
        const [cls, teacher, teacherEmail, audienceIds] = await Promise.all([
          Class.findById(a.class_id, 'name').lean(),
          User.findById(teacherId, 'name').lean(),
          getTeacherEmail(teacherId),
          getTaskAudienceIds(a),
        ]);
        const when = next.toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const title = `Deadline extended: ${a.title}`;
        const message = `${teacher?.name || 'Your teacher'} extended the deadline for "${a.title}" to ${when}.${cleanReason ? ` Note: ${cleanReason}` : ''}`;

        if (a.mode === 'discussion') {
          await Promise.all(audienceIds.map(rid => createDirectNotification({
            title, message, type: 'info', classId: a.class_id, teacherId, recipientId: rid, linkType: 'assignment', linkId: a._id,
          })));
        } else {
          await createInAppNotification({
            title, message, type: 'info', classId: a.class_id, teacherId,
            linkType: 'assignment', linkId: a._id, courseId: a.course_id || null,
          });
        }

        // Email only the students who still have something to hand in.
        const done = await Submission.distinct('student_id', { assignment_id: a._id });
        const doneSet = new Set(done.map(String));
        const pending = audienceIds.filter(id => !doneSet.has(String(id)));
        const people = await User.find({ _id: { $in: pending } }, 'email').lean();
        const emails = people.map(p => p.email).filter(Boolean);
        if (emails.length) {
          await notifyDeadlineExtended({
            studentEmails: emails, teacherEmail, assignmentTitle: a.title, className: cls?.name || '',
            oldDeadline: previous, newDeadline: next, reason: cleanReason, teacherName: teacher?.name || 'Your teacher',
          }).catch(err => console.error('Email send error:', err.message));
        }
      } catch (err) {
        console.error('Notification error (extend deadline):', err.message);
      }
    }

    res.json({ message: 'Deadline extended', deadline: a.deadline, deadline_history: a.deadline_history });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getAssignments, createAssignment, updateAssignment, deleteAssignment, toggleAssignmentStatus,
  downloadAssignment, viewAssignment, downloadAssignmentFile, viewAssignmentFile,
  submitAssignment, getSubmissions, downloadSubmission, viewSubmission,
  downloadSubmissionFile, viewSubmissionFile,
  gradeSubmission, getGradesReport, extendDeadline,
};