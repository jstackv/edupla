const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher, isStudent } = require('../middleware/auth');
const {
  getConversationAsTeacher, postMessageAsTeacher,
  getConversationAsStudent, postMessageAsStudent,
  getMyTeacherThreads, getMyTeachers, getMyStudentThreads,
  deleteMessage, clearMyMessages,
  setConversationStatus,
} = require('../controllers/teacherMessageController');

// Student — inbox overview: every teacher they have a DM thread with
router.get('/my', isAuthenticated, isStudent, getMyTeacherThreads);

// Student — teachers of their enrolled classes they can start a DM with
router.get('/my-teachers', isAuthenticated, isStudent, getMyTeachers);

// Teacher — inbox overview: every student they have a DM thread with
router.get('/my-students', isAuthenticated, isTeacher, getMyStudentThreads);

// Teacher — start / continue a private DM with a student they teach
router.get('/student/:studentId',            isAuthenticated, isTeacher, getConversationAsTeacher);
router.post('/student/:studentId',           isAuthenticated, isTeacher, postMessageAsTeacher);
router.patch('/student/:studentId/status',   isAuthenticated, isTeacher, setConversationStatus);
router.delete('/student/:studentId/messages',            isAuthenticated, isTeacher, clearMyMessages);
router.delete('/student/:studentId/messages/:messageId', isAuthenticated, isTeacher, deleteMessage);

// Student — view / start / reply to a DM with a teacher of one of their classes
router.get('/teacher/:teacherId',            isAuthenticated, isStudent, getConversationAsStudent);
router.post('/teacher/:teacherId',           isAuthenticated, isStudent, postMessageAsStudent);
router.delete('/teacher/:teacherId/messages',            isAuthenticated, isStudent, clearMyMessages);
router.delete('/teacher/:teacherId/messages/:messageId', isAuthenticated, isStudent, deleteMessage);

module.exports = router;