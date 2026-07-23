const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, isTeacher } = require('../middleware/auth');
const { excelUpload } = require('../middleware/upload');
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
      .populate('class_id', 'name')
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

// Excel marks template download / upload
router.get('/teacher/assessments/:id/marks/template', isAuthenticated, isTeacher, ctrl.teacherDownloadMarksTemplate);
router.post('/teacher/assessments/:id/marks/upload',  isAuthenticated, isTeacher, excelUpload.single('file'), ctrl.teacherUploadMarks);
router.get('/teacher/reports/:assessmentId',  isAuthenticated, isTeacher, ctrl.teacherAssessmentReport);

// ── TEACHER: online-quiz feature (question builder, sharing, grading) ─────
router.get('/teacher/assessments/:id/questions',        isAuthenticated, isTeacher, ctrl.teacherGetQuestions);
router.post('/teacher/assessments/:id/questions',       isAuthenticated, isTeacher, ctrl.teacherSaveQuestions);
router.post('/teacher/assessments/:id/share',           isAuthenticated, isTeacher, ctrl.teacherShareAssessment);
router.post('/teacher/assessments/:id/unshare',         isAuthenticated, isTeacher, ctrl.teacherUnshareAssessment);
router.post('/teacher/assessments/:id/attempts/add',    isAuthenticated, isTeacher, ctrl.teacherAddAttempts);
router.get('/teacher/assessments/:id/attempts',         isAuthenticated, isTeacher, ctrl.teacherListAttempts);

// Overall (combined) results — every shared assessment of one type/term/year
// in a module+class, combined into a single scaled result per student.
router.get('/teacher/assessments/overall',              isAuthenticated, isTeacher, ctrl.teacherGetOverallResults);
router.get('/teacher/assessments/overall/excel',        isAuthenticated, isTeacher, ctrl.teacherDownloadOverallExcel);
router.get('/teacher/assessments/overall/pdf',          isAuthenticated, isTeacher, ctrl.teacherDownloadOverallPdf);
router.get('/teacher/assessments/:id/attempts/excel',   isAuthenticated, isTeacher, ctrl.teacherDownloadAttemptsExcel);
router.get('/teacher/assessments/:id/attempts/pdf',     isAuthenticated, isTeacher, ctrl.teacherDownloadAttemptsPdf);
router.get('/teacher/attempts/:attemptId',               isAuthenticated, isTeacher, ctrl.teacherGetAttemptForGrading);
router.post('/teacher/attempts/:attemptId/grade',        isAuthenticated, isTeacher, ctrl.teacherGradeOpenAnswers);

// Student: get all courses assigned to their class
const { isStudent } = require('../middleware/auth');
router.get('/student/courses', isAuthenticated, isStudent, ctrl.studentGetCourses);

// ── STUDENT: online-quiz feature (browse, attempt, submit) ────────────────
router.get('/student/assessments',                      isAuthenticated, isStudent, ctrl.studentGetSharedAssessments);
router.get('/student/assessments/:id/instructions',     isAuthenticated, isStudent, ctrl.studentGetAssessmentInstructions);
router.post('/student/assessments/:id/start',           isAuthenticated, isStudent, ctrl.studentStartAttempt);
router.get('/student/attempts/:attemptId',                isAuthenticated, isStudent, ctrl.studentGetAttempt);
router.post('/student/attempts/:attemptId/answer',        isAuthenticated, isStudent, ctrl.studentSaveAnswer);
router.post('/student/attempts/:attemptId/submit',          isAuthenticated, isStudent, ctrl.studentSubmitAttempt);
router.post('/student/attempts/:attemptId/auto-submit',     isAuthenticated, isStudent, ctrl.studentAutoSubmitAttempt);

module.exports = router;