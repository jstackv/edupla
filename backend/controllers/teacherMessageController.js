const mongoose = require('mongoose');
const { Class, User, TeacherDirectMessage, TeacherDmConversationState } = require('../models/db');
const { createDirectNotification, createInAppNotification } = require('../services/notificationHelpers');

/* ══════════════════════════════════════════════════════════════════════════
   TEACHER <-> STUDENT PRIVATE DM
   Either side may start a conversation: a teacher with any student they
   teach, or a student with any teacher of a class they are enrolled in
   (owning teacher OR extra_teacher). The only gate is the shared class.
   The teacher keeps sole control of pausing a thread (TeacherDmConversationState).
   Access to any given thread is strictly limited to the two participants
   (teacher_id + student_id) — no one else, including other teachers, can
   read it.
══════════════════════════════════════════════════════════════════════════ */

// Confirms the teacher currently teaches a class the student is enrolled
// in (as owning teacher OR extra_teacher). Returns that class or null.
async function findSharedClass(teacherId, studentId) {
  return Class.findOne({
    students: studentId,
    $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
  }, '_id name').lean();
}

// True once the teacher has sent at least one message in this thread. Used
// only to decide whether the student should get a "new private message"
// notification on the teacher's first message (a student-started thread
// still notifies the student when the teacher first replies).
async function threadStartedByTeacher(teacherId, studentId) {
  const exists = await TeacherDirectMessage.exists({
    teacher_id: teacherId,
    student_id: studentId,
    sender_role: 'teacher',
  });
  return !!exists;
}

// Whether the teacher has paused this thread. Missing state = never paused.
async function isConversationDisabled(teacherId, studentId) {
  const state = await TeacherDmConversationState.findOne({ teacher_id: teacherId, student_id: studentId }, 'disabled').lean();
  return !!state?.disabled;
}

function fmt(m) {
  return {
    id: m._id,
    sender_id: m.sender_id,
    sender_role: m.sender_role,
    content: m.content,
    read: m.read,
    created_at: m.created_at,
  };
}

/* ── Teacher: fetch / poll the conversation with a student they teach ───── */
const getConversationAsTeacher = async (req, res) => {
  try {
    const teacherId = String(req.user.id);
    const { studentId } = req.params;
    const { since } = req.query;

    const cls = await findSharedClass(teacherId, studentId);
    if (!cls) return res.status(403).json({ message: 'This student is not in any of your classes.' });

    const student = await User.findOne({ _id: studentId, role: 'student' }, 'name').lean();
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const filter = { teacher_id: teacherId, student_id: studentId };
    if (since) filter.created_at = { $gt: new Date(since) };
    const messages = await TeacherDirectMessage.find(filter).sort({ created_at: 1 }).lean();

    // Mark the student's messages to me as read
    await TeacherDirectMessage.updateMany(
      { teacher_id: teacherId, student_id: studentId, sender_role: 'student', read: false },
      { read: true }
    );

    const disabled = await isConversationDisabled(teacherId, studentId);

    res.json({
      peer: { id: student._id, name: student.name },
      class_name: cls.name,
      disabled,
      messages: messages.map(fmt),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: send a message to a student they teach (starts the thread) ── */
const postMessageAsTeacher = async (req, res) => {
  try {
    const teacherId = String(req.user.id);
    const { studentId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const cls = await findSharedClass(teacherId, studentId);
    if (!cls) return res.status(403).json({ message: 'This student is not in any of your classes.' });

    if (await isConversationDisabled(teacherId, studentId)) {
      return res.status(403).json({ message: 'You paused this conversation. Restore it to send messages.' });
    }

    const isFirstMessage = !(await threadStartedByTeacher(teacherId, studentId));

    const msg = await TeacherDirectMessage.create({
      teacher_id: teacherId,
      student_id: studentId,
      class_id: cls._id,
      sender_id: teacherId,
      sender_role: 'teacher',
      content: content.trim(),
    });

    if (isFirstMessage) {
      const teacher = await User.findById(teacherId, 'name').lean();
      await createDirectNotification({
        title: 'New private message',
        message: `${teacher?.name || 'Your teacher'} sent you a private message.`,
        type: 'info',
        classId: cls._id,
        teacherId,
        recipientId: studentId,
        linkType: 'teacher_dm',
        linkId: teacherId,
      });
    }

    res.status(201).json({ message: 'Message sent.', msg: fmt(msg) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student: fetch / poll a conversation a teacher has started with them ── */
const getConversationAsStudent = async (req, res) => {
  try {
    const studentId = String(req.user.id);
    const { teacherId } = req.params;
    const { since } = req.query;

    // The only requirement to open (or start) a thread is a shared class.
    const cls = await findSharedClass(teacherId, studentId);
    if (!cls) return res.status(403).json({ message: 'You are not in any class taught by this teacher.' });

    // A thread the teacher paused is unavailable to the student, whether or
    // not any messages exist yet.
    if (await isConversationDisabled(teacherId, studentId)) {
      return res.status(403).json({ message: 'This conversation is not available right now.' });
    }

    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' }, 'name').lean();
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });

    const filter = { teacher_id: teacherId, student_id: studentId };
    if (since) filter.created_at = { $gt: new Date(since) };
    const messages = await TeacherDirectMessage.find(filter).sort({ created_at: 1 }).lean();

    await TeacherDirectMessage.updateMany(
      { teacher_id: teacherId, student_id: studentId, sender_role: 'teacher', read: false },
      { read: true }
    );

    res.json({ peer: { id: teacher._id, name: teacher.name }, class_name: cls.name, messages: messages.map(fmt) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student: send a message to a teacher (starts the thread if new) ────── */
const postMessageAsStudent = async (req, res) => {
  try {
    const studentId = String(req.user.id);
    const { teacherId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const cls = await findSharedClass(teacherId, studentId);
    if (!cls) return res.status(403).json({ message: 'You are not in any class taught by this teacher.' });

    if (await isConversationDisabled(teacherId, studentId)) {
      return res.status(403).json({ message: 'This conversation is not available right now.' });
    }

    // Notify the teacher only when this begins a new "burst" — i.e. they have
    // no earlier unread message from this student. Avoids one notification
    // per message while the student is typing several in a row.
    const alreadyUnread = await TeacherDirectMessage.exists({
      teacher_id: teacherId, student_id: studentId, sender_role: 'student', read: false,
    });

    const msg = await TeacherDirectMessage.create({
      teacher_id: teacherId,
      student_id: studentId,
      class_id: cls._id,
      sender_id: studentId,
      sender_role: 'student',
      content: content.trim(),
    });

    if (!alreadyUnread) {
      const student = await User.findById(studentId, 'name').lean();
      await createInAppNotification({
        title: 'New private message',
        message: `${student?.name || 'A student'} sent you a private message.`,
        type: 'info',
        classId: cls._id,
        teacherId,
        audience: 'teacher',
        linkType: 'teacher_dm',
        linkId: studentId,
      });
    }

    res.status(201).json({ message: 'Message sent.', msg: fmt(msg) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student: teachers they can message (any teacher of an enrolled class) ─ */
const getMyTeachers = async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.user.id);
    const classes = await Class.find(
      { students: studentId },
      '_id name teacher_id extra_teachers'
    ).lean();

    // teacherId -> { classes: [names] }
    const byTeacher = new Map();
    classes.forEach(c => {
      const ids = [c.teacher_id, ...(c.extra_teachers || [])].filter(Boolean).map(String);
      new Set(ids).forEach(tid => {
        if (!byTeacher.has(tid)) byTeacher.set(tid, []);
        byTeacher.get(tid).push(c.name);
      });
    });
    if (byTeacher.size === 0) return res.json({ teachers: [] });

    const teacherIds = [...byTeacher.keys()];
    const [teachers, paused] = await Promise.all([
      User.find({ _id: { $in: teacherIds }, role: 'teacher' }, 'name').lean(),
      // Teachers who paused their thread with this student are left out — the
      // student cannot message them until the teacher restores it.
      TeacherDmConversationState.find(
        { student_id: studentId, teacher_id: { $in: teacherIds }, disabled: true }, 'teacher_id'
      ).lean(),
    ]);
    const pausedSet = new Set(paused.map(p => String(p.teacher_id)));

    res.json({
      teachers: teachers
        .filter(t => !pausedSet.has(String(t._id)))
        .map(t => ({ id: t._id, name: t.name, classes: byTeacher.get(String(t._id)) || [] }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: inbox — every thread with a student (either side started it) ─ */
const getMyStudentThreads = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.user.id);

    const convos = await TeacherDirectMessage.aggregate([
      { $match: { teacher_id: teacherId } },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: '$student_id',
          last_message: { $first: '$content' },
          last_at: { $first: '$created_at' },
          unread_count: {
            $sum: { $cond: [{ $and: [{ $eq: ['$sender_role', 'student'] }, { $eq: ['$read', false] }] }, 1, 0] },
          },
        },
      },
      { $sort: { last_at: -1 } },
    ]);

    const studentIds = convos.map(c => c._id);
    const [students, states] = await Promise.all([
      User.find({ _id: { $in: studentIds } }, 'name').lean(),
      TeacherDmConversationState.find(
        { teacher_id: teacherId, student_id: { $in: studentIds }, disabled: true }, 'student_id'
      ).lean(),
    ]);
    const nameMap = {};
    students.forEach(s => { nameMap[String(s._id)] = s.name; });
    const pausedSet = new Set(states.map(s => String(s.student_id)));

    res.json({
      conversations: convos.map(c => ({
        student_id: c._id,
        student_name: nameMap[String(c._id)] || 'Student',
        last_message: c.last_message,
        last_at: c.last_at,
        unread_count: c.unread_count,
        disabled: pausedSet.has(String(c._id)),
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student: list every teacher who has started a DM with them (inbox) ──── */
const getMyTeacherThreads = async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.user.id);

    const pipeline = [
      { $match: { student_id: studentId } },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: '$teacher_id',
          last_message: { $first: '$content' },
          last_at: { $first: '$created_at' },
          unread_count: {
            $sum: { $cond: [{ $and: [{ $eq: ['$sender_role', 'teacher'] }, { $eq: ['$read', false] }] }, 1, 0] },
          },
        },
      },
      { $sort: { last_at: -1 } },
    ];

    const convos = await TeacherDirectMessage.aggregate(pipeline);
    const teacherIds = convos.map(c => c._id);
    const teachers = await User.find({ _id: { $in: teacherIds } }, 'name').lean();
    const nameMap = {};
    teachers.forEach(t => { nameMap[String(t._id)] = t.name; });

    // Paused threads are filtered out entirely — the student shouldn't even
    // know a conversation exists until the teacher restores it.
    const states = await TeacherDmConversationState.find(
      { student_id: studentId, teacher_id: { $in: teacherIds }, disabled: true }, 'teacher_id'
    ).lean();
    const disabledSet = new Set(states.map(s => String(s.teacher_id)));
    const visibleConvos = convos.filter(c => !disabledSet.has(String(c._id)));

    res.json({
      conversations: visibleConvos.map(c => ({
        teacher_id: c._id,
        teacher_name: nameMap[String(c._id)] || 'Teacher',
        last_message: c.last_message,
        last_at: c.last_at,
        unread_count: c.unread_count,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: pause or restore a thread — only the teacher may flip this ── */
const setConversationStatus = async (req, res) => {
  try {
    const teacherId = String(req.user.id);
    const { studentId } = req.params;
    const disabled = !!req.body.disabled;

    const cls = await findSharedClass(teacherId, studentId);
    if (!cls) return res.status(403).json({ message: 'This student is not in any of your classes.' });

    await TeacherDmConversationState.findOneAndUpdate(
      { teacher_id: teacherId, student_id: studentId },
      { disabled, disabled_at: disabled ? new Date() : null },
      { upsert: true }
    );

    res.json({
      message: disabled ? 'Conversation paused.' : 'Conversation restored.',
      disabled,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Author: delete a single message of their own ────────────────────────── */
const deleteMessage = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const msg = await TeacherDirectMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    if (String(msg.sender_id) !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }
    await TeacherDirectMessage.deleteOne({ _id: req.params.messageId });
    res.json({ message: 'Message deleted.', message_id: req.params.messageId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Author: clear (delete) every message they've sent to this peer ─────── */
const clearMyMessages = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role = req.user.role;
    const filter = role === 'teacher'
      ? { teacher_id: userId, student_id: req.params.studentId, sender_id: userId }
      : { teacher_id: req.params.teacherId, student_id: userId, sender_id: userId };
    const result = await TeacherDirectMessage.deleteMany(filter);
    res.json({ message: `Cleared ${result.deletedCount} message(s).`, removed_count: result.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getConversationAsTeacher, postMessageAsTeacher,
  getConversationAsStudent, postMessageAsStudent,
  getMyTeacherThreads, getMyTeachers, getMyStudentThreads,
  deleteMessage, clearMyMessages,
  setConversationStatus,
};