const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Document, Class } = require('../models/db');

const getDocuments = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, classId } = req.query;
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const role = req.session.user.role;
    const searchRegex = new RegExp(search, 'i');

    if (role === 'teacher') {
      const filter = {
        teacher_id: userId,
        $or: [{ title: searchRegex }, { description: searchRegex }],
        ...(classId && { class_id: classId }),
      };
      const [docs, total] = await Promise.all([
        Document.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
          .populate('class_id', 'name').lean(),
        Document.countDocuments(filter),
      ]);
      return res.json({
        documents: docs.map(d => ({ ...d, id: d._id, class_name: d.class_id?.name })),
        total, page: parseInt(page), limit: parseInt(limit),
      });
    }

    // Student: only docs from enrolled classes
    const enrolled = await Class.find({ students: userId }, '_id').lean();
    const enrolledIds = enrolled.map(c => c._id);

    const filter = {
      class_id: { $in: enrolledIds },
      $or: [{ title: searchRegex }, { description: searchRegex }],
      ...(classId && { class_id: classId }),
    };
    const [docs, total] = await Promise.all([
      Document.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
        .populate('class_id', 'name').populate('teacher_id', 'name').lean(),
      Document.countDocuments(filter),
    ]);
    res.json({
      documents: docs.map(d => ({ ...d, id: d._id, class_name: d.class_id?.name, teacher_name: d.teacher_id?.name })),
      total, page: parseInt(page), limit: parseInt(limit),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { title, description, classId } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const doc = await Document.create({
      title, description, class_id: classId || null,
      teacher_id: req.session.user.id,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
    });
    res.status(201).json({ message: 'Document uploaded', id: doc._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateDocument = async (req, res) => {
  try {
    const { title, description, classId } = req.body;
    const result = await Document.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id },
      { title, description, class_id: classId || null }
    );
    if (!result) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const fp = path.join(__dirname, '../uploads/documents', doc.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    res.json({ message: 'Document deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const resolveDocument = async (id, userId, role) => {
  if (role === 'teacher') {
    return Document.findOne({ _id: id, teacher_id: userId }).lean();
  }
  const enrolled = await Class.find({ students: userId }, '_id').lean();
  const enrolledIds = enrolled.map(c => c._id);
  let doc = await Document.findOne({ _id: id, class_id: { $in: enrolledIds } }).lean();
  if (!doc) doc = await Document.findOne({ _id: id, class_id: null }).lean();
  return doc;
};

const downloadDocument = async (req, res) => {
  try {
    const doc = await resolveDocument(req.params.id, req.session.user.id, req.session.user.role);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const fp = path.resolve(__dirname, '../uploads/documents', doc.filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found on server' });
    Document.updateOne({ _id: req.params.id }, { $inc: { download_count: 1 } }).catch(() => {});
    res.download(fp, doc.original_name);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const viewDocument = async (req, res) => {
  try {
    const doc = await resolveDocument(req.params.id, req.session.user.id, req.session.user.role);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const fp = path.resolve(__dirname, '../uploads/documents', doc.filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found on server' });
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(fp).pipe(res);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getDocuments, uploadDocument, updateDocument, deleteDocument, downloadDocument, viewDocument };
