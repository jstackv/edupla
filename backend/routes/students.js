const router = require('express').Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getStudents, getStudent, getStudentStats } = require('../controllers/studentController');

router.use(isAuthenticated, isTeacher);
router.get('/', getStudents);
router.get('/stats', getStudentStats);
router.get('/:id', getStudent);

module.exports = router;
