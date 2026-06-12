const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, isTeacher } = require('../middleware/auth');
const ctrl = require('../controllers/assessmentController');

// ── ADMIN routes ─────────────────────────────────────────────────────────
router.get('/admin/courses',             isAuthenticated, isAdmin, ctrl.adminGetCourses);
router.post('/admin/courses',            isAuthenticated, isAdmin, ctrl.adminCreateCourse);
router.put('/admin/courses/:id',         isAuthenticated, isAdmin, ctrl.adminUpdateCourse);
router.delete('/admin/courses/:id',      isAuthenticated, isAdmin, ctrl.adminDeleteCourse);

// Admin reports
router.get('/admin/reports/student/:studentId',        isAuthenticated, isAdmin, ctrl.adminStudentReport);
router.get('/admin/reports/assessment/:assessmentId',  isAuthenticated, isAdmin, ctrl.adminAssessmentReport);
router.get('/admin/reports/class/:classId',            isAuthenticated, isAdmin, ctrl.adminClassReport);

// Admin can also list all assessments (read-only)
router.get('/admin/assessments', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { Course, Assessment } = require('../models/db');
    // Only show assessments for courses this admin created
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id);
    const assessments = await Assessment.find({ course_id: { $in: courseIds } })
      .populate('course_id', 'name code')
      .populate('teacher_id', 'name')
      .sort({ created_at: -1 })
      .lean();
    res.json({ assessments: assessments.map(a => ({ ...a, id: a._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin — assessment submission review workflow
router.get('/admin/submissions',                          isAuthenticated, isAdmin, ctrl.adminListSubmissions);
router.get('/admin/submissions/:assessmentId',             isAuthenticated, isAdmin, ctrl.adminViewSubmission);
router.post('/admin/submissions/:assessmentId/approve',    isAuthenticated, isAdmin, ctrl.adminApproveSubmission);
router.post('/admin/submissions/:assessmentId/reject',     isAuthenticated, isAdmin, ctrl.adminRejectSubmission);

// ── TEACHER routes ────────────────────────────────────────────────────────
router.get('/teacher/courses',           isAuthenticated, isTeacher, ctrl.teacherGetCourses);
router.get('/teacher/assessments',       isAuthenticated, isTeacher, ctrl.teacherGetAssessments);
router.post('/teacher/assessments',      isAuthenticated, isTeacher, ctrl.teacherCreateAssessment);
router.put('/teacher/assessments/:id',   isAuthenticated, isTeacher, ctrl.teacherUpdateAssessment);
router.delete('/teacher/assessments/:id',isAuthenticated, isTeacher, ctrl.teacherDeleteAssessment);

router.get('/teacher/assessments/:id/marks',  isAuthenticated, isTeacher, ctrl.teacherGetMarks);
router.post('/teacher/assessments/:id/marks', isAuthenticated, isTeacher, ctrl.teacherSaveMarks);
router.post('/teacher/assessments/:id/submit',isAuthenticated, isTeacher, ctrl.teacherSubmitMarks);
router.get('/teacher/reports/:assessmentId',  isAuthenticated, isTeacher, ctrl.teacherAssessmentReport);

module.exports = router;
