const mongoose = require('mongoose');
const { Announcement, Class, User } = require('../models/db');
const { notifyAnnouncement } = require('../services/emailService');
const { createInAppNotification, getTeacherEmail } = require('../services/notificationHelpers');

const getAnnouncements = async (req, res) => {
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
        $or: [{ class_id: null }, { class_id: { $in: enrolledIds } }],
        $and: [{ $or: [{ title: searchRegex }, { content: searchRegex }] }],
        ...(classId && { class_id: classId }),
      };
    }

    const announcements = await Announcement.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('class_id', 'name')
      .populate('teacher_id', 'name')
      .lean();

    const result = announcements.map(a => ({
      ...a, id: a._id,
      class_name: a.class_id?.name,
      teacher_name: a.teacher_id?.name,
    }));

    res.json({ announcements: result, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, classId } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content are required' });
    const a = await Announcement.create({
      title, content, class_id: classId || null, teacher_id: req.session.user.id
    });
    res.status(201).json({ message: 'Announcement created', id: a._id });

    // Fire notifications async
    try {
      const [teacher, teacherEmail] = await Promise.all([
        User.findById(req.session.user.id, 'name').lean(),
        getTeacherEmail(req.session.user.id),
      ]);
      let studentEmails = [];
      let className = null;
      if (classId) {
        const cls = await Class.findById(classId).populate('students', 'email').lean();
        studentEmails = cls?.students?.map(s => s.email).filter(Boolean) || [];
        className = cls?.name || null;
      }
      await createInAppNotification({
        title: 'Announcement: ' + title,
        message: (teacher?.name || 'Your teacher') + ': ' + content.substring(0, 120) + (content.length > 120 ? '...' : ''),
        type: 'info',
        classId: classId || null,
        teacherId: req.session.user.id,
        linkType: 'announcement',
        linkId: a._id,
      });
      if (studentEmails.length) {
        notifyAnnouncement({
          studentEmails, teacherEmail,
          announcementTitle: title, content, className,
          teacherName: teacher?.name || 'Your teacher',
        }).catch(err => console.error('Email error:', err.message));
      }
    } catch (err) { console.error('Notification error (announcement):', err.message); }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { title, content, classId } = req.body;
    const result = await Announcement.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id },
      { title, content, class_id: classId || null }
    );
    if (!result) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ message: 'Announcement updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const result = await Announcement.findOneAndDelete({
      _id: req.params.id, teacher_id: req.session.user.id
    });
    if (!result) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ message: 'Announcement deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
