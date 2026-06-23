const express = require('express');
const router = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getDiscussions, getDiscussion, createDiscussion, deleteDiscussion, addComment } = require('../controllers/discussionController');

router.get('/', isAuthenticated, getDiscussions);
router.get('/:id', isAuthenticated, getDiscussion);
router.post('/', isAuthenticated, isTeacher, createDiscussion);
router.delete('/:id', isAuthenticated, isTeacher, deleteDiscussion);
router.post('/:id/comments', isAuthenticated, addComment);

module.exports = router;