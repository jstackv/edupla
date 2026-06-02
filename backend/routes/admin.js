const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
  getDashboardStats, getTeachers, createTeacher, updateTeacher, deleteTeacher,
  getAllClasses, adminCreateClass, adminUpdateClass, adminDeleteClass, adminAssignClassToTeacher,
  adminGetClassTeachers, adminGetClassStudents,
  getAllStudents, adminCreateStudent, adminUpdateStudent, adminDeleteStudent,
  adminAssignStudentToClass, adminGetStudentDetail,
  getAdminAssignments,
  getLevels, createLevel, deleteLevel, updateLevel,
  getTrades, createTrade, deleteTrade, updateTrade,
} = require('../controllers/adminController');

router.use(isAuthenticated, isAdmin);

// Dashboard
router.get('/stats', getDashboardStats);

// Teachers
router.get('/teachers', getTeachers);
router.post('/teachers', createTeacher);
router.put('/teachers/:id', updateTeacher);
router.delete('/teachers/:id', deleteTeacher);

// Classes
router.get('/classes', getAllClasses);
router.post('/classes', adminCreateClass);
router.put('/classes/:id', adminUpdateClass);
router.delete('/classes/:id', adminDeleteClass);
router.put('/classes/:id/assign-teacher', adminAssignClassToTeacher);
router.get('/classes/:id/teachers', adminGetClassTeachers);
router.get('/classes/:id/students', adminGetClassStudents);
router.post('/classes/:id/enroll-student', async (req, res) => {
  const { pool } = require('../models/db');
  try {
    const { student_id } = req.body;
    await pool.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?,?)', [req.params.id, student_id]);
    res.json({ message: 'Student enrolled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Students
router.get('/students', getAllStudents);
router.post('/students', adminCreateStudent);
router.get('/students/:id', adminGetStudentDetail);
router.put('/students/:id', adminUpdateStudent);
router.delete('/students/:id', adminDeleteStudent);
router.post('/students/:id/assign', adminAssignStudentToClass);

// Assignments (view-only for admin)
router.get('/assignments', getAdminAssignments);

// Levels management
router.get('/levels', getLevels);
router.post('/levels', createLevel);
router.put('/levels/:value', updateLevel);
router.delete('/levels/:value', deleteLevel);

// Trades management
router.get('/trades', getTrades);
router.post('/trades', createTrade);
router.put('/trades/:value', updateTrade);
router.delete('/trades/:value', deleteTrade);

module.exports = router;