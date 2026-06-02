const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Assignment, Submission, Class, User } = require('../models/db');

const getAssignments = async (req, res) => {
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
      const [assignments, total] = await Promise.all([
        Assignment.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit))
          .populate('class_id', 'name').lean(),
        Assignment.countDocuments(filter),
      ]);

      const result = await Promise.all(assignments.map(async (a) => {
        const [submission_count, cls] = await Promise.all([
          Submission.countDocuments({ assignment_id: a._id }),
          Class.findById(a.class_id, 'students').lean(),
        ]);
        return {
          ...a, id: a._id,
          class_name: a.class_id?.name,
          submission_count,
          total_students: cls?.students?.length || 0,
        };
      }));
      return res.json({ assignments: result, total, page: parseInt(page), limit: parseInt(limit) });
    }

    // Student view
    const enrolledClasses = await Class.find({ students: userId }, '_id').lean();
    const enrolledClassIds = enrolledClasses.map(c => c._id);

    const filter = {
      class_id: { $in: enrolledClassIds },
      $or: [{ title: searchRegex }, { description: searchRegex }],
      ...(classId && { class_id: classId }),
    };
    const [assignments, total] = await Promise.all([
      Assignment.find(filter).sort({ deadline: 1 }).skip(skip).limit(parseInt(limit))
        .populate('class_id', 'name').populate('teacher_id', 'name').lean(),
      Assignment.countDocuments(filter),
    ]);

    const result = await Promise.all(assignments.map(async (a) => {
      const sub = await Submission.findOne({ assignment_id: a._id, student_id: userId }, 'submitted_at score feedback _id').lean();
      return {
        ...a, id: a._id,
        class_name: a.class_id?.name,
        teacher_name: a.teacher_id?.name,
        submission_id: sub?._id || null,
        submitted_at: sub?.submitted_at || null,
        score: sub?.score ?? null,
        feedback: sub?.feedback || null,
      };
    }));
    res.json({ assignments: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createAssignment = async (req, res) => {
  try {
    const { title, description, deadline, classId, max_score } = req.body;
    if (!title || !deadline || !classId) return res.status(400).json({ message: 'Title, deadline, and class are required' });
    const a = await Assignment.create({
      title, description, deadline,
      class_id: classId, teacher_id: req.session.user.id,
      max_score: max_score || 100,
      filename: req.file?.filename || null,
      original_name: req.file?.originalname || null,
      mime_type: req.file?.mimetype || null,
    });
    res.status(201).json({ message: 'Assignment created', id: a._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateAssignment = async (req, res) => {
  try {
    const { title, description, deadline, classId, max_score } = req.body;
    const existing = await Assignment.findOne({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!existing) return res.status(404).json({ message: 'Assignment not found' });

    let filename = existing.filename;
    let original_name = existing.original_name;
    let mime_type = existing.mime_type;

    if (req.file) {
      if (filename) {
        const oldPath = path.join('uploads/assignments', filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      filename = req.file.filename;
      original_name = req.file.originalname;
      mime_type = req.file.mimetype;
    }

    await Assignment.updateOne(
      { _id: req.params.id },
      { title, description, deadline, class_id: classId, max_score: max_score || 100, filename, original_name, mime_type }
    );
    res.json({ message: 'Assignment updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteAssignment = async (req, res) => {
  try {
    const a = await Assignment.findOneAndDelete({ _id: req.params.id, teacher_id: req.session.user.id });
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    if (a.filename) {
      const fp = path.join('uploads/assignments', a.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ message: 'Assignment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const downloadAssignment = async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).lean();
    if (!a || !a.filename) return res.status(404).json({ message: 'File not found' });
    const fp = path.resolve('uploads/assignments', a.filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found on server' });
    res.download(fp, a.original_name);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const viewAssignment = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const role = req.session.user.role;
    let a;
    if (role === 'teacher') {
      a = await Assignment.findOne({ _id: req.params.id, teacher_id: userId }).lean();
    } else {
      const enrolled = await Class.findOne({ students: userId }, '_id').lean();
      a = enrolled ? await Assignment.findOne({ _id: req.params.id, class_id: enrolled._id }).lean() : null;
    }
    if (!a || !a.filename) return res.status(404).json({ message: 'File not found' });
    const fp = path.resolve('uploads/assignments', a.filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found on server' });
    res.setHeader('Content-Type', a.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${a.original_name}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(fp).pipe(res);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const submitAssignment = async (req, res) => {
  try {
    const { notes } = req.body;
    const studentId = req.session.user.id;
    const assignmentId = req.params.id;

    const a = await Assignment.findById(assignmentId);
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    if (new Date() > new Date(a.deadline)) {
      return res.status(400).json({ message: 'Submission deadline has expired. Resubmission is no longer allowed.' });
    }

    const existing = await Submission.findOne({ assignment_id: assignmentId, student_id: studentId });
    if (existing) {
      const update = { notes, submitted_at: new Date() };
      if (req.file) {
        update.filename = req.file.filename;
        update.original_name = req.file.originalname;
      }
      await Submission.updateOne({ _id: existing._id }, update);
      return res.json({ message: 'Submission updated successfully' });
    }

    await Submission.create({
      assignment_id: assignmentId, student_id: studentId,
      filename: req.file?.filename || null,
      original_name: req.file?.originalname || null,
      notes,
    });
    res.status(201).json({ message: 'Assignment submitted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ assignment_id: req.params.id })
      .sort({ submitted_at: -1 })
      .populate('student_id', 'name email level trade')
      .lean();
    const result = submissions.map(s => ({
      ...s, id: s._id,
      student_name: s.student_id?.name,
      student_email: s.student_id?.email,
      level: s.student_id?.level,
      trade: s.student_id?.trade,
    }));
    res.json({ submissions: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const downloadSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.submissionId).lean();
    if (!sub || !sub.filename) return res.status(404).json({ message: 'File not found' });
    const fp = path.resolve('uploads/assignments', sub.filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found on server' });
    res.download(fp, sub.original_name);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const viewSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.submissionId).lean();
    if (!sub || !sub.filename) return res.status(404).json({ message: 'File not found' });
    const fp = path.resolve('uploads/assignments', sub.filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found on server' });
    res.setHeader('Content-Type', sub.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${sub.original_name}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(fp).pipe(res);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const gradeSubmission = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const result = await Submission.findByIdAndUpdate(
      req.params.submissionId,
      { score, feedback: feedback || null, graded_at: new Date() }
    );
    if (!result) return res.status(404).json({ message: 'Submission not found' });
    res.json({ message: 'Submission graded' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getGradesReport = async (req, res) => {
  try {
    const { studentId } = req.query;
    const assignmentId = req.params.id;

    const a = await Assignment.findOne({ _id: assignmentId, teacher_id: req.session.user.id })
      .populate('class_id', 'name students').lean();
    if (!a) return res.status(404).json({ message: 'Assignment not found' });

    let students = await User.find(
      { _id: { $in: a.class_id.students }, role: 'student', ...(studentId && { _id: studentId }) },
      'name email level trade'
    ).lean();

    const grades = await Promise.all(students.map(async (s) => {
      const sub = await Submission.findOne({ assignment_id: assignmentId, student_id: s._id }, 'score feedback submitted_at graded_at _id').lean();
      return {
        student_id: s._id,
        student_name: s.name,
        student_email: s.email,
        level: s.level,
        trade: s.trade,
        submission_id: sub?._id || null,
        score: sub?.score ?? null,
        feedback: sub?.feedback || null,
        submitted_at: sub?.submitted_at || null,
        graded_at: sub?.graded_at || null,
        max_score: a.max_score,
        assignment_title: a.title,
        class_name: a.class_id?.name,
      };
    }));

    grades.sort((a, b) => a.student_name.localeCompare(b.student_name));
    res.json({ assignment: a, grades });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getAssignments, createAssignment, updateAssignment, deleteAssignment,
  downloadAssignment, viewAssignment,
  submitAssignment, getSubmissions, downloadSubmission, viewSubmission,
  gradeSubmission, getGradesReport,
};
