const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getClasses, getClass, updateClass, deleteClass, getClassStudents, getMyClasses } = require('../controllers/classController');

// Student endpoint - get classes they're enrolled in
router.get('/my', isAuthenticated, getMyClasses);

// Teacher endpoints - view their assigned classes & students
router.get('/', isAuthenticated, isTeacher, getClasses);
router.get('/:id', isAuthenticated, isTeacher, getClass);
router.put('/:id', isAuthenticated, isTeacher, updateClass);
router.delete('/:id', isAuthenticated, isTeacher, deleteClass);
router.get('/:id/students', isAuthenticated, isTeacher, getClassStudents);

module.exports = router;
