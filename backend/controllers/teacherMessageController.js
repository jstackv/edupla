const mongoose = require('mongoose');
const { Class, User, TeacherDirectMessage } = require('../models/db');
const { createDirectNotification } = require('../services/notificationHelpers');

/* ══════════════════════════════════════════════════════════════════════════
   TEACHER <-> STUDENT PRIVATE DM
   Only a teacher can start a conversation with a student they teach — the
   thread only becomes visible to (and repliable by) the student once the
   teacher has sent at least one message. After that, either side may
   reply freely. Access to any given thread is strictly limited to the two
   participants (teacher_id + student_id) — no one else, including other
   teachers, can read it.
══════════════════════════════════════════════════════════════════════════ */

// Confirms the teacher currently teaches a class the student is enrolled
// in (as owning teacher OR extra_teacher). Returns that class or null.
async function findSharedClass(teacherId, studentId) {
  return Class.findOne({
    students: studentId,
    $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
  }, '_id name').lean();
}

// A thread only "exists" from the student's side once the teacher has
// sent at least one message — this is what makes the teacher the only one
// who can allow the conversation to start.
async function threadStartedByTeacher(teacherId, studentId) {
  const exists = await TeacherDirectMessage.exists({
    teacher_id: teacherId,
    student_id: studentId,
    sender_role: 'teacher',
  });
  return !!exists;
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

    res.json({
      peer: { id: student._id, name: student.name },
      class_name: cls.name,
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

    const started = await threadStartedByTeacher(teacherId, studentId);
    if (!started) return res.status(403).json({ message: 'This teacher has not started a conversation with you yet.' });

    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' }, 'name').lean();
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });

    const filter = { teacher_id: teacherId, student_id: studentId };
    if (since) filter.created_at = { $gt: new Date(since) };
    const messages = await TeacherDirectMessage.find(filter).sort({ created_at: 1 }).lean();

    await TeacherDirectMessage.updateMany(
      { teacher_id: teacherId, student_id: studentId, sender_role: 'teacher', read: false },
      { read: true }
    );

    res.json({ peer: { id: teacher._id, name: teacher.name }, messages: messages.map(fmt) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student: reply — only once the teacher has started the thread ──────── */
const postMessageAsStudent = async (req, res) => {
  try {
    const studentId = String(req.user.id);
    const { teacherId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const started = await threadStartedByTeacher(teacherId, studentId);
    if (!started) return res.status(403).json({ message: 'Only your teacher can start this conversation.' });

    const cls = await findSharedClass(teacherId, studentId);
    if (!cls) return res.status(403).json({ message: 'You are no longer sharing a class with this teacher.' });

    const msg = await TeacherDirectMessage.create({
      teacher_id: teacherId,
      student_id: studentId,
      class_id: cls._id,
      sender_id: studentId,
      sender_role: 'student',
      content: content.trim(),
    });

    res.status(201).json({ message: 'Message sent.', msg: fmt(msg) });
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

    res.json({
      conversations: convos.map(c => ({
        teacher_id: c._id,
        teacher_name: nameMap[String(c._id)] || 'Teacher',
        last_message: c.last_message,
        last_at: c.last_at,
        unread_count: c.unread_count,
      })),
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
  getMyTeacherThreads, deleteMessage, clearMyMessages,
};
