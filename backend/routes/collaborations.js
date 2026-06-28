const express = require('express');
const router  = express.Router();
const { isAuthenticated, isTeacher, isStudent } = require('../middleware/auth');
const { voiceNoteUpload } = require('../middleware/upload');
const {
  openCollaboration,
  closeCollaboration,
  getMyClassesWithStatus,
  getClassCollaborationStatus,
  getClassmates,
  sendDirectMessage,
  sendVoiceNoteDM,
  deleteMessage,
  clearMyMessagesWithPeer,
  getConversation,
  getConversationList,
  getMyClassesStatus,
} = require('../controllers/collaborationController');

// ── Teacher routes ────────────────────────────────────────────────────────
// List teacher's classes with their current collaboration status
router.get('/my-classes',              isAuthenticated, isTeacher, getMyClassesWithStatus);
// Open / close collaboration for a specific class
router.post('/:classId/open',          isAuthenticated, isTeacher, openCollaboration);
router.post('/:classId/close',         isAuthenticated, isTeacher, closeCollaboration);

// ── Student routes ────────────────────────────────────────────────────────
// List student's classes with active collaboration flag
router.get('/my-class-status',         isAuthenticated, isStudent, getMyClassesStatus);
// Check collaboration status for one class
router.get('/class/:classId/status',   isAuthenticated, isStudent, getClassCollaborationStatus);
// List classmates available to DM
router.get('/class/:classId/students', isAuthenticated, isStudent, getClassmates);
// Conversation list (inbox overview) for a class
router.get('/class/:classId/conversations', isAuthenticated, isStudent, getConversationList);
// Get messages with a specific peer (polling-friendly)
router.get('/class/:classId/messages/:peerId', isAuthenticated, isStudent, getConversation);
// Send a direct message
router.post('/class/:classId/messages', isAuthenticated, isStudent, sendDirectMessage);
// Send a voice note (multipart upload via Cloudinary)
router.post('/class/:classId/voice-notes', isAuthenticated, isStudent, voiceNoteUpload.single('audio'), sendVoiceNoteDM);
// Clear (delete) all of my own messages with one peer — MUST be before the generic :messageId delete
router.delete('/class/:classId/messages/peer/:peerId', isAuthenticated, isStudent, clearMyMessagesWithPeer);
// Delete a single message of my own
router.delete('/class/:classId/messages/:messageId',   isAuthenticated, isStudent, deleteMessage);

module.exports = router;
