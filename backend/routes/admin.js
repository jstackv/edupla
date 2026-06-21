const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/auth');
const {
  getDashboardStats, getTeachers, createTeacher, updateTeacher, deleteTeacher,
  getAllClasses, adminCreateClass, adminUpdateClass, adminDeleteClass, adminAssignClassToTeacher,
  adminGetClassTeachers, adminGetClassStudents,
  getAllStudents, adminCreateStudent, adminUpdateStudent, adminDeleteStudent,
  adminAssignStudentToClass, adminGetStudentDetail,
  getAdminAssignments,
  getLevels, createLevel, deleteLevel, updateLevel,
  getTrades, createTrade, deleteTrade, updateTrade,
  getProgramConfigs, createProgramConfig, updateProgramConfig, deleteProgramConfig,
  toggleTeacherStatus, toggleStudentStatus, toggleClassStatus, toggleAdminStatus,
} = require('../controllers/adminController');

router.use(isAuthenticated, isAdmin);

// ── Admin account management — SUPER ADMIN ONLY ───────────────────────────

// List all admins
router.get('/admins', isSuperAdmin, async (req, res) => {
  try {
    const { User } = require('../models/db');
    const admins = await User
      .find({ role: 'admin', is_super_admin: { $ne: true } })
      .select('name email is_active is_super_admin created_at')
      .sort({ created_at: -1 })
      .lean();
    res.json({ admins: admins.map(a => ({ ...a, id: a._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Platform-wide user search — SUPER ADMIN ONLY.
// Unlike /teachers, /students, /admins above (which are scoped to
// created_by: req.user.id for regular admins), this searches every
// non-super-admin user across the whole platform by name or email.
// Built specifically to power the "impersonate" search panel: the super
// admin needs to find any teacher/student/admin to log in as them and
// verify a fix, regardless of which regular admin originally created them.
router.get('/users/search', isSuperAdmin, async (req, res) => {
  try {
    const { User } = require('../models/db');
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      is_super_admin: { $ne: true },
      $or: [{ name: searchRegex }, { email: searchRegex }],
    })
      .select('name email role is_active created_at')
      .sort({ name: 1 })
      .limit(20)
      .lean();

    res.json({ users: users.map(u => ({ ...u, id: u._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Bulk stats for all admins (teacher/class/student counts per admin)
router.get('/admins/stats', isSuperAdmin, async (req, res) => {
  try {
    const { User, Class } = require('../models/db');
    const mongoose = require('mongoose');

    const admins = await User.find({ role: 'admin' }, '_id').lean();
    const adminIds = admins.map(a => a._id);

    const stats = await Promise.all(adminIds.map(async (adminId) => {
      const [teacherCount, studentCount, classes] = await Promise.all([
        User.countDocuments({ role: 'teacher', created_by: adminId }),
        User.countDocuments({ role: 'student', created_by: adminId }),
        Class.countDocuments({ created_by: adminId }),
      ]);
      return {
        admin_id: adminId,
        teacher_count: teacherCount,
        class_count: classes,
        student_count: studentCount,
      };
    }));

    res.json({ stats });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Full detail for one admin: teachers, classes (with enrolled students), students
router.get('/admins/:id/detail', isSuperAdmin, async (req, res) => {
  try {
    const { User, Class } = require('../models/db');
    const mongoose = require('mongoose');
    const adminId = new mongoose.Types.ObjectId(req.params.id);

    const [teachers, classes, students] = await Promise.all([
      // Teachers created by this admin with per-teacher stats
      User.find({ role: 'teacher', created_by: adminId })
        .select('name email is_active created_at')
        .sort({ created_at: -1 })
        .lean(),

      // Classes created by this admin, with teacher info and student ids
      Class.find({ created_by: adminId })
        .sort({ created_at: -1 })
        .populate('teacher_id', 'name')
        .lean(),

      // Students created by this admin
      User.find({ role: 'student', created_by: adminId })
        .select('name email level trade is_active created_at')
        .sort({ created_at: -1 })
        .lean(),
    ]);

    // Enrich teachers with class/student counts
    const enrichedTeachers = await Promise.all(teachers.map(async t => {
      const tClasses = await Class.find({
        $or: [{ teacher_id: t._id }, { extra_teachers: t._id }]
      }, 'students').lean();
      const studentSet = new Set();
      tClasses.forEach(c => c.students.forEach(s => studentSet.add(s.toString())));
      return { ...t, id: t._id, class_count: tClasses.length, student_count: studentSet.size };
    }));

    // Enrich classes with student objects (names, emails)
    const allStudentIds = [...new Set(classes.flatMap(c => c.students.map(s => s.toString())))];
    const studentMap = {};
    if (allStudentIds.length > 0) {
      const studentDocs = await User.find({
        _id: { $in: allStudentIds }
      }, 'name email level trade is_active').lean();
      studentDocs.forEach(s => { studentMap[s._id.toString()] = { ...s, id: s._id }; });
    }

    const enrichedClasses = classes.map(c => ({
      ...c,
      id: c._id,
      teacher_name: c.teacher_id?.name ?? null,
      student_count: c.students?.length ?? 0,
      enrolledStudents: (c.students ?? []).map(sid => studentMap[sid.toString()]).filter(Boolean),
    }));

    // Enrich students with class counts
    const enrichedStudents = await Promise.all(students.map(async s => {
      const classCount = await Class.countDocuments({ students: s._id, created_by: adminId });
      return { ...s, id: s._id, class_count: classCount };
    }));

    res.json({
      teachers: enrichedTeachers,
      classes: enrichedClasses,
      students: enrichedStudents,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create admin
router.post('/admins', isSuperAdmin, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { User } = require('../models/db');
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const admin = await User.create({ name, email: email.toLowerCase(), password: hashed, role: 'admin', is_active: true });
    res.status(201).json({ message: 'Admin account created', id: admin._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/admins/:id/toggle-status', isSuperAdmin, toggleAdminStatus);

// Update admin info
router.put('/admins/:id', isSuperAdmin, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { User } = require('../models/db');
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot edit your own account via this endpoint' });
    const { name, email, password } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (conflict) return res.status(400).json({ message: 'Email already in use by another account' });
      update.email = email.toLowerCase();
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      update.password = await bcrypt.hash(password, 10);
    }
    const result = await User.findOneAndUpdate({ _id: req.params.id, role: 'admin' }, update, { new: true });
    if (!result) return res.status(404).json({ message: 'Admin not found' });
    res.json({ message: 'Admin updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


router.delete('/admins/:id', isSuperAdmin, async (req, res) => {
  try {
    const { User } = require('../models/db');
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });
    const result = await User.findOneAndDelete({ _id: req.params.id, role: 'admin' });
    if (!result) return res.status(404).json({ message: 'Admin not found' });
    res.json({ message: 'Admin account deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Dashboard
router.get('/stats', getDashboardStats);

// Teachers
router.get('/teachers', getTeachers);
router.post('/teachers', createTeacher);
router.put('/teachers/:id', updateTeacher);
router.patch('/teachers/:id/toggle-status', toggleTeacherStatus);
router.delete('/teachers/:id', deleteTeacher);

// Classes
router.get('/classes', getAllClasses);
router.post('/classes', adminCreateClass);
router.put('/classes/:id', adminUpdateClass);
router.patch('/classes/:id/toggle-status', toggleClassStatus);
router.delete('/classes/:id', adminDeleteClass);
router.put('/classes/:id/assign-teacher', adminAssignClassToTeacher);
router.get('/classes/:id/teachers', adminGetClassTeachers);
router.get('/classes/:id/students', adminGetClassStudents);
router.post('/classes/:id/enroll-student', async (req, res) => {
  try {
    const { Class } = require('../models/db');
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    if (!cls.is_active) return res.status(400).json({ message: 'Cannot enroll students in an inactive class' });
    const { student_id } = req.body;
    // Guard: reject if student already enrolled
    const alreadyEnrolled = cls.students.map(s => s.toString()).includes(String(student_id));
    if (alreadyEnrolled) return res.status(400).json({ message: 'Student is already enrolled in this class' });
    await Class.updateOne({ _id: req.params.id }, { $addToSet: { students: student_id } });
    res.json({ message: 'Student enrolled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get unenrolled students for a class (excludes already enrolled + supports search)
router.get('/classes/:id/unenrolled-students', async (req, res) => {
  try {
    const { Class, User } = require('../models/db');
    const mongoose = require('mongoose');
    const cls = await Class.findById(req.params.id, 'students').lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    const enrolledIds = cls.students.map(s => s.toString());
    const search = req.query.search || '';
    const searchRegex = new RegExp(search, 'i');
    const students = await User.find({
      role: 'student',
      created_by: req.user.id,
      _id: { $nin: enrolledIds.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } }).filter(Boolean) },
      $or: [{ name: searchRegex }, { email: searchRegex }],
    }).select('name email level trade').sort({ name: 1 }).limit(50).lean();
    res.json({ students: students.map(s => ({ ...s, id: s._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Students
router.get('/students', getAllStudents);
router.post('/students', adminCreateStudent);
router.get('/students/:id', adminGetStudentDetail);
router.put('/students/:id', adminUpdateStudent);
router.patch('/students/:id/toggle-status', toggleStudentStatus);
router.delete('/students/:id', adminDeleteStudent);
router.post('/students/:id/assign', adminAssignStudentToClass);

// Assignments (view-only for admin)
router.get('/assignments', getAdminAssignments);

// Levels management
router.get('/levels', getLevels);
router.post('/levels', createLevel);
router.put('/levels/:value', updateLevel);
router.delete('/levels/:value', deleteLevel);

// Trades management
router.get('/trades', getTrades);
router.post('/trades', createTrade);
router.put('/trades/:value', updateTrade);
router.delete('/trades/:value', deleteTrade);

// Program configurations (sector + trade + qualificationTitle + rtqfLevel)
router.get('/program-configs', getProgramConfigs);
router.post('/program-configs', createProgramConfig);
router.put('/program-configs/:id', updateProgramConfig);
router.delete('/program-configs/:id', deleteProgramConfig);

module.exports = router;