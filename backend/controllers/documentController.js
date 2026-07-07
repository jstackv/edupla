const mongoose = require('mongoose');
const { Document, Class, User } = require('../models/db');
const { cloudinary, getResourceType } = require('../middleware/upload');
const { notifyDocumentPosted } = require('../services/emailService');
const { createInAppNotification, getStudentEmails, getTeacherEmail } = require('../services/notificationHelpers');

const getDocuments = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, classId, courseId } = req.query;
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;
    const searchRegex = new RegExp(search, 'i');

    // Build courseId / classId filter fragment shared by all roles
    const scopeFilter = {};
    if (classId)  scopeFilter.class_id  = new mongoose.Types.ObjectId(classId);
    if (courseId) scopeFilter.course_id = new mongoose.Types.ObjectId(courseId);

    if (role === 'teacher') {
      const filter = {
        teacher_id: userId,
        $or: [{ title: searchRegex }, { description: searchRegex }],
        ...scopeFilter,
      };
      const [docs, total] = await Promise.all([
        Document.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
          .populate('class_id', 'name').populate('course_id', 'name code category').lean(),
        Document.countDocuments(filter),
      ]);
      return res.json({
        documents: docs.map(d => ({
          ...d, id: d._id,
          class_name: d.class_id?.name,
          course_name: d.course_id?.name,
          course_code: d.course_id?.code,
          course_category: d.course_id?.category,
          file_url: d.file_url,
        })),
        total, page: parseInt(page), limit: parseInt(limit),
      });
    }

    // Admin: all documents
    if (role === 'admin') {
      const filter = {
        $or: [{ title: searchRegex }, { description: searchRegex }],
        ...scopeFilter,
      };
      const [docs, total] = await Promise.all([
        Document.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
          .populate('class_id', 'name').populate('teacher_id', 'name')
          .populate('course_id', 'name code category').lean(),
        Document.countDocuments(filter),
      ]);
      return res.json({
        documents: docs.map(d => ({
          ...d, id: d._id,
          class_name: d.class_id?.name,
          teacher_name: d.teacher_id?.name,
          course_name: d.course_id?.name,
          course_code: d.course_id?.code,
          course_category: d.course_id?.category,
          file_url: d.file_url,
        })),
        total, page: parseInt(page), limit: parseInt(limit),
      });
    }

    // Student: only docs from enrolled classes
    const enrolled = await Class.find({ students: userId }, '_id').lean();
    const enrolledIds = enrolled.map(c => c._id);

    const filter = {
      class_id: { $in: enrolledIds },
      $or: [{ title: searchRegex }, { description: searchRegex }],
      ...scopeFilter,
    };
    const [docs, total] = await Promise.all([
      Document.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
        .populate('class_id', 'name').populate('teacher_id', 'name')
        .populate('course_id', 'name code category').lean(),
      Document.countDocuments(filter),
    ]);
    res.json({
      documents: docs.map(d => ({
        ...d, id: d._id,
        class_name: d.class_id?.name,
        teacher_name: d.teacher_id?.name,
        course_name: d.course_id?.name,
        course_code: d.course_id?.code,
        course_category: d.course_id?.category,
        file_url: d.file_url,
      })),
      total, page: parseInt(page), limit: parseInt(limit),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { title, description, classId, courseId } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    // If a class is specified, verify the teacher is assigned to it
    if (classId) {
      const teacherClass = await Class.findOne({
        _id: classId,
        $or: [{ teacher_id: req.session.user.id }, { extra_teachers: req.session.user.id }]
      }).lean();
      if (!teacherClass) return res.status(403).json({ message: 'You are not assigned to this class.' });
    }
    const doc = await Document.create({
      title, description, class_id: classId || null,
      course_id: courseId || null,
      teacher_id: req.session.user.id,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_size: req.file.size || null,
      mime_type: req.file.mimetype,
      file_url: req.file.path,
    });
    res.status(201).json({ message: 'Document uploaded', id: doc._id });

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
        title: 'New Document: ' + title,
        message: (teacher?.name || 'Your teacher') + ' shared "' + title + '"' + (className ? ' in ' + className : '') + '.',
        type: 'info',
        classId: classId || null,
        teacherId: req.session.user.id,
        linkType: 'document',
        linkId: doc._id,
        courseId: courseId || null,
      });
      if (studentEmails.length) {
        notifyDocumentPosted({
          studentEmails, teacherEmail,
          documentTitle: title, className,
          teacherName: teacher?.name || 'Your teacher',
          description,
        }).catch(err => console.error('Email error:', err.message));
      }
    } catch (err) { console.error('Notification error (document):', err.message); }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateDocument = async (req, res) => {
  try {
    const { title, description, classId, courseId } = req.body;
    const result = await Document.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id },
      { title, description, class_id: classId || null, course_id: courseId || null }
    );
    if (!result) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    // Delete from Cloudinary
    if (doc.filename) {
      try {
        await cloudinary.uploader.destroy(doc.filename, { resource_type: getResourceType(doc.original_name, doc.mime_type) });
      } catch (cloudErr) {
        console.error('Cloudinary delete error:', cloudErr.message);
      }
    }
    res.json({ message: 'Document deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const resolveDocument = async (id, userId, role) => {
  if (role === 'teacher') {
    return Document.findOne({ _id: id, teacher_id: userId }).lean();
  }
  if (role === 'admin') {
    return Document.findById(id).lean();
  }
  // Student: must be enrolled in the document's class
  const enrolled = await Class.find({ students: userId }, '_id').lean();
  const enrolledIds = enrolled.map(c => c._id);
  let doc = await Document.findOne({ _id: id, class_id: { $in: enrolledIds } }).lean();
  if (!doc) doc = await Document.findOne({ _id: id, class_id: null }).lean();
  return doc;
};

const downloadDocument = async (req, res) => {
  try {
    const doc = await resolveDocument(req.params.id, req.session.user.id, req.session.user.role);
    if (!doc || !doc.file_url) return res.status(404).json({ message: 'Document not found' });
    Document.updateOne({ _id: req.params.id }, { $inc: { download_count: 1 } }).catch(() => {});
    res.redirect(doc.file_url);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const viewDocument = async (req, res) => {
  try {
    const doc = await resolveDocument(req.params.id, req.session.user.id, req.session.user.role);
    if (!doc || !doc.file_url) return res.status(404).json({ message: 'Document not found' });
    res.redirect(doc.file_url);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getDocuments, uploadDocument, updateDocument, deleteDocument, downloadDocument, viewDocument };