const mongoose = require('mongoose');
const { Assignment, Submission, Class, User, Course } = require('../models/db');
const { cloudinary, getResourceType } = require('../middleware/upload');
const { notifyAssignmentPosted, notifyAssignmentSubmitted } = require('../services/emailService');
const { createInAppNotification, getStudentEmails, getTeacherEmail } = require('../services/notificationHelpers');
const { buildDownloadFilename, streamWithFilename } = require('../utils/downloadFilename');

// Helper: check if assignment is currently accessible to students
function isAssignmentAccessible(a) {
  return !!a.is_active;
}

const getAssignments = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, classId, courseId } = req.query;
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;
    const searchRegex = new RegExp(search, 'i');

    if (role === 'teacher') {
      // Find all classes this teacher is assigned to (as class teacher OR extra teacher)
      const assignedClasses = await Class.find({
        $or: [{ teacher_id: userId }, { extra_teachers: userId }]
      }, '_id').lean();
      const assignedClassIds = assignedClasses.map(c => c._id);

      const classFilter = classId ? { class_id: classId } : { class_id: { $in: assignedClassIds } };
      const filter = {
        ...classFilter,
        $or: [{ title: searchRegex }, { description: searchRegex }],
      };
      if (courseId) filter.course_id = new mongoose.Types.ObjectId(courseId);
      const [assignments, total] = await Promise.all([
        Assignment.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
          .populate('class_id', 'name').populate('course_id', 'name code category').lean(),
        Assignment.countDocuments(filter),
      ]);

      const result = await Promise.all(assignments.map(async (a) => {
        const [submission_count, cls] = await Promise.all([
          Submission.countDocuments({ assignment_id: a._id }),
          Class.findById(a.class_id, 'students').lean(),
        ]);
        return {
          ...a, id: a._id,
          class_name: a.class_id?.name,
          course_name: a.course_id?.name,
          course_code: a.course_id?.code,
          course_category: a.course_id?.category,
          file_url: a.file_url,
          submission_count,
          total_students: cls?.students?.length || 0,
          is_accessible: isAssignmentAccessible(a),
        };
      }));
      return res.json({ assignments: result, total, page: parseInt(page), limit: parseInt(limit) });
    }

    // Student view — only return active, in-window assignments
    // Note: do NOT filter by class is_active here — a class being inactive
    // should not hide assignments that are themselves active.
    const enrolledClasses = await Class.find({ students: userId }, '_id').lean();
    const enrolledClassIds = enrolledClasses.map(c => c._id);

    // If a classId filter is requested, scope it within the student's enrolled
    // classes rather than overwriting the enrollment guard entirely.
    const classIdFilter = classId
      ? enrolledClassIds.filter(id => id.toString() === classId)
      : enrolledClassIds;

    const filter = {
      class_id: { $in: classIdFilter },
      is_active: true,
      $or: [{ title: searchRegex }, { description: searchRegex }],
    };
    if (courseId) filter.course_id = new mongoose.Types.ObjectId(courseId);
    const [assignments, total] = await Promise.all([
      Assignment.find(filter).sort({ deadline: 1 }).skip(skip).limit(parseInt(limit))
        .populate('class_id', 'name').populate('teacher_id', 'name')
        .populate('course_id', 'name code category').lean(),
      Assignment.countDocuments(filter),
    ]);

    const result = await Promise.all(assignments.map(async (a) => {
      const sub = await Submission.findOne({ assignment_id: a._id, student_id: userId }, 'submitted_at score feedback _id').lean();
      return {
        ...a, id: a._id,
        class_name: a.class_id?.name,
        teacher_name: a.teacher_id?.name,
        course_name: a.course_id?.name,
        course_code: a.course_id?.code,
        course_category: a.course_id?.category,
        file_url: a.file_url,
        submission_id: sub?._id || null,
        submitted_at: sub?.submitted_at || null,
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
    // Verify teacher is assigned to this class (as class teacher or extra teacher)
    const teacherClass = await Class.findOne({
      _id: classId,
      $or: [{ teacher_id: req.session.user.id }, { extra_teachers: req.session.user.id }]
    }).lean();
    if (!teacherClass) return res.status(403).json({ message: 'You are not assigned to this class.' });
    // If a module/course is specified, verify the teacher is assigned to that module
    if (courseId) {
      const teacherCourse = await Course.findOne({ _id: courseId, teacher_id: req.session.user.id }).lean();
      if (!teacherCourse) return res.status(403).json({ message: 'You are not assigned to this module.' });
    }
    const a = await Assignment.create({
      title, description, deadline,
      is_active: (is_active === undefined || is_active === null || is_active === "") ? true : (is_active === true || is_active === "true"),
      class_id: classId, course_id: courseId || null, teacher_id: req.session.user.id,
      max_score: max_score || 100,
      filename:      req.file?.filename      || null,
      original_name: req.file?.originalname  || null,
      mime_type:     req.file?.mimetype      || null,
      file_url:      req.file?.path          || null,
    });
    res.status(201).json({ message: 'Assignment created', id: a._id });

    // ── Fire notifications async (don't block response) ────────────────
    if (a.is_active) {
      try {
        const [cls, teacherEmail] = await Promise.all([
          Class.findById(classId).populate('students', 'email name').lean(),
          getTeacherEmail(req.session.user.id),
        ]);
        const teacher = await User.findById(req.session.user.id, 'name').lean();
        const studentEmails = cls?.students?.map(s => s.email).filter(Boolean) || [];

        // In-app
        await createInAppNotification({
          title: `New Assignment: ${title}`,
          message: `${teacher?.name || 'Your teacher'} posted a new assignment "${title}" in ${cls?.name || 'your class'}. Deadline: ${new Date(deadline).toLocaleDateString()}.`,
          type: 'info',
          classId: classId,
          teacherId: req.session.user.id,
          linkType: 'assignment',
          linkId: a._id,
          courseId: a.course_id || null,
        });

        // Email
        if (studentEmails.length) {
          notifyAssignmentPosted({
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
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateAssignment = async (req, res) => {
  try {
    const { title, description, deadline, classId, courseId, max_score, is_active } = req.body;
    const existing = await Assignment.findOne({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!existing) return res.status(404).json({ message: 'Assignment not found' });

    let { filename, original_name, mime_type, file_url } = existing;

    if (req.file) {
      if (filename) {
        try { await cloudinary.uploader.destroy(filename, { resource_type: getResourceType(original_name, mime_type) }); } catch (_) {}
      }
      filename      = req.file.filename;
      original_name = req.file.originalname;
      mime_type     = req.file.mimetype;
      file_url      = req.file.path;
    }

    await Assignment.updateOne(
      { _id: req.params.id },
      {
        title, description, deadline, class_id: classId, course_id: courseId || null, max_score: max_score || 100,
        is_active: is_active === true || is_active === 'true',
        filename, original_name, mime_type, file_url,
      }
    );
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
    if (a.filename) {
      try { await cloudinary.uploader.destroy(a.filename, { resource_type: getResourceType(a.original_name, a.mime_type) }); } catch (_) {}
    }

    // Cascade: every student submission for this assignment also has an
    // uploaded file in Cloudinary — clean those up too, then remove the
    // now-orphaned Submission records themselves.
    const submissions = await Submission.find({ assignment_id: a._id }, 'filename original_name').lean();
    await Promise.all(submissions.map(s => {
      if (!s.filename) return Promise.resolve();
      return cloudinary.uploader.destroy(s.filename, { resource_type: getResourceType(s.original_name) }).catch(() => {});
    }));
    await Submission.deleteMany({ assignment_id: a._id });

    res.json({ message: 'Assignment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const downloadAssignment = async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).lean();
    if (!a || !a.file_url) return res.status(404).json({ message: 'File not found' });
    // Students can only download active, in-window assignments
    if (req.session.user.role === 'student' && !isAssignmentAccessible(a)) {
      return res.status(403).json({ message: 'This assignment is not currently active.' });
    }
    const filename = buildDownloadFilename(a.title, a.original_name);
    await streamWithFilename(res, a.file_url, filename);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const viewAssignment = async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).lean();
    if (!a || !a.file_url) return res.status(404).json({ message: 'File not found' });
    if (req.session.user.role === 'student' && !isAssignmentAccessible(a)) {
      return res.status(403).json({ message: 'This assignment is not currently active.' });
    }
    const filename = buildDownloadFilename(a.title, a.original_name);
    await streamWithFilename(res, a.file_url, filename, 'inline');
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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

    if (new Date() > new Date(a.deadline)) {
      return res.status(400).json({ message: 'Submission deadline has expired. Resubmission is no longer allowed.' });
    }

    const existing = await Submission.findOne({ assignment_id: assignmentId, student_id: studentId });
    if (existing) {
      const update = { notes, submitted_at: new Date() };
      if (req.file) {
        if (existing.filename) {
          try { await cloudinary.uploader.destroy(existing.filename, { resource_type: getResourceType(existing.original_name) }); } catch (_) {}
        }
        update.filename      = req.file.filename;
        update.original_name = req.file.originalname;
        update.file_url      = req.file.path;
      }
      await Submission.updateOne({ _id: existing._id }, update);
      return res.json({ message: 'Submission updated successfully' });
    }

    await Submission.create({
      assignment_id: assignmentId, student_id: studentId,
      filename:      req.file?.filename     || null,
      original_name: req.file?.originalname || null,
      file_url:      req.file?.path         || null,
      notes,
    });
    res.status(201).json({ message: 'Assignment submitted successfully' });

    // ── Notify teacher async ─────────────────────────────────────────────
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
        message: `${student?.name || 'A student'} submitted "${a.title}". Ready to review.`,
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
        notifyAssignmentSubmitted({
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
    }));
    res.json({ submissions: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const downloadSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.submissionId)
      .populate('assignment_id', 'title')
      .populate('student_id', 'name')
      .lean();
    if (!sub || !sub.file_url) return res.status(404).json({ message: 'File not found' });
    const assignmentTitle = sub.assignment_id?.title;
    const studentName = sub.student_id?.name;
    const title = assignmentTitle
      ? `${assignmentTitle}${studentName ? ` - ${studentName}` : ''}`
      : null;
    const filename = buildDownloadFilename(title, sub.original_name);
    await streamWithFilename(res, sub.file_url, filename);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const viewSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.submissionId)
      .populate('assignment_id', 'title')
      .populate('student_id', 'name')
      .lean();
    if (!sub || !sub.file_url) return res.status(404).json({ message: 'File not found' });
    const assignmentTitle = sub.assignment_id?.title;
    const studentName = sub.student_id?.name;
    const title = assignmentTitle
      ? `${assignmentTitle}${studentName ? ` - ${studentName}` : ''}`
      : null;
    const filename = buildDownloadFilename(title, sub.original_name);
    await streamWithFilename(res, sub.file_url, filename, 'inline');
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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

    let students = await User.find(
      { _id: { $in: a.class_id.students }, role: 'student', ...(studentId && { _id: studentId }) },
      'name email level trade'
    ).lean();

    const grades = await Promise.all(students.map(async (s) => {
      const sub = await Submission.findOne({ assignment_id: assignmentId, student_id: s._id }, 'score feedback submitted_at graded_at filename original_name file_url notes _id').lean();
      return {
        student_id:    s._id,
        student_name:  s.name,
        student_email: s.email,
        level: s.level,
        trade: s.trade,
        submission_id: sub?._id || null,
        filename:      sub?.filename || null,
        original_name: sub?.original_name || null,
        file_url:      sub?.file_url || null,
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

module.exports = {
  getAssignments, createAssignment, updateAssignment, deleteAssignment, toggleAssignmentStatus,
  downloadAssignment, viewAssignment,
  submitAssignment, getSubmissions, downloadSubmission, viewSubmission,
  gradeSubmission, getGradesReport,
};