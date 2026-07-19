const mongoose = require('mongoose');
const { Attendance, Class, User } = require('../models/db');
const { createDirectNotification } = require('../services/notificationHelpers');

// Normalize any date/string to midnight UTC so "2025-01-10" and a Date object
// for the same calendar day always collide on the unique (class_id, date) index.
function toDayStart(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function assertTeacherOwnsClass(classId, teacherId) {
  return Class.findOne({
    _id: classId,
    $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
  }).lean();
}

// GET /api/attendance/session?classId=&date=
// Returns either the saved session for that class+date, or — if none exists
// yet — the class roster defaulted to 'present' so the teacher can fill it
// in from scratch.
const getSession = async (req, res) => {
  try {
    const { classId, date } = req.query;
    if (!classId || !date) return res.status(400).json({ message: 'classId and date are required' });

    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const day = toDayStart(date);
    if (!day) return res.status(400).json({ message: 'Invalid date' });

    const roster = await User.find({ _id: { $in: cls.students }, role: 'student' }, 'name email level trade').lean();

    const existing = await Attendance.findOne({ class_id: classId, date: day }).lean();
    const recordByStudent = new Map((existing?.records || []).map(r => [r.student_id.toString(), r]));

    const records = roster.map(s => ({
      student_id: s._id,
      name: s.name,
      email: s.email,
      level: s.level,
      trade: s.trade,
      status: recordByStudent.get(s._id.toString())?.status || 'present',
      remarks: recordByStudent.get(s._id.toString())?.remarks || null,
    }));

    res.json({
      id: existing?._id || null,
      class_id: classId,
      date: day,
      already_taken: !!existing,
      records,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/attendance/session  { classId, date, records: [{ student_id, status, remarks }] }
// Upserts the session for that class+date.
const saveSession = async (req, res) => {
  try {
    const { classId, date, records } = req.body;
    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({ message: 'classId, date, and records are required' });
    }

    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const day = toDayStart(date);
    if (!day) return res.status(400).json({ message: 'Invalid date' });

    const enrolledIds = new Set(cls.students.map(s => s.toString()));
    const cleanRecords = records
      .filter(r => r.student_id && enrolledIds.has(String(r.student_id)))
      .map(r => ({
        student_id: r.student_id,
        status: ['present', 'absent', 'late', 'excused'].includes(r.status) ? r.status : 'present',
        remarks: r.remarks || null,
      }));

    const wasExisting = await Attendance.findOne({ class_id: classId, date: day }, '_id').lean();

    const session = await Attendance.findOneAndUpdate(
      { class_id: classId, date: day },
      {
        class_id: classId,
        date: day,
        teacher_id: req.session.user.id,
        records: cleanRecords,
        created_by: req.session.user.id,
      },
      { upsert: true, new: true }
    );

    res.json({ message: wasExisting ? 'Attendance updated' : 'Attendance recorded', id: session._id });

    // ── Notify students marked absent/late/excused, only on first take ───
    // (Skip on edits to avoid re-notifying every time a teacher corrects a
    // record.)
    if (!wasExisting) {
      try {
        const teacher = await User.findById(req.session.user.id, 'name').lean();
        const flagged = cleanRecords.filter(r => r.status !== 'present');
        await Promise.all(flagged.map(r => createDirectNotification({
          title: 'Attendance recorded',
          message: `${teacher?.name || 'Your teacher'} marked you ${r.status} in ${cls.name} on ${day.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
          type: r.status === 'absent' ? 'warning' : 'info',
          classId,
          teacherId: req.session.user.id,
          recipientId: r.student_id,
          linkType: 'attendance',
          linkId: session._id,
        })));
      } catch (err) {
        console.error('Notification error (attendance):', err.message);
      }
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/attendance/class/:classId — paginated session history with per-day counts
const getClassHistory = async (req, res) => {
  try {
    const { classId } = req.params;
    const { page = 1, limit = 15 } = req.query;
    const skip = (page - 1) * limit;

    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const [sessions, total] = await Promise.all([
      Attendance.find({ class_id: classId }).sort({ date: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Attendance.countDocuments({ class_id: classId }),
    ]);

    const result = sessions.map(s => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      s.records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
      return { id: s._id, date: s.date, total: s.records.length, counts };
    });

    res.json({ sessions: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/attendance/class/:classId/summary — per-student totals across all sessions
const getClassSummary = async (req, res) => {
  try {
    const { classId } = req.params;
    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const students = await User.find({ _id: { $in: cls.students }, role: 'student' }, 'name email level trade').lean();
    const sessions = await Attendance.find({ class_id: classId }, 'records').lean();
    const totalSessions = sessions.length;

    const summary = students.map(s => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      sessions.forEach(sess => {
        const rec = sess.records.find(r => r.student_id.toString() === s._id.toString());
        if (rec) counts[rec.status] = (counts[rec.status] || 0) + 1;
      });
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      return {
        student_id: s._id, student_name: s.name, student_email: s.email,
        level: s.level, trade: s.trade,
        ...counts, attendance_rate: rate,
      };
    });

    summary.sort((a, b) => a.student_name.localeCompare(b.student_name));
    res.json({ total_sessions: totalSessions, summary });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/attendance/session/:id
const deleteSession = async (req, res) => {
  try {
    const session = await Attendance.findOne({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!session) return res.status(404).json({ message: 'Attendance session not found' });
    await session.deleteOne();
    res.json({ message: 'Attendance session deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/attendance/my?classId= — student view of their own attendance
const getMyAttendance = async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.session.user.id);
    const { classId } = req.query;

    const enrolledClasses = await Class.find({ students: studentId }, 'name').lean();
    const classIds = classId ? [classId] : enrolledClasses.map(c => c._id.toString());
    const classNameById = new Map(enrolledClasses.map(c => [c._id.toString(), c.name]));

    const sessions = await Attendance.find({ class_id: { $in: classIds } }).sort({ date: -1 }).lean();

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    const history = [];
    sessions.forEach(s => {
      const rec = s.records.find(r => r.student_id.toString() === req.session.user.id);
      if (!rec) return;
      counts[rec.status] = (counts[rec.status] || 0) + 1;
      history.push({
        date: s.date,
        class_id: s.class_id,
        class_name: classNameById.get(s.class_id.toString()) || null,
        status: rec.status,
        remarks: rec.remarks,
      });
    });

    const marked = counts.present + counts.absent + counts.late + counts.excused;
    const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;

    res.json({ counts, attendance_rate: rate, history });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getSession, saveSession, getClassHistory, getClassSummary, deleteSession, getMyAttendance,
};