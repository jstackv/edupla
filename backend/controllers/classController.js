const mongoose = require('mongoose');
const { Class } = require('../models/db');

const teacherFilter = (teacherId) => ({
  $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }]
});

// Teacher: get classes they are assigned to
const getClasses = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.session.user.id);
    const { search = '', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(search, 'i');

    const baseFilter = {
      ...teacherFilter(teacherId),
      $and: [{ $or: [{ name: searchRegex }, { description: searchRegex }] }]
    };

    const [classes, total] = await Promise.all([
      Class.find(baseFilter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('teacher_id', 'name email')
        .lean(),
      Class.countDocuments(baseFilter),
    ]);

    const result = classes.map(c => ({
      ...c,
      id: c._id,
      student_count: c.students ? c.students.length : 0,
    }));

    res.json({ classes: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getClass = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.session.user.id);
    const cls = await Class.findOne({
      _id: req.params.id,
      ...teacherFilter(teacherId)
    }).populate('teacher_id', 'name email').lean();

    if (!cls) return res.status(404).json({ message: 'Class not found' });
    res.json({ class: { ...cls, id: cls._id, student_count: cls.students.length } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createClass = async (req, res) => {
  try {
    const { name, description, level, trade } = req.body;
    if (!name) return res.status(400).json({ message: 'Class name is required' });
    const cls = await Class.create({
      name, description: description || null, level: level || null,
      trade: trade || null, teacher_id: req.session.user.id
    });
    res.status(201).json({ message: 'Class created', id: cls._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateClass = async (req, res) => {
  try {
    const { name, description, level, trade } = req.body;
    const result = await Class.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id },
      { name, description: description || null, level: level || null, trade: trade || null }
    );
    if (!result) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteClass = async (req, res) => {
  try {
    const result = await Class.findOneAndDelete({
      _id: req.params.id, teacher_id: req.session.user.id
    });
    if (!result) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getClassStudents = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('students', 'name email level trade created_at')
      .lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    res.json({ students: cls.students });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Student: get classes they are enrolled in
const getMyClasses = async (req, res) => {
  try {
    const { Assignment } = require('../models/db');
    const studentId = new mongoose.Types.ObjectId(req.session.user.id);
    const classes = await Class.find({ students: studentId })
      .populate('teacher_id', 'name email')
      .lean();

    const result = await Promise.all(classes.map(async (c) => {
      const assignment_count = await Assignment.countDocuments({ class_id: c._id });
      return {
        ...c,
        id: c._id,
        teacher_name: c.teacher_id?.name,
        student_count: c.students.length,
        assignment_count,
      };
    }));

    res.json({ classes: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getClasses, getClass, createClass, updateClass, deleteClass, getClassStudents, getMyClasses };
