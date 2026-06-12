const { Course, Assessment, Mark, Class, User, AssessmentSubmission } = require('../models/db');
const mongoose = require('mongoose');

/* ═══════════════════════════════════════════════════
   ADMIN — COURSE MANAGEMENT
═══════════════════════════════════════════════════ */

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

exports.adminCreateCourse = async (req, res) => {
  try {
    const { name, code, description, class_id, teacher_id, total_marks } = req.body;
    if (!name) return res.status(400).json({ message: 'Course name is required' });
    const course = await Course.create({
      name: name.trim(),
      code: code?.trim() || null,
      description: description?.trim() || null,
      total_marks: total_marks ? Number(total_marks) : 100,
      class_id: class_id || null,
      teacher_id: teacher_id || null,
      created_by: req.user.id,
    });
    res.status(201).json({ message: 'Course created', id: course._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminUpdateCourse = async (req, res) => {
  try {
    const { name, code, description, class_id, teacher_id, total_marks } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (code !== undefined) update.code = code?.trim() || null;
    if (description !== undefined) update.description = description?.trim() || null;
    if (total_marks !== undefined) update.total_marks = total_marks ? Number(total_marks) : 100;
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
exports.adminStudentReport = async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const student = await User.findById(studentId).select('name email level trade class_year').lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const assessmentFilter = {};
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    let assessments = await Assessment.find(assessmentFilter)
      .populate({ path: 'course_id', select: 'name code total_marks' })
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const marks = await Mark.find({ student_id: studentId, assessment_id: { $in: assessmentIds } }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.assessment_id.toString()] = m; });

    const reportData = assessments.map(a => ({
      assessment_id: a._id,
      title: a.title,
      course: a.course_id?.name || 'N/A',
      course_code: a.course_id?.code || '',
      course_total_marks: a.course_id?.total_marks || 100,
      type: a.type,
      term: a.term,
      year: a.academic_year,
      max_marks: a.max_marks,
      marks_obtained: markMap[a._id.toString()]?.approved_marks ?? null,
    }));

    res.json({ student: { ...student, id: student._id }, report: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/admin/reports/assessment/:assessmentId
exports.adminAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code total_marks')
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
    }));

    // Add rank
    const sorted = [...reportData].filter(s => s.percentage != null).sort((a, b) => b.percentage - a.percentage);
    reportData.forEach(s => {
      if (s.percentage != null) {
        s.rank = sorted.findIndex(x => x.student_id?.toString() === s.student_id?.toString()) + 1;
        s.rank_percent = sorted.length > 0 ? Math.round(((sorted.length - s.rank + 1) / sorted.length) * 100) : null;
      }
    });

    res.json({ assessment: { ...assessment, id: assessment._id }, students: reportData });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessments/admin/reports/class/:classId
exports.adminClassReport = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId).populate('students', 'name email level trade').lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const { term, year, studentIds } = req.query;
    const courses = await Course.find({ class_id: req.params.classId, created_by: req.user.id }).lean();
    const courseIds = courses.map(c => c._id);

    const assessmentFilter = { course_id: { $in: courseIds } };
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    const assessments = await Assessment.find(assessmentFilter)
      .populate('course_id', 'name code total_marks')
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const allMarks = await Mark.find({ assessment_id: { $in: assessmentIds } }).lean();

    const markIndex = {};
    allMarks.forEach(m => {
      const key = m.student_id.toString() + '_' + m.assessment_id.toString();
      markIndex[key] = m;
    });

    // Filter students if specific ones requested
    let targetStudents = cls.students;
    if (studentIds) {
      const ids = studentIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        targetStudents = cls.students.filter(s => ids.includes(s._id.toString()));
      }
    }

    const students = targetStudents.map(s => {
      const studentMarks = assessments.map(a => {
        const key = s._id.toString() + '_' + a._id.toString();
        const mark = markIndex[key];
        return {
          assessment_id: a._id,
          assessment_title: a.title,
          course: a.course_id?.name,
          course_code: a.course_id?.code,
          course_total_marks: a.course_id?.total_marks || 100,
          type: a.type,
          term: a.term,
          marks: mark?.approved_marks ?? null,
          max_marks: a.max_marks,
        };
      });
      const scored = studentMarks.filter(m => m.marks != null);
      const totalObtained = scored.reduce((s, m) => s + m.marks, 0);
      const totalMax = scored.reduce((s, m) => s + m.max_marks, 0);
      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
      return {
        student_id: s._id,
        name: s.name,
        email: s.email,
        level: s.level,
        trade: s.trade,
        marks: studentMarks,
        total_obtained: totalObtained,
        total_max: totalMax,
        percentage,
        grade: totalMax > 0 ? getGrade(totalObtained, totalMax) : 'N/A',
      };
    });

    // Assign ranks
    const sorted = [...students].filter(s => s.percentage != null).sort((a, b) => b.percentage - a.percentage);
    students.forEach(s => {
      if (s.percentage != null) {
        s.rank = sorted.findIndex(x => x.student_id?.toString() === s.student_id?.toString()) + 1;
        s.rank_percent = sorted.length > 0 ? Math.round(((sorted.length - s.rank + 1) / sorted.length) * 100) : null;
      }
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

exports.teacherGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ teacher_id: req.user.id, is_active: true })
      .populate('class_id', 'name')
      .sort({ created_at: -1 })
      .lean();
    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetAssessments = async (req, res) => {
  try {
    const { course_id } = req.query;
    const filter = { teacher_id: req.user.id };
    if (course_id) filter.course_id = course_id;

    const assessments = await Assessment.find(filter)
      .populate('course_id', 'name code class_id total_marks')
      .sort({ created_at: -1 })
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const submissions = await AssessmentSubmission.find({ assessment_id: { $in: assessmentIds } }).lean();
    const subMap = {};
    submissions.forEach(s => { subMap[s.assessment_id.toString()] = s; });

    // For each assessment, compute progress (how many students have marks)
    const enriched = await Promise.all(assessments.map(async a => {
      const course = a.course_id;
      let studentCount = 0;
      let markedCount = 0;
      if (course?.class_id) {
        const cls = await Class.findById(course.class_id, 'students').lean();
        studentCount = cls?.students?.length || 0;
        markedCount = await Mark.countDocuments({ assessment_id: a._id, marks: { $ne: null } });
      }
      const sub = subMap[a._id.toString()];
      return {
        ...a, id: a._id, student_count: studentCount, marked_count: markedCount,
        submission_status: sub?.status || 'draft',
        review_note: sub?.review_note || null,
      };
    }));

    res.json({ assessments: enriched });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherCreateAssessment = async (req, res) => {
  try {
    const { title, course_id, type, term, academic_year, max_marks } = req.body;
    if (!title || !course_id || !type || !term || !academic_year) {
      return res.status(400).json({ message: 'Title, course, type, term, and year are required' });
    }
    const course = await Course.findOne({ _id: course_id, teacher_id: req.user.id });
    if (!course) return res.status(403).json({ message: 'Course not assigned to you' });

    // The admin-set module weight (total_marks) is the hard ceiling for max_marks.
    // Teachers cannot override it — we always use the course's total_marks.
    const courseWeight = course.total_marks || 100;
    if (max_marks && Number(max_marks) > courseWeight) {
      return res.status(400).json({
        message: `Max marks cannot exceed the module weight set by admin (${courseWeight} marks).`,
      });
    }

    const assessment = await Assessment.create({
      title: title.trim(),
      course_id,
      teacher_id: req.user.id,
      type,
      term,
      academic_year,
      max_marks: courseWeight, // always locked to the admin-defined weight
      created_by: req.user.id,
    });
    res.status(201).json({ message: 'Assessment created', id: assessment._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherUpdateAssessment = async (req, res) => {
  try {
    const { title, type, term, academic_year } = req.body;
    // max_marks is intentionally excluded — it is locked to the course's admin-set total_marks
    const update = {};
    if (title) update.title = title.trim();
    if (type) update.type = type;
    if (term) update.term = term;
    if (academic_year) update.academic_year = academic_year;
    // Re-sync max_marks from the course in case admin changed it after creation
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id }).populate('course_id', 'total_marks');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
    update.max_marks = assessment.course_id?.total_marks || assessment.max_marks || 100;
    const updated = await Assessment.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.user.id },
      update, { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Assessment not found' });
    res.json({ message: 'Assessment updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherDeleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    // Check if any marks have been recorded for this assessment
    const marksCount = await Mark.countDocuments({ assessment_id: req.params.id, marks: { $ne: null } });
    if (marksCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this assessment — ${marksCount} mark(s) have already been recorded. Clear all marks before deleting.`,
      });
    }

    await Assessment.deleteOne({ _id: req.params.id });
    await Mark.deleteMany({ assessment_id: req.params.id });
    await AssessmentSubmission.deleteOne({ assessment_id: req.params.id });
    res.json({ message: 'Assessment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id total_marks')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const cls = await Class.findById(assessment.course_id?.class_id).populate('students', 'name email level trade').lean();
    const students = cls?.students || [];

    const marks = await Mark.find({ assessment_id: req.params.id }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id }).lean();
    const status = submission?.status || 'draft';

    const result = students.map(s => ({
      student_id: s._id,
      name: s.name,
      email: s.email,
      marks: markMap[s._id.toString()]?.marks ?? null,
      mark_id: markMap[s._id.toString()]?._id ?? null,
    }));

    res.json({
      assessment: { ...assessment, id: assessment._id },
      students: result,
      submission: {
        status,
        submitted_at: submission?.submitted_at ?? null,
        reviewed_at: submission?.reviewed_at ?? null,
        review_note: submission?.review_note ?? null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessment/teacher/assessments/:id/marks
// Saves marks as a draft. Allowed while status is draft or rejected (i.e. teacher has edit access).
exports.teacherSaveMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id });
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks are locked. This assessment has already been submitted for review.' });
    }

    const { marks } = req.body;
    if (!Array.isArray(marks)) return res.status(400).json({ message: 'marks must be an array' });

    // Validate: no individual mark may exceed the admin-set module weight
    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;
    const overLimit = marks.filter(m => m.marks != null && Number(m.marks) > maxAllowed);
    if (overLimit.length > 0) {
      return res.status(400).json({
        message: `One or more marks exceed the maximum allowed (${maxAllowed}). Please correct them before saving.`,
      });
    }

    const ops = marks.map(m => ({
      updateOne: {
        filter: { assessment_id: req.params.id, student_id: m.student_id },
        update: {
          $set: {
            marks: m.marks,
            entered_by: req.user.id,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) await Mark.bulkWrite(ops);

    // Ensure submission record exists and is in draft status
    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      { $setOnInsert: { assessment_id: req.params.id, status: 'draft' } },
      { upsert: true }
    );

    res.json({ message: 'Marks saved as draft', status: 'draft' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessment/teacher/assessments/:id/submit
// Saves the latest marks, then locks editing by marking the assessment as submitted.
exports.teacherSubmitMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id });
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks have already been submitted.' });
    }

    const { marks } = req.body;

    // Validate marks against admin-set module weight before submitting
    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;
    if (Array.isArray(marks) && marks.length > 0) {
      const overLimit = marks.filter(m => m.marks != null && Number(m.marks) > maxAllowed);
      if (overLimit.length > 0) {
        return res.status(400).json({
          message: `One or more marks exceed the maximum allowed (${maxAllowed}). Please correct them before submitting.`,
        });
      }
    }
    if (Array.isArray(marks) && marks.length > 0) {
      const ops = marks.map(m => ({
        updateOne: {
          filter: { assessment_id: req.params.id, student_id: m.student_id },
          update: { $set: { marks: m.marks, entered_by: req.user.id } },
          upsert: true,
        },
      }));
      await Mark.bulkWrite(ops);
    }

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      {
        $set: {
          status: 'submitted',
          submitted_by: req.user.id,
          submitted_at: new Date(),
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
        },
      },
      { upsert: true }
    );

    res.json({ message: 'Marks submitted for review', status: 'submitted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   ADMIN — ASSESSMENT SUBMISSION REVIEW
═══════════════════════════════════════════════════ */

// GET /api/assessment/admin/submissions
// Lists all assessments (for courses created by this admin) with their submission status.
exports.adminListSubmissions = async (req, res) => {
  try {
    const { status } = req.query;
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id);

    const assessments = await Assessment.find({ course_id: { $in: courseIds } })
      .populate('course_id', 'name code total_marks class_id')
      .populate('teacher_id', 'name email')
      .sort({ created_at: -1 })
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const submissions = await AssessmentSubmission.find({ assessment_id: { $in: assessmentIds } }).lean();
    const subMap = {};
    submissions.forEach(s => { subMap[s.assessment_id.toString()] = s; });

    const allMarks = await Mark.find({ assessment_id: { $in: assessmentIds } }).lean();
    const markCount = {};
    allMarks.forEach(m => {
      if (m.marks != null) {
        const key = m.assessment_id.toString();
        markCount[key] = (markCount[key] || 0) + 1;
      }
    });

    let result = assessments.map(a => {
      const sub = subMap[a._id.toString()];
      return {
        ...a,
        id: a._id,
        submission_status: sub?.status || 'draft',
        submitted_at: sub?.submitted_at || null,
        reviewed_at: sub?.reviewed_at || null,
        review_note: sub?.review_note || null,
        marked_count: markCount[a._id.toString()] || 0,
      };
    });

    if (status) result = result.filter(a => a.submission_status === status);

    res.json({ assessments: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/assessment/admin/submissions/:assessmentId
// "View" — preview all marks submitted for an assessment.
exports.adminViewSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code total_marks class_id')
      .populate('teacher_id', 'name email')
      .lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()))
      return res.status(404).json({ message: 'Assessment not found' });

    const cls = await Class.findById(assessment.course_id?.class_id).populate('students', 'name email level trade').lean();
    const students = cls?.students || [];

    const marks = await Mark.find({ assessment_id: req.params.assessmentId }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId }).lean();

    const result = students.map(s => {
      const m = markMap[s._id.toString()];
      const marksVal = m?.marks ?? null;
      const max = assessment.max_marks;
      return {
        student_id: s._id,
        name: s.name,
        email: s.email,
        marks: marksVal,
        approved_marks: m?.approved_marks ?? null,
        max_marks: max,
        percentage: marksVal != null ? Math.round((marksVal / max) * 100) : null,
        grade: marksVal != null ? getGrade(marksVal, max) : 'N/A',
      };
    });

    res.json({
      assessment: { ...assessment, id: assessment._id },
      students: result,
      submission: {
        status: submission?.status || 'draft',
        submitted_at: submission?.submitted_at || null,
        submitted_by: submission?.submitted_by || null,
        reviewed_at: submission?.reviewed_at || null,
        review_note: submission?.review_note || null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessment/admin/submissions/:assessmentId/approve
// Approves the submission — marks become the "approved_marks" used in reports.
exports.adminApproveSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId).populate('course_id', '_id').lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()))
      return res.status(404).json({ message: 'Assessment not found' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId });
    if (!submission || submission.status !== 'submitted')
      return res.status(400).json({ message: 'This assessment has not been submitted for review.' });

    // Copy current marks into approved_marks for every mark of this assessment
    const marks = await Mark.find({ assessment_id: req.params.assessmentId });
    await Promise.all(marks.map(m => {
      m.approved_marks = m.marks;
      return m.save();
    }));

    submission.status = 'approved';
    submission.reviewed_by = req.user.id;
    submission.reviewed_at = new Date();
    submission.review_note = null;
    await submission.save();

    res.json({ message: 'Assessment approved. Reports now reflect these marks.', status: 'approved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/assessment/admin/submissions/:assessmentId/reject
// Rejects the submission — teacher regains edit access.
exports.adminRejectSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId).populate('course_id', '_id').lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()))
      return res.status(404).json({ message: 'Assessment not found' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId });
    if (!submission || (submission.status !== 'submitted' && submission.status !== 'approved'))
      return res.status(400).json({ message: 'Only submitted or approved assessments can be rejected.' });

    const { note } = req.body;
    submission.status = 'rejected';
    submission.reviewed_by = req.user.id;
    submission.reviewed_at = new Date();
    submission.review_note = note || null;
    await submission.save();

    res.json({ message: 'Assessment rejected. The teacher can now edit marks again.', status: 'rejected' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.assessmentId, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id total_marks')
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
    }));

    const sorted = [...reportData].filter(s => s.percentage != null).sort((a, b) => b.percentage - a.percentage);
    reportData.forEach(s => {
      if (s.percentage != null) {
        s.rank = sorted.findIndex(x => x.student_id?.toString() === s.student_id?.toString()) + 1;
      }
    });

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