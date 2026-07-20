const mongoose = require('mongoose');
const { Attendance, Class, User } = require('../models/db');
const { createDirectNotification, createInAppNotification } = require('../services/notificationHelpers');

// Normalize any date/string to midnight UTC so "2025-01-10" and a Date object
// for the same calendar day always collide when matching sessions.
function toDayStart(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const MS_DAY = 24 * 60 * 60 * 1000;

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

function tallyCounts(records) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  return counts;
}

async function namesById(ids) {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }, 'name').lean();
  return new Map(users.map(u => [u._id.toString(), u.name]));
}

// GET /api/attendance/session?classId=&date=
// Every teacher assigned to a class takes their OWN attendance session for a
// given day — a class may be visited by several teachers across different
// periods, and each one's session is independent (one teacher's entry never
// blocks or overwrites another's). Returns this teacher's saved session for
// that class+date, or — if they haven't taken it yet — the class roster
// defaulted to 'present' so they can fill it in from scratch. Also surfaces
// any *other* teachers' sessions already taken that same day, for awareness.
const getSession = async (req, res) => {
  try {
    const { classId, date } = req.query;
    if (!classId || !date) return res.status(400).json({ message: 'classId and date are required' });

    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const day = toDayStart(date);
    if (!day) return res.status(400).json({ message: 'Invalid date' });

    const roster = await User.find({ _id: { $in: cls.students }, role: 'student' }, 'name level trade').sort({ name: 1 }).lean();

    const [existing, otherSessions] = await Promise.all([
      Attendance.findOne({ class_id: classId, date: day, teacher_id: req.session.user.id }).lean(),
      Attendance.find({ class_id: classId, date: day, teacher_id: { $ne: req.session.user.id } }).lean(),
    ]);
    const recordByStudent = new Map((existing?.records || []).map(r => [r.student_id.toString(), r]));

    const records = roster.map(s => ({
      student_id: s._id,
      name: s.name,
      level: s.level,
      trade: s.trade,
      status: recordByStudent.get(s._id.toString())?.status || 'present',
      remarks: recordByStudent.get(s._id.toString())?.remarks || null,
    }));

    let otherSessionsInfo = [];
    if (otherSessions.length) {
      const teacherNames = await namesById(otherSessions.map(s => s.teacher_id));
      otherSessionsInfo = otherSessions.map(s => ({
        teacher_name: teacherNames.get(s.teacher_id.toString()) || 'Another teacher',
        counts: tallyCounts(s.records),
      }));
    }

    res.json({
      id: existing?._id || null,
      class_id: classId,
      date: day,
      already_taken: !!existing,
      records,
      other_sessions: otherSessionsInfo,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/attendance/session  { classId, date, records: [{ student_id, status, remarks }] }
// Upserts THIS teacher's session for that class+date — independent of any
// session another teacher has already taken for the same class and day.
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

    const filter = { class_id: classId, date: day, teacher_id: req.session.user.id };
    const wasExisting = await Attendance.findOne(filter, '_id').lean();

    const session = await Attendance.findOneAndUpdate(
      filter,
      { ...filter, records: cleanRecords, created_by: req.session.user.id },
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

        // ── Chronic absenteeism alert — tell this teacher when a student has
        // just missed their last 3 sessions in a row (scoped to sessions THIS
        // teacher has taken, since another teacher's sessions are a separate
        // series). ─────────────────────────────────────────────────────────
        const absentIds = cleanRecords.filter(r => r.status === 'absent').map(r => String(r.student_id));
        if (absentIds.length) {
          const recentSessions = await Attendance.find({ class_id: classId, teacher_id: req.session.user.id, date: { $lte: day } })
            .sort({ date: -1 }).limit(3).select('records date').lean();
          if (recentSessions.length >= 3) {
            const chronicIds = absentIds.filter(sid => recentSessions.every(sess => {
              const rec = sess.records.find(r => r.student_id.toString() === sid);
              return rec?.status === 'absent';
            }));
            if (chronicIds.length) {
              const chronicNames = await namesById(chronicIds);
              const names = [...chronicNames.values()].join(', ');
              await createInAppNotification({
                title: 'Attendance alert',
                message: `${names} ${chronicIds.length > 1 ? 'have' : 'has'} now been absent for 3 consecutive sessions in ${cls.name}.`,
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

// GET /api/attendance/class/:classId?scope=all|mine — paginated session history.
// Since sessions are per-teacher, the same day can list several entries (one
// per teacher who took attendance); each is tagged with who took it.
const getClassHistory = async (req, res) => {
  try {
    const { classId } = req.params;
    const { page = 1, limit = 15, scope = 'all' } = req.query;
    const skip = (page - 1) * limit;

    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const filter = { class_id: classId };
    if (scope === 'mine') filter.teacher_id = req.session.user.id;

    const [sessions, total] = await Promise.all([
      Attendance.find(filter).sort({ date: -1, created_at: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Attendance.countDocuments(filter),
    ]);

    const teacherNames = await namesById(sessions.map(s => s.teacher_id));

    const result = sessions.map(s => ({
      id: s._id,
      date: s.date,
      teacher_name: teacherNames.get(s.teacher_id.toString()) || 'Teacher',
      mine: s.teacher_id.toString() === req.session.user.id,
      total: s.records.length,
      counts: tallyCounts(s.records),
    }));

    res.json({ sessions: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/attendance/class/:classId/summary — per-student totals across ALL
// sessions taken for the class, by any assigned teacher.
const getClassSummary = async (req, res) => {
  try {
    const { classId } = req.params;
    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const students = await User.find({ _id: { $in: cls.students }, role: 'student' }, 'name level trade').sort({ name: 1 }).lean();
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
        student_id: s._id, student_name: s.name,
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

// GET /api/attendance/class/:classId/report?period=daily|weekly|monthly&date=&scope=all|mine
// A register-style grid: students (rows, A→Z) × sessions (columns) for the
// chosen period — each column is one teacher's session on one day, since a
// class can have more than one session per day. Plus class-level stats
// (average rate, at-risk students, best/worst day) for a printable/
// exportable teacher report.
const getClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const { period = 'weekly', date, scope = 'all' } = req.query;
    const cls = await assertTeacherOwnsClass(classId, req.session.user.id);
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const range = getPeriodRange(period, date);
    if (!range) return res.status(400).json({ message: 'Invalid period. Use daily, weekly, or monthly.' });

    const filter = { class_id: classId, date: { $gte: range.start, $lte: range.end } };
    if (scope === 'mine') filter.teacher_id = req.session.user.id;

    const [sessions, roster] = await Promise.all([
      Attendance.find(filter).sort({ date: 1, created_at: 1 }).lean(),
      User.find({ _id: { $in: cls.students }, role: 'student' }, 'name level trade').sort({ name: 1 }).lean(),
    ]);

    const teacherNames = await namesById(sessions.map(s => s.teacher_id));
    const sessionMeta = sessions.map(s => ({
      id: s._id.toString(),
      date: s.date,
      teacher_name: teacherNames.get(s.teacher_id.toString()) || 'Teacher',
    }));

    const students = roster.map(s => {
      const by_session = {};
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      sessions.forEach(sess => {
        const rec = sess.records.find(r => r.student_id.toString() === s._id.toString());
        const status = rec?.status || null;
        by_session[sess._id.toString()] = status;
        if (status) counts[status]++;
      });
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      return { student_id: s._id, name: s.name, level: s.level, trade: s.trade, by_session, counts, rate };
    });

    const rated = students.filter(s => s.rate != null);
    const averageRate = rated.length ? Math.round((rated.reduce((a, s) => a + s.rate, 0) / rated.length) * 10) / 10 : null;
    const atRisk = rated.filter(s => s.rate < 75).sort((a, b) => a.rate - b.rate)
      .map(s => ({ student_id: s.student_id, name: s.name, rate: s.rate }));

    let bestDay = null, worstDay = null;
    sessions.forEach(sess => {
      const counts = tallyCounts(sess.records);
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      if (rate == null) return;
      const entry = { date: sess.date, teacher_name: teacherNames.get(sess.teacher_id.toString()) || 'Teacher', rate, counts };
      if (!bestDay || rate > bestDay.rate) bestDay = entry;
      if (!worstDay || rate < worstDay.rate) worstDay = entry;
    });

    res.json({
      period, start: range.start, end: range.end,
      class_name: cls.name,
      sessions: sessionMeta,
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

    const [sessions, prevSessions, allSessions] = await Promise.all([
      Attendance.find({ class_id: { $in: classIds }, date: { $gte: range.start, $lte: range.end } }).lean(),
      Attendance.find({ class_id: { $in: classIds }, date: { $gte: prevRange.start, $lte: prevRange.end } }).lean(),
      Attendance.find({ class_id: { $in: enrolledClasses.map(c => c._id.toString()) } }).sort({ date: -1 }).select('records teacher_id').lean(),
    ]);

    const teacherNames = await namesById([...sessions, ...prevSessions].map(s => s.teacher_id));

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
          teacher_name: teacherNames.get(s.teacher_id.toString()) || null,
          status: rec.status, remarks: rec.remarks,
        });
      });
      days.sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending by date within the period
      const marked = counts.present + counts.absent + counts.late + counts.excused;
      const rate = marked ? Math.round((counts.present / marked) * 1000) / 10 : null;
      return { counts, rate, days };
    };

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
    const teacherNames = await namesById(sessions.map(s => s.teacher_id));

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
        teacher_name: teacherNames.get(s.teacher_id.toString()) || null,
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
