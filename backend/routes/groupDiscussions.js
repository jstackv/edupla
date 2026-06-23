const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher, isStudent } = require('../middleware/auth');
const {
  getGroups, createGroup, deleteGroup,
  getGroup,  getMyGroups, postMessage,
} = require('../controllers/groupDiscussionController');

// Student — list own groups (MUST be before /:id — Express matches "my" as an id param otherwise)
router.get('/my/groups', isAuthenticated, getMyGroups);

// Teacher routes
router.get('/',          isAuthenticated, isTeacher, getGroups);
router.post('/',         isAuthenticated, isTeacher, createGroup);
router.delete('/:id',    isAuthenticated, isTeacher, deleteGroup);

// Shared — group detail (teacher read-only, student read+write)
router.get('/:id',           isAuthenticated, getGroup);
router.post('/:id/messages', isAuthenticated, postMessage); // students only (enforced in controller)

module.exports = router;
