const mongoose = require('mongoose');
const { DiscussionGroup, Class, User } = require('../models/db');

// ── Teacher: list all groups they created (optionally filtered by class) ──
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
      .lean();

    const result = groups.map(g => ({
      id: g._id,
      name: g.name,
      class_id: g.class_id?._id,
      class_name: g.class_id?.name,
      member_count: g.members?.length || 0,
      members: (g.members || []).map(m => ({ id: m._id, name: m.name })),
      message_count: g.messages?.length || 0,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));

    res.json({ groups: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Teacher: create a group for a class ──────────────────────────────────
const createGroup = async (req, res) => {
  try {
    const { name, classId, memberIds } = req.body;
    if (!name || !classId || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'Group name, class, and at least one member are required.' });
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

    const group = await DiscussionGroup.create({
      name: name.trim(),
      class_id: classId,
      teacher_id: req.user.id,
      members: validMembers,
      messages: [],
    });

    res.status(201).json({ message: 'Group created', id: group._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Teacher: delete a group they own ─────────────────────────────────────
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

// ── Shared: fetch a single group thread (teacher or member student) ───────
const getGroup = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const role   = req.user.role;

    const group = await DiscussionGroup.findById(req.params.id)
      .populate('class_id', 'name')
      .populate('members', 'name')
      .lean();
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    // Access control
    if (role === 'teacher') {
      if (String(group.teacher_id) !== userId) {
        return res.status(403).json({ message: 'You can only view groups you created.' });
      }
    } else {
      const isMember = (group.members || []).some(m => String(m._id) === userId);
      if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    res.json({
      group: {
        id: group._id,
        name: group.name,
        class_id: group.class_id?._id,
        class_name: group.class_id?.name,
        members: (group.members || []).map(m => ({ id: m._id, name: m.name })),
        messages: (group.messages || []).map(msg => ({
          id: msg._id,
          author_id: msg.author_id,
          author_name: msg.author_name,
          content: msg.content,
          created_at: msg.created_at,
        })),
        created_at: group.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Student: list all groups the student belongs to ───────────────────────
const getMyGroups = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const groups = await DiscussionGroup.find({ members: userId })
      .sort({ updated_at: -1 })
      .populate('class_id', 'name')
      .populate('members', 'name')
      .lean();

    const result = groups.map(g => ({
      id: g._id,
      name: g.name,
      class_id: g.class_id?._id,
      class_name: g.class_id?.name,
      member_count: g.members?.length || 0,
      members: (g.members || []).map(m => ({ id: m._id, name: m.name })),
      message_count: g.messages?.length || 0,
      last_message: g.messages?.length
        ? g.messages[g.messages.length - 1]
        : null,
      updated_at: g.updated_at,
    }));

    res.json({ groups: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Student (or teacher peek): post a message to the group ───────────────
// Only enrolled members can post; teachers cannot post (read-only for them).
const postMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const userId = String(req.user.id);
    const role   = req.user.role;

    if (role === 'teacher') {
      return res.status(403).json({ message: 'Teachers observe groups — only students can post.' });
    }

    const group = await DiscussionGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const isMember = group.members.some(m => String(m) === userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this group.' });

    const author = await User.findById(userId, 'name').lean();
    const msg = {
      author_id:   userId,
      author_name: author?.name || 'Unknown',
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
        content: saved.content,
        created_at: saved.created_at,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getGroups, createGroup, deleteGroup, getGroup, getMyGroups, postMessage };
