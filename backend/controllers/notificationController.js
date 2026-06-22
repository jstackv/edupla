const mongoose = require('mongoose');
const { Notification, Class } = require('../models/db');

/**
 * Build the notification visibility filter for a student.
 *
 * A student must only see notifications that are:
 *  1. addressed to students (audience: 'students') — never a 'teacher'-audience
 *     event such as an assignment submission, even if it's stamped with their
 *     own teacher_id/class_id for the teacher's convenience;
 *  2. authored by a teacher who currently teaches one of the student's
 *     enrolled classes;
 *  3. scoped to one of those shared classes (or that same teacher's
 *     class-less notification).
 *
 * Crucially, class_id: null is NOT treated as "broadcast to everyone" — it
 * is only visible to students who share an enrolled class with that specific
 * teacher. This prevents a student from seeing another teacher's
 * notifications just because the notification wasn't tied to a class.
 */
const buildStudentNotificationFilter = async (userId) => {
  const enrolled = await Class.find({ students: userId }, '_id teacher_id extra_teachers').lean();
  const enrolledClassIds = enrolled.map(c => c._id);

  // All teachers (primary + extra) of classes this student is enrolled in.
  const teacherIdSet = new Set();
  enrolled.forEach(c => {
    if (c.teacher_id) teacherIdSet.add(c.teacher_id.toString());
    (c.extra_teachers || []).forEach(t => teacherIdSet.add(t.toString()));
  });
  const teacherIds = [...teacherIdSet].map(id => new mongoose.Types.ObjectId(id));

  if (teacherIds.length === 0) {
    // Not enrolled anywhere — nothing to show.
    return { _id: null };
  }

  return {
    audience: 'students',
    teacher_id: { $in: teacherIds },
    $or: [{ class_id: null }, { class_id: { $in: enrolledClassIds } }],
  };
};

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
      filter = await buildStudentNotificationFilter(userId);
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
      const studentFilter = await buildStudentNotificationFilter(userId);
      filter = { ...studentFilter, read_by: { $ne: userId } };
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
      audience: 'students', // manual notifications composed by a teacher always target their students
    });
    res.status(201).json({ message: 'Notification created', id: n._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateNotification = async (req, res) => {
  try {
    const { title, message, type, classId } = req.body;
    const result = await Notification.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id, audience: 'students' },
      { title, message, type: type || 'info', class_id: classId || null }
    );
    if (!result) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteNotification = async (req, res) => {
  try {
    const result = await Notification.findOneAndDelete({ _id: req.params.id, teacher_id: req.session.user.id, audience: 'students' });
    if (!result) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const markRead = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const role = req.session.user.role;

    // Only allow marking a notification as read if it's actually visible to this user
    // (own notifications for a teacher; teacher-and-class scoped notifications for a student).
    let scope;
    if (role === 'teacher') {
      scope = { teacher_id: new mongoose.Types.ObjectId(userId) };
    } else {
      scope = await buildStudentNotificationFilter(new mongoose.Types.ObjectId(userId));
    }

    const result = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...scope },
      { $addToSet: { read_by: userId } }
    );
    if (!result) return res.status(404).json({ message: 'Notification not found' });
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
      filter = await buildStudentNotificationFilter(userId);
    }
    await Notification.updateMany(filter, { $addToSet: { read_by: userId } });
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getNotifications, getUnreadCount, createNotification, updateNotification, deleteNotification, markRead, markAllRead };