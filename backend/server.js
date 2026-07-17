require('dotenv').config();
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
  const { Class, Document, Assignment, Submission, Announcement, Assessment, Mark, Course, AssessmentSubmission } = require('./models/db');
  const mongoose = require('mongoose');
  const teacherId = new mongoose.Types.ObjectId(req.user.id);

  try {
    const [classes, docs, assignments, announcements, assessments, modules] = await Promise.all([
      Class.countDocuments({ $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] }),
      Document.countDocuments({ teacher_id: teacherId }),
      Assignment.countDocuments({ teacher_id: teacherId }),
      Announcement.countDocuments({ teacher_id: teacherId }),
      Assessment.countDocuments({ teacher_id: teacherId }),
      Course.countDocuments({ teacher_id: teacherId }),
    ]);

    const teacherClasses = await Class.find(
      { $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] },
      '_id students'
    );
    const studentSet = new Set();
    teacherClasses.forEach(c => c.students.forEach(s => studentSet.add(s.toString())));
    const students = studentSet.size;

    const counts = { classes, students, documents: docs, assignments, announcements, assessments, modules };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const assignmentIds = (await Assignment.find({ teacher_id: teacherId }, '_id')).map(a => a._id);

    const submissionTrend = await Submission.aggregate([
      { $match: { assignment_id: { $in: assignmentIds }, submitted_at: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$submitted_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    const gradedSubs = await Submission.find({ assignment_id: { $in: assignmentIds }, score: { $ne: null } }, 'score');
    const gradeDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    gradedSubs.forEach(s => {
      if (s.score >= 90) gradeDistribution.excellent++;
      else if (s.score >= 70) gradeDistribution.good++;
      else if (s.score >= 50) gradeDistribution.average++;
      else gradeDistribution.poor++;
    });

    const topStudents = await Submission.aggregate([
      { $match: { assignment_id: { $in: assignmentIds }, score: { $ne: null } } },
      { $group: { _id: '$student_id', submissions: { $sum: 1 }, avg_score: { $avg: '$score' } } },
      { $sort: { avg_score: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { id: '$_id', name: '$user.name', submissions: 1, avg_score: 1, _id: 0 } },
    ]);

    // Assessment (marks) grade distribution across all my assessments
    const myAssessmentIds = (await Assessment.find({ teacher_id: teacherId }, '_id')).map(a => a._id);
    const myMarks = await Mark.find({ assessment_id: { $in: myAssessmentIds }, marks_obtained: { $ne: null } })
      .populate('assessment_id', 'total_marks').lean();
    const assessmentGradeDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    myMarks.forEach(m => {
      const total = m.assessment_id?.total_marks || 100;
      const pct = (m.marks_obtained / total) * 100;
      if (pct >= 75) assessmentGradeDistribution.excellent++;
      else if (pct >= 60) assessmentGradeDistribution.good++;
      else if (pct >= 40) assessmentGradeDistribution.average++;
      else assessmentGradeDistribution.poor++;
    });

    // Recent assessments by this teacher
    const recentAssessments = await Assessment.find({ teacher_id: teacherId })
      .sort({ created_at: -1 }).limit(5)
      .populate('course_id', 'name')
      .populate('class_id', 'name')
      .lean();

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
      submissionTrend,
      gradeDistribution,
      topStudents,
      assessmentGradeDistribution,
      recentAssessments: recentAssessments.map(a => ({
        id: a._id,
        type: a.type,
        term: a.term,
        academic_year: a.academic_year,
        course_name: a.course_id?.name,
        class_name: a.class_id?.name,
        total_marks: a.total_marks,
        status: a.status,
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