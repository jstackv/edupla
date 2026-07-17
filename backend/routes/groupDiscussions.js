const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { voiceNoteUpload, chatMediaUpload } = require('../middleware/upload');
const {
  getGroups, createGroup, deleteGroup,
  getGroup,  getMyGroups, postMessage, postVoiceNote, postMedia, deleteMessage, clearMyMessages,
  endConversation, restoreConversation, getGroupMessages,
  getLeaderDm, postLeaderDm, deleteLeaderDmMessage, clearMyLeaderDmMessages,
  addGroupMembers, removeGroupMember, moveGroupMember,
} = require('../controllers/groupDiscussionController');

// Student — list own groups (MUST be before /:id — Express matches "my" as an id param otherwise)
router.get('/my/groups', isAuthenticated, getMyGroups);

// Teacher routes
router.get('/',          isAuthenticated, isTeacher, getGroups);
router.post('/',         isAuthenticated, isTeacher, createGroup);
router.delete('/:id',    isAuthenticated, isTeacher, deleteGroup);

// Teacher (owner): end / restore conversation
router.post('/:id/end',     isAuthenticated, isTeacher, endConversation);
router.post('/:id/restore', isAuthenticated, isTeacher, restoreConversation);

// Teacher (any assigned to the class): add or remove group members
router.post('/:id/members',              isAuthenticated, isTeacher, addGroupMembers);
router.delete('/:id/members/:studentId', isAuthenticated, isTeacher, removeGroupMember);
router.post('/:id/members/:studentId/move', isAuthenticated, isTeacher, moveGroupMember);

// Shared — group detail & messaging. Access is enforced inside the controller:
// students must be members; any teacher assigned to the class has full,
// automatic read/post access (no invitation needed).
router.get('/:id',            isAuthenticated, getGroup);
router.get('/:id/messages',   isAuthenticated, getGroupMessages);
router.post('/:id/messages',  isAuthenticated, postMessage);

// Delete own messages: a single message, or every message I've sent in this group.
router.delete('/:id/messages',            isAuthenticated, clearMyMessages);
router.delete('/:id/messages/:messageId', isAuthenticated, deleteMessage);

// Voice notes: multipart upload via Cloudinary, then saved as a message with type='voice'
router.post('/:id/voice-notes', isAuthenticated, voiceNoteUpload.single('audio'), postVoiceNote);

// Photos & files: multipart upload via Cloudinary, saved as a message with type='image'|'file'
router.post('/:id/media', isAuthenticated, chatMediaUpload.single('file'), postMedia);

// Team leader <-> owning teacher private DM
router.get('/:id/leader-dm',              isAuthenticated, getLeaderDm);
router.post('/:id/leader-dm',             isAuthenticated, postLeaderDm);
router.delete('/:id/leader-dm',           isAuthenticated, clearMyLeaderDmMessages);
router.delete('/:id/leader-dm/:messageId', isAuthenticated, deleteLeaderDmMessage);

module.exports = router;