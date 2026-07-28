require('dotenv').config();
console.log(
  process.env.GEMINI_API_KEY
    ? `GEMINI_API_KEY loaded (ends in ...${process.env.GEMINI_API_KEY.slice(-4)}) — AI question generation is enabled.`
    : 'GEMINI_API_KEY is NOT set — AI question generation will return an error until it is added to backend/.env (get a free key, no card required, at https://aistudio.google.com/apikey) and the server is restarted.'
);
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { connectDB } = require('./models/db');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Maintenance mode ──────────────────────────────────────────────────────
// Global gate: when the super admin turns maintenance mode on, every request
// below is blocked (503) for everyone except the super admin. Mounted before
// the routes so it can't accidentally be skipped by adding a new route file.
const { maintenanceGate } = require('./middleware/maintenance');
app.use(maintenanceGate);
app.use('/api/system', require('./routes/system'));

// ── Static uploads ────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/classes',       require('./routes/classes'));
app.use('/api/students',      require('./routes/students'));
app.use('/api/documents',     require('./routes/documents'));
app.use('/api/assignments',   require('./routes/assignments'));
app.use('/api/assessment',   require('./routes/assessments_new'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/group-discussions', require('./routes/groupDiscussions'));
app.use('/api/collaborations', require('./routes/collaborations'));
app.use('/api/teacher-messages', require('./routes/teacherMessages'));
app.use('/api/notifications',     require('./routes/notifications'));

// ── Analytics ─────────────────────────────────────────────────────────────
const { isAuthenticated, isTeacher } = require('./middleware/auth');

app.get('/api/analytics', isAuthenticated, isTeacher, async (req, res) => {
  const { Class, Document, Announcement, Assessment, Mark, Course, AssessmentSubmission, AssessmentAttempt, DiscussionGroup } = require('./models/db');
  const mongoose = require('mongoose');
  const teacherId = new mongoose.Types.ObjectId(req.user.id);

  try {
    const [classes, docs, announcements, assessments, modules, groups, onlineAssessments] = await Promise.all([
      Class.countDocuments({ $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] }),
      Document.countDocuments({ teacher_id: teacherId }),
      Announcement.countDocuments({ teacher_id: teacherId }),
      Assessment.countDocuments({ teacher_id: teacherId }),
      Course.countDocuments({ teacher_id: teacherId }),
      DiscussionGroup.countDocuments({ teacher_id: teacherId }),
      Assessment.countDocuments({ teacher_id: teacherId, is_shared: true }),
    ]);

    const teacherClasses = await Class.find(
      { $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] },
      '_id students'
    );
    const studentSet = new Set();
    teacherClasses.forEach(c => c.students.forEach(s => studentSet.add(s.toString())));
    const students = studentSet.size;

    const counts = { classes, students, documents: docs, announcements, assessments, modules, groups, onlineAssessments };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Assessment performance — covers BOTH manually-entered marks AND
    // online quizzes (a graded quiz attempt's best score is auto-copied into
    // Mark by the quiz grading flow), so this one source covers "assessment
    // marks recorded by teacher" and "student's online assessment attempts"
    // at once. `marks` (not `approved_marks`) is used here — the teacher's
    // own dashboard should reflect the latest recorded/computed score, not
    // just the subset that's already been through admin approval.
    const myAssessments = await Assessment.find({ teacher_id: teacherId })
      .select('_id title type term academic_year max_marks mode class_id course_id')
      .populate('class_id', 'name')
      .populate('course_id', 'name')
      .lean();
    const myAssessmentIds = myAssessments.map(a => a._id);
    const assessmentById = {};
    myAssessments.forEach(a => { assessmentById[a._id.toString()] = a; });

    const allAssessmentMarks = await Mark.find({ assessment_id: { $in: myAssessmentIds }, marks: { $ne: null } })
      .populate('student_id', 'name')
      .lean();

    // Grade-band distribution across every assessment (marks-mode + quiz-mode alike)
    const assessmentGradeDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    allAssessmentMarks.forEach(m => {
      const a = assessmentById[m.assessment_id.toString()];
      if (!a || !a.max_marks) return;
      const pct = (m.marks / a.max_marks) * 100;
      if (pct >= 75) assessmentGradeDistribution.excellent++;
      else if (pct >= 60) assessmentGradeDistribution.good++;
      else if (pct >= 40) assessmentGradeDistribution.average++;
      else assessmentGradeDistribution.poor++;
    });

    // Top scorers across all assessments — average percentage per student
    // over every assessment they have a recorded mark for.
    const studentAgg = {};
    allAssessmentMarks.forEach(m => {
      const a = assessmentById[m.assessment_id.toString()];
      if (!a || !a.max_marks || !m.student_id) return;
      const sid = m.student_id._id.toString();
      if (!studentAgg[sid]) studentAgg[sid] = { id: sid, name: m.student_id.name, obtained: 0, max: 0, count: 0 };
      studentAgg[sid].obtained += m.marks;
      studentAgg[sid].max += a.max_marks;
      studentAgg[sid].count += 1;
    });
    const assessmentTopStudents = Object.values(studentAgg)
      .map(s => ({ id: s.id, name: s.name, assessments_taken: s.count, avg_score: s.max > 0 ? Math.round((s.obtained / s.max) * 100) : 0 }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 5);

    // Top class performance — average percentage per class across all of
    // this teacher's assessments for that class.
    const classAgg = {};
    allAssessmentMarks.forEach(m => {
      const a = assessmentById[m.assessment_id.toString()];
      if (!a || !a.max_marks || !a.class_id) return;
      const cid = a.class_id._id.toString();
      if (!classAgg[cid]) classAgg[cid] = { id: cid, name: a.class_id.name, obtained: 0, max: 0, students: new Set() };
      classAgg[cid].obtained += m.marks;
      classAgg[cid].max += a.max_marks;
      if (m.student_id) classAgg[cid].students.add(m.student_id._id.toString());
    });
    const classPerformance = Object.values(classAgg)
      .map(c => ({ id: c.id, name: c.name, avg_score: c.max > 0 ? Math.round((c.obtained / c.max) * 100) : 0, students_graded: c.students.size }))
      .sort((a, b) => b.avg_score - a.avg_score);

    // Online quiz participation — how many students have actually attempted
    // the online assessments this teacher has shared, separate from marks
    // that were typed in manually.
    const quizAssessmentIds = myAssessments.filter(a => a.mode === 'quiz').map(a => a._id);
    const [totalAttempts, gradedAttempts, needsManualGrading, inProgressAttempts, attemptedStudentIds] = await Promise.all([
      AssessmentAttempt.countDocuments({ assessment_id: { $in: quizAssessmentIds }, voided: { $ne: true } }),
      AssessmentAttempt.countDocuments({ assessment_id: { $in: quizAssessmentIds }, status: 'graded', voided: { $ne: true } }),
      AssessmentAttempt.countDocuments({ assessment_id: { $in: quizAssessmentIds }, needs_manual_grading: true, status: { $ne: 'graded' }, voided: { $ne: true } }),
      AssessmentAttempt.countDocuments({ assessment_id: { $in: quizAssessmentIds }, status: 'in_progress', voided: { $ne: true } }),
      AssessmentAttempt.distinct('student_id', { assessment_id: { $in: quizAssessmentIds }, voided: { $ne: true } }),
    ]);

    // ── Deeper online-quiz analytics — student attempt behavior and
    // performance, distinct from the manually-recorded assessment marks
    // above. Pulled straight from AssessmentAttempt (not Mark), so it can
    // surface things Mark doesn't carry: completion rate against class size,
    // auto-submit rate (timeouts / left-screen), and a per-quiz breakdown.
    const classStudentCount = {};
    teacherClasses.forEach(c => { classStudentCount[c._id.toString()] = c.students.length; });

    const allQuizAttempts = await AssessmentAttempt.find({ assessment_id: { $in: quizAssessmentIds }, voided: { $ne: true } })
      .select('assessment_id student_id total_score status submitted_at auto_submitted needs_manual_grading')
      .lean();

    // Grade-band distribution + overall average, based on each attempt's
    // total_score against that quiz's max_marks — graded attempts only.
    const onlineQuizGradeDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    let quizObtainedSum = 0, quizMaxSum = 0;
    allQuizAttempts.forEach(a => {
      if (a.status !== 'graded' || a.total_score === null) return;
      const assess = assessmentById[a.assessment_id.toString()];
      if (!assess || !assess.max_marks) return;
      const pct = (a.total_score / assess.max_marks) * 100;
      quizObtainedSum += a.total_score;
      quizMaxSum += assess.max_marks;
      if (pct >= 75) onlineQuizGradeDistribution.excellent++;
      else if (pct >= 60) onlineQuizGradeDistribution.good++;
      else if (pct >= 40) onlineQuizGradeDistribution.average++;
      else onlineQuizGradeDistribution.poor++;
    });
    const quizAvgScore = quizMaxSum > 0 ? Math.round((quizObtainedSum / quizMaxSum) * 100) : null;

    // Auto-submit rate: attempts the student didn't consciously submit
    // themselves (ran out of time, or left the exam screen) — an engagement
    // red flag that Mark-based analytics can't show.
    const autoSubmittedCount = allQuizAttempts.filter(a => a.auto_submitted).length;
    const autoSubmitRate = allQuizAttempts.length ? Math.round((autoSubmittedCount / allQuizAttempts.length) * 100) : 0;

    // Per-quiz breakdown: completion against that quiz's class roster, plus
    // its own average score — lets a teacher spot which specific quiz is
    // under-attempted or scoring low, rather than only a blended total.
    const attemptsByAssessment = {};
    allQuizAttempts.forEach(a => {
      const key = a.assessment_id.toString();
      if (!attemptsByAssessment[key]) attemptsByAssessment[key] = { students: new Set(), scores: [], count: 0, autoSubmitted: 0 };
      const bucket = attemptsByAssessment[key];
      bucket.count += 1;
      bucket.students.add(a.student_id.toString());
      if (a.auto_submitted) bucket.autoSubmitted += 1;
      if (a.status === 'graded' && a.total_score !== null) bucket.scores.push(a.total_score);
    });

    let sumEligible = 0, sumAttemptedStudents = 0;
    const onlineQuizPerAssessment = quizAssessmentIds.map(id => {
      const key = id.toString();
      const a = assessmentById[key];
      const bucket = attemptsByAssessment[key] || { students: new Set(), scores: [], count: 0, autoSubmitted: 0 };
      const eligible = a?.class_id ? (classStudentCount[a.class_id._id.toString()] || 0) : 0;
      sumEligible += eligible;
      sumAttemptedStudents += bucket.students.size;
      const avgScore = (bucket.scores.length && a?.max_marks)
        ? Math.round(((bucket.scores.reduce((s, v) => s + v, 0) / bucket.scores.length) / a.max_marks) * 100)
        : null;
      return {
        id: key,
        title: a?.title,
        class_name: a?.class_id?.name,
        attempts: bucket.count,
        studentsAttempted: bucket.students.size,
        eligible,
        completionRate: eligible ? Math.round((bucket.students.size / eligible) * 100) : 0,
        avgScore,
      };
    }).sort((x, y) => y.attempts - x.attempts).slice(0, 6);

    const quizCompletionRate = sumEligible ? Math.round((sumAttemptedStudents / sumEligible) * 100) : 0;

    // Online quiz submission trend (last 30 days) — a student actually
    // finishing an attempt, separate from the assessmentTrend line which
    // only reflects graded/recorded marks.
    const onlineQuizTrend = await AssessmentAttempt.aggregate([
      { $match: { assessment_id: { $in: quizAssessmentIds }, voided: { $ne: true }, submitted_at: { $ne: null, $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$submitted_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    const onlineQuizStats = {
      quizAssessments: quizAssessmentIds.length,
      totalAttempts,
      gradedAttempts,
      needsManualGrading,
      inProgress: inProgressAttempts,
      studentsAttempted: attemptedStudentIds.length,
      avgScore: quizAvgScore,
      completionRate: quizCompletionRate,
      autoSubmitRate,
    };

    // Assessment activity trend (last 30 days) — every recorded Mark, which
    // covers a manually-entered mark AND an online quiz attempt's score
    // being copied in once graded, so this is a single trend line for all
    // assessment activity, with no assignment data mixed in.
    const assessmentTrend = await Mark.aggregate([
      { $match: { assessment_id: { $in: myAssessmentIds }, marks: { $ne: null }, created_at: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    // Recent assessments by this teacher, with their real review status
    const recentAssessments = await Assessment.find({ teacher_id: teacherId })
      .sort({ created_at: -1 }).limit(5)
      .populate('course_id', 'name')
      .populate('class_id', 'name')
      .lean();
    const recentAssessmentIds = recentAssessments.map(a => a._id);
    const recentStatuses = await AssessmentSubmission.find(
      { assessment_id: { $in: recentAssessmentIds } }, 'assessment_id status'
    ).lean();
    const statusByAssessment = {};
    recentStatuses.forEach(s => { statusByAssessment[s.assessment_id.toString()] = s.status; });

    // Assessment submission statuses
    const pendingAssessments = await AssessmentSubmission.countDocuments({
      assessment_id: { $in: myAssessmentIds }, status: 'submitted'
    });
    const approvedAssessments = await AssessmentSubmission.countDocuments({
      assessment_id: { $in: myAssessmentIds }, status: 'approved'
    });

    // Modules (courses) with student count per class
    const myModules = await Course.find({ teacher_id: teacherId })
      .populate('class_ids', 'name students').limit(5).lean();
    const moduleSummary = myModules.map(m => ({
      id: m._id,
      name: m.name,
      code: m.code,
      category: m.category,
      classCount: m.class_ids?.length || 0,
      studentCount: m.class_ids?.reduce((sum, c) => sum + (c.students?.length || 0), 0) || 0,
    }));

    res.json({
      counts,
      assessmentTrend,
      assessmentGradeDistribution,
      assessmentTopStudents,
      classPerformance,
      onlineQuizStats,
      onlineQuizGradeDistribution,
      onlineQuizPerAssessment,
      onlineQuizTrend,
      recentAssessments: recentAssessments.map(a => ({
        id: a._id,
        type: a.type,
        term: a.term,
        academic_year: a.academic_year,
        course_name: a.course_id?.name,
        class_name: a.class_id?.name,
        max_marks: a.max_marks,
        status: statusByAssessment[a._id.toString()] || 'draft',
        created_at: a.created_at,
      })),
      assessmentStats: { pending: pendingAssessments, approved: approvedAssessments },
      moduleSummary,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


// ── Admin Analytics — handled in routes/admin.js ──────────────────────────
// (kept as a no-op placeholder; real handler lives in the admin router)


// ── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Ensure the oldest admin is marked as super admin ──────────────────────
async function ensureSuperAdmin() {
  try {
    const { User } = require('./models/db');
    const hasSuperAdmin = await User.exists({ role: 'admin', is_super_admin: true });
    if (!hasSuperAdmin) {
      const first = await User.findOne({ role: 'admin' }).sort({ created_at: 1, _id: 1 });
      if (first) {
        await User.updateOne({ _id: first._id }, { is_super_admin: true });
        console.log(`✅ Super admin set: ${first.email}`);
      }
    }
  } catch (err) {
    console.error('ensureSuperAdmin error:', err.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(async () => {
  await ensureSuperAdmin();

  // Notifications older than 2 days are already hidden from every user's
  // panel at query time; this sweep just deletes them for good so the
  // collection doesn't grow forever. Runs once on boot, then every hour.
  const { sweepOldNotifications } = require('./controllers/notificationController');
  sweepOldNotifications();
  setInterval(sweepOldNotifications, 60 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`EDUPLA running on port ${PORT}`));
  }
}).catch(err => { console.error('DB connection failed:', err); process.exit(1); });

module.exports = app;