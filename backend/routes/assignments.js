const router = require('express').Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { assignmentUpload } = require('../middleware/upload');
const {
  getAssignments, createAssignment, updateAssignment, deleteAssignment, downloadAssignment, viewAssignment,
  submitAssignment, getSubmissions, downloadSubmission, viewSubmission, gradeSubmission, getGradesReport
} = require('../controllers/assignmentController');

router.use(isAuthenticated);
router.get('/', getAssignments);
router.post('/', isTeacher, assignmentUpload.single('file'), createAssignment);
router.put('/:id', isTeacher, assignmentUpload.single('file'), updateAssignment);
router.delete('/:id', isTeacher, deleteAssignment);
router.get('/:id/download', downloadAssignment);
router.get('/:id/view', viewAssignment);
router.post('/:id/submit', assignmentUpload.single('file'), submitAssignment);
router.get('/:id/submissions', isTeacher, getSubmissions);
router.get('/:id/submissions/:submissionId/download', isTeacher, downloadSubmission);
router.get('/:id/submissions/:submissionId/view', isTeacher, viewSubmission);
router.put('/:id/submissions/:submissionId/grade', isTeacher, gradeSubmission);
router.get('/:id/grades-report', isTeacher, getGradesReport);

module.exports = router;
