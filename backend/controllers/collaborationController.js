const mongoose = require('mongoose');
const { Class, User, ClassCollaboration, DirectMessage } = require('../models/db');
const { cloudinary, getResourceType } = require('../middleware/upload');

// Best-effort Cloudinary delete — never throws, since a missing/already-gone
// asset shouldn't block the DB-side deletion the user actually asked for.
async function destroyMedia(publicId, resourceType = 'raw') {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); }
  catch (err) { console.error('Cloudinary delete error:', err.message); }
}

// A direct message stores only ONE of voice_url/file_url depending on
// message_type; figure out which, and what resource_type it was uploaded as.
function destroyMessageMedia(msg) {
  if (!msg || !msg.media_public_id) return Promise.resolve();
  if (msg.message_type === 'voice') return destroyMedia(msg.media_public_id, 'raw');
  if (msg.message_type === 'image') return destroyMedia(msg.media_public_id, 'image');
  if (msg.message_type === 'file') {
    return destroyMedia(msg.media_public_id, getResourceType(msg.file_name, msg.mime_type));
  }
  return Promise.resolve();
}

/* ─────────────────────────────────────────────────────────────────────────
   TEACHER: Open collaboration for a class
   POST /api/collaborations/:classId/open
   ───────────────────────────────────────────────────────────────────────── */
const openCollaboration = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId } = req.params;

    // Verify teacher owns / is assigned to this class
    const cls = await Class.findOne({
      _id: classId,
      $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
    }).lean();
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const collab = await ClassCollaboration.findOneAndUpdate(
      { class_id: classId, teacher_id: teacherId },
      { is_active: true, opened_at: new Date(), closed_at: null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Collaboration opened.', collaboration: _fmt(collab) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   TEACHER: Close collaboration for a class
   POST /api/collaborations/:classId/close
   ───────────────────────────────────────────────────────────────────────── */
const closeCollaboration = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId } = req.params;

    const cls = await Class.findOne({
      _id: classId,
      $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
    }).lean();
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const collab = await ClassCollaboration.findOneAndUpdate(
      { class_id: classId, teacher_id: teacherId },
      { is_active: false, closed_at: new Date() },
      { new: true }
    );
    if (!collab) return res.status(404).json({ message: 'No collaboration session found for this class.' });

    res.json({ message: 'Collaboration closed.', collaboration: _fmt(collab) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   TEACHER: Get status of all classes they teach (with collaboration state)
   GET /api/collaborations/my-classes
   ───────────────────────────────────────────────────────────────────────── */
const getMyClassesWithStatus = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const classes = await Class.find({
      $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
      is_active: true,
    }, '_id name').sort({ name: 1 }).lean();

    const classIds = classes.map(c => c._id);
    const collabs = await ClassCollaboration.find({
      class_id: { $in: classIds },
      teacher_id: teacherId,
    }).lean();

    const collabMap = {};
    collabs.forEach(c => { collabMap[String(c.class_id)] = c; });

    const result = classes.map(cls => {
      const collab = collabMap[String(cls._id)];
      return {
        id: cls._id,
        name: cls.name,
        collaboration_active: collab ? collab.is_active : false,
        opened_at: collab?.opened_at || null,
        closed_at: collab?.closed_at || null,
      };
    });

    res.json({ classes: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: Check if collaboration is active for a class they're in
   GET /api/collaborations/class/:classId/status
   ───────────────────────────────────────────────────────────────────────── */
const getClassCollaborationStatus = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { classId } = req.params;

    // Verify student is enrolled
    const cls = await Class.findOne({ _id: classId, students: studentId }, '_id name').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    // Any teacher of this class who has collaboration active
    const activeCollab = await ClassCollaboration.findOne({
      class_id: classId,
      is_active: true,
    }).lean();

    res.json({
      class_id: classId,
      class_name: cls.name,
      collaboration_active: !!activeCollab,
      opened_at: activeCollab?.opened_at || null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: List classmates they can DM (all enrolled students except self)
   GET /api/collaborations/class/:classId/students
   ───────────────────────────────────────────────────────────────────────── */
const getClassmates = async (req, res) => {
  try {
    const studentId = String(req.user.id);
    const { classId } = req.params;

    // Must be enrolled
    const cls = await Class.findOne({ _id: classId, students: studentId })
      .populate('students', 'name').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    // Collaboration must be active
    const activeCollab = await ClassCollaboration.findOne({ class_id: classId, is_active: true }).lean();
    if (!activeCollab) return res.status(403).json({ message: 'Collaboration is not active for this class.' });

    const classmates = (cls.students || [])
      .filter(s => String(s._id) !== studentId)
      .map(s => ({ id: s._id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ classmates });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: Send a direct message to a classmate
   POST /api/collaborations/class/:classId/messages
   Body: { receiverId, content }
   ───────────────────────────────────────────────────────────────────────── */
const sendDirectMessage = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { classId } = req.params;
    const { receiverId, content } = req.body;

    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ message: 'receiverId and content are required.' });
    }
    if (senderId === String(receiverId)) {
      return res.status(400).json({ message: 'You cannot message yourself.' });
    }

    // Verify sender is enrolled
    const cls = await Class.findOne({ _id: classId, students: senderId }, '_id students').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    // Verify receiver is enrolled in same class
    const receiverEnrolled = (cls.students || []).some(s => String(s) === String(receiverId));
    if (!receiverEnrolled) return res.status(403).json({ message: 'Recipient is not enrolled in this class.' });

    // Collaboration must be active
    const activeCollab = await ClassCollaboration.findOne({ class_id: classId, is_active: true }).lean();
    if (!activeCollab) return res.status(403).json({ message: 'Collaboration is not active for this class.' });

    const sender = await User.findById(senderId, 'name').lean();

    const msg = await DirectMessage.create({
      class_id: classId,
      sender_id: senderId,
      receiver_id: receiverId,
      message_type: 'text',
      content: content.trim(),
    });

    res.status(201).json({
      message: 'Message sent.',
      msg: {
        id: msg._id,
        sender_id: msg.sender_id,
        sender_name: sender?.name || 'Unknown',
        receiver_id: msg.receiver_id,
        message_type: msg.message_type,
        content: msg.content,
        read: msg.read,
        created_at: msg.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: Send a voice note to a classmate
   POST /api/collaborations/class/:classId/voice-notes
   Body (multipart): receiverId, duration, audio
   ───────────────────────────────────────────────────────────────────────── */
const sendVoiceNoteDM = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { classId } = req.params;
    const { receiverId } = req.body;

    if (!req.file) return res.status(400).json({ message: 'No audio file uploaded.' });
    if (!receiverId) return res.status(400).json({ message: 'receiverId is required.' });
    if (senderId === String(receiverId)) {
      return res.status(400).json({ message: 'You cannot message yourself.' });
    }

    const cls = await Class.findOne({ _id: classId, students: senderId }, '_id students').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    const receiverEnrolled = (cls.students || []).some(s => String(s) === String(receiverId));
    if (!receiverEnrolled) return res.status(403).json({ message: 'Recipient is not enrolled in this class.' });

    const activeCollab = await ClassCollaboration.findOne({ class_id: classId, is_active: true }).lean();
    if (!activeCollab) return res.status(403).json({ message: 'Collaboration is not active for this class.' });

    const sender = await User.findById(senderId, 'name').lean();
    const duration = parseFloat(req.body.duration) || null;

    const msg = await DirectMessage.create({
      class_id: classId,
      sender_id: senderId,
      receiver_id: receiverId,
      message_type: 'voice',
      content: '',
      voice_url: req.file.path,
      voice_duration: duration,
      media_public_id: req.file.filename, // Cloudinary public_id, needed to delete this asset later
    });

    res.status(201).json({
      message: 'Voice note sent.',
      msg: {
        id: msg._id,
        sender_id: msg.sender_id,
        sender_name: sender?.name || 'Unknown',
        receiver_id: msg.receiver_id,
        message_type: msg.message_type,
        content: msg.content,
        voice_url: msg.voice_url,
        voice_duration: msg.voice_duration,
        read: msg.read,
        created_at: msg.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: Send a photo or file to a classmate
   POST /api/collaborations/class/:classId/media
   Body (multipart): receiverId, file
   ───────────────────────────────────────────────────────────────────────── */
const sendMediaDM = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { classId } = req.params;
    const { receiverId } = req.body;

    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    if (!receiverId) return res.status(400).json({ message: 'receiverId is required.' });
    if (senderId === String(receiverId)) {
      return res.status(400).json({ message: 'You cannot message yourself.' });
    }

    const cls = await Class.findOne({ _id: classId, students: senderId }, '_id students').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    const receiverEnrolled = (cls.students || []).some(s => String(s) === String(receiverId));
    if (!receiverEnrolled) return res.status(403).json({ message: 'Recipient is not enrolled in this class.' });

    const activeCollab = await ClassCollaboration.findOne({ class_id: classId, is_active: true }).lean();
    if (!activeCollab) return res.status(403).json({ message: 'Collaboration is not active for this class.' });

    const sender = await User.findById(senderId, 'name').lean();
    const isImage = (req.file.mimetype || '').startsWith('image/');

    const msg = await DirectMessage.create({
      class_id: classId,
      sender_id: senderId,
      receiver_id: receiverId,
      message_type: isImage ? 'image' : 'file',
      content: '',
      file_url: req.file.path,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      media_public_id: req.file.filename, // Cloudinary public_id, needed to delete this asset later
    });

    res.status(201).json({
      message: isImage ? 'Photo sent.' : 'File sent.',
      msg: {
        id: msg._id,
        sender_id: msg.sender_id,
        sender_name: sender?.name || 'Unknown',
        receiver_id: msg.receiver_id,
        message_type: msg.message_type,
        content: msg.content,
        file_url: msg.file_url,
        file_name: msg.file_name,
        file_size: msg.file_size,
        mime_type: msg.mime_type,
        read: msg.read,
        created_at: msg.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT (sender only): delete a single message of their own
   DELETE /api/collaborations/class/:classId/messages/:messageId
   ───────────────────────────────────────────────────────────────────────── */
const deleteMessage = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { classId, messageId } = req.params;

    const msg = await DirectMessage.findOne({ _id: messageId, class_id: classId });
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    if (String(msg.sender_id) !== senderId) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    await destroyMessageMedia(msg);
    await DirectMessage.deleteOne({ _id: messageId });
    res.json({ message: 'Message deleted.', message_id: messageId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT (sender only): clear (delete) all of my own messages sent to one peer
   DELETE /api/collaborations/class/:classId/messages/peer/:peerId
   ───────────────────────────────────────────────────────────────────────── */
const clearMyMessagesWithPeer = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { classId, peerId } = req.params;

    const toDelete = await DirectMessage.find({
      class_id: classId,
      sender_id: senderId,
      receiver_id: peerId,
    }, 'message_type media_public_id file_name mime_type').lean();
    await Promise.all(toDelete.map(destroyMessageMedia));

    const result = await DirectMessage.deleteMany({
      class_id: classId,
      sender_id: senderId,
      receiver_id: peerId,
    });

    res.json({ message: `Cleared ${result.deletedCount} message(s).`, removed_count: result.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: Get conversation with a specific classmate
   GET /api/collaborations/class/:classId/messages/:peerId
   Query: ?since=<ISO timestamp>  (for polling)
   ───────────────────────────────────────────────────────────────────────── */
const getConversation = async (req, res) => {
  try {
    const myId = String(req.user.id);
    const { classId, peerId } = req.params;
    const { since } = req.query;

    // Verify enrolled
    const cls = await Class.findOne({ _id: classId, students: myId }, '_id students').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    // Verify peer is in same class
    const peerEnrolled = (cls.students || []).some(s => String(s) === String(peerId));
    if (!peerEnrolled) return res.status(403).json({ message: 'Peer is not enrolled in this class.' });

    // Collaboration must be active
    const activeCollab = await ClassCollaboration.findOne({ class_id: classId, is_active: true }).lean();
    if (!activeCollab) return res.status(403).json({ message: 'Collaboration is not active for this class.' });

    const filter = {
      class_id: classId,
      $or: [
        { sender_id: myId,    receiver_id: peerId },
        { sender_id: peerId,  receiver_id: myId },
      ],
    };
    if (since) filter.created_at = { $gt: new Date(since) };

    const messages = await DirectMessage.find(filter).sort({ created_at: 1 }).lean();

    // Mark unread messages as read
    await DirectMessage.updateMany(
      { class_id: classId, sender_id: peerId, receiver_id: myId, read: false },
      { read: true }
    );

    // Fetch sender names
    const userIds = [...new Set(messages.map(m => String(m.sender_id)))];
    const users = await User.find({ _id: { $in: userIds } }, 'name').lean();
    const nameMap = {};
    users.forEach(u => { nameMap[String(u._id)] = u.name; });

    res.json({
      messages: messages.map(m => ({
        id: m._id,
        sender_id: m.sender_id,
        sender_name: nameMap[String(m.sender_id)] || 'Unknown',
        receiver_id: m.receiver_id,
        message_type: m.message_type || 'text',
        content: m.content,
        voice_url: m.voice_url || null,
        voice_duration: m.voice_duration || null,
        file_url: m.file_url || null,
        file_name: m.file_name || null,
        file_size: m.file_size || null,
        mime_type: m.mime_type || null,
        read: m.read,
        created_at: m.created_at,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: List recent conversation partners (inbox overview)
   GET /api/collaborations/class/:classId/conversations
   ───────────────────────────────────────────────────────────────────────── */
const getConversationList = async (req, res) => {
  try {
    const myId = new mongoose.Types.ObjectId(req.user.id);
    const { classId } = req.params;

    // Verify enrolled
    const cls = await Class.findOne({ _id: classId, students: myId }, '_id').lean();
    if (!cls) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    // Collaboration must be active
    const activeCollab = await ClassCollaboration.findOne({ class_id: classId, is_active: true }).lean();
    if (!activeCollab) return res.status(403).json({ message: 'Collaboration is not active for this class.' });

    // Aggregate: for each peer, get last message and unread count
    const pipeline = [
      {
        $match: {
          class_id: new mongoose.Types.ObjectId(classId),
          $or: [{ sender_id: myId }, { receiver_id: myId }],
        },
      },
      {
        $addFields: {
          peer_id: { $cond: { if: { $eq: ['$sender_id', myId] }, then: '$receiver_id', else: '$sender_id' } },
          is_unread: {
            $cond: {
              if: { $and: [{ $eq: ['$receiver_id', myId] }, { $eq: ['$read', false] }] },
              then: 1, else: 0,
            },
          },
        },
      },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: '$peer_id',
          last_message: { $first: '$content' },
          last_message_type: { $first: '$message_type' },
          last_at: { $first: '$created_at' },
          unread_count: { $sum: '$is_unread' },
        },
      },
      { $sort: { last_at: -1 } },
    ];

    const convos = await DirectMessage.aggregate(pipeline);
    const peerIds = convos.map(c => c._id);
    const peers = await User.find({ _id: { $in: peerIds } }, 'name').lean();
    const peerMap = {};
    peers.forEach(p => { peerMap[String(p._id)] = p.name; });

    res.json({
      conversations: convos.map(c => ({
        peer_id: c._id,
        peer_name: peerMap[String(c._id)] || 'Unknown',
        last_message: c.last_message_type === 'voice' ? '🎤 Voice note'
          : c.last_message_type === 'image' ? '📷 Photo'
          : c.last_message_type === 'file' ? '📎 File'
          : c.last_message,
        last_at: c.last_at,
        unread_count: c.unread_count,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT: My enrolled classes with their active collaboration status
   GET /api/collaborations/my-class-status
   ───────────────────────────────────────────────────────────────────────── */
const getMyClassesStatus = async (req, res) => {
  try {
    const studentId = req.user.id;

    const classes = await Class.find({ students: studentId, is_active: true }, '_id name').lean();
    const classIds = classes.map(c => c._id);

    const activeCollabs = await ClassCollaboration.find({
      class_id: { $in: classIds },
      is_active: true,
    }).lean();

    const activeSet = new Set(activeCollabs.map(c => String(c.class_id)));

    res.json({
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        collaboration_active: activeSet.has(String(c._id)),
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* helper */
function _fmt(collab) {
  return {
    id: collab._id,
    class_id: collab.class_id,
    is_active: collab.is_active,
    opened_at: collab.opened_at,
    closed_at: collab.closed_at,
  };
}

module.exports = {
  openCollaboration,
  closeCollaboration,
  getMyClassesWithStatus,
  getClassCollaborationStatus,
  getClassmates,
  sendDirectMessage,
  sendVoiceNoteDM,
  sendMediaDM,
  deleteMessage,
  clearMyMessagesWithPeer,
  getConversation,
  getConversationList,
  getMyClassesStatus,
};