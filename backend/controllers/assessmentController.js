const { Course, Assessment, Mark, Class, User } = require('../models/db');
const mongoose = require('mongoose');

/* ═══════════════════════════════════════════════════
   ADMIN — COURSE MANAGEMENT
═══════════════════════════════════════════════════ */

// GET /api/assessments/admin/courses
exports.adminGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id })
      .populate('class_id', 'name')
      .populate('teacher_id', 'name email')
      .sort({ created_at: -1 })
      .lean();
    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessments/admin/courses
exports.adminCreateCourse = async (req, res) => {
  try {
    const { name, code, description, class_id, teacher_id } = req.body;
    if (!name) return res.status(400).json({ message: 'Course name is required' });
    const course = await Course.create({
      name: name.trim(),
      code: code?.trim() || null,
      description: description?.trim() || null,
      class_id: class_id || null,
      teacher_id: teacher_id || null,
      created_by: req.user.id,
    });
    res.status(201).json({ message: 'Course created', id: course._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/assessments/admin/courses/:id
exports.adminUpdateCourse = async (req, res) => {
  try {
    const { name, code, description, class_id, teacher_id } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (code !== undefined) update.code = code?.trim() || null;
    if (description !== undefined) update.description = description?.trim() || null;
    if (class_id !== undefined) update.class_id = class_id || null;
    if (teacher_id !== undefined) update.teacher_id = teacher_id || null;
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, created_by: req.user.id },
      update, { new: true }
    );
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/assessments/admin/courses/:id
exports.adminDeleteCourse = async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ _id: req.params.id, created_by: req.user.id });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   ADMIN — REPORT VIEWING
═══════════════════════════════════════════════════ */

// GET /api/assessments/admin/reports/student/:studentId
// Query: term, year
exports.adminStudentReport = async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const student = await User.findById(studentId).select('name email level trade class_year').lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const filter = { student_id: studentId };
    const assessmentFilter = {};
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    // Get all assessments matching filter, then find marks
    let assessments = [];
    if (Object.keys(assessmentFilter).length > 0) {
      assessments = await Assessment.find(assessmentFilter)
        .populate('course_id', 'name code')
        .lean();
    } else {
      assessments = await Assessment.find({})
        .populate('course_id', 'name code')
        .lean();
    }

    const assessmentIds = assessments.map(a => a._id);
    const marks = await Mark.find({ student_id: studentId, assessment_id: { $in: assessmentIds } }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.assessment_id.toString()] = m; });

    const reportData = assessments.map(a => ({
      assessment_id: a._id,
      title: a.title,
      course: a.course_id?.name || 'N/A',
      course_code: a.course_id?.code || '',
      type: a.type,
      term: a.term,
      year: a.academic_year,
      max_marks: a.max_marks,
      marks_obtained: markMap[a._id.toString()]?.marks ?? null,
      remarks: markMap[a._id.toString()]?.remarks || null,
    }));

    res.json({ student: { ...student, id: student._id }, report: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/admin/reports/assessment/:assessmentId
exports.adminAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code')
      .populate('teacher_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const marks = await Mark.find({ assessment_id: req.params.assessmentId })
      .populate('student_id', 'name email level trade')
      .lean();

    const reportData = marks.map(m => ({
      student_id: m.student_id?._id,
      student_name: m.student_id?.name,
      student_email: m.student_id?.email,
      marks_obtained: m.marks,
      max_marks: assessment.max_marks,
      percentage: m.marks != null ? Math.round((m.marks / assessment.max_marks) * 100) : null,
      grade: m.marks != null ? getGrade(m.marks, assessment.max_marks) : 'N/A',
      remarks: m.remarks,
    }));

    res.json({ assessment: { ...assessment, id: assessment._id }, students: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/admin/reports/class/:classId
// Returns all students in the class with their marks across all courses/assessments
exports.adminClassReport = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId).populate('students', 'name email level trade').lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const { term, year } = req.query;
    const courses = await Course.find({ class_id: req.params.classId, created_by: req.user.id }).lean();
    const courseIds = courses.map(c => c._id);

    const assessmentFilter = { course_id: { $in: courseIds } };
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    const assessments = await Assessment.find(assessmentFilter)
      .populate('course_id', 'name code')
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const allMarks = await Mark.find({ assessment_id: { $in: assessmentIds } }).lean();

    const markIndex = {};
    allMarks.forEach(m => {
      const key = m.student_id.toString() + '_' + m.assessment_id.toString();
      markIndex[key] = m;
    });

    const students = cls.students.map(s => {
      const studentMarks = assessments.map(a => {
        const key = s._id.toString() + '_' + a._id.toString();
        const mark = markIndex[key];
        return {
          assessment_id: a._id,
          assessment_title: a.title,
          course: a.course_id?.name,
          type: a.type,
          term: a.term,
          marks: mark?.marks ?? null,
          max_marks: a.max_marks,
        };
      });
      const scored = studentMarks.filter(m => m.marks != null);
      const totalObtained = scored.reduce((s, m) => s + m.marks, 0);
      const totalMax = scored.reduce((s, m) => s + m.max_marks, 0);
      return {
        student_id: s._id,
        name: s.name,
        email: s.email,
        marks: studentMarks,
        total_obtained: totalObtained,
        total_max: totalMax,
        percentage: totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null,
        grade: totalMax > 0 ? getGrade(totalObtained, totalMax) : 'N/A',
      };
    });

    res.json({
      class: { id: cls._id, name: cls.name },
      assessments,
      courses,
      students,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   TEACHER — ASSESSMENT MANAGEMENT
═══════════════════════════════════════════════════ */

// GET /api/assessments/teacher/courses — courses assigned to this teacher
exports.teacherGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ teacher_id: req.user.id, is_active: true })
      .populate('class_id', 'name')
      .sort({ created_at: -1 })
      .lean();
    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/teacher/assessments — assessments created by this teacher
exports.teacherGetAssessments = async (req, res) => {
  try {
    const { course_id } = req.query;
    const filter = { teacher_id: req.user.id };
    if (course_id) filter.course_id = course_id;

    const assessments = await Assessment.find(filter)
      .populate('course_id', 'name code class_id')
      .sort({ created_at: -1 })
      .lean();
    res.json({ assessments: assessments.map(a => ({ ...a, id: a._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessments/teacher/assessments
exports.teacherCreateAssessment = async (req, res) => {
  try {
    const { title, course_id, type, term, academic_year, max_marks } = req.body;
    if (!title || !course_id || !type || !term || !academic_year) {
      return res.status(400).json({ message: 'Title, course, type, term, and year are required' });
    }
    // Verify teacher owns this course
    const course = await Course.findOne({ _id: course_id, teacher_id: req.user.id });
    if (!course) return res.status(403).json({ message: 'Course not assigned to you' });

    const assessment = await Assessment.create({
      title: title.trim(),
      course_id,
      teacher_id: req.user.id,
      type,
      term,
      academic_year,
      max_marks: max_marks || 100,
      created_by: req.user.id,
    });
    res.status(201).json({ message: 'Assessment created', id: assessment._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/assessments/teacher/assessments/:id
exports.teacherUpdateAssessment = async (req, res) => {
  try {
    const { title, type, term, academic_year, max_marks } = req.body;
    const update = {};
    if (title) update.title = title.trim();
    if (type) update.type = type;
    if (term) update.term = term;
    if (academic_year) update.academic_year = academic_year;
    if (max_marks) update.max_marks = max_marks;
    const a = await Assessment.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.user.id },
      update, { new: true }
    );
    if (!a) return res.status(404).json({ message: 'Assessment not found' });
    res.json({ message: 'Assessment updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/assessments/teacher/assessments/:id
exports.teacherDeleteAssessment = async (req, res) => {
  try {
    const a = await Assessment.findOneAndDelete({ _id: req.params.id, teacher_id: req.user.id });
    if (!a) return res.status(404).json({ message: 'Assessment not found' });
    await Mark.deleteMany({ assessment_id: req.params.id });
    res.json({ message: 'Assessment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/teacher/assessments/:id/marks
exports.teacherGetMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    // Get class students
    const cls = await Class.findById(assessment.course_id?.class_id).populate('students', 'name email level trade').lean();
    const students = cls?.students || [];

    const marks = await Mark.find({ assessment_id: req.params.id }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const result = students.map(s => ({
      student_id: s._id,
      name: s.name,
      email: s.email,
      marks: markMap[s._id.toString()]?.marks ?? null,
      remarks: markMap[s._id.toString()]?.remarks ?? '',
      mark_id: markMap[s._id.toString()]?._id ?? null,
    }));

    res.json({ assessment: { ...assessment, id: assessment._id }, students: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessments/teacher/assessments/:id/marks — bulk save marks
exports.teacherSaveMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id });
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const { marks } = req.body; // Array of { student_id, marks, remarks }
    if (!Array.isArray(marks)) return res.status(400).json({ message: 'marks must be an array' });

    const ops = marks.map(m => ({
      updateOne: {
        filter: { assessment_id: req.params.id, student_id: m.student_id },
        update: {
          $set: {
            marks: m.marks,
            remarks: m.remarks || '',
            entered_by: req.user.id,
          },
        },
        upsert: true,
      },
    }));

    await Mark.bulkWrite(ops);
    res.json({ message: 'Marks saved successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/teacher/reports/:assessmentId
exports.teacherAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.assessmentId, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found or not yours' });

    const marks = await Mark.find({ assessment_id: req.params.assessmentId })
      .populate('student_id', 'name email level trade')
      .lean();

    const reportData = marks.map(m => ({
      student_id: m.student_id?._id,
      student_name: m.student_id?.name,
      student_email: m.student_id?.email,
      marks_obtained: m.marks,
      max_marks: assessment.max_marks,
      percentage: m.marks != null ? Math.round((m.marks / assessment.max_marks) * 100) : null,
      grade: m.marks != null ? getGrade(m.marks, assessment.max_marks) : 'N/A',
      remarks: m.remarks,
    }));

    res.json({ assessment: { ...assessment, id: assessment._id }, students: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
function getGrade(obtained, max) {
  const pct = (obtained / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}
