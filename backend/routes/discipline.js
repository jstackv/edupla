const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher, isAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/disciplineController');

// Teacher — only meaningful for whichever class(es) this user is the
// class teacher of; enforced again inside each controller function.
router.get('/my-classes',                     isAuthenticated, isTeacher, ctrl.teacherMyClassTeacherClasses);
router.get('/class/:classId',                 isAuthenticated, isTeacher, ctrl.teacherGetDisciplineSheet);
router.post('/class/:classId/save',           isAuthenticated, isTeacher, ctrl.teacherSaveDisciplineSheet);
router.post('/class/:classId/submit',         isAuthenticated, isTeacher, ctrl.teacherSubmitDisciplineSheet);

// Admin — review/approve/reject discipline mark submissions
router.get('/admin/submissions',              isAuthenticated, isAdmin, ctrl.adminListDisciplineSubmissions);
router.get('/admin/submissions/:id',          isAuthenticated, isAdmin, ctrl.adminViewDisciplineSubmission);
router.post('/admin/submissions/:id/approve', isAuthenticated, isAdmin, ctrl.adminApproveDisciplineSubmission);
router.post('/admin/submissions/:id/reject',  isAuthenticated, isAdmin, ctrl.adminRejectDisciplineSubmission);

module.exports = router;