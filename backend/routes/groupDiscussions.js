const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher, isStudent } = require('../middleware/auth');
const {
  getGroups, createGroup, deleteGroup,
  getGroup,  getMyGroups, postMessage,
  getEligibleTeachers, inviteTeacher,
  getMyInvitations, respondToInvitation,
} = require('../controllers/groupDiscussionController');

// Student — list own groups (MUST be before /:id — Express matches "my" as an id param otherwise)
router.get('/my/groups', isAuthenticated, getMyGroups);

// Teacher — invitations addressed to me (MUST be before /:id for the same reason)
router.get('/invitations/mine', isAuthenticated, isTeacher, getMyInvitations);
router.post('/invitations/:invitationId/respond', isAuthenticated, isTeacher, respondToInvitation);

// Teacher routes
router.get('/',          isAuthenticated, isTeacher, getGroups);
router.post('/',         isAuthenticated, isTeacher, createGroup);
router.delete('/:id',    isAuthenticated, isTeacher, deleteGroup);

// Team leader (student member in charge of the group) — invite a teacher in
router.get('/:id/eligible-teachers', isAuthenticated, isStudent, getEligibleTeachers);
router.post('/:id/invite',           isAuthenticated, isStudent, inviteTeacher);

// Shared — group detail & messaging. Access is enforced inside the controller:
// students must be members; teachers need an ACCEPTED invitation from the
// team leader (the creating teacher gets no special access).
router.get('/:id',           isAuthenticated, getGroup);
router.post('/:id/messages', isAuthenticated, postMessage);

module.exports = router;
