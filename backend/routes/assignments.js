const router = require('express').Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { assignmentUpload } = require('../middleware/upload');
const {
  getAssignments, createAssignment, updateAssignment, deleteAssignment, toggleAssignmentStatus,
  downloadAssignment, viewAssignment, downloadAssignmentFile, viewAssignmentFile,
  submitAssignment, getSubmissions, downloadSubmission, viewSubmission,
  downloadSubmissionFile, viewSubmissionFile, gradeSubmission, getGradesReport,
  extendDeadline,
} = require('../controllers/assignmentController');

// Several files per request. 'files' is the field the app sends; 'file' is
// still accepted so older clients that send a single file keep working.
const manyFiles = assignmentUpload.fields([
  { name: 'files', maxCount: 10 },
  { name: 'file', maxCount: 10 },
]);

router.use(isAuthenticated);
router.get('/', getAssignments);
router.post('/', isTeacher, manyFiles, createAssignment);
router.put('/:id', isTeacher, manyFiles, updateAssignment);
router.patch('/:id/toggle-status', isTeacher, toggleAssignmentStatus);
router.patch('/:id/extend-deadline', isTeacher, extendDeadline);
router.delete('/:id', isTeacher, deleteAssignment);
router.get('/:id/download', downloadAssignment);
router.get('/:id/view', viewAssignment);
router.get('/:id/files/:fileId/download', downloadAssignmentFile);
router.get('/:id/files/:fileId/view', viewAssignmentFile);
router.post('/:id/submit', manyFiles, submitAssignment);
router.get('/:id/submissions', isTeacher, getSubmissions);
router.get('/:id/submissions/:submissionId/download', isTeacher, downloadSubmission);
router.get('/:id/submissions/:submissionId/view', isTeacher, viewSubmission);
router.get('/:id/submissions/:submissionId/files/:fileId/download', isTeacher, downloadSubmissionFile);
router.get('/:id/submissions/:submissionId/files/:fileId/view', isTeacher, viewSubmissionFile);
router.put('/:id/submissions/:submissionId/grade', isTeacher, gradeSubmission);
router.get('/:id/grades-report', isTeacher, getGradesReport);

module.exports = router;
