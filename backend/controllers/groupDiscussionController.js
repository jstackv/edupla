const mongoose = require('mongoose');
const { DiscussionGroup, Class, User } = require('../models/db');
const { createInAppNotification } = require('../services/notificationHelpers');

/* ── helpers ──────────────────────────────────────────────────────────── */

// Find this teacher's invitation within a group's invitations array (if any).
function findInvitation(group, teacherId) {
  return (group.invitations || []).find(i => String(i.teacher_id?._id || i.teacher_id) === String(teacherId));
}

// A teacher only gets read/write access to a group's conversation once
// their invitation (sent by the team leader) has been accepted. This
// applies to every teacher, including the one who created the group.
function hasAcceptedAccess(group, teacherId) {
  const invite = findInvitation(group, teacherId);
  return !!invite && invite.status === 'accepted';
}

/* ── Teacher: list all groups they created (optionally filtered by class) ── */
const getGroups = async (req, res) => {
  try {
    const { classId } = req.query;
    const teacherId = req.user.id;

    const filter = { teacher_id: teacherId };
    if (classId) filter.class_id = classId;

    const groups = await DiscussionGroup.find(filter)
      .sort({ created_at: -1 })
      .populate('class_id', 'name')
      .populate('members', 'name')
      .populate('team_leader', 'name')
      .lean();

    const result = groups.map(g => {
      const myInvite = findInvitation(g, teacherId);
      return {
        id: g._id,
        name: g.name,
        class_id: g.class_id?._id,
        class_name: g.class_id?.name,
        member_count: g.members?.length || 0,
        members: (g.members || []).map(m => ({ id: m._id, name: m.name })),
        team_leader: g.team_leader ? { id: g.team_leader._id, name: g.team_leader.name } : null,
        message_count: g.messages?.length || 0,
        pending_invitation_count: (g.invitations || []).filter(i => i.status === 'pending').length,
        accepted_teacher_count: (g.invitations || []).filter(i => i.status === 'accepted').length,
        // Whether THIS teacher (the creator viewing their own list) currently has
        // an accepted invitation — i.e. whether they personally can open the chat.
        my_invitation_status: myInvite ? myInvite.status : null,
        created_at: g.created_at,
        updated_at: g.updated_at,
      };
    });

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
      invitations: [],
      messages: [],
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
    if (!result) return res.status(404).json({ message: 'Group not found.' });
    res.json({ message: 'Group deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Shared: fetch a single group's conversation ─────────────────────────
   - Student: must be a member.
   - Teacher: must have an ACCEPTED invitation from the team leader — being
     the group's creator does not grant access on its own. */
const getGroup = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role   = req.user.role;

    const group = await DiscussionGroup.findById(req.params.id)
      .populate('class_id', 'name')
      .populate('members', 'name')
      .populate('team_leader', 'name')
      .populate('invitations.teacher_id', 'name email')
      .lean();
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    let myInvite = null;
    if (role === 'teacher') {
      myInvite = findInvitation(group, userId);
      if (!myInvite || myInvite.status !== 'accepted') {
        return res.status(403).json({
          message: 'You need an accepted invitation from the team leader to view this group\'s conversation.',
          invitation_status: myInvite ? myInvite.status : null,
        });
      }
    } else {
      const isMember = (group.members || []).some(m => String(m._id) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const isTeamLeader = role === 'student' && String(group.team_leader?._id) === userId;

    res.json({
      group: {
        id: group._id,
        name: group.name,
        class_id: group.class_id?._id,
        class_name: group.class_id?.name,
        members: (group.members || []).map(m => ({ id: m._id, name: m.name })),
        team_leader: group.team_leader ? { id: group.team_leader._id, name: group.team_leader.name } : null,
        is_team_leader: isTeamLeader,
        can_post: group.is_ended ? false : (role === 'student' ? true : myInvite?.status === 'accepted'),
        is_ended: group.is_ended || false,
        ended_at: group.ended_at || null,
        // Invitations are visible to every participant so members know which
        // teacher(s) the team leader has brought into the conversation.
        invitations: (group.invitations || []).map(i => ({
          id: i._id,
          teacher_id: i.teacher_id?._id || i.teacher_id,
          teacher_name: i.teacher_id?.name || 'Unknown',
          status: i.status,
          invited_at: i.created_at,
          responded_at: i.responded_at,
        })),
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
      .lean();

    const result = groups.map(g => ({
      id: g._id,
      name: g.name,
      class_id: g.class_id?._id,
      class_name: g.class_id?.name,
      member_count: g.members?.length || 0,
      members: (g.members || []).map(m => ({ id: m._id, name: m.name })),
      team_leader: g.team_leader ? { id: g.team_leader._id, name: g.team_leader.name } : null,
      is_team_leader: String(g.team_leader?._id) === String(req.user.id),
      message_count: g.messages?.length || 0,
      accepted_teacher_count: (g.invitations || []).filter(i => i.status === 'accepted').length,
      last_message: g.messages?.length
        ? g.messages[g.messages.length - 1]
        : null,
      updated_at: g.updated_at,
    }));

    res.json({ groups: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Team leader: list teachers (assigned to the group's class) who can
   be invited, along with any existing invitation status for each ────────── */
const getEligibleTeachers = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only the team leader can view this.' });
    }
    const userId = String(req.user.id);

    const group = await DiscussionGroup.findById(req.params.id)
      .populate('class_id', 'teacher_id extra_teachers')
      .lean();
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (String(group.team_leader) !== userId) {
      return res.status(403).json({ message: 'Only the team leader can invite a teacher.' });
    }

    const cls = group.class_id;
    const teacherIds = [
      ...(cls?.teacher_id ? [cls.teacher_id] : []),
      ...(cls?.extra_teachers || []),
    ];
    const teachers = await User.find({ _id: { $in: teacherIds } }, 'name email').lean();

    const result = teachers.map(t => {
      const invite = findInvitation(group, t._id);
      return {
        id: t._id,
        name: t.name,
        email: t.email,
        invitation_status: invite ? invite.status : null, // null | 'pending' | 'accepted' | 'denied'
      };
    });

    res.json({ teachers: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Team leader: invite a teacher into the group ────────────────────────── */
const inviteTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;
    if (!teacherId) return res.status(400).json({ message: 'Please choose a teacher to invite.' });
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only the team leader can invite a teacher.' });
    }
    const userId = String(req.user.id);

    const group = await DiscussionGroup.findById(req.params.id).populate('class_id', 'teacher_id extra_teachers name');
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (String(group.team_leader) !== userId) {
      return res.status(403).json({ message: 'Only the team leader can invite a teacher.' });
    }

    // The invited teacher must actually be assigned to this class
    const cls = group.class_id;
    const eligible = [String(cls?.teacher_id), ...(cls?.extra_teachers || []).map(String)];
    if (!eligible.includes(String(teacherId))) {
      return res.status(400).json({ message: 'You can only invite a teacher assigned to this class.' });
    }

    const existing = group.invitations.find(i => String(i.teacher_id) === String(teacherId));
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ message: 'This teacher already has a pending invitation.' });
    }
    if (existing && existing.status === 'accepted') {
      return res.status(400).json({ message: 'This teacher is already part of the conversation.' });
    }

    if (existing) {
      // Re-send after a previous denial
      existing.status = 'pending';
      existing.invited_by = userId;
      existing.responded_at = null;
    } else {
      group.invitations.push({ teacher_id: teacherId, invited_by: userId, status: 'pending' });
    }

    await group.save();
    res.status(201).json({ message: 'Invitation sent' });

    // Best-effort notification to the invited teacher
    try {
      const leader = await User.findById(userId, 'name').lean();
      await createInAppNotification({
        title: 'Group invitation: ' + group.name,
        message: (leader?.name || 'A student') + ' invited you to join the conversation in "' + group.name + '".',
        type: 'info',
        classId: group.class_id?._id || group.class_id,
        teacherId,
        audience: 'teacher',
      });
    } catch (err) { console.error('Notification error (group invite):', err.message); }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: list invitations addressed to me, across all groups ───────── */
const getMyInvitations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const groups = await DiscussionGroup.find({ 'invitations.teacher_id': userId })
      .populate('class_id', 'name')
      .populate('team_leader', 'name')
      .lean();

    const result = [];
    groups.forEach(g => {
      (g.invitations || []).forEach(inv => {
        if (String(inv.teacher_id) === String(userId)) {
          result.push({
            invitation_id: inv._id,
            group_id: g._id,
            group_name: g.name,
            class_name: g.class_id?.name,
            team_leader_name: g.team_leader?.name,
            status: inv.status,
            invited_at: inv.created_at,
            responded_at: inv.responded_at,
          });
        }
      });
    });

    result.sort((a, b) => new Date(b.invited_at) - new Date(a.invited_at));
    res.json({ invitations: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: accept or deny an invitation addressed to me ───────────────── */
const respondToInvitation = async (req, res) => {
  try {
    const { action } = req.body; // 'accept' | 'deny'
    if (!['accept', 'deny'].includes(action)) {
      return res.status(400).json({ message: "Action must be 'accept' or 'deny'." });
    }
    const userId = String(req.user.id);

    const group = await DiscussionGroup.findOne({ 'invitations._id': req.params.invitationId });
    if (!group) return res.status(404).json({ message: 'Invitation not found.' });

    const invitation = group.invitations.find(i => String(i._id) === req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Invitation not found.' });
    if (String(invitation.teacher_id) !== userId) {
      return res.status(403).json({ message: 'This invitation is not addressed to you.' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'This invitation has already been responded to.' });
    }

    invitation.status = action === 'accept' ? 'accepted' : 'denied';
    invitation.responded_at = new Date();
    await group.save();

    res.json({ message: action === 'accept' ? 'Invitation accepted — you now have access to the conversation.' : 'Invitation declined.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student (always), or teacher with an accepted invitation: post a message ── */
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
      if (!hasAcceptedAccess(group, userId)) {
        return res.status(403).json({ message: 'You need an accepted invitation from the team leader to post in this group.' });
      }
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
        content: saved.content,
        created_at: saved.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Student or accepted teacher: post a voice note ─────────────────────── */
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
      if (!hasAcceptedAccess(group, userId)) {
        return res.status(403).json({ message: 'You need an accepted invitation from the team leader to post in this group.' });
      }
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


const leaveGroup = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    // Mark all this teacher's accepted/pending invitations as revoked
    let changed = false;
    (group.invitations || []).forEach(inv => {
      if (String(inv.teacher_id) === userId && ['accepted', 'pending'].includes(inv.status)) {
        inv.status = 'left';
        changed = true;
      }
    });
    if (!changed) return res.status(400).json({ message: 'You are not in this group.' });

    await group.save();
    res.json({ message: 'You have left the group. Students may continue chatting.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── Teacher: end conversation (everyone loses posting access) ──────────── */
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
      if (!hasAcceptedAccess(group, userId)) {
        return res.status(403).json({ message: 'Access denied.' });
      }
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

module.exports = { getGroups, createGroup, deleteGroup, getGroup, getMyGroups, postMessage, postVoiceNote,
  getEligibleTeachers, inviteTeacher, getMyInvitations, respondToInvitation,
  leaveGroup, endConversation, getGroupMessages };