/**
 * Helpers to create in-app Notification documents automatically
 * when key events occur (assignment posted, document posted, etc.)
 */
const { Notification, Class, User } = require('../models/db');

/**
 * Create a scoped in-app notification for a class.
 * type: 'info' | 'success' | 'warning' | 'error'
 */
async function createInAppNotification({ title, message, type = 'info', classId, teacherId }) {
  try {
    await Notification.create({
      title,
      message,
      type,
      class_id: classId || null,
      teacher_id: teacherId,
    });
  } catch (err) {
    console.error('createInAppNotification error:', err.message);
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

module.exports = { createInAppNotification, getStudentEmails, getTeacherEmail };
