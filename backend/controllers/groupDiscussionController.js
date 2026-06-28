const mongoose = require('mongoose');
const { DiscussionGroup, Class, User } = require('../models/db');

/* ── helpers ──────────────────────────────────────────────────────────── */

// Is this teacher assigned to the class behind a group (its main teacher or
// one of its extra_teachers)? Any such teacher gets full, automatic
// read/post access to the group's conversation — no invitation needed.
async function isAssignedTeacher(classId, teacherId) {
  const cls = await Class.findOne({
    _id: classId,
    $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
  }, '_id').lean();
  return !!cls;
}

/* ── Teacher: list all groups for classes they're assigned to ───────────── */
const getGroups = async (req, res) => {
  try {
    const { classId } = req.query;
    const teacherId = req.user.id;

    const classFilter = { $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] };
    if (classId) classFilter._id = classId;
    const myClasses = await Class.find(classFilter, '_id').lean();
    const classIds = myClasses.map(c => c._id);

    const groups = await DiscussionGroup.find({ class_id: { $in: classIds } })
      .sort({ created_at: -1 })
      .populate('class_id', 'name')
      .populate('members', 'name')
      .populate('team_leader', 'name')
      .populate('teacher_id', 'name')
      .lean();

    const result = groups.map(g => ({
      id: g._id,
      name: g.name,
      class_id: g.class_id?._id,
      class_name: g.class_id?.name,
      member_count: g.members?.length || 0,
      members: (g.members || []).map(m => ({ id: m._id, name: m.name })),
      team_leader: g.team_leader ? { id: g.team_leader._id, name: g.team_leader.name } : null,
      teacher_id: g.teacher_id?._id,
      teacher_name: g.teacher_id?.name,
      // Only the creating teacher may delete the group or end the conversation.
      is_owner: String(g.teacher_id?._id) === String(teacherId),
      message_count: g.messages?.length || 0,
      is_ended: g.is_ended || false,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));

    res.json({ groups: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: create a group for a class + assign a team leader ─────────── */
const createGroup = async (req, res) => {
  try {
    const { name, classId, memberIds, teamLeaderId } = req.body;
    if (!name || !classId || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'Group name, class, and at least one member are required.' });
    }
    if (!teamLeaderId) {
      return res.status(400).json({ message: 'Please choose a team leader for this group.' });
    }

    // Verify teacher is assigned to this class
    const cls = await Class.findOne({
      _id: classId,
      $or: [{ teacher_id: req.user.id }, { extra_teachers: req.user.id }],
    }).lean();
    if (!cls) return res.status(403).json({ message: 'You are not assigned to this class.' });

    // Verify all selected students are actually enrolled in the class
    const enrolledIds = (cls.students || []).map(s => String(s));
    const validMembers = memberIds.filter(id => enrolledIds.includes(String(id)));
    if (validMembers.length === 0) {
      return res.status(400).json({ message: 'None of the selected students are enrolled in this class.' });
    }

    // Team leader must be one of the chosen members
    if (!validMembers.map(String).includes(String(teamLeaderId))) {
      return res.status(400).json({ message: 'The team leader must be one of the selected group members.' });
    }

    const group = await DiscussionGroup.create({
      name: name.trim(),
      class_id: classId,
      teacher_id: req.user.id,
      members: validMembers,
      team_leader: teamLeaderId,
      messages: [],
      leader_messages: [],
    });

    res.status(201).json({ message: 'Group created', id: group._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: delete a group they own ────────────────────────────────────── */
const deleteGroup = async (req, res) => {
  try {
    const result = await DiscussionGroup.findOneAndDelete({
      _id: req.params.id,
      teacher_id: req.user.id,
    });
    if (!result) return res.status(404).json({ message: 'Group not found or you are not the owner.' });
    res.json({ message: 'Group deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Shared: fetch a single group's conversation ─────────────────────────
   - Student: must be a member.
   - Teacher: must be assigned to the group's class (main teacher or an
     extra_teacher) — full automatic access, no invitation needed. */
const getGroup = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role   = req.user.role;

    const group = await DiscussionGroup.findById(req.params.id)
      .populate('class_id', 'name')
      .populate('members', 'name')
      .populate('team_leader', 'name')
      .populate('teacher_id', 'name')
      .lean();
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    if (role === 'teacher') {
      const allowed = await isAssignedTeacher(group.class_id?._id || group.class_id, userId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this class.' });
    } else {
      const isMember = (group.members || []).some(m => String(m._id) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const isTeamLeader = role === 'student' && String(group.team_leader?._id) === userId;
    const isOwner = role === 'teacher' && String(group.teacher_id?._id) === userId;

    res.json({
      group: {
        id: group._id,
        name: group.name,
        class_id: group.class_id?._id,
        class_name: group.class_id?.name,
        members: (group.members || []).map(m => ({ id: m._id, name: m.name })),
        team_leader: group.team_leader ? { id: group.team_leader._id, name: group.team_leader.name } : null,
        teacher_id: group.teacher_id?._id,
        teacher_name: group.teacher_id?.name,
        is_team_leader: isTeamLeader,
        is_owner: isOwner,
        can_post: !group.is_ended,
        is_ended: group.is_ended || false,
        ended_at: group.ended_at || null,
        messages: (group.messages || []).map(msg => ({
          id: msg._id,
          author_id: msg.author_id,
          author_name: msg.author_name,
          author_role: msg.author_role || 'student',
          message_type: msg.message_type || 'text',
          content: msg.content,
          voice_url: msg.voice_url || null,
          voice_duration: msg.voice_duration || null,
          created_at: msg.created_at,
        })),
        created_at: group.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student: list all groups the student belongs to ─────────────────────── */
const getMyGroups = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const groups = await DiscussionGroup.find({ members: userId })
      .sort({ updated_at: -1 })
      .populate('class_id', 'name')
      .populate('members', 'name')
      .populate('team_leader', 'name')
      .populate('teacher_id', 'name')
      .lean();

    const result = groups.map(g => ({
      id: g._id,
      name: g.name,
      class_id: g.class_id?._id,
      class_name: g.class_id?.name,
      member_count: g.members?.length || 0,
      members: (g.members || []).map(m => ({ id: m._id, name: m.name })),
      team_leader: g.team_leader ? { id: g.team_leader._id, name: g.team_leader.name } : null,
      teacher_id: g.teacher_id?._id,
      teacher_name: g.teacher_id?.name,
      is_team_leader: String(g.team_leader?._id) === String(req.user.id),
      message_count: g.messages?.length || 0,
      last_message: g.messages?.length
        ? g.messages[g.messages.length - 1]
        : null,
      updated_at: g.updated_at,
    }));

    res.json({ groups: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student (always), or any teacher assigned to the class: post a message ── */
const postMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const userId = String(req.user.id);
    const role   = req.user.role;

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    if (group.is_ended) {
      return res.status(403).json({ message: 'This conversation has ended. No one can post anymore.' });
    }

    if (role === 'teacher') {
      const allowed = await isAssignedTeacher(group.class_id, userId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this class.' });
    } else {
      const isMember = group.members.some(m => String(m) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const author = await User.findById(userId, 'name').lean();
    const msg = {
      author_id:    userId,
      author_name:  author?.name || 'Unknown',
      author_role:  role === 'teacher' ? 'teacher' : 'student',
      message_type: 'text',
      content: content.trim(),
    };

    group.messages.push(msg);
    await group.save();

    const saved = group.messages[group.messages.length - 1];
    res.status(201).json({
      message: 'Message sent',
      msg: {
        id: saved._id,
        author_id: saved.author_id,
        author_name: saved.author_name,
        author_role: saved.author_role,
        message_type: saved.message_type,
        content: saved.content,
        created_at: saved.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student or any assigned teacher: post a voice note ─────────────────── */
const postVoiceNote = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role   = req.user.role;

    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded.' });
    }

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    if (group.is_ended) {
      return res.status(403).json({ message: 'This conversation has ended. No one can post anymore.' });
    }

    if (role === 'teacher') {
      const allowed = await isAssignedTeacher(group.class_id, userId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this class.' });
    } else {
      const isMember = group.members.some(m => String(m) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const author = await User.findById(userId, 'name').lean();
    const duration = parseFloat(req.body.duration) || null; // client sends duration in seconds

    const msg = {
      author_id:      userId,
      author_name:    author?.name || 'Unknown',
      author_role:    role === 'teacher' ? 'teacher' : 'student',
      message_type:   'voice',
      content:        '',          // no text for voice notes
      voice_url:      req.file.path, // Cloudinary URL returned by multer-storage-cloudinary
      voice_duration: duration,
    };

    group.messages.push(msg);
    await group.save();

    const saved = group.messages[group.messages.length - 1];
    res.status(201).json({
      message: 'Voice note sent',
      msg: {
        id:             saved._id,
        author_id:      saved.author_id,
        author_name:    saved.author_name,
        author_role:    saved.author_role,
        message_type:   saved.message_type,
        content:        saved.content,
        voice_url:      saved.voice_url,
        voice_duration: saved.voice_duration,
        created_at:     saved.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Author: delete a single message of their own (group conversation) ──── */
const deleteMessage = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role   = req.user.role;

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    // Must still have access to the conversation to act within it.
    if (role === 'teacher') {
      const allowed = await isAssignedTeacher(group.class_id, userId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this class.' });
    } else {
      const isMember = group.members.some(m => String(m) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const msg = group.messages.id(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    if (String(msg.author_id) !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    group.messages.pull({ _id: req.params.messageId });
    await group.save();

    res.json({ message: 'Message deleted.', message_id: req.params.messageId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Author: clear (delete) every message they've sent in this group ────── */
const clearMyMessages = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role   = req.user.role;

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    if (role === 'teacher') {
      const allowed = await isAssignedTeacher(group.class_id, userId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this class.' });
    } else {
      const isMember = group.members.some(m => String(m) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const before = group.messages.length;
    group.messages = group.messages.filter(m => String(m.author_id) !== userId);
    const removed = before - group.messages.length;
    await group.save();

    res.json({ message: `Cleared ${removed} message(s).`, removed_count: removed });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher (owner): end conversation (everyone loses typing access) ───── */
const endConversation = async (req, res) => {
  try {
    const group = await DiscussionGroup.findOne({
      _id: req.params.id,
      teacher_id: req.user.id,
    });
    if (!group) return res.status(404).json({ message: 'Group not found or you are not the owner.' });
    if (group.is_ended) return res.status(400).json({ message: 'Conversation already ended.' });

    group.is_ended = true;
    group.ended_at = new Date();
    await group.save();
    res.json({ message: 'Conversation ended. No one can post anymore.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Poll for new messages (real-time simulation) ────────────────────────── */
const getGroupMessages = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role = req.user.role;
    const since = req.query.since; // ISO timestamp

    const group = await DiscussionGroup.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    // Access check
    if (role === 'teacher') {
      const allowed = await isAssignedTeacher(group.class_id, userId);
      if (!allowed) return res.status(403).json({ message: 'Access denied.' });
    } else {
      const isMember = group.members.some(m => String(m) === userId);
      if (!isMember) return res.status(403).json({ message: 'Access denied.' });
    }

    let msgs = group.messages || [];
    if (since) {
      const sinceDate = new Date(since);
      msgs = msgs.filter(m => new Date(m.created_at) > sinceDate);
    }

    res.json({
      messages: msgs.map(m => ({
        id: m._id,
        author_id: m.author_id,
        author_name: m.author_name,
        author_role: m.author_role,
        message_type: m.message_type || 'text',
        content: m.content,
        voice_url: m.voice_url || null,
        voice_duration: m.voice_duration || null,
        created_at: m.created_at,
      })),
      is_ended: group.is_ended || false,
      message_count: group.messages.length,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ══════════════════════════════════════════════════════════════════════════
   TEAM LEADER <-> TEACHER PRIVATE DM
   A private 1:1 channel between the group's team leader and its owning
   teacher (teacher_id). No one else (other members, other teachers) can
   read or post here.
══════════════════════════════════════════════════════════════════════════ */

// Confirms the requester is either the team leader or the owning teacher,
// and returns their role label for convenience.
function leaderDmRole(group, userId, role) {
  if (role === 'student' && String(group.team_leader) === userId) return 'student';
  if (role === 'teacher' && String(group.teacher_id) === userId) return 'teacher';
  return null;
}

/* ── Team leader or owning teacher: fetch / poll the private DM thread ───── */
const getLeaderDm = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const since  = req.query.since;

    const group = await DiscussionGroup.findById(req.params.id)
      .populate('team_leader', 'name')
      .populate('teacher_id', 'name')
      .lean();
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const myRole = leaderDmRole(group, userId, req.user.role);
    if (!myRole) return res.status(403).json({ message: 'Only the team leader and the group teacher can access this DM.' });

    let msgs = group.leader_messages || [];
    if (since) {
      const sinceDate = new Date(since);
      msgs = msgs.filter(m => new Date(m.created_at) > sinceDate);
    }

    res.json({
      peer: myRole === 'student'
        ? { id: group.teacher_id?._id, name: group.teacher_id?.name, role: 'teacher' }
        : { id: group.team_leader?._id, name: group.team_leader?.name, role: 'student' },
      messages: msgs.map(m => ({
        id: m._id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        sender_role: m.sender_role,
        content: m.content,
        created_at: m.created_at,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Team leader or owning teacher: send a message in the private DM ────── */
const postLeaderDm = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }
    const userId = String(req.user.id);

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const myRole = leaderDmRole(group, userId, req.user.role);
    if (!myRole) return res.status(403).json({ message: 'Only the team leader and the group teacher can access this DM.' });

    const sender = await User.findById(userId, 'name').lean();
    const msg = {
      sender_id:   userId,
      sender_name: sender?.name || 'Unknown',
      sender_role: myRole,
      content:     content.trim(),
    };

    group.leader_messages.push(msg);
    await group.save();

    const saved = group.leader_messages[group.leader_messages.length - 1];
    res.status(201).json({
      message: 'Message sent',
      msg: {
        id: saved._id,
        sender_id: saved.sender_id,
        sender_name: saved.sender_name,
        sender_role: saved.sender_role,
        content: saved.content,
        created_at: saved.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Author: delete a single message of their own in the leader DM ──────── */
const deleteLeaderDmMessage = async (req, res) => {
  try {
    const userId = String(req.user.id);

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const myRole = leaderDmRole(group, userId, req.user.role);
    if (!myRole) return res.status(403).json({ message: 'Only the team leader and the group teacher can access this DM.' });

    const msg = group.leader_messages.id(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    if (String(msg.sender_id) !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    group.leader_messages.pull({ _id: req.params.messageId });
    await group.save();

    res.json({ message: 'Message deleted.', message_id: req.params.messageId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Author: clear (delete) every message they've sent in the leader DM ─── */
const clearMyLeaderDmMessages = async (req, res) => {
  try {
    const userId = String(req.user.id);

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const myRole = leaderDmRole(group, userId, req.user.role);
    if (!myRole) return res.status(403).json({ message: 'Only the team leader and the group teacher can access this DM.' });

    const before = group.leader_messages.length;
    group.leader_messages = group.leader_messages.filter(m => String(m.sender_id) !== userId);
    const removed = before - group.leader_messages.length;
    await group.save();

    res.json({ message: `Cleared ${removed} message(s).`, removed_count: removed });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getGroups, createGroup, deleteGroup, getGroup, getMyGroups,
  postMessage, postVoiceNote, deleteMessage, clearMyMessages,
  endConversation, getGroupMessages,
  getLeaderDm, postLeaderDm, deleteLeaderDmMessage, clearMyLeaderDmMessages,
};
