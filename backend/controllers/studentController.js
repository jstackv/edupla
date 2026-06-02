const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Class, Submission } = require('../models/db');

// Helper: get all class IDs belonging to this teacher
const getTeacherClassIds = async (teacherId) => {
  const classes = await Class.find(
    { $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] },
    '_id'
  );
  return classes.map(c => c._id);
};

const getStudents = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, classId, level, trade } = req.query;
    const skip = (page - 1) * limit;
    const teacherId = new mongoose.Types.ObjectId(req.session.user.id);
    const classIds = classId ? [new mongoose.Types.ObjectId(classId)] : await getTeacherClassIds(teacherId);

    // Students enrolled in teacher's classes
    const enrolledClasses = await Class.find({ _id: { $in: classIds } }, 'students name');
    const studentIdSet = new Set();
    enrolledClasses.forEach(c => c.students.forEach(s => studentIdSet.add(s.toString())));
    const studentIds = [...studentIdSet].map(id => new mongoose.Types.ObjectId(id));

    const searchRegex = new RegExp(search, 'i');
    const filter = {
      _id: { $in: studentIds },
      role: 'student',
      $or: [{ name: searchRegex }, { email: searchRegex }],
    };
    if (level) filter.level = level;
    if (trade) filter.trade = trade;

    const [students, total] = await Promise.all([
      User.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter),
    ]);

    // Attach class names for each student
    const result = students.map(s => {
      const sClasses = enrolledClasses
        .filter(c => c.students.some(sid => sid.toString() === s._id.toString()))
        .map(c => c.name);
      return { ...s, id: s._id, classes: sClasses.join(', '), class_count: sClasses.length };
    });

    res.json({ students: result, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getStudent = async (req, res) => {
  try {
    const teacherId = new mongoose.Types.ObjectId(req.session.user.id);
    const studentId = new mongoose.Types.ObjectId(req.params.id);

    // Check access: student must be in one of teacher's classes
    const accessClass = await Class.findOne({
      $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
      students: studentId,
    });
    if (!accessClass) return res.status(404).json({ message: 'Student not found' });

    const [student, classes, statsAgg] = await Promise.all([
      User.findOne({ _id: studentId, role: 'student' }, '-password').lean(),
      Class.find({
        $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
        students: studentId,
      }, 'name _id').lean(),
      Submission.aggregate([
        { $match: { student_id: studentId } },
        { $group: {
          _id: null,
          total_submissions: { $sum: 1 },
          avg_score: { $avg: '$score' },
          graded: { $sum: { $cond: [{ $ne: ['$score', null] }, 1, 0] } },
        }}
      ]),
    ]);

    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({
      student: {
        ...student, id: student._id,
        classes: classes.map(c => ({ id: c._id, name: c.name })),
        stats: statsAgg[0] || { total_submissions: 0, avg_score: null, graded: 0 },
      }
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createStudent = async (req, res) => {
  try {
    const { name, email, classIds = [], level, trade, class_year, phone } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const defaultPassword = process.env.STUDENT_DEFAULT_PASSWORD || 'student123';
    const hashed = await bcrypt.hash(defaultPassword, 10);

    const student = await User.create({
      name, email: email.toLowerCase(), password: hashed, role: 'student',
      level: level || null, trade: trade || null, class_year: class_year || null, phone: phone || null,
    });

    if (classIds.length > 0) {
      const teacherId = req.session.user.id;
      const validClasses = await Class.find({
        _id: { $in: classIds },
        $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
      });
      await Promise.all(validClasses.map(c =>
        Class.updateOne({ _id: c._id }, { $addToSet: { students: student._id } })
      ));
    }

    res.status(201).json({ message: 'Student created successfully', id: student._id, defaultPassword });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateStudent = async (req, res) => {
  try {
    const { name, email, classIds = [], level, trade, class_year, phone } = req.body;
    const teacherId = req.session.user.id;
    const studentId = req.params.id;

    const accessClass = await Class.findOne({
      $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
      students: studentId,
    });
    if (!accessClass) return res.status(404).json({ message: 'Student not found' });

    await User.updateOne(
      { _id: studentId, role: 'student' },
      { name, email: email.toLowerCase(), level: level || null, trade: trade || null, class_year: class_year || null, phone: phone || null }
    );

    // Remove student from teacher's classes, then re-add to selected ones
    const myClasses = await Class.find({ $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] });
    await Promise.all(myClasses.map(c =>
      Class.updateOne({ _id: c._id }, { $pull: { students: new mongoose.Types.ObjectId(studentId) } })
    ));

    if (classIds.length > 0) {
      const validClasses = await Class.find({
        _id: { $in: classIds },
        $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
      });
      await Promise.all(validClasses.map(c =>
        Class.updateOne({ _id: c._id }, { $addToSet: { students: studentId } })
      ));
    }

    res.json({ message: 'Student updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteStudent = async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    const accessClass = await Class.findOne({
      $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }],
      students: req.params.id,
    });
    if (!accessClass) return res.status(404).json({ message: 'Student not found' });

    const result = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
    if (!result) return res.status(404).json({ message: 'Student not found' });
    // Clean up enrollment
    await Class.updateMany({}, { $pull: { students: new mongoose.Types.ObjectId(req.params.id) } });
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const assignToClass = async (req, res) => {
  try {
    const { classId } = req.body;
    const teacherId = req.session.user.id;
    const cls = await Class.findOne({ _id: classId, $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] });
    if (!cls) return res.status(403).json({ message: 'Class not found or not authorized' });
    await Class.updateOne({ _id: classId }, { $addToSet: { students: req.params.id } });
    res.json({ message: 'Student assigned to class' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getStudentStats = async (req, res) => {
  try {
    const { Assignment } = require('../models/db');
    const teacherId = new mongoose.Types.ObjectId(req.session.user.id);
    const classIds = await getTeacherClassIds(teacherId);

    const classes = await Class.find({ _id: { $in: classIds } }, 'students').lean();
    const studentIdSet = new Set();
    classes.forEach(c => c.students.forEach(s => studentIdSet.add(s.toString())));
    const studentIds = [...studentIdSet].map(id => new mongoose.Types.ObjectId(id));
    const totalStudents = studentIds.length;

    const [byLevel, byTrade] = await Promise.all([
      User.aggregate([
        { $match: { _id: { $in: studentIds }, role: 'student' } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
        { $project: { level: '$_id', count: 1, _id: 0 } }
      ]),
      User.aggregate([
        { $match: { _id: { $in: studentIds }, role: 'student' } },
        { $group: { _id: '$trade', count: { $sum: 1 } } },
        { $project: { trade: '$_id', count: 1, _id: 0 } }
      ]),
    ]);

    const assignmentIds = (await Assignment.find({ class_id: { $in: classIds } }, '_id')).map(a => a._id);
    const submittedStudents = await Submission.distinct('student_id', { assignment_id: { $in: assignmentIds } });

    res.json({
      totalStudents,
      byLevel,
      byTrade,
      submissionRate: { submitted: submittedStudents.length, total: totalStudents }
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getStudents, getStudent, createStudent, updateStudent, deleteStudent, assignToClass, getStudentStats };
