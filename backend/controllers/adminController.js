const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  User, Class, Assignment, Document, Announcement, Level, Trade, Submission, ProgramConfig, ReportConfig,
  DiscussionGroup, ClassCollaboration, DirectMessage,
} = require('../models/db');
const { cloudinary, getResourceType } = require('../middleware/upload');

// Best-effort Cloudinary delete — never throws, so a missing/already-gone
// asset never blocks the DB-side deletion the admin actually asked for.
async function destroyFile(publicId, resourceType = 'raw') {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); }
  catch (err) { console.error('Cloudinary delete error:', err.message); }
}

function destroyGroupMessageMedia(msg) {
  if (!msg || !msg.media_public_id) return Promise.resolve();
  if (msg.message_type === 'voice') return destroyFile(msg.media_public_id, 'raw');
  if (msg.message_type === 'image') return destroyFile(msg.media_public_id, 'image');
  if (msg.message_type === 'file') return destroyFile(msg.media_public_id, getResourceType(msg.file_name, msg.mime_type));
  return Promise.resolve();
}

// Deletes every Document, Assignment (+ its Submissions), and DiscussionGroup
// (+ its chat media) belonging to a class, cleaning up Cloudinary as it goes.
// Used whenever a class itself is deleted, so nothing is left orphaned.
async function cascadeDeleteClassContent(classId) {
  const [documents, assignments, groups] = await Promise.all([
    Document.find({ class_id: classId }, 'filename original_name mime_type').lean(),
    Assignment.find({ class_id: classId }, 'filename original_name mime_type').lean(),
    DiscussionGroup.find({ class_id: classId }, 'messages').lean(),
  ]);

  await Promise.all(documents.map(d => d.filename
    ? destroyFile(d.filename, getResourceType(d.original_name, d.mime_type)) : Promise.resolve()));
  await Document.deleteMany({ class_id: classId });

  const assignmentIds = assignments.map(a => a._id);
  await Promise.all(assignments.map(a => a.filename
    ? destroyFile(a.filename, getResourceType(a.original_name, a.mime_type)) : Promise.resolve()));

  const submissions = await Submission.find({ assignment_id: { $in: assignmentIds } }, 'filename original_name').lean();
  await Promise.all(submissions.map(s => s.filename
    ? destroyFile(s.filename, getResourceType(s.original_name)) : Promise.resolve()));
  await Submission.deleteMany({ assignment_id: { $in: assignmentIds } });
  await Assignment.deleteMany({ class_id: classId });

  await Promise.all(groups.flatMap(g => (g.messages || []).map(destroyGroupMessageMedia)));
  await DiscussionGroup.deleteMany({ class_id: classId });

  // Chat/collaboration side-effects: DM voice notes & files exchanged for
  // this class, plus the (file-less) collaboration toggle record itself.
  const directMessages = await DirectMessage.find({ class_id: classId }, 'message_type media_public_id file_name mime_type').lean();
  await Promise.all(directMessages.map(destroyGroupMessageMedia));
  await DirectMessage.deleteMany({ class_id: classId });
  await ClassCollaboration.deleteMany({ class_id: classId });
}

// Resolves a programConfigId (scoped to this admin) into the snapshot fields
// stored directly on the Class document. Returns nulls if no id given or not found.
const resolveProgramConfig = async (programConfigId, adminId) => {
  if (!programConfigId) {
    return { program_config_id: null, program_sector: null, program_trade: null, program_qualification_title: null, program_rtqf_level: null };
  }
  const cfg = await ProgramConfig.findOne({ _id: programConfigId, created_by: adminId }).lean();
  if (!cfg) {
    return { program_config_id: null, program_sector: null, program_trade: null, program_qualification_title: null, program_rtqf_level: null };
  }
  return {
    program_config_id: cfg._id,
    program_sector: cfg.sector,
    program_trade: cfg.trade,
    program_qualification_title: cfg.qualificationTitle,
    program_rtqf_level: cfg.rtqfLevel,
  };
};
const { notifyAccountStatus, notifyWelcome } = require('../services/emailService');

// ── Dashboard Stats ────────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    const [myTeacherDocs, myClassDocs] = await Promise.all([
      User.find({ role: 'teacher', created_by: adminId }, '_id').lean(),
      Class.find({ created_by: adminId }, '_id').lean(),
    ]);
    const myTeacherIds = myTeacherDocs.map(t => t._id);
    const myClassIds   = myClassDocs.map(c => c._id);

    const [teachers, students, classes, assignments, documents, announcements] = await Promise.all([
      User.countDocuments({ role: 'teacher', created_by: adminId }),
      User.countDocuments({ role: 'student', created_by: adminId }),
      Class.countDocuments({ created_by: adminId }),
      Assignment.countDocuments({ teacher_id: { $in: myTeacherIds } }),
      Document.countDocuments({ teacher_id: { $in: myTeacherIds } }),
      Announcement.countDocuments({ teacher_id: { $in: myTeacherIds } }),
    ]);

    const [recentTeachers, recentStudents] = await Promise.all([
      User.find({ role: 'teacher', created_by: adminId }).sort({ created_at: -1 }).limit(5).select('name email created_at').lean(),
      User.find({ role: 'student', created_by: adminId }).sort({ created_at: -1 }).limit(5).select('name email level trade created_at').lean(),
    ]);

    const classesByTeacher = await Class.aggregate([
      { $match: { created_by: new mongoose.Types.ObjectId(adminId) } },
      { $group: { _id: '$teacher_id', class_count: { $sum: 1 }, all_students: { $push: '$students' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'teacher' } },
      { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
      { $project: {
          teacher_name: '$teacher.name',
          class_count: 1,
          student_count: {
            $size: {
              $reduce: {
                input: '$all_students',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] }
              }
            }
          }
        }
      },
      { $sort: { class_count: -1 } },
      { $limit: 5 },
    ]);

    res.json({ counts: { teachers, students, classes, assignments, documents, announcements }, recentTeachers, recentStudents, classesByTeacher });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Teachers ───────────────────────────────────────────────────────────
const getTeachers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, 'i');
    const filter = { role: 'teacher', created_by: req.user.id, $or: [{ name: searchRegex }, { email: searchRegex }] };

    const [teachers, total] = await Promise.all([
      User.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter),
    ]);

    const result = await Promise.all(teachers.map(async (t) => {
      const classes = await Class.find({ $or: [{ teacher_id: t._id }, { extra_teachers: t._id }] }, 'students').lean();
      const studentSet = new Set();
      classes.forEach(c => c.students.forEach(s => studentSet.add(s.toString())));
      return { ...t, id: t._id, class_count: classes.length, student_count: studentSet.size };
    }));

    res.json({ teachers: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createTeacher = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already exists' });
    const defaultPassword = process.env.TEACHER_DEFAULT_PASSWORD || 'teacher123';
    const hashed = await bcrypt.hash(defaultPassword, 10);
    const t = await User.create({ name, email: email.toLowerCase(), password: hashed, role: 'teacher', phone: phone || null, created_by: req.user.id });
    res.status(201).json({ message: 'Teacher created successfully', id: t._id, defaultPassword });
    // Welcome email
    try {
      const admin = await User.findById(req.user.id, 'name').lean();
      notifyWelcome({ to: t.email, name: t.name, role: 'teacher', defaultPassword, adminName: admin?.name }).catch(() => {});
    } catch (_) {}
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateTeacher = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const result = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'teacher' },
      { name, email: email?.toLowerCase(), phone: phone || null }
    );
    if (!result) return res.status(404).json({ message: 'Teacher not found' });
    res.json({ message: 'Teacher updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteTeacher = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.params.id);
    await Class.updateMany({ teacher_id: teacherId }, { $unset: { teacher_id: '' } });
    await Class.updateMany({ extra_teachers: teacherId }, { $pull: { extra_teachers: teacherId } });
    const result = await User.findOneAndDelete({ _id: teacherId, role: 'teacher' });
    if (!result) return res.status(404).json({ message: 'Teacher not found' });
    res.json({ message: 'Teacher deleted. Their classes remain and can be reassigned.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Admin Classes ──────────────────────────────────────────────────────
const getAllClasses = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, 'i');
    const filter = { created_by: req.user.id, $or: [{ name: searchRegex }, { description: searchRegex }] };

    const [classes, total] = await Promise.all([
      Class.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
        .populate('teacher_id', 'name')
        .populate('program_config_id', 'sector trade qualificationTitle rtqfLevel')
        .lean(),
      Class.countDocuments(filter),
    ]);

    const result = classes.map(c => ({
      ...c, id: c._id,
      teacher_name: c.teacher_id?.name,
      student_count: c.students?.length || 0,
    }));

    res.json({ classes: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminCreateClass = async (req, res) => {
  try {
    const { name, description, level, trade, teacher_id, extra_teacher_ids = [], programConfigId } = req.body;
    if (!name || !teacher_id) return res.status(400).json({ message: 'Name and teacher are required' });
    const toObjectId = (id) => {
      try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
    };
    const teacherObjId = toObjectId(teacher_id);
    const teacherIdStr = teacherObjId ? teacherObjId.toString() : '';
    const extraIds = extra_teacher_ids
      .map(toObjectId)
      .filter(id => id && id.toString() !== teacherIdStr);

    const program = await resolveProgramConfig(programConfigId, req.user.id);

    const cls = await Class.create({
      name, description: description || null, level: level || null, trade: trade || null,
      teacher_id: teacherObjId, extra_teachers: extraIds,
      created_by: req.user.id,
      ...program,
    });
    res.status(201).json({ message: 'Class created', id: cls._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminUpdateClass = async (req, res) => {
  try {
    const { name, description, level, trade, teacher_id, extra_teacher_ids = [], programConfigId } = req.body;
    // Cast IDs to ObjectId safely, exclude the class teacher from extra_teachers
    const toObjectId = (id) => {
      try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
    };
    const teacherObjId = toObjectId(teacher_id);
    const teacherIdStr = teacherObjId ? teacherObjId.toString() : '';
    const allExtraIds = extra_teacher_ids
      .map(toObjectId)
      .filter(id => id && id.toString() !== teacherIdStr);

    const update = {
      name, description: description || null, level: level || null, trade: trade || null,
      teacher_id: teacherObjId, extra_teachers: allExtraIds,
    };

    // Only touch program fields if the client included the key at all (covers explicit clearing too)
    if (Object.prototype.hasOwnProperty.call(req.body, 'programConfigId')) {
      Object.assign(update, await resolveProgramConfig(programConfigId, req.user.id));
    }

    const result = await Class.findByIdAndUpdate(req.params.id, update);
    if (!result) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminDeleteClass = async (req, res) => {
  try {
    const result = await Class.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Class not found' });
    // Clean up every Document, Assignment, Submission, and chat/DM file tied
    // to this class — otherwise they become permanently orphaned in Cloudinary.
    await cascadeDeleteClassContent(result._id);
    res.json({ message: 'Class deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminAssignClassToTeacher = async (req, res) => {
  try {
    const { teacher_id } = req.body;
    const result = await Class.findByIdAndUpdate(
      req.params.id,
      { teacher_id, $addToSet: { extra_teachers: teacher_id } }
    );
    if (!result) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class assigned to teacher' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminGetClassTeachers = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('teacher_id', 'name email')
      .populate('extra_teachers', 'name email')
      .lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    const teachers = [cls.teacher_id, ...cls.extra_teachers].filter(Boolean);
    res.json({ teachers });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminGetClassStudents = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('students', 'name email level trade created_at')
      .populate('program_config_id', 'sector trade qualificationTitle rtqfLevel')
      .lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    res.json({ students: cls.students, class: { id: cls._id, name: cls.name, program: cls.program_config_id || null } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Admin Students ─────────────────────────────────────────────────────
const getAllStudents = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 12, classId, level, trade } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, 'i');

    let studentIds;
    if (classId) {
      const cls = await Class.findById(classId, 'students').lean();
      studentIds = cls?.students || [];
    }

    const filter = {
      role: 'student',
      created_by: req.user.id,
      $or: [{ name: searchRegex }, { email: searchRegex }],
      ...(level && { level }),
      ...(trade && { trade }),
      ...(studentIds && { _id: { $in: studentIds } }),
    };

    const [students, total] = await Promise.all([
      User.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter),
    ]);

    const allClasses = await Class.find({}, 'name students').lean();
    const result = students.map(s => {
      const sClasses = allClasses.filter(c => c.students.some(sid => sid.toString() === s._id.toString()));
      return { ...s, id: s._id, classes: sClasses.map(c => c.name).join(', '), class_count: sClasses.length };
    });

    res.json({ students: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminCreateStudent = async (req, res) => {
  try {
    const { name, email, classIds = [], class_year } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    // A student can only ever be enrolled in a single class at a time —
    // ignore anything beyond the first class id supplied.
    const classId = classIds[0] || null;

    // Derive level & trade from the enrolled class
    let derivedLevel = null;
    let derivedTrade = null;
    if (classId) {
      const primaryClass = await Class.findById(classId, 'level trade').lean();
      derivedLevel = primaryClass?.level || null;
      derivedTrade = primaryClass?.trade || null;
    }

    const defaultPassword = process.env.STUDENT_DEFAULT_PASSWORD || 'student123';
    const hashed = await bcrypt.hash(defaultPassword, 10);
    const s = await User.create({
      name, email: email.toLowerCase(), password: hashed, role: 'student',
      level: derivedLevel, trade: derivedTrade, class_year: class_year || null, phone: null,
      created_by: req.user.id,
    });

    if (classId) {
      await Class.updateOne({ _id: classId }, { $addToSet: { students: s._id } });
    }
    res.status(201).json({ message: 'Student created successfully', id: s._id, defaultPassword });
    // Welcome email
    try {
      const admin = await User.findById(req.user.id, 'name').lean();
      notifyWelcome({ to: s.email, name: s.name, role: 'student', defaultPassword, adminName: admin?.name }).catch(() => {});
    } catch (_) {}
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminUpdateStudent = async (req, res) => {
  try {
    const { name, email, classIds = [], class_year } = req.body;

    // A student can only ever be enrolled in a single class at a time —
    // ignore anything beyond the first class id supplied.
    const classId = classIds[0] || null;

    // Derive level & trade from the enrolled class
    let derivedLevel = null;
    let derivedTrade = null;
    if (classId) {
      const primaryClass = await Class.findById(classId, 'level trade').lean();
      derivedLevel = primaryClass?.level || null;
      derivedTrade = primaryClass?.trade || null;
    }

    await User.updateOne(
      { _id: req.params.id, role: 'student' },
      { name, email: email?.toLowerCase(), level: derivedLevel, trade: derivedTrade, class_year: class_year || null }
    );
    await Class.updateMany({}, { $pull: { students: new mongoose.Types.ObjectId(req.params.id) } });
    if (classId) {
      await Class.updateOne({ _id: classId }, { $addToSet: { students: req.params.id } });
    }
    res.json({ message: 'Student updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminDeleteStudent = async (req, res) => {
  try {
    const result = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
    if (!result) return res.status(404).json({ message: 'Student not found' });
    await Class.updateMany({}, { $pull: { students: new mongoose.Types.ObjectId(req.params.id) } });

    // Clean up this student's uploaded submission files — otherwise they
    // become permanently orphaned in Cloudinary once the student is gone.
    const submissions = await Submission.find({ student_id: result._id }, 'filename original_name').lean();
    await Promise.all(submissions.map(s => s.filename
      ? destroyFile(s.filename, getResourceType(s.original_name)) : Promise.resolve()));
    await Submission.deleteMany({ student_id: result._id });

    // Remove them from any discussion groups (as member and/or team leader)
    // and from group chats they participated in, and drop their direct
    // messages (cleaning up any voice notes/files those contained).
    await DiscussionGroup.updateMany({}, { $pull: { members: result._id } });
    const dms = await DirectMessage.find(
      { $or: [{ sender_id: result._id }, { receiver_id: result._id }] },
      'message_type media_public_id file_name mime_type'
    ).lean();
    await Promise.all(dms.map(destroyGroupMessageMedia));
    await DirectMessage.deleteMany({ $or: [{ sender_id: result._id }, { receiver_id: result._id }] });

    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminAssignStudentToClass = async (req, res) => {
  try {
    const { classId } = req.body;
    // A student can only ever be enrolled in a single class — remove them
    // from any other class before assigning the new one.
    await Class.updateMany({}, { $pull: { students: new mongoose.Types.ObjectId(req.params.id) } });
    await Class.updateOne({ _id: classId }, { $addToSet: { students: req.params.id } });
    res.json({ message: 'Student assigned to class' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const adminGetStudentDetail = async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' }, '-password').lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const classes = await Class.find({ students: req.params.id }, 'name _id').lean();
    res.json({ student: { ...student, id: student._id, classes } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Admin Assignments View ─────────────────────────────────────────────
const getAdminAssignments = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, 'i');

    const myTeachers = await User.find({ role: 'teacher', created_by: req.user.id }, '_id').lean();
    const myTeacherIds = myTeachers.map(t => t._id);

    const [assignments, total] = await Promise.all([
      Assignment.find({ teacher_id: { $in: myTeacherIds } })
        .sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
        .populate('teacher_id', 'name email')
        .populate('class_id', 'name level trade')
        .lean(),
      Assignment.countDocuments({ teacher_id: { $in: myTeacherIds } }),
    ]);

    const filtered = assignments.filter(a =>
      searchRegex.test(a.title) || searchRegex.test(a.teacher_id?.name) || searchRegex.test(a.class_id?.name)
    );

    const result = await Promise.all(filtered.map(async (a) => ({
      ...a, id: a._id,
      teacher_name: a.teacher_id?.name, teacher_email: a.teacher_id?.email,
      class_name: a.class_id?.name,
      level: a.class_id?.level, trade: a.class_id?.trade,
      submission_count: await Submission.countDocuments({ assignment_id: a._id }),
    })));

    res.json({ assignments: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Levels (admin-scoped) ──────────────────────────────────────────────
const getLevels = async (req, res) => {
  try {
    const adminId = req.user.id;
    const rows = await Level.find({ created_by: adminId }).sort({ value: 1 }).lean();
    res.json({ levels: rows.map(r => ({ value: r.value, label: r.label || r.value })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createLevel = async (req, res) => {
  try {
    const { value, label } = req.body;
    if (!value) return res.status(400).json({ message: 'Value is required' });
    const adminId = req.user.id;
    await Level.findOneAndUpdate(
      { value: value.toUpperCase(), created_by: adminId },
      { value: value.toUpperCase(), label: label || value, created_by: adminId },
      { upsert: true }
    );
    res.status(201).json({ message: 'Level created' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteLevel = async (req, res) => {
  try {
    const adminId = req.user.id;
    await Level.findOneAndDelete({ value: req.params.value, created_by: adminId });
    res.json({ message: 'Level deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateLevel = async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) return res.status(400).json({ message: 'Label is required' });
    const adminId = req.user.id;
    await Level.updateOne({ value: req.params.value, created_by: adminId }, { label });
    res.json({ message: 'Level updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Trades (admin-scoped) ──────────────────────────────────────────────
const getTrades = async (req, res) => {
  try {
    const adminId = req.user.id;
    const rows = await Trade.find({ created_by: adminId }).sort({ value: 1 }).lean();
    res.json({ trades: rows.map(r => ({ value: r.value, label: r.label || r.value })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createTrade = async (req, res) => {
  try {
    const { value, label } = req.body;
    if (!value) return res.status(400).json({ message: 'Value is required' });
    const adminId = req.user.id;
    await Trade.findOneAndUpdate(
      { value: value.toUpperCase(), created_by: adminId },
      { value: value.toUpperCase(), label: label || value, created_by: adminId },
      { upsert: true }
    );
    res.status(201).json({ message: 'Trade created' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteTrade = async (req, res) => {
  try {
    const adminId = req.user.id;
    await Trade.findOneAndDelete({ value: req.params.value, created_by: adminId });
    res.json({ message: 'Trade deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateTrade = async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) return res.status(400).json({ message: 'Label is required' });
    const adminId = req.user.id;
    await Trade.updateOne({ value: req.params.value, created_by: adminId }, { label });
    res.json({ message: 'Trade updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Status Toggle Handlers ─────────────────────────────────────────────
const toggleTeacherStatus = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    teacher.is_active = !teacher.is_active;
    teacher.deactivated_at = teacher.is_active ? null : new Date();
    await teacher.save();
    res.json({ message: `Teacher ${teacher.is_active ? 'activated' : 'deactivated'} successfully`, is_active: teacher.is_active });
    notifyAccountStatus({ to: teacher.email, name: teacher.name, role: 'teacher', isActive: teacher.is_active }).catch(() => {});
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const toggleStudentStatus = async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    student.is_active = !student.is_active;
    student.deactivated_at = student.is_active ? null : new Date();
    await student.save();
    res.json({ message: `Student ${student.is_active ? 'activated' : 'deactivated'} successfully`, is_active: student.is_active });
    notifyAccountStatus({ to: student.email, name: student.name, role: 'student', isActive: student.is_active }).catch(() => {});
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const toggleClassStatus = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    cls.is_active = !cls.is_active;
    await cls.save();
    res.json({ message: `Class ${cls.is_active ? 'activated' : 'deactivated'} successfully`, is_active: cls.is_active });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Toggle Admin Status — cascades to teachers & students ──────────────
const toggleAdminStatus = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const wasActive = admin.is_active;
    admin.is_active = !wasActive;
    admin.deactivated_at = admin.is_active ? null : new Date();
    await admin.save();

    // Cascade: deactivate or reactivate all teachers and students created by this admin
    const now = admin.deactivated_at || null;
    await User.updateMany(
      { created_by: admin._id, role: { $in: ['teacher', 'student'] } },
      {
        is_active: admin.is_active,
        deactivated_at: now,
      }
    );

    res.json({
      message: `Admin ${admin.is_active ? 'activated' : 'deactivated'} successfully. All their teachers and students have been ${admin.is_active ? 'reactivated' : 'deactivated'} and their sessions terminated.`,
      is_active: admin.is_active,
    });

    // Notify admin + all their teachers + all their students by email
    try {
      notifyAccountStatus({ to: admin.email, name: admin.name, role: 'admin', isActive: admin.is_active }).catch(() => {});
      const affected = await User.find({ created_by: admin._id, role: { $in: ['teacher', 'student'] } }, 'name email role').lean();
      for (const u of affected) {
        notifyAccountStatus({ to: u.email, name: u.name, role: u.role, isActive: admin.is_active }).catch(() => {});
      }
    } catch (_) {}
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── ProgramConfig CRUD ──────────────────────────────────────────────────
const getProgramConfigs = async (req, res) => {
  try {
    const adminId = req.user.id;
    const configs = await ProgramConfig.find({ created_by: adminId }).sort({ created_at: -1 }).lean();
    res.json({ programConfigs: configs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createProgramConfig = async (req, res) => {
  try {
    const { sector, trade, qualificationTitle, rtqfLevel } = req.body;
    if (!sector || !trade || !qualificationTitle || !rtqfLevel)
      return res.status(400).json({ message: 'All four fields are required' });
    const adminId = req.user.id;
    const doc = await ProgramConfig.create({
      sector: sector.trim(),
      trade: trade.trim(),
      qualificationTitle: qualificationTitle.trim(),
      rtqfLevel: rtqfLevel.trim(),
      created_by: adminId,
    });
    res.status(201).json({ programConfig: doc });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateProgramConfig = async (req, res) => {
  try {
    const { sector, trade, qualificationTitle, rtqfLevel } = req.body;
    if (!sector || !trade || !qualificationTitle || !rtqfLevel)
      return res.status(400).json({ message: 'All four fields are required' });
    const adminId = req.user.id;
    const doc = await ProgramConfig.findOneAndUpdate(
      { _id: req.params.id, created_by: adminId },
      { sector: sector.trim(), trade: trade.trim(), qualificationTitle: qualificationTitle.trim(), rtqfLevel: rtqfLevel.trim() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Program config not found' });
    res.json({ programConfig: doc });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteProgramConfig = async (req, res) => {
  try {
    const adminId = req.user.id;
    await ProgramConfig.findOneAndDelete({ _id: req.params.id, created_by: adminId });
    res.json({ message: 'Program configuration deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── ReportConfig — school header/branding shown on printed assessment reports ──
// One document per admin account (upserted), so it persists server-side instead
// of living in the browser's localStorage.
const REPORT_CONFIG_DEFAULTS = {
  republic: 'REPUBLIC OF RWANDA',
  ministry: 'MINISTRY OF EDUCATION',
  district: '',
  schoolName: 'EDUPLA Academy',
  schoolMotto: 'Excellence Through Knowledge',
  schoolLogoUrl: '',
  schoolAddress: '',
  schoolPhone: '',
  schoolEmail: '',
  schoolWebsite: '',
  managerName: '',
  managerTitle: 'School Principal',
  footerNote: "Module Weight = Module's learning hours = Credit × 10. Passing Line: 70% for Specific modules; 50% for General and Complementary modules. Module Annual Average: (Average of Integrated A + Average of Comprehensive A) / number of assessed terms.",
  primaryColor: '#1a3a6b',
  accentColor: '#1565c0',
  academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
};
const REPORT_CONFIG_FIELDS = Object.keys(REPORT_CONFIG_DEFAULTS);

const getReportConfig = async (req, res) => {
  try {
    const adminId = req.user.id;
    const cfg = await ReportConfig.findOne({ created_by: adminId }).lean();
    res.json({ reportConfig: { ...REPORT_CONFIG_DEFAULTS, ...(cfg || {}) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const saveReportConfig = async (req, res) => {
  try {
    const adminId = req.user.id;
    const update = {};
    REPORT_CONFIG_FIELDS.forEach(key => {
      if (req.body[key] !== undefined) update[key] = String(req.body[key] ?? '').trim();
    });
    const cfg = await ReportConfig.findOneAndUpdate(
      { created_by: adminId },
      { $set: update, $setOnInsert: { created_by: adminId } },
      { new: true, upsert: true }
    ).lean();
    res.json({ reportConfig: { ...REPORT_CONFIG_DEFAULTS, ...cfg }, message: 'Report configuration saved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Uploads a school logo image (Cloudinary, via the `logoUpload` multer
// middleware) and immediately persists its URL onto the admin's ReportConfig,
// so it shows up on every printed student report right away.
const uploadReportLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No logo file uploaded' });
    const adminId = req.user.id;
    const logoUrl = req.file.path; // Cloudinary secure URL
    const logoPublicId = req.file.filename; // Cloudinary public_id

    // Destroy the previous logo (if any) so replacing it doesn't leave the
    // old image behind in Cloudinary forever.
    const previous = await ReportConfig.findOne({ created_by: adminId }, 'schoolLogoPublicId').lean();
    if (previous?.schoolLogoPublicId) await destroyFile(previous.schoolLogoPublicId, 'image');

    const cfg = await ReportConfig.findOneAndUpdate(
      { created_by: adminId },
      { $set: { schoolLogoUrl: logoUrl, schoolLogoPublicId: logoPublicId }, $setOnInsert: { created_by: adminId } },
      { new: true, upsert: true }
    ).lean();
    res.json({ reportConfig: { ...REPORT_CONFIG_DEFAULTS, ...cfg }, logoUrl, message: 'Logo uploaded' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getDashboardStats, getTeachers, createTeacher, updateTeacher, deleteTeacher,
  getAllClasses, adminCreateClass, adminUpdateClass, adminDeleteClass, adminAssignClassToTeacher,
  adminGetClassTeachers, adminGetClassStudents,
  getAllStudents, adminCreateStudent, adminUpdateStudent, adminDeleteStudent,
  adminAssignStudentToClass, adminGetStudentDetail,
  getAdminAssignments,
  getLevels, createLevel, deleteLevel, updateLevel,
  getTrades, createTrade, deleteTrade, updateTrade,
  getProgramConfigs, createProgramConfig, updateProgramConfig, deleteProgramConfig,
  getReportConfig, saveReportConfig, uploadReportLogo,
  toggleTeacherStatus, toggleStudentStatus, toggleClassStatus, toggleAdminStatus,
};