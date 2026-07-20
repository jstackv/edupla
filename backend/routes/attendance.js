const router = require('express').Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const {
  getSession, saveSession, getClassHistory, getClassSummary, getClassReport,
  deleteSession, getMyAttendance, getMyReport,
} = require('../controllers/attendanceController');

router.use(isAuthenticated);

router.get('/my', getMyAttendance);           // student
router.get('/my/report', getMyReport);        // student

router.get('/session', isTeacher, getSession);
router.post('/session', isTeacher, saveSession);
router.delete('/session/:id', isTeacher, deleteSession);
router.get('/class/:classId', isTeacher, getClassHistory);
router.get('/class/:classId/summary', isTeacher, getClassSummary);
router.get('/class/:classId/report', isTeacher, getClassReport);

module.exports = router;
