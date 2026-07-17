const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher, isStudent } = require('../middleware/auth');
const {
  getConversationAsTeacher, postMessageAsTeacher,
  getConversationAsStudent, postMessageAsStudent,
  getMyTeacherThreads, deleteMessage, clearMyMessages,
} = require('../controllers/teacherMessageController');

// Student — list every teacher who has started a DM with them (inbox overview)
router.get('/my', isAuthenticated, isStudent, getMyTeacherThreads);

// Teacher — start / continue a private DM with a student they teach
router.get('/student/:studentId',            isAuthenticated, isTeacher, getConversationAsTeacher);
router.post('/student/:studentId',           isAuthenticated, isTeacher, postMessageAsTeacher);
router.delete('/student/:studentId/messages',            isAuthenticated, isTeacher, clearMyMessages);
router.delete('/student/:studentId/messages/:messageId', isAuthenticated, isTeacher, deleteMessage);

// Student — view / reply to a DM a teacher has started with them
router.get('/teacher/:teacherId',            isAuthenticated, isStudent, getConversationAsStudent);
router.post('/teacher/:teacherId',           isAuthenticated, isStudent, postMessageAsStudent);
router.delete('/teacher/:teacherId/messages',            isAuthenticated, isStudent, clearMyMessages);
router.delete('/teacher/:teacherId/messages/:messageId', isAuthenticated, isStudent, deleteMessage);

module.exports = router;
