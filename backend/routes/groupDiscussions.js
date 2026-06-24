const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher, isStudent } = require('../middleware/auth');
const { voiceNoteUpload } = require('../middleware/upload');
const {
  getGroups, createGroup, deleteGroup,
  getGroup,  getMyGroups, postMessage, postVoiceNote,
  getEligibleTeachers, inviteTeacher,
  getMyInvitations, respondToInvitation,
  leaveGroup, endConversation, getGroupMessages,
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

// Teacher: leave group or end conversation
router.post('/:id/leave', isAuthenticated, isTeacher, leaveGroup);
router.post('/:id/end',   isAuthenticated, isTeacher, endConversation);

// Team leader (student member in charge of the group) — invite a teacher in
router.get('/:id/eligible-teachers', isAuthenticated, isStudent, getEligibleTeachers);
router.post('/:id/invite',           isAuthenticated, isStudent, inviteTeacher);

// Shared — group detail & messaging. Access is enforced inside the controller:
// students must be members; teachers need an ACCEPTED invitation from the
// team leader (the creating teacher gets no special access).
router.get('/:id',            isAuthenticated, getGroup);
router.get('/:id/messages',   isAuthenticated, getGroupMessages);
router.post('/:id/messages',  isAuthenticated, postMessage);

// Voice notes: multipart upload via Cloudinary, then saved as a message with type='voice'
router.post('/:id/voice-notes', isAuthenticated, voiceNoteUpload.single('audio'), postVoiceNote);

module.exports = router;