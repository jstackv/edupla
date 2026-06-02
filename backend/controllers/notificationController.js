const mongoose = require('mongoose');
const { Notification, Class } = require('../models/db');

const getNotifications = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let filter;
    if (role === 'teacher') {
      filter = { teacher_id: userId };
    } else {
      const enrolled = await Class.find({ students: userId }, '_id').lean();
      const enrolledIds = enrolled.map(c => c._id);
      filter = { $or: [{ class_id: null }, { class_id: { $in: enrolledIds } }] };
    }

    const notifications = await Notification.find(filter)
      .sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
      .populate('class_id', 'name').populate('teacher_id', 'name').lean();

    const result = notifications.map(n => ({
      ...n, id: n._id,
      class_name: n.class_id?.name,
      teacher_name: n.teacher_id?.name,
      is_read: n.read_by.some(id => id.toString() === userId.toString()),
    }));

    res.json({ notifications: result, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;

    let filter;
    if (role === 'teacher') {
      filter = { teacher_id: userId, read_by: { $ne: userId } };
    } else {
      const enrolled = await Class.find({ students: userId }, '_id').lean();
      const enrolledIds = enrolled.map(c => c._id);
      filter = {
        $or: [{ class_id: null }, { class_id: { $in: enrolledIds } }],
        read_by: { $ne: userId },
      };
    }
    const count = await Notification.countDocuments(filter);
    res.json({ count });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createNotification = async (req, res) => {
  try {
    const { title, message, type, classId } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });
    const n = await Notification.create({
      title, message, type: type || 'info',
      class_id: classId || null, teacher_id: req.session.user.id,
    });
    res.status(201).json({ message: 'Notification created', id: n._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateNotification = async (req, res) => {
  try {
    const { title, message, type, classId } = req.body;
    const result = await Notification.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id },
      { title, message, type: type || 'info', class_id: classId || null }
    );
    if (!result) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteNotification = async (req, res) => {
  try {
    const result = await Notification.findOneAndDelete({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!result) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const markRead = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await Notification.updateOne({ _id: req.params.id }, { $addToSet: { read_by: userId } });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const markAllRead = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;

    let filter;
    if (role === 'teacher') {
      filter = { teacher_id: userId };
    } else {
      const enrolled = await Class.find({ students: userId }, '_id').lean();
      filter = { $or: [{ class_id: null }, { class_id: { $in: enrolled.map(c => c._id) } }] };
    }
    await Notification.updateMany(filter, { $addToSet: { read_by: userId } });
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getNotifications, getUnreadCount, createNotification, updateNotification, deleteNotification, markRead, markAllRead };
