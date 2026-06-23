const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const {
  getNotifications, createNotification, updateNotification, deleteNotification,
  markRead, getUnreadCount, markAllRead, clearAllNotifications, clearNotification,
} = require('../controllers/notificationController');

router.get('/', isAuthenticated, getNotifications);
router.get('/unread-count', isAuthenticated, getUnreadCount);
router.post('/', isAuthenticated, isTeacher, createNotification);
router.put('/:id', isAuthenticated, isTeacher, updateNotification);
router.delete('/:id', isAuthenticated, isTeacher, deleteNotification);
router.post('/:id/read', isAuthenticated, markRead);
router.post('/mark-all-read', isAuthenticated, markAllRead);
// Clear notifications from the caller's own panel (admin, teacher, or student).
router.post('/clear-all', isAuthenticated, clearAllNotifications);
router.post('/:id/clear', isAuthenticated, clearNotification);

module.exports = router;
