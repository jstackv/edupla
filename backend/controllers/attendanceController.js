const mongoose = require('mongoose');
const { Attendance, Class, User } = require('../models/db');
const { createDirectNotification, createInAppNotification } = require('../services/notificationHelpers');

// Normalize any date/string to midnight UTC so "2025-01-10" and a Date object
// for the same calendar day always collide on the unique (class_id, date) index.
function toDayStart(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const MS_DAY = 24 * 60 * 60 * 1000;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// Resolve a 'daily' | 'weekly' | 'monthly' period into a { start, end } day range
// (inclusive, UTC midnight), anchored on the given reference date.
// Weeks run Monday → Sunday.
function getPeriodRange(period, dateInput) {
  const day = toDayStart(dateInput);
  if (!day) return null;
  if (period === 'daily') return { start: day, end: day };
  if (period === 'weekly') {
    const dow = day.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const start = new Date(day.getTime() + diffToMonday * MS_DAY);
    const end = new Date(start.getTime() + 6 * MS_DAY);
    return { start, end };
  }
  if (period === 'monthly') {
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
    return { start, end };
  }
  return null;
}

// The immediately preceding period of equal length — used to compute a trend.
function getPreviousPeriodRange(period, range) {
  if (period === 'monthly') {
    const start = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 0));
    return { start, end };
  }
  const span = range.end.getTime() - range.start.getTime() + MS_DAY;
  return { start: new Date(range.start.getTime() - span), end: new Date(range.end.getTime() - span) };
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

    const roster = await User.find({ _id: { $in: cls.students }, role: 'student' }, 'name email level trade').sort({ name: 1 }).lean();

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

        // ── Chronic absenteeism alert — tell the teacher when a student has
        // just hit 3 consecutive absent sessions in this class. ──────────
        const absentIds = cleanRecords.filter(r => r.status === 'absent').map(r => String(r.student_id));
        if (absentIds.length) {
          const recentSessions = await Attendance.find({ class_id: classId, date: { $lte: day } })
            .sort({ date: -1 }).limit(3).select('records date').lean();
          if (recentSessions.length >= 3) {
            const chronicIds = absentIds.filter(sid => recentSessions.every(sess => {
              const rec = sess.records.find(r => r.student_id.toString() === sid);
              return rec?.status === 'absent';
            }));
            if (chronicIds.length) {
              const chronicStudents = await User.find({ _id: { $in: chronicIds } }, 'name').lean();
              const names = chronicStudents.map(s => s.name).join(', ');
              await createInAppNotification({
                title: 'Attendance alert',
                message: `${names} ${chronicStudents.length > 1 ? 'have' : 'has'} now been absent for 3 consecutive sessions in ${cls.name}.`,
                type: 'warning',
                classId,
                teacherId: req.session.user.id,
                audience: 'teacher',
                linkType: 'attendance',
                linkId: session._id,
              });
            }
          }
        }
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

    const students = await User.find({ _id: { $in: cls.students }, role: 'student' }, 'name email level trade').sort({ name: 1 }).lean();
    const sessions = await Attendance.find({ class_id: classId }, 'records date').sort({ date: -1 }).lean();
    const totalSessions = sessions.length;

    const summary = students.map(s => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      let currentAbsentStreak = 0;
      let streakBroken = false;
      sessions.forEach(sess => {
        const rec = sess.records.find(r => r.student_id.toString() === s._id.toString());
        if (rec) {
          counts[rec.status] = (counts[rec.status] || 0) + 1;
          if (!streakBroken) {
            if (rec.status === 'absent') currentAbsentStreak++;
            else streakBroken = true;
          }
        }
      });
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      return {
        student_id: s._id, student_name: s.name, student_email: s.email,
        level: s.level, trade: s.trade,
        ...counts, attendance_rate: rate,
        current_absent_streak: currentAbsentStreak,
        at_risk: (rate != null && rate < 75) || currentAbsentStreak >= 3,
      };
    });

    summary.sort((a, b) => a.student_name.localeCompare(b.student_name));
    res.json({ total_sessions: totalSessions, summary });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/attendance/class/:classId/report?period=daily|weekly|monthly&date=
// A register-style grid: students (rows, A-Z) × session dates (columns) for the
// chosen period, plus class-level stats (average rate, at-risk students, best/
// worst day) for a printable/exportable teacher report.
const getClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { period = 'weekly', date } = req.query;
    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const range = getPeriodRange(period, date);
    if (!range) return res.status(400).json({ message: 'Invalid period. Use daily, weekly, or monthly.' });

    const [sessions, roster] = await Promise.all([
      Attendance.find({ class_id: classId, date: { $gte: range.start, $lte: range.end } }).sort({ date: 1 }).lean(),
      User.find({ _id: { $in: cls.students }, role: 'student' }, 'name email level trade').sort({ name: 1 }).lean(),
    ]);

    const sessionDates = sessions.map(s => isoDay(s.date));

    const students = roster.map(s => {
      const by_date = {};
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      sessions.forEach(sess => {
        const rec = sess.records.find(r => r.student_id.toString() === s._id.toString());
        const status = rec?.status || null;
        by_date[isoDay(sess.date)] = status;
        if (status) counts[status]++;
      });
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      return { student_id: s._id, name: s.name, email: s.email, level: s.level, trade: s.trade, by_date, counts, rate };
    });

    const rated = students.filter(s => s.rate != null);
    const averageRate = rated.length ? Math.round((rated.reduce((a, s) => a + s.rate, 0) / rated.length) * 10) / 10 : null;
    const atRisk = rated.filter(s => s.rate < 75).sort((a, b) => a.rate - b.rate)
      .map(s => ({ student_id: s.student_id, name: s.name, rate: s.rate }));

    let bestDay = null, worstDay = null;
    sessions.forEach(sess => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      sess.records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      if (rate == null) return;
      const entry = { date: sess.date, rate, counts };
      if (!bestDay || rate > bestDay.rate) bestDay = entry;
      if (!worstDay || rate < worstDay.rate) worstDay = entry;
    });

    res.json({
      period, start: range.start, end: range.end,
      class_name: cls.name,
      session_dates: sessionDates,
      students,
      class_stats: { average_rate: averageRate, total_sessions: sessions.length, at_risk: atRisk, best_day: bestDay, worst_day: worstDay },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/attendance/my/report?period=daily|weekly|monthly&date=&classId=
// A personal report: attendance for the chosen period, a same-length prior-
// period comparison for trend, and an all-time current "present" streak.
const getMyReport = async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const { period = 'weekly', date, classId } = req.query;
    const range = getPeriodRange(period, date);
    if (!range) return res.status(400).json({ message: 'Invalid period. Use daily, weekly, or monthly.' });
    const prevRange = getPreviousPeriodRange(period, range);

    const enrolledClasses = await Class.find({ students: new mongoose.Types.ObjectId(studentId) }, 'name').lean();
    const classIds = classId ? [classId] : enrolledClasses.map(c => c._id.toString());
    const classNameById = new Map(enrolledClasses.map(c => [c._id.toString(), c.name]));

    const summarize = (sessArr) => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      const days = [];
      sessArr.forEach(s => {
        const rec = s.records.find(r => r.student_id.toString() === studentId);
        if (!rec) return;
        counts[rec.status] = (counts[rec.status] || 0) + 1;
        days.push({
          date: s.date, class_id: s.class_id,
          class_name: classNameById.get(s.class_id.toString()) || null,
          status: rec.status, remarks: rec.remarks,
        });
      });
      days.sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending by date within the period
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      return { counts, rate, days };
    };

    const [sessions, prevSessions, allSessions] = await Promise.all([
      Attendance.find({ class_id: { $in: classIds }, date: { $gte: range.start, $lte: range.end } }).lean(),
      Attendance.find({ class_id: { $in: classIds }, date: { $gte: prevRange.start, $lte: prevRange.end } }).lean(),
      Attendance.find({ class_id: { $in: enrolledClasses.map(c => c._id.toString()) } }).sort({ date: -1 }).select('records').lean(),
    ]);

    const current = summarize(sessions);
    const previous = summarize(prevSessions);
    const trend = (current.rate != null && previous.rate != null) ? Math.round((current.rate - previous.rate) * 10) / 10 : null;

    // All-time current streak of consecutive 'present' sessions, most-recent first.
    let streak = 0;
    for (const s of allSessions) {
      const rec = s.records.find(r => r.student_id.toString() === studentId);
      if (!rec) continue;
      if (rec.status === 'present') streak++;
      else break;
    }

    res.json({ period, start: range.start, end: range.end, current, previous, trend, current_streak: streak });
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

    const sessions = await Attendance.find({ class_id: { $in: classIds } }).sort({ date: 1 }).lean();

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
  getSession, saveSession, getClassHistory, getClassSummary, getClassReport,
  deleteSession, getMyAttendance, getMyReport,
};
