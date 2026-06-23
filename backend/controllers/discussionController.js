const mongoose = require('mongoose');
const { Discussion, Class, User } = require('../models/db');
const { createInAppNotification } = require('../services/notificationHelpers');

// List discussions.
// - Teacher: only discussions THEY hosted (other teachers on the same class never see it).
// - Student: discussions for any class they're enrolled in.
const getDiscussions = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, classId } = req.query;
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;
    const searchRegex = new RegExp(search, 'i');

    let filter;
    if (role === 'teacher') {
      filter = {
        teacher_id: userId,
        $or: [{ title: searchRegex }, { content: searchRegex }],
        ...(classId && { class_id: classId }),
      };
    } else {
      const enrolled = await Class.find({ students: userId }, '_id').lean();
      const enrolledIds = enrolled.map(c => c._id);
      filter = {
        class_id: { $in: enrolledIds },
        $or: [{ title: searchRegex }, { content: searchRegex }],
        ...(classId && { class_id: classId }),
      };
    }

    const [discussions, total] = await Promise.all([
      Discussion.find(filter)
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('class_id', 'name')
        .populate('teacher_id', 'name')
        .lean(),
      Discussion.countDocuments(filter),
    ]);

    const result = discussions.map(d => ({
      id: d._id,
      title: d.title,
      content: d.content,
      class_id: d.class_id?._id,
      class_name: d.class_id?.name,
      teacher_name: d.teacher_id?.name,
      comment_count: d.comments?.length || 0,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    res.json({ discussions: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Full thread (post + every comment), with the same access rule enforced.
const getDiscussion = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const role = req.session.user.role;

    const discussion = await Discussion.findById(req.params.id)
      .populate('class_id', 'name')
      .populate('teacher_id', 'name')
      .populate('comments.author_id', 'name')
      .lean();
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' });

    if (role === 'teacher') {
      if (String(discussion.teacher_id?._id) !== String(userId)) {
        return res.status(403).json({ message: 'You can only view discussions you created.' });
      }
    } else {
      const enrolled = await Class.findOne({ _id: discussion.class_id?._id, students: userId }).lean();
      if (!enrolled) return res.status(403).json({ message: 'You are not enrolled in this class.' });
    }

    res.json({
      discussion: {
        id: discussion._id,
        title: discussion.title,
        content: discussion.content,
        class_id: discussion.class_id?._id,
        class_name: discussion.class_id?.name,
        teacher_id: discussion.teacher_id?._id,
        teacher_name: discussion.teacher_id?.name,
        created_at: discussion.created_at,
        comments: (discussion.comments || []).map(c => ({
          id: c._id,
          author_id: c.author_id?._id,
          author_name: c.author_id?.name || 'Unknown',
          author_role: c.author_role,
          content: c.content,
          created_at: c.created_at,
        })),
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Teacher posts a discussion to one of their own classes.
const createDiscussion = async (req, res) => {
  try {
    const { title, content, classId } = req.body;
    if (!title || !content || !classId) {
      return res.status(400).json({ message: 'Title, opening message, and class are required' });
    }

    // Verify the teacher is actually assigned to this class (as class teacher or extra teacher)
    const teacherClass = await Class.findOne({
      _id: classId,
      $or: [{ teacher_id: req.session.user.id }, { extra_teachers: req.session.user.id }],
    }).lean();
    if (!teacherClass) return res.status(403).json({ message: 'You are not assigned to this class.' });

    const d = await Discussion.create({
      title, content, class_id: classId, teacher_id: req.session.user.id, comments: [],
    });
    res.status(201).json({ message: 'Discussion posted', id: d._id });

    // Fire notification async — every student in the class gets pinged
    try {
      const teacher = await User.findById(req.session.user.id, 'name').lean();
      await createInAppNotification({
        title: 'New Discussion: ' + title,
        message: (teacher?.name || 'Your teacher') + ' started a discussion in ' +
          (teacherClass.name || 'your class') + ': ' +
          content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        type: 'info',
        classId,
        teacherId: req.session.user.id,
        audience: 'students',
      });
    } catch (err) { console.error('Notification error (discussion):', err.message); }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Host-only delete.
const deleteDiscussion = async (req, res) => {
  try {
    const result = await Discussion.findOneAndDelete({
      _id: req.params.id, teacher_id: req.session.user.id,
    });
    if (!result) return res.status(404).json({ message: 'Discussion not found' });
    res.json({ message: 'Discussion deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Add a comment — host teacher or any student enrolled in the class.
const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Comment cannot be empty' });

    const userId = req.session.user.id;
    const role = req.session.user.role;

    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' });

    if (role === 'teacher') {
      if (String(discussion.teacher_id) !== String(userId)) {
        return res.status(403).json({ message: 'You can only comment on discussions you created.' });
      }
    } else {
      const enrolled = await Class.findOne({ _id: discussion.class_id, students: userId }).lean();
      if (!enrolled) return res.status(403).json({ message: 'You are not enrolled in this class.' });
    }

    discussion.comments.push({ author_id: userId, author_role: role, content: content.trim() });
    await discussion.save();
    const newComment = discussion.comments[discussion.comments.length - 1];

    const author = await User.findById(userId, 'name').lean();
    res.status(201).json({
      message: 'Comment posted',
      comment: {
        id: newComment._id,
        author_id: userId,
        author_name: author?.name || 'You',
        author_role: role,
        content: newComment.content,
        created_at: newComment.created_at,
      },
    });

    // Notify the "other side" of the conversation async.
    try {
      if (role === 'student') {
        await createInAppNotification({
          title: 'New reply: ' + discussion.title,
          message: (author?.name || 'A student') + ' replied to your discussion.',
          type: 'info',
          classId: discussion.class_id,
          teacherId: discussion.teacher_id,
          audience: 'teacher',
        });
      } else {
        await createInAppNotification({
          title: 'New reply: ' + discussion.title,
          message: (author?.name || 'Your teacher') + ' replied in the discussion.',
          type: 'info',
          classId: discussion.class_id,
          teacherId: discussion.teacher_id,
          audience: 'students',
        });
      }
    } catch (err) { console.error('Notification error (discussion comment):', err.message); }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getDiscussions, getDiscussion, createDiscussion, deleteDiscussion, addComment };