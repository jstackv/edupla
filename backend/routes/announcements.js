const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');

router.get('/', isAuthenticated, getAnnouncements);
router.post('/', isAuthenticated, isTeacher, createAnnouncement);
router.put('/:id', isAuthenticated, isTeacher, updateAnnouncement);
router.delete('/:id', isAuthenticated, isTeacher, deleteAnnouncement);

module.exports = router;
