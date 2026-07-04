/**
 * Helpers to create in-app Notification documents automatically
 * when key events occur (assignment posted, document posted, etc.)
 */
const { Notification, Class, User } = require('../models/db');

/**
 * Create a scoped in-app notification for a class.
 * type: 'info' | 'success' | 'warning' | 'error'
 */
async function createInAppNotification({ title, message, type = 'info', classId, teacherId, audience = 'students', linkType = null, linkId = null, courseId = null }) {
  try {
    await Notification.create({
      title,
      message,
      type,
      class_id: classId || null,
      teacher_id: teacherId,
      audience,
      link_type: linkType || null,
      link_id: linkId || null,
      course_id: courseId || null,
    });
  } catch (err) {
    console.error('createInAppNotification error:', err.message);
  }
}

/**
 * Create a notification addressed to exactly ONE user (e.g. "you were added
 * to a group"), bypassing the usual class-wide broadcast scoping.
 * type: 'info' | 'success' | 'warning' | 'error'
 */
async function createDirectNotification({ title, message, type = 'info', classId, teacherId, recipientId, linkType = null, linkId = null }) {
  try {
    await Notification.create({
      title,
      message,
      type,
      class_id: classId || null,
      teacher_id: teacherId,
      audience: 'students',
      recipient_id: recipientId,
      link_type: linkType || null,
      link_id: linkId || null,
    });
  } catch (err) {
    console.error('createDirectNotification error:', err.message);
  }
}

/**
 * Get student emails enrolled in a class.
 * Returns array of email strings.
 */
async function getStudentEmails(classId) {
  try {
    const cls = await Class.findById(classId).populate('students', 'email').lean();
    if (!cls) return [];
    return cls.students.map(s => s.email).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get teacher email by ID.
 */
async function getTeacherEmail(teacherId) {
  try {
    const teacher = await User.findById(teacherId, 'email').lean();
    return teacher?.email || null;
  } catch {
    return null;
  }
}

module.exports = { createInAppNotification, createDirectNotification, getStudentEmails, getTeacherEmail };