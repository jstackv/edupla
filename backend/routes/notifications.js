const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getNotifications, createNotification, updateNotification, deleteNotification, markRead, getUnreadCount } = require('../controllers/notificationController');

router.get('/', isAuthenticated, getNotifications);
router.get('/unread-count', isAuthenticated, getUnreadCount);
router.post('/', isAuthenticated, isTeacher, createNotification);
router.put('/:id', isAuthenticated, isTeacher, updateNotification);
router.delete('/:id', isAuthenticated, isTeacher, deleteNotification);
router.post('/:id/read', isAuthenticated, markRead);
router.post('/mark-all-read', isAuthenticated, (req, res, next) => { const { markAllRead } = require('../controllers/notificationController'); markAllRead(req, res); });

module.exports = router;
