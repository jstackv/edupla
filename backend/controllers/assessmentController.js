const { Course, Assessment, Mark, Class, User, AssessmentSubmission, AssessmentQuestion, AssessmentAttempt } = require('../models/db');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const { createInAppNotification, getStudentEmails, getTeacherEmail } = require('../services/notificationHelpers');
const { notifyAssessmentShared } = require('../services/emailService');

/* ─────────────────────────────────────────────────────────
   Assessment title is derived from the assessment type.
   This is the single source of truth.
───────────────────────────────────────────────────────── */
const TYPE_TITLES = {
  FA: 'Formative Assessment',
  IA: 'Integrated Assessment',
  CA: 'Comprehensive Assessment',
};

// Competency decision (Rwandan CBT convention, mirrors the admin report):
// Specific modules pass at 70%, everything else passes at 50%.
function passingLineForCategory(category) {
  return category === 'Specific modules' ? 70 : 50;
}
function computeDecision(pct, category) {
  if (pct == null || Number.isNaN(pct)) return null;
  return pct >= passingLineForCategory(category) ? 'C' : 'NYC';
}
// Scale a score earned out of fromMax onto a different total (the module
// weight), e.g. 62/80 -> ~100.6/130. Null if nothing sensible to scale.
function scaleScore(obtained, fromMax, toMax) {
  if (obtained == null || !fromMax) return null;
  return Math.round((obtained / fromMax) * toMax * 100) / 100;
}

/* ─────────────────────────────────────────────────────────
   Helper: normalise class_ids from the request body.
   Accepts:
     • class_ids: ['id1', 'id2']          (new multi-class UI)
     • class_id:  'id1'                   (legacy single-class)
     • class_ids: []  / class_id: ''      → empty array (no class)
   Always returns a plain array of non-empty strings.
───────────────────────────────────────────────────────── */
function resolveClassIds(body) {
  const { class_ids, class_id } = body;

  if (Array.isArray(class_ids) && class_ids.length > 0) {
    return class_ids.filter(Boolean);          // trust the new multi-class payload
  }

  if (class_id) return [class_id];             // legacy single value

  return [];                                   // nothing assigned
}

/* ═══════════════════════════════════════════════════
   ADMIN — COURSE MANAGEMENT
═══════════════════════════════════════════════════ */

exports.adminGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id })
      /*
       * Populate both fields so the frontend can use whichever it finds:
       *   course.class_ids  → array of populated class objects  (new)
       *   course.class_id   → single populated class object     (legacy)
       */
      .populate('class_ids', 'name')
      .populate('class_id',  'name')
      .populate('teacher_id', 'name email')
      .sort({ created_at: -1 })
      .lean();

    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminCreateCourse = async (req, res) => {
  try {
    const { name, description, code, teacher_id, total_marks, category } = req.body;
    if (!name) return res.status(400).json({ message: 'Course name is required' });

    const classIds = resolveClassIds(req.body);

    const course = await Course.create({
      name:        name.trim(),
      code:        code?.trim()        || null,
      description: description?.trim() || null,
      total_marks: total_marks ? Number(total_marks) : 100,
      category:    category || 'Complementary modules',

      /* ── multi-class (new) ── */
      class_ids: classIds,

      /* ── legacy single-class: keep the first entry so old code still works ── */
      class_id: classIds[0] || null,

      teacher_id:  teacher_id || null,
      created_by:  req.user.id,
    });

    res.status(201).json({ message: 'Course created', id: course._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminUpdateCourse = async (req, res) => {
  try {
    const { name, code, description, teacher_id, total_marks, category } = req.body;
    const update = {};

    if (name        !== undefined) update.name        = name.trim();
    if (code        !== undefined) update.code        = code?.trim()        || null;
    if (description !== undefined) update.description = description?.trim() || null;
    if (total_marks !== undefined) update.total_marks = total_marks ? Number(total_marks) : 100;
    if (category    !== undefined) update.category    = category    || 'Complementary modules';
    if (teacher_id  !== undefined) update.teacher_id  = teacher_id  || null;

    /*
     * class_ids / class_id are only updated when the caller explicitly sends
     * at least one of them (so a PATCH that only changes the name won't
     * accidentally wipe the class assignment).
     */
    const hasClassPayload =
      Array.isArray(req.body.class_ids) || req.body.class_id !== undefined;

    if (hasClassPayload) {
      const classIds = resolveClassIds(req.body);
      update.class_ids = classIds;
      update.class_id  = classIds[0] || null;   // keep legacy field in sync
    }

    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, created_by: req.user.id },
      update,
      { new: true }
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

exports.adminStudentReport = async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const student = await User.findById(studentId).select('name email level trade class_year').lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const studentClass = await Class.findOne({ students: studentId })
      .select('name program_sector program_trade program_qualification_title program_rtqf_level students')
      .populate('students', '_id name')
      .lean();

    const assessmentFilter = {};
    if (studentClass) assessmentFilter.class_id = studentClass._id;
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    const assessments = await Assessment.find(assessmentFilter)
      .populate({ path: 'course_id', select: 'name code total_marks category' })
      .lean();

    const assessmentIds = assessments.map(a => a._id);

    /* ── All marks for all students in the class (for ranking) ── */
    const allClassStudentIds = (studentClass?.students || []).map(s => s._id);
    const allMarks = await Mark.find({
      assessment_id: { $in: assessmentIds },
      student_id: { $in: allClassStudentIds.length ? allClassStudentIds : [studentId] },
    }).lean();

    /* Build per-student mark totals for ranking within same filter */
    const studentTotalsMap = {};
    allMarks.forEach(m => {
      const sid = m.student_id.toString();
      if (!studentTotalsMap[sid]) studentTotalsMap[sid] = { obtained: 0, max: 0 };
      const a = assessments.find(x => x._id.toString() === m.assessment_id.toString());
      if (!a) return;
      if (m.approved_marks != null) {
        studentTotalsMap[sid].obtained += m.approved_marks;
        studentTotalsMap[sid].max      += a.max_marks;
      }
    });

    /* Rank: sort all students by percentage descending */
    const rankedStudents = Object.entries(studentTotalsMap)
      .map(([sid, { obtained, max }]) => ({
        sid,
        pct: max > 0 ? Math.round((obtained / max) * 100) : null,
      }))
      .filter(x => x.pct != null)
      .sort((a, b) => b.pct - a.pct);

    const myRankEntry = rankedStudents.find(x => x.sid === studentId.toString());
    const myRank = myRankEntry
      ? rankedStudents.findIndex(x => x.sid === studentId.toString()) + 1
      : null;

    /* Per-term ranks */
    const TERMS = ['Term 1', 'Term 2', 'Term 3'];
    const termRanks = {};
    for (const t of TERMS) {
      const termAssessments = assessments.filter(a => a.term === t);
      if (termAssessments.length === 0) continue;
      const termAssIds = termAssessments.map(a => a._id);

      const termMarks = allMarks.filter(m =>
        termAssIds.some(id => id.toString() === m.assessment_id.toString())
      );

      const termTotals = {};
      termMarks.forEach(m => {
        const sid = m.student_id.toString();
        if (!termTotals[sid]) termTotals[sid] = { obtained: 0, max: 0 };
        const a = termAssessments.find(x => x._id.toString() === m.assessment_id.toString());
        if (!a) return;
        if (m.approved_marks != null) {
          termTotals[sid].obtained += m.approved_marks;
          termTotals[sid].max      += a.max_marks;
        }
      });

      const ranked = Object.entries(termTotals)
        .map(([sid, { obtained, max }]) => ({ sid, pct: max > 0 ? Math.round((obtained / max) * 100) : null }))
        .filter(x => x.pct != null)
        .sort((a, b) => b.pct - a.pct);

      const myTermEntry = ranked.find(x => x.sid === studentId.toString());
      termRanks[t] = myTermEntry
        ? { rank: ranked.findIndex(x => x.sid === studentId.toString()) + 1, total: ranked.length }
        : null;
    }

    /* Marks for the requested student */
    const myMarks = await Mark.find({ student_id: studentId, assessment_id: { $in: assessmentIds } }).lean();
    const markMap = {};
    myMarks.forEach(m => { markMap[m.assessment_id.toString()] = m; });

    const reportData = assessments.map(a => ({
      assessment_id: a._id,
      title: a.title,
      course: a.course_id?.name || 'N/A',
      course_id: a.course_id?._id,
      course_code: a.course_id?.code || '',
      course_total_marks: a.course_id?.total_marks || 100,
      course_category: a.course_id?.category || 'Complementary modules',
      type: a.type,
      term: a.term,
      year: a.academic_year,
      max_marks: a.max_marks,
      marks_obtained: markMap[a._id.toString()]?.approved_marks ?? null,
    }));

    res.json({
      student: { ...student, id: student._id, class_name: studentClass?.name || student.class_year || null },
      report: reportData,
      rank: myRank,
      total_students: rankedStudents.length,
      term_ranks: termRanks,
      program: {
        sector: studentClass?.program_sector || null,
        trade: studentClass?.program_trade || null,
        qualificationTitle: studentClass?.program_qualification_title || null,
        rtqfLevel: studentClass?.program_rtqf_level || null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminAssessmentReport = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code total_marks category')
      .populate('class_id', 'name')
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

exports.adminClassReport = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId)
      .populate('students', 'name email level trade')
      .populate('teacher_id', 'name email')
      .lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const { term, year, studentIds } = req.query;

    /*
     * Find courses assigned to this class.
     * Support both the legacy single class_id field AND the new class_ids array.
     */
    const courses = await Course.find({
      created_by: req.user.id,
      $or: [
        { class_id:  req.params.classId },
        { class_ids: req.params.classId },
      ],
    }).lean();

    const courseIds = courses.map(c => c._id);

    /*
     * Scope to assessments belonging to THIS class specifically — a module
     * shared with other classes may have its own separate assessments there,
     * which must not bleed into this class's report.
     */
    const assessmentFilter = { course_id: { $in: courseIds }, class_id: req.params.classId };
    if (term) assessmentFilter.term = term;
    if (year) assessmentFilter.academic_year = year;

    const assessments = await Assessment.find(assessmentFilter)
      .populate('course_id', 'name code total_marks category')
      .lean();

    const assessmentIds = assessments.map(a => a._id);

    /* All marks for all class students across all assessments in filter */
    const allMarks = await Mark.find({ assessment_id: { $in: assessmentIds } }).lean();
    const markIndex = {};
    allMarks.forEach(m => {
      const key = m.student_id.toString() + '_' + m.assessment_id.toString();
      markIndex[key] = m;
    });

    /* ── Per-term ranking across ALL class students ── */
    const TERMS_ALL = ['Term 1', 'Term 2', 'Term 3'];
    const termRankMap = {};

    for (const t of TERMS_ALL) {
      const termAssessments = assessments.filter(a => a.term === t);
      if (termAssessments.length === 0) continue;

      const termTotals = cls.students.map(s => {
        let obtained = 0;
        let max = 0;
        termAssessments.forEach(a => {
          const key = s._id.toString() + '_' + a._id.toString();
          const m = markIndex[key];
          if (m?.approved_marks != null) {
            obtained += m.approved_marks;
            max      += a.max_marks;
          }
        });
        return { sid: s._id.toString(), obtained, max, pct: max > 0 ? Math.round((obtained / max) * 100) : null };
      });

      const ranked = [...termTotals]
        .filter(x => x.pct != null)
        .sort((a, b) => b.pct - a.pct);

      ranked.forEach((entry, idx) => {
        if (!termRankMap[entry.sid]) termRankMap[entry.sid] = {};
        termRankMap[entry.sid][t] = { rank: idx + 1, total: ranked.length };
      });
    }

    /* ── Filter to target students for the response ── */
    let targetStudents = cls.students;
    if (studentIds) {
      const ids = studentIds.split(',').filter(Boolean);
      if (ids.length > 0) targetStudents = cls.students.filter(s => ids.includes(s._id.toString()));
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
          course_category: a.course_id?.category || 'Complementary modules',
          type: a.type,
          term: a.term,
          marks: mark?.approved_marks ?? null,
          max_marks: a.max_marks,
        };
      });
      const scored = studentMarks.filter(m => m.marks != null);
      const totalObtained = scored.reduce((s, m) => s + m.marks, 0);
      const totalMax      = scored.reduce((s, m) => s + m.max_marks, 0);
      const percentage    = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
      return {
        student_id: s._id, name: s.name, email: s.email, level: s.level, trade: s.trade,
        marks: studentMarks, total_obtained: totalObtained, total_max: totalMax, percentage,
        grade: totalMax > 0 ? getGrade(totalObtained, totalMax) : 'N/A',
        term_ranks: termRankMap[s._id.toString()] || {},
      };
    });

    /* ── Annual rank across ALL class students ── */
    const allStudentTotals = cls.students.map(s => {
      const scored = assessments.map(a => {
        const key = s._id.toString() + '_' + a._id.toString();
        const m = markIndex[key];
        return m?.approved_marks != null ? { marks: m.approved_marks, max: a.max_marks } : null;
      }).filter(Boolean);
      const totalObt = scored.reduce((acc, x) => acc + x.marks, 0);
      const totalMx  = scored.reduce((acc, x) => acc + x.max, 0);
      return {
        sid: s._id.toString(),
        pct: totalMx > 0 ? Math.round((totalObt / totalMx) * 100) : null,
      };
    });

    const annualRanked = [...allStudentTotals]
      .filter(x => x.pct != null)
      .sort((a, b) => b.pct - a.pct);

    students.forEach(s => {
      const idx = annualRanked.findIndex(x => x.sid === s.student_id.toString());
      s.rank = idx >= 0 ? idx + 1 : null;
      s.rank_total = annualRanked.length;
    });

    /*
     * Display order: ascending rank (rank 1 first). When a single term was
     * requested, order by that term's rank; otherwise use the overall/annual
     * rank. Students with no rank (no marks yet) are pushed to the end.
     */
    students.sort((a, b) => {
      const rankOf = (s) => (term ? s.term_ranks?.[term]?.rank : s.rank) ?? Infinity;
      return rankOf(a) - rankOf(b);
    });

    res.json({
      class: {
        id: cls._id, name: cls.name,
        teacher: cls.teacher_id ? { name: cls.teacher_id.name, email: cls.teacher_id.email } : null,
        program: {
          sector: cls.program_sector || null,
          trade: cls.program_trade || null,
          qualificationTitle: cls.program_qualification_title || null,
          rtqfLevel: cls.program_rtqf_level || null,
        },
      },
      assessments, courses, students,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   TEACHER — ASSESSMENT MANAGEMENT
═══════════════════════════════════════════════════ */

exports.teacherGetCourses = async (req, res) => {
  try {
    const courses = await Course.find({ teacher_id: req.user.id, is_active: true })
      .populate('class_ids', 'name')
      .populate('class_id',  'name')
      .sort({ created_at: -1 })
      .lean();
    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetAssessments = async (req, res) => {
  try {
    const { course_id, class_id, mode } = req.query;
    const filter = { teacher_id: req.user.id };
    if (course_id) filter.course_id = course_id;
    if (class_id) filter.class_id = class_id;
    // Marks Recording and the independent online-Assessments page each only
    // ever see their own records. Default to 'marks' for backward compatibility
    // with the existing Marks Recording page, which never sends this param.
    filter.mode = mode === 'quiz' ? 'quiz' : 'marks';

    const assessments = await Assessment.find(filter)
      .populate('course_id', 'name code class_id class_ids total_marks category')
      .populate('class_id', 'name')
      .sort({ created_at: -1 })
      .lean();

    const assessmentIds = assessments.map(a => a._id);
    const submissions = await AssessmentSubmission.find({ assessment_id: { $in: assessmentIds } }).lean();
    const subMap = {};
    submissions.forEach(s => { subMap[s.assessment_id.toString()] = s; });

    const enriched = await Promise.all(assessments.map(async a => {
      /*
       * Student/marked counts are scoped to THIS assessment's own class —
       * not every class the module happens to be assigned to.
       */
      let studentCount = 0;
      let markedCount  = 0;

      const classId = a.class_id?._id || a.class_id;
      if (classId) {
        const cls = await Class.findById(classId, 'students').lean();
        studentCount = cls?.students?.length || 0;
        markedCount  = await Mark.countDocuments({ assessment_id: a._id, marks: { $ne: null } });
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
    const { course_id, class_id, type, term, academic_year, mode, title } = req.body;
    const assessmentMode = mode === 'quiz' ? 'quiz' : 'marks';

    if (!course_id || !class_id || !type || !term || !academic_year) {
      return res.status(400).json({ message: 'Class, module, type, term, and year are required' });
    }

    if (!TYPE_TITLES[type]) {
      return res.status(400).json({ message: `Invalid assessment type "${type}". Must be FA, IA, or CA.` });
    }

    const baseTitle = TYPE_TITLES[type];

    const course = await Course.findOne({ _id: course_id, teacher_id: req.user.id });
    if (!course) return res.status(403).json({ message: 'Course not assigned to you' });

    /* ── The selected class must actually be one of the classes this module is assigned to ── */
    const courseClassIds = (
      Array.isArray(course.class_ids) && course.class_ids.length > 0
        ? course.class_ids
        : course.class_id ? [course.class_id] : []
    ).map(String);
    if (!courseClassIds.includes(String(class_id))) {
      return res.status(400).json({ message: 'This module is not assigned to the selected class.' });
    }

    const courseWeight = course.total_marks || 100;
    /* Quiz-mode assessments no longer take a manually entered maximum — the
       max is derived automatically once the teacher builds the question
       paper (sum of each question's marks), and is kept ≤ the module weight
       by teacherSaveQuestions. It starts at 0 here and is filled in later. */

    /* ── Titles: a module/class/term/year can now hold MULTIPLE assessments
       of the same type (e.g. 2+ Formative Assessments), so the duplicate
       guard is scoped by TITLE, not by type alone. If the teacher doesn't
       supply a custom title, one is auto-generated by appending an ordinal
       to the type's base title ("Formative Assessment 2", "…3", etc.) so
       it never collides with an assessment that already exists. ── */
    const siblingCount = await Assessment.countDocuments({
      course_id, class_id, teacher_id: req.user.id, type, term, academic_year, mode: assessmentMode,
    });

    let finalTitle = (title || '').toString().trim();
    if (!finalTitle) {
      finalTitle = siblingCount === 0 ? baseTitle : `${baseTitle} ${siblingCount + 1}`;
    }

    /* ── Server-side duplicate guard — scoped to THIS class, mode AND title.
       A module assigned to several classes can have its own independent set
       of assessments per class; an assessment created for one class is never
       treated as already created for another. The manual "Marks Recording"
       assessment and an independent online-quiz assessment for the same
       module/class/term/year are two separate records (they live on two
       separate teacher pages), so mode is part of the duplicate check too. ── */
    const existing = await Assessment.findOne({
      course_id,
      class_id,
      teacher_id: req.user.id,
      term,
      academic_year,
      mode: assessmentMode,
      title: finalTitle,
    });
    if (existing) {
      const cls = await Class.findById(class_id).select('name').lean();
      return res.status(409).json({
        message: `An assessment titled "${finalTitle}" already exists for this module in ${term} ${academic_year}${cls ? ` (${cls.name})` : ''}. Give this one a different title.`,
      });
    }

    const assessment = await Assessment.create({
      title: finalTitle,
      course_id,
      class_id,
      teacher_id: req.user.id,
      type,
      term,
      academic_year,
      max_marks: assessmentMode === 'quiz' ? 0 : courseWeight,
      created_by: req.user.id,
      mode: assessmentMode,
    });

    res.status(201).json({ message: 'Assessment created', id: assessment._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An assessment with this title already exists for this module, class, term and year.' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.teacherUpdateAssessment = async (req, res) => {
  try {
    const { type, term, academic_year, class_id, title } = req.body;

    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks class_id class_ids');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    /* Once an assessment has been shared with students, its core details
       (type/term/year/class/title) are locked — editing them after students
       may already be attempting it could silently invalidate their progress
       or results. Unshare it first (which stops new attempts, but keeps
       existing ones) if these details genuinely need to change. Sharing
       settings themselves (duration, expiry, attempts, instructions) are
       edited separately via the Share modal / "Add attempt" action, which
       remain available even while shared. */
    if (assessment.is_shared) {
      return res.status(400).json({
        message: 'This assessment has already been shared, so its type, term, year, class and title are locked. Unshare it first if you need to change these details.',
      });
    }

    const update = {};
    if (type) {
      if (!TYPE_TITLES[type]) {
        return res.status(400).json({ message: `Invalid assessment type "${type}". Must be FA, IA, or CA.` });
      }
      update.type = type;
      // Only fall back to the auto title if the teacher isn't also setting
      // a custom one in this same request.
      if (!title) update.title = TYPE_TITLES[type];
    }
    if (title && title.toString().trim()) update.title = title.toString().trim();
    if (term) update.term = term;
    if (academic_year) update.academic_year = academic_year;

    /* If the class is being changed, make sure it's still one of the classes
       this module is assigned to. */
    if (class_id) {
      const courseClassIds = (
        Array.isArray(assessment.course_id?.class_ids) && assessment.course_id.class_ids.length > 0
          ? assessment.course_id.class_ids
          : assessment.course_id?.class_id ? [assessment.course_id.class_id] : []
      ).map(String);
      if (!courseClassIds.includes(String(class_id))) {
        return res.status(400).json({ message: 'This module is not assigned to the selected class.' });
      }
      update.class_id = class_id;
    }

    /* Server-side duplicate guard for edits — scoped to the (possibly new)
       class AND title, since a module/class/term/year can now legitimately
       hold several assessments of the same type as long as titles differ. */
    const checkTerm  = term          || assessment.term;
    const checkYear  = academic_year || assessment.academic_year;
    const checkClass = class_id      || assessment.class_id;
    const checkTitle = update.title  || assessment.title;
    const duplicate = await Assessment.findOne({
      _id: { $ne: req.params.id },
      course_id: assessment.course_id?._id || assessment.course_id,
      class_id: checkClass,
      teacher_id: req.user.id,
      term: checkTerm,
      academic_year: checkYear,
      mode: assessment.mode,
      title: checkTitle,
    });
    if (duplicate) {
      return res.status(409).json({
        message: `An assessment titled "${checkTitle}" already exists for this module/class in ${checkTerm} ${checkYear}. Give it a different title.`,
      });
    }

    if (assessment.mode !== 'quiz') {
      update.max_marks = assessment.course_id?.total_marks || assessment.max_marks || 100;
    }

    const updated = await Assessment.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.user.id },
      update, { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Assessment not found' });
    res.json({ message: 'Assessment updated' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An assessment with this title already exists for this module, class, term and year.' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.teacherDeleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const marksCount = await Mark.countDocuments({ assessment_id: req.params.id, marks: { $ne: null } });
    if (marksCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this assessment — ${marksCount} mark(s) have already been recorded. Clear all marks before deleting.`,
      });
    }

    const attemptsCount = await AssessmentAttempt.countDocuments({ assessment_id: req.params.id });
    if (attemptsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this assessment — ${attemptsCount} student attempt(s) have already been recorded.`,
      });
    }

    await Assessment.deleteOne({ _id: req.params.id });
    await Mark.deleteMany({ assessment_id: req.params.id });
    await AssessmentSubmission.deleteOne({ assessment_id: req.params.id });
    await AssessmentQuestion.deleteMany({ assessment_id: req.params.id });
    await AssessmentAttempt.deleteMany({ assessment_id: req.params.id });
    res.json({ message: 'Assessment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name code class_id class_ids total_marks category')
      .populate('class_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    /*
     * Students come from THIS assessment's own class only — not every class
     * the module happens to be assigned to.
     */
    let students = [];
    const classId = assessment.class_id?._id || assessment.class_id;
    if (classId) {
      const cls = await Class.findById(classId)
        .populate('students', 'name email level trade')
        .lean();
      students = cls?.students || [];
    }

    const marks = await Mark.find({ assessment_id: req.params.id }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id }).lean();
    const status = submission?.status || 'draft';

    /*
     * Default marking order: ascending by student name (A→Z). This is the
     * order teachers see both in the on-screen marks table and in the
     * downloadable Excel template, before any marks have been entered.
     * Once marks are uploaded via Excel, the frontend re-sorts the table by
     * performance (marks obtained) — see teacherUploadMarks below.
     */
    const result = students
      .map(s => ({
        student_id: s._id,
        name: s.name,
        email: s.email,
        marks: markMap[s._id.toString()]?.marks ?? null,
        mark_id: markMap[s._id.toString()]?._id ?? null,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json({
      assessment: { ...assessment, id: assessment._id },
      students: result,
      submission: {
        status,
        submitted_at: submission?.submitted_at ?? null,
        reviewed_at:  submission?.reviewed_at  ?? null,
        review_note:  submission?.review_note  ?? null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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

    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;
    const overLimit  = marks.filter(m => m.marks != null && Number(m.marks) > maxAllowed);
    if (overLimit.length > 0) {
      return res.status(400).json({
        message: `One or more marks exceed the maximum allowed (${maxAllowed}). Please correct them before saving.`,
      });
    }

    const ops = marks.map(m => ({
      updateOne: {
        filter: { assessment_id: req.params.id, student_id: m.student_id },
        update: { $set: { marks: m.marks, entered_by: req.user.id } },
        upsert: true,
      },
    }));

    if (ops.length > 0) await Mark.bulkWrite(ops);

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      { $setOnInsert: { assessment_id: req.params.id, status: 'draft' } },
      { upsert: true }
    );

    res.json({ message: 'Marks saved as draft', status: 'draft' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   TEACHER — EXCEL TEMPLATE DOWNLOAD / MARKS UPLOAD
═══════════════════════════════════════════════════ */

/*
 * Loads the assessment (scoped to this teacher), its class roster
 * (ascending by name), and any existing marks. Shared by the template
 * download and the upload handler so both always agree on which students
 * belong to this assessment and what the current marks are.
 */
async function loadAssessmentForExcel(req) {
  const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
    .populate('course_id', 'name code total_marks')
    .populate('class_id', 'name')
    .lean();
  if (!assessment) return null;

  let students = [];
  const classId = assessment.class_id?._id || assessment.class_id;
  if (classId) {
    const cls = await Class.findById(classId).populate('students', 'name email').lean();
    students = cls?.students || [];
  }
  students = [...students].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const marks = await Mark.find({ assessment_id: req.params.id }).lean();
  const markMap = {};
  marks.forEach(m => { markMap[m.student_id.toString()] = m; });

  return { assessment, students, markMap };
}

/*
 * GET /teacher/assessments/:id/marks/template
 * Streams an .xlsx workbook back to the teacher: one row per student
 * (ascending by name), pre-filled with any marks already recorded, plus a
 * hidden Student ID column used to match rows back up on upload — even if
 * the teacher reorders or resorts the sheet in Excel.
 */
exports.teacherDownloadMarksTemplate = async (req, res) => {
  try {
    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id }).lean();
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks are locked. This assessment has already been submitted for review.' });
    }

    const data = await loadAssessmentForExcel(req);
    if (!data) return res.status(404).json({ message: 'Assessment not found' });
    const { assessment, students, markMap } = data;

    if (students.length === 0) {
      return res.status(400).json({ message: 'This assessment has no students to build a template for.' });
    }

    const maxMarks = assessment.course_id?.total_marks || assessment.max_marks || 100;

    const header = ['Student ID', 'No.', 'Student Name', 'Email', `Marks (out of ${maxMarks})`];
    const rows = students.map((s, i) => [
      String(s._id),
      i + 1,
      s.name || '',
      s.email || '',
      markMap[s._id.toString()]?.marks ?? '',
    ]);

    const title = `${assessment.title} — ${assessment.course_id?.name || ''} — ${assessment.class_id?.name || ''} — ${assessment.term} ${assessment.academic_year}`;
    const instructions = `Enter marks in the last column only (0–${maxMarks}). Do not edit the Student ID, No., Name, or Email columns — they are used to match rows back to students on upload. Do not add or remove rows.`;

    const sheetData = [[title], [instructions], [], header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Merge the title/instruction rows across all columns for readability.
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
    ];
    ws['!cols'] = [
      { wch: 26 }, // Student ID
      { wch: 6 },  // No.
      { wch: 28 }, // Name
      { wch: 30 }, // Email
      { wch: 20 }, // Marks
    ];
    // Hide the Student ID column — teachers don't need to see/touch it.
    ws['!cols'][0].hidden = true;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `marks-template-${assessment.type}-${(assessment.class_id?.name || 'class').replace(/[^a-z0-9]+/gi, '-')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/*
 * POST /teacher/assessments/:id/marks/upload
 * Accepts a multipart 'file' field containing the filled-in Excel
 * template, parses it, validates marks against the module's max marks,
 * and upserts Mark records exactly like teacherSaveMarks (draft status,
 * same locking rules). Rows are matched to students by the hidden
 * Student ID column; unrecognised or malformed rows are reported back
 * instead of silently applied.
 */
exports.teacherUploadMarks = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.id });
    if (submission && (submission.status === 'submitted' || submission.status === 'approved')) {
      return res.status(403).json({ message: 'Marks are locked. This assessment has already been submitted for review.' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded. Please select an Excel (.xlsx) file.' });
    }

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch {
      return res.status(400).json({ message: 'Could not read this file. Please upload a valid .xlsx file.' });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ message: 'The uploaded workbook has no sheets.' });

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find the header row (contains 'Student ID') instead of assuming a
    // fixed row number, so minor edits (extra blank rows, etc.) still work.
    const headerRowIdx = rows.findIndex(r => r.some(cell => String(cell).trim() === 'Student ID'));
    if (headerRowIdx === -1) {
      return res.status(400).json({ message: 'This does not look like the marks template — the "Student ID" column header was not found. Please use the downloaded template.' });
    }
    const headerRow = rows[headerRowIdx].map(c => String(c).trim());
    const idCol    = headerRow.indexOf('Student ID');
    const marksCol = headerRow.findIndex(c => c.startsWith('Marks'));
    if (idCol === -1 || marksCol === -1) {
      return res.status(400).json({ message: 'The template is missing required columns. Please use the downloaded template.' });
    }

    const dataRows = rows.slice(headerRowIdx + 1).filter(r => r.some(c => String(c).trim() !== ''));

    // Roster for this assessment's class, so we only accept marks for
    // students who actually belong to it.
    let students = [];
    const classId = assessment.class_id?._id || assessment.class_id;
    if (classId) {
      const cls = await Class.findById(classId).populate('students', 'name email').lean();
      students = cls?.students || [];
    }
    const validStudentIds = new Set(students.map(s => String(s._id)));

    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;

    const ops = [];
    const errors = [];
    dataRows.forEach((row, i) => {
      const rowNum = headerRowIdx + 2 + i; // 1-indexed, +1 for header row itself
      const studentId = String(row[idCol] ?? '').trim();
      const rawMarks  = row[marksCol];

      if (!studentId) return; // blank ID cell on an otherwise blank-ish row; skip quietly
      if (!validStudentIds.has(studentId)) {
        errors.push(`Row ${rowNum}: unrecognised student — this row was not modified.`);
        return;
      }

      if (rawMarks === '' || rawMarks == null) {
        ops.push({ student_id: studentId, marks: null });
        return;
      }

      const num = Number(rawMarks);
      if (Number.isNaN(num)) {
        errors.push(`Row ${rowNum}: "${rawMarks}" is not a valid number — this row was skipped.`);
        return;
      }
      if (num < 0 || num > maxAllowed) {
        errors.push(`Row ${rowNum}: ${num} is outside the allowed range (0–${maxAllowed}) — this row was skipped.`);
        return;
      }

      ops.push({ student_id: studentId, marks: num });
    });

    if (ops.length > 0) {
      await Mark.bulkWrite(ops.map(m => ({
        updateOne: {
          filter: { assessment_id: req.params.id, student_id: m.student_id },
          update: { $set: { marks: m.marks, entered_by: req.user.id } },
          upsert: true,
        },
      })));
    }

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      { $setOnInsert: { assessment_id: req.params.id, status: 'draft' } },
      { upsert: true }
    );

    /* ── Return the refreshed roster, sorted by performance (marks
       obtained, highest first) so the frontend can immediately show
       students ranked by how they did on this upload. Students with no
       mark are pushed to the end. ── */
    const freshMarks = await Mark.find({ assessment_id: req.params.id }).lean();
    const freshMarkMap = {};
    freshMarks.forEach(m => { freshMarkMap[m.student_id.toString()] = m; });

    const resultStudents = students
      .map(s => ({
        student_id: s._id,
        name: s.name,
        email: s.email,
        marks: freshMarkMap[s._id.toString()]?.marks ?? null,
      }))
      .sort((a, b) => {
        if (a.marks == null && b.marks == null) return (a.name || '').localeCompare(b.name || '');
        if (a.marks == null) return 1;
        if (b.marks == null) return -1;
        return b.marks - a.marks;
      });

    res.json({
      message: errors.length > 0
        ? `Uploaded with ${errors.length} issue${errors.length === 1 ? '' : 's'} — see details.`
        : 'Marks uploaded successfully',
      updated: ops.length,
      errors,
      students: resultStudents,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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
    const maxAllowed = assessment.course_id?.total_marks || assessment.max_marks || 100;

    if (Array.isArray(marks) && marks.length > 0) {
      const overLimit = marks.filter(m => m.marks != null && Number(m.marks) > maxAllowed);
      if (overLimit.length > 0) {
        return res.status(400).json({
          message: `One or more marks exceed the maximum allowed (${maxAllowed}). Please correct them before submitting.`,
        });
      }
      const ops = marks.map(m => ({
        updateOne: {
          filter: { assessment_id: req.params.id, student_id: m.student_id },
          update: { $set: { marks: m.marks, entered_by: req.user.id } },
          upsert: true,
        },
      }));
      await Mark.bulkWrite(ops);
    }

    /* ── Marks must be fully recorded before submission is allowed.
       Saving (draft) is always allowed even with no marks at all — this lets a
       teacher clear marks back out and delete the assessment if needed — but
       submitting for admin review requires every student to have a mark. ── */
    const cls = await Class.findOne({ _id: assessment.class_id }, 'students').lean();
    const totalStudents = cls?.students?.length || 0;

    if (totalStudents > 0) {
      const allMarks = await Mark.find({ assessment_id: req.params.id }).lean();
      const recordedCount = allMarks.filter(m => m.marks != null).length;
      if (recordedCount < totalStudents) {
        return res.status(400).json({
          message: `Cannot submit — ${totalStudents - recordedCount} of ${totalStudents} student(s) still need marks recorded before this assessment can be submitted for review.`,
        });
      }
    }

    await AssessmentSubmission.findOneAndUpdate(
      { assessment_id: req.params.id },
      {
        $set: {
          status: 'submitted',
          submitted_by: req.user.id,
          submitted_at: new Date(),
          reviewed_by:  null,
          reviewed_at:  null,
          review_note:  null,
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

exports.adminListSubmissions = async (req, res) => {
  try {
    const { status } = req.query;
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id);

    const assessments = await Assessment.find({ course_id: { $in: courseIds } })
      .populate('course_id', 'name code total_marks class_id class_ids category')
      .populate('class_id', 'name')
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
        ...a, id: a._id,
        submission_status: sub?.status || 'draft',
        submitted_at:  sub?.submitted_at  || null,
        reviewed_at:   sub?.reviewed_at   || null,
        review_note:   sub?.review_note   || null,
        marked_count:  markCount[a._id.toString()] || 0,
      };
    });

    if (status) result = result.filter(a => a.submission_status === status);
    res.json({ assessments: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminViewSubmission = async (req, res) => {
  try {
    const courses = await Course.find({ created_by: req.user.id }, '_id').lean();
    const courseIds = courses.map(c => c._id.toString());

    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('course_id', 'name code total_marks category')
      .populate('class_id', 'name')
      .populate('teacher_id', 'name email')
      .lean();
    if (!assessment || !courseIds.includes(assessment.course_id?._id?.toString()))
      return res.status(404).json({ message: 'Assessment not found' });

    /*
     * Students come from THIS assessment's own class only.
     */
    let students = [];
    const classId = assessment.class_id?._id || assessment.class_id;
    if (classId) {
      const cls = await Class.findById(classId)
        .populate('students', 'name email level trade')
        .lean();
      students = cls?.students || [];
    }

    const marks = await Mark.find({ assessment_id: req.params.assessmentId }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const submission = await AssessmentSubmission.findOne({ assessment_id: req.params.assessmentId }).lean();

    const result = students.map(s => {
      const m = markMap[s._id.toString()];
      const marksVal = m?.marks ?? null;
      const max = assessment.max_marks;
      return {
        student_id: s._id, name: s.name, email: s.email,
        marks: marksVal, approved_marks: m?.approved_marks ?? null, max_marks: max,
        percentage: marksVal != null ? Math.round((marksVal / max) * 100) : null,
        grade: marksVal != null ? getGrade(marksVal, max) : 'N/A',
      };
    });

    res.json({
      assessment: { ...assessment, id: assessment._id },
      students: result,
      submission: {
        status:       submission?.status       || 'draft',
        submitted_at: submission?.submitted_at || null,
        submitted_by: submission?.submitted_by || null,
        reviewed_at:  submission?.reviewed_at  || null,
        review_note:  submission?.review_note  || null,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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

    const marks = await Mark.find({ assessment_id: req.params.assessmentId });
    await Promise.all(marks.map(m => { m.approved_marks = m.marks; return m.save(); }));

    submission.status      = 'approved';
    submission.reviewed_by = req.user.id;
    submission.reviewed_at = new Date();
    submission.review_note = null;
    await submission.save();

    res.json({ message: 'Assessment approved. Reports now reflect these marks.', status: 'approved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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
    submission.status      = 'rejected';
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
      .populate('course_id', 'name code class_id class_ids total_marks category')
      .populate('class_id', 'name')
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

/* ─────────── Helpers ─────────── */
function getGrade(obtained, max) {
  const pct = Math.min((obtained / max) * 100, 100);
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

/* ─────────── Student: get all courses for their enrolled class ─────────── */
exports.studentGetCourses = async (req, res) => {
  try {
    const cls = await Class.findOne({ students: req.user.id }).lean();
    if (!cls) return res.json({ courses: [] });

    /*
     * Match courses assigned to this class via either field.
     */
    const courses = await Course.find({
      $or: [
        { class_id:  cls._id },
        { class_ids: cls._id },
      ],
    })
      .populate('teacher_id', 'name email')
      .populate('class_ids', 'name')
      .populate('class_id',  'name')
      .sort({ category: 1, name: 1 })
      .lean();

    res.json({ courses: courses.map(c => ({ ...c, id: c._id })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
/* ═══════════════════════════════════════════════════════════════════════
   ONLINE ASSESSMENT (QUIZ) FEATURE
   ───────────────────────────────────────────────────────────────────────
   Adds question-based, auto-graded assessments on top of the existing
   marks-entry Assessment model:
     1. Teacher builds a question paper for an assessment (MCQ, True/False,
        Fill-in-the-gap, Matching, Open) — teacherSaveQuestions.
     2. Teacher shares it with the class with a duration, expiry, and
        attempt limit — teacherShareAssessment.
     3. Students see it under "Assessments", read the instructions, and
        start it — studentGetSharedAssessments / studentGetAssessmentInstructions
        / studentStartAttempt.
     4. The attempt runs full-screen client-side; the server enforces the
        time limit and accepts autosaves and the final submit/auto-submit.
     5. On submit, everything except open questions is auto-graded exactly
        against the teacher's expected answers. Open questions wait for the
        teacher (teacherGradeOpenAnswers). Once an attempt is fully graded
        its score feeds into the same Mark model the manual-entry flow uses,
        so the existing report/approval pipeline picks it up automatically.
   ═══════════════════════════════════════════════════════════════════════ */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normStr(s) { return (s ?? '').toString().trim().toLowerCase(); }

/*
 * Auto-grade one answer against its question's expected answer.
 * Returns { auto_score, is_correct, needsManual }. `needsManual` is true
 * only for open questions, which always require a teacher score.
 */
function gradeAnswer(question, answer) {
  const marks = question.marks || 0;
  switch (question.type) {
    case 'mcq': {
      const correct = Array.isArray(question.correct_answer)
        ? question.correct_answer.map(normStr)
        : [normStr(question.correct_answer)];
      const given = Array.isArray(answer) ? answer.map(normStr) : (answer != null ? [normStr(answer)] : []);
      const isCorrect = correct.length > 0 && correct.length === given.length && correct.every(c => given.includes(c));
      return { auto_score: isCorrect ? marks : 0, is_correct: isCorrect, needsManual: false };
    }
    case 'true_false': {
      const isCorrect = normStr(answer) === normStr(question.correct_answer);
      return { auto_score: isCorrect ? marks : 0, is_correct: isCorrect, needsManual: false };
    }
    case 'fill_gap': {
      const accepted = Array.isArray(question.correct_answer)
        ? question.correct_answer.map(normStr)
        : [normStr(question.correct_answer)];
      const isCorrect = accepted.includes(normStr(answer));
      return { auto_score: isCorrect ? marks : 0, is_correct: isCorrect, needsManual: false };
    }
    case 'matching': {
      const pairs = question.pairs || [];
      if (!pairs.length) return { auto_score: 0, is_correct: false, needsManual: false };
      const given = answer && typeof answer === 'object' ? answer : {};
      let correctCount = 0;
      pairs.forEach(p => { if (normStr(given[p.left]) === normStr(p.right)) correctCount++; });
      const isCorrect = correctCount === pairs.length;
      const score = Math.round((marks * correctCount / pairs.length) * 100) / 100;
      return { auto_score: score, is_correct: isCorrect, needsManual: false };
    }
    case 'open':
    default:
      return { auto_score: null, is_correct: null, needsManual: true };
  }
}

/* Strip a question of anything that would give the answer away before
   sending it to a student who is about to attempt it. */
function stripQuestionForAttempt(q) {
  const base = { id: q._id, type: q.type, question_text: q.question_text, marks: q.marks };
  if (q.type === 'mcq') base.options = (q.options || []).map(o => ({ key: o.key, text: o.text }));
  if (q.type === 'matching') {
    base.left_items = (q.pairs || []).map(p => p.left);
    base.right_options = shuffleArray((q.pairs || []).map(p => p.right));
  }
  return base;
}

async function buildAttemptPayload(attempt, assessment, orderedQuestions) {
  let questions = orderedQuestions;
  if (!questions) {
    const found = await AssessmentQuestion.find({ _id: { $in: attempt.question_order } }).lean();
    const map = {};
    found.forEach(q => { map[q._id.toString()] = q; });
    questions = attempt.question_order.map(id => map[id.toString()]).filter(Boolean);
  }
  const answerMap = {};
  (attempt.answers || []).forEach(a => { answerMap[a.question_id.toString()] = a.answer; });

  return {
    attempt_id: attempt._id,
    assessment_id: assessment._id,
    assessment_title: assessment.title,
    module_name: assessment.course_id?.name,
    instructions: assessment.instructions,
    duration_minutes: assessment.duration_minutes,
    started_at: attempt.started_at,
    due_at: attempt.due_at,
    questions: questions.map(q => ({
      ...stripQuestionForAttempt(q),
      saved_answer: answerMap[q._id.toString()] ?? null,
    })),
  };
}

/* Recompute an attempt's total score from its (now fully-scored) answers,
   mark it graded, and — if it beats the student's best score so far — push
   it into the Mark model so it flows through the existing report/approval
   pipeline exactly like a manually entered mark. */
async function finalizeAttemptSubmission(attempt, { autoSubmitted = false, reason = null } = {}) {
  const questions = await AssessmentQuestion.find({ _id: { $in: attempt.question_order } }).lean();
  const qMap = {};
  questions.forEach(q => { qMap[q._id.toString()] = q; });

  let allGraded = true;
  attempt.answers.forEach(a => {
    const q = qMap[a.question_id.toString()];
    if (!q) return;
    if (a.auto_score == null && a.manual_score == null) {
      const g = gradeAnswer(q, a.answer);
      a.auto_score = g.auto_score;
      a.is_correct = g.is_correct;
    }
    if (a.auto_score == null && a.manual_score == null) allGraded = false;
  });

  attempt.status = allGraded ? 'graded' : 'submitted';
  attempt.needs_manual_grading = !allGraded;
  attempt.submitted_at = new Date();
  attempt.auto_submitted = autoSubmitted;
  attempt.auto_submit_reason = reason;

  if (allGraded) {
    const total = attempt.answers.reduce((s, a) => s + (a.auto_score != null ? a.auto_score : a.manual_score), 0);
    attempt.total_score = Math.round(total * 100) / 100;
    attempt.graded_at = new Date();
  }

  await attempt.save();

  if (allGraded) {
    const assessment = await Assessment.findById(attempt.assessment_id).lean();
    if (assessment) await recomputeAndUpsertMark(assessment, attempt.student_id);
  }
  return attempt;
}

/* Builds the "here's your result" payload shared by submit / auto-submit /
   resume-after-ended, so the student always sees their score on both the
   assessment's own scale AND the module weight scale, plus the C/NYC
   decision once grading is fully complete (open questions included). */
function buildResultPayload(assessment, attempt) {
  const maxMarks = assessment.max_marks || 0;
  const moduleWeight = assessment.course_id?.total_marks || 100;
  const category = assessment.course_id?.category || 'Complementary modules';
  const totalScore = attempt.total_score;
  const percentage = totalScore != null && maxMarks ? Math.round((totalScore / maxMarks) * 100) : null;
  return {
    status: attempt.status,
    total_score: totalScore,
    needs_manual_grading: attempt.needs_manual_grading,
    max_marks: maxMarks,
    module_weight: moduleWeight,
    marks_on_mw: scaleScore(totalScore, maxMarks, moduleWeight),
    percentage,
    decision: attempt.status === 'graded' ? computeDecision(percentage, category) : null,
  };
}

/* A student's Mark for a quiz-mode assessment is always their BEST fully
   graded attempt — matches the "however many attempts, best one counts"
   expectation and keeps a single source of truth for reports. */
async function recomputeAndUpsertMark(assessment, studentId) {
  const attempts = await AssessmentAttempt.find({
    assessment_id: assessment._id, student_id: studentId, status: 'graded', total_score: { $ne: null },
  }).lean();
  if (!attempts.length) return;
  const best = attempts.reduce((a, b) => (b.total_score > a.total_score ? b : a));
  await Mark.findOneAndUpdate(
    { assessment_id: assessment._id, student_id: studentId },
    { marks: best.total_score, entered_by: assessment.teacher_id },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

/* ═══════════════════════ TEACHER: Question builder ═══════════════════ */

exports.teacherGetQuestions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id }).lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const locked = await AssessmentAttempt.countDocuments({
      assessment_id: assessment._id, status: { $ne: 'in_progress' },
    }) > 0;

    const questions = await AssessmentQuestion.find({ assessment_id: req.params.id }).sort({ order: 1 }).lean();
    res.json({
      questions: questions.map(q => ({ ...q, id: q._id })),
      locked,
      mode: assessment.mode,
      is_shared: assessment.is_shared,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherSaveQuestions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'total_marks');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const submittedAttempts = await AssessmentAttempt.countDocuments({
      assessment_id: assessment._id, status: { $ne: 'in_progress' },
    });
    if (submittedAttempts > 0) {
      return res.status(400).json({ message: 'Questions are locked — students have already submitted attempts for this assessment.' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Add at least one question.' });
    }

    const VALID_TYPES = ['mcq', 'true_false', 'fill_gap', 'matching', 'open'];
    for (const q of questions) {
      if (!q.question_text || !q.question_text.trim()) {
        return res.status(400).json({ message: 'Every question needs question text.' });
      }
      if (!VALID_TYPES.includes(q.type)) {
        return res.status(400).json({ message: `Invalid question type "${q.type}".` });
      }
      if (!q.marks || Number(q.marks) <= 0) {
        return res.status(400).json({ message: 'Every question needs marks greater than 0.' });
      }
      if (q.type === 'mcq' && (!Array.isArray(q.options) || q.options.length < 2)) {
        return res.status(400).json({ message: 'Multiple choice questions need at least 2 options.' });
      }
      if (q.type === 'mcq' && (!Array.isArray(q.correct_answer) || q.correct_answer.length === 0)) {
        return res.status(400).json({ message: 'Select the correct option(s) for every multiple choice question.' });
      }
      if (q.type === 'matching' && (!Array.isArray(q.pairs) || q.pairs.length < 2)) {
        return res.status(400).json({ message: 'Matching questions need at least 2 pairs.' });
      }
      if (q.type === 'true_false' && !['true', 'false'].includes(String(q.correct_answer))) {
        return res.status(400).json({ message: 'True/False questions need a correct answer of true or false.' });
      }
      if (q.type === 'fill_gap' && (!q.correct_answer || (Array.isArray(q.correct_answer) && q.correct_answer.length === 0))) {
        return res.status(400).json({ message: 'Fill-in-the-gap questions need at least one expected answer.' });
      }
    }

    /* The assessment's maximum is no longer set by hand — it's always the
       sum of the question marks the teacher just built, capped at the
       module's weight so a single assessment can never claim more than the
       whole module is worth. */
    const quizMax = questions.reduce((s, q) => s + Number(q.marks), 0);
    const courseWeight = assessment.course_id?.total_marks || 100;
    if (quizMax > courseWeight) {
      return res.status(400).json({
        message: `The total question marks (${quizMax}) exceed the module weight (${courseWeight} marks). Reduce some question marks before saving.`,
      });
    }

    await AssessmentQuestion.deleteMany({ assessment_id: assessment._id });
    const docs = questions.map((q, i) => ({
      assessment_id: assessment._id,
      type: q.type,
      question_text: q.question_text.trim(),
      options: q.type === 'mcq' ? q.options : [],
      pairs: q.type === 'matching' ? q.pairs : [],
      correct_answer: q.type === 'open' ? (q.correct_answer || null) : q.correct_answer,
      marks: Number(q.marks),
      order: i,
    }));
    await AssessmentQuestion.insertMany(docs);

    assessment.max_marks = quizMax;
    if (assessment.mode !== 'quiz') assessment.mode = 'quiz';
    await assessment.save();

    res.json({ message: 'Questions saved.', count: docs.length, max_marks: quizMax });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ TEACHER: Share / unshare ═════════════════════ */

exports.teacherShareAssessment = async (req, res) => {
  try {
    const { duration_minutes, expires_at, max_attempts, instructions, shuffle_questions } = req.body;

    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name')
      .populate('class_id', 'name students');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const qCount = await AssessmentQuestion.countDocuments({ assessment_id: assessment._id });
    if (qCount === 0) {
      return res.status(400).json({ message: 'Add at least one question before sharing this assessment.' });
    }
    if (!duration_minutes || Number(duration_minutes) <= 0) {
      return res.status(400).json({ message: 'Set an assessment duration greater than 0 minutes.' });
    }
    if (expires_at && new Date(expires_at) <= new Date()) {
      return res.status(400).json({ message: 'Expiry date/time must be in the future.' });
    }
    if (!assessment.class_id) {
      return res.status(400).json({ message: 'This assessment has no class assigned.' });
    }

    const requestedMaxAttempts = Math.max(1, Number(max_attempts) || 1);

    /* Guard against silently locking students out: if some students have
       already used more attempts than the new value would allow, block it
       and point the teacher at the dedicated "Add attempt" action instead. */
    if (assessment.is_shared) {
      const mostUsed = await AssessmentAttempt.findOne({ assessment_id: assessment._id })
        .sort({ attempt_number: -1 }).lean();
      if (mostUsed && requestedMaxAttempts < mostUsed.attempt_number) {
        return res.status(400).json({
          message: `Cannot set attempts to ${requestedMaxAttempts} — at least one student has already used ${mostUsed.attempt_number} attempt(s). Use "Add attempt" to increase it instead.`,
        });
      }
    }

    assessment.mode              = 'quiz';
    assessment.duration_minutes  = Number(duration_minutes);
    assessment.expires_at        = expires_at ? new Date(expires_at) : null;
    assessment.max_attempts      = requestedMaxAttempts;
    assessment.instructions      = instructions ?? assessment.instructions;
    assessment.shuffle_questions = shuffle_questions !== false;
    assessment.is_shared         = true;
    assessment.shared_at         = new Date();
    await assessment.save();

    res.json({ message: 'Assessment shared with the class.' });

    // ── Notify students async (never block the response) ────────────────
    try {
      const teacher = await User.findById(req.user.id, 'name').lean();
      const studentEmails = await getStudentEmails(assessment.class_id._id);

      await createInAppNotification({
        title: `New Assessment: ${assessment.title}`,
        message: `${teacher?.name || 'Your teacher'} shared "${assessment.title}" (${assessment.course_id?.name || 'module'}) for you to attempt in ${assessment.class_id?.name || 'your class'}.`,
        type: 'info',
        classId: assessment.class_id._id,
        teacherId: req.user.id,
        linkType: 'assessment',
        linkId: assessment._id,
        courseId: assessment.course_id?._id || null,
      });

      if (studentEmails.length) {
        notifyAssessmentShared({
          studentEmails,
          teacherEmail: await getTeacherEmail(req.user.id),
          assessmentTitle: assessment.title,
          moduleName: assessment.course_id?.name,
          className: assessment.class_id?.name,
          teacherName: teacher?.name || 'Your teacher',
          durationMinutes: assessment.duration_minutes,
          maxAttempts: assessment.max_attempts,
          expiresAt: assessment.expires_at,
        }).catch(err => console.error('Email send error:', err.message));
      }
    } catch (err) {
      console.error('Notification error (assessment share):', err.message);
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherUnshareAssessment = async (req, res) => {
  try {
    const updated = await Assessment.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.user.id },
      { is_shared: false },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Assessment not found' });
    res.json({ message: 'Assessment unshared. Students can no longer start new attempts.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* Give students one (or more) extra attempts on an assessment that's already
   shared — e.g. because a student needs another try to demonstrate they've
   understood the material. This is deliberately a lighter-weight action than
   full re-sharing: it doesn't touch duration/expiry/instructions and doesn't
   require re-sending the "new assessment" notification email; students who
   are already looking at the assessment just see more attempts available. */
exports.teacherAddAttempts = async (req, res) => {
  try {
    const additional = Math.max(1, Math.round(Number(req.body.additional_attempts) || 1));

    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('course_id', 'name')
      .populate('class_id', 'name students');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
    if (!assessment.is_shared) {
      return res.status(400).json({ message: 'This assessment has not been shared yet — share it first.' });
    }

    assessment.max_attempts = (assessment.max_attempts || 1) + additional;
    await assessment.save();

    res.json({ message: `Added ${additional} attempt${additional > 1 ? 's' : ''}. Students now get up to ${assessment.max_attempts} attempt${assessment.max_attempts > 1 ? 's' : ''}.`, max_attempts: assessment.max_attempts });

    // ── Notify students async — a quick heads-up, not a full re-share blast ──
    try {
      const teacher = await User.findById(req.user.id, 'name').lean();
      await createInAppNotification({
        title: `Extra attempt: ${assessment.title}`,
        message: `${teacher?.name || 'Your teacher'} gave you an extra attempt on "${assessment.title}" (${assessment.course_id?.name || 'module'}). You now have up to ${assessment.max_attempts} attempts.`,
        type: 'info',
        classId: assessment.class_id._id,
        teacherId: req.user.id,
        linkType: 'assessment',
        linkId: assessment._id,
        courseId: assessment.course_id?._id || null,
      });
    } catch (err) {
      console.error('Notification error (assessment add-attempts):', err.message);
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ TEACHER: Attempts / grading / mark sheet ═════ */

exports.teacherListAttempts = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('class_id', 'name students')
      .populate('course_id', 'name total_marks category')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const students = await User.find({ _id: { $in: assessment.class_id?.students || [] } }, 'name email')
      .sort({ name: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ assessment_id: assessment._id }).sort({ attempt_number: 1 }).lean();

    const byStudent = {};
    attempts.forEach(a => {
      const key = a.student_id.toString();
      (byStudent[key] = byStudent[key] || []).push(a);
    });

    const totalAgg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: assessment._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    const maxMarks = totalAgg[0]?.total || 0;
    const moduleWeight = assessment.course_id?.total_marks || 100;
    const category = assessment.course_id?.category || 'Complementary modules';

    const rows = students.map(s => {
      const list = byStudent[s._id.toString()] || [];
      const graded = list.filter(a => a.status === 'graded');
      const best = [...graded].sort((a, b) => b.total_score - a.total_score)[0];
      const pendingGrading = list.some(a => a.needs_manual_grading && a.status === 'submitted');
      const bestScore = best ? best.total_score : null;
      const percentage = bestScore != null && maxMarks ? Math.round((bestScore / maxMarks) * 100) : null;
      const marksOnMw = scaleScore(bestScore, maxMarks, moduleWeight);
      return {
        student_id: s._id,
        student_name: s.name,
        student_email: s.email,
        attempts_used: list.length,
        best_score: bestScore,
        max_marks: maxMarks,
        module_weight: moduleWeight,
        marks_on_mw: marksOnMw,
        percentage,
        decision: computeDecision(percentage, category),
        status: pendingGrading ? 'needs_grading' : (best ? 'graded' : (list.length ? 'submitted' : 'not_attempted')),
        attempts: list.map(a => ({
          id: a._id, attempt_number: a.attempt_number, status: a.status,
          total_score: a.total_score, needs_manual_grading: a.needs_manual_grading,
          auto_submitted: a.auto_submitted, auto_submit_reason: a.auto_submit_reason,
          submitted_at: a.submitted_at,
        })),
      };
    });

    res.json({ assessment: { ...assessment, id: assessment._id, max_marks_computed: maxMarks, module_weight: moduleWeight }, rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGetAttemptForGrading = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId)
      .populate('student_id', 'name email').lean();
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const assessment = await Assessment.findOne({ _id: attempt.assessment_id, teacher_id: req.user.id }).lean();
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const questions = await AssessmentQuestion.find({ _id: { $in: attempt.question_order } }).lean();
    const qMap = {};
    questions.forEach(q => { qMap[q._id.toString()] = q; });

    const answers = attempt.question_order.map(qid => {
      const q = qMap[qid.toString()];
      const a = attempt.answers.find(x => x.question_id.toString() === qid.toString());
      return {
        question_id: qid, type: q?.type, question_text: q?.question_text, marks: q?.marks,
        options: q?.options, pairs: q?.pairs, correct_answer: q?.correct_answer,
        student_answer: a?.answer ?? null,
        auto_score: a?.auto_score ?? null,
        manual_score: a?.manual_score ?? null,
        is_correct: a?.is_correct ?? null,
      };
    });

    res.json({
      attempt: {
        id: attempt._id, status: attempt.status, total_score: attempt.total_score,
        student: attempt.student_id, submitted_at: attempt.submitted_at,
        auto_submitted: attempt.auto_submitted, auto_submit_reason: attempt.auto_submit_reason,
      },
      assessment: { id: assessment._id, title: assessment.title },
      answers,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherGradeOpenAnswers = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const assessment = await Assessment.findOne({ _id: attempt.assessment_id, teacher_id: req.user.id }).lean();
    if (!assessment) return res.status(403).json({ message: 'Access denied' });

    const { grades } = req.body;
    if (!Array.isArray(grades)) return res.status(400).json({ message: 'Grades payload is required.' });

    const questions = await AssessmentQuestion.find({ _id: { $in: grades.map(g => g.question_id) } }).lean();
    const qMap = {};
    questions.forEach(q => { qMap[q._id.toString()] = q; });

    grades.forEach(({ question_id, manual_score }) => {
      const q = qMap[String(question_id)];
      if (!q || q.type !== 'open') return;
      const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
      if (!entry) return;
      const clamped = Math.max(0, Math.min(Number(manual_score) || 0, q.marks));
      entry.manual_score = clamped;
      entry.is_correct = clamped > 0;
    });

    const allGraded = attempt.answers.every(a => a.auto_score != null || a.manual_score != null);
    attempt.needs_manual_grading = !allGraded;
    if (allGraded) {
      const total = attempt.answers.reduce((s, a) => s + (a.auto_score != null ? a.auto_score : a.manual_score), 0);
      attempt.total_score = Math.round(total * 100) / 100;
      attempt.status = 'graded';
      attempt.graded_by = req.user.id;
      attempt.graded_at = new Date();
    }
    await attempt.save();

    if (allGraded) {
      await recomputeAndUpsertMark(assessment, attempt.student_id);
    }

    res.json({
      message: allGraded ? 'Grading complete.' : 'Scores saved. Some open questions still need grading.',
      status: attempt.status,
      total_score: attempt.total_score,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ TEACHER: Mark sheet exports ══════════════════ */

exports.teacherDownloadAttemptsExcel = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('class_id', 'name students').populate('course_id', 'name total_marks category').lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const students = await User.find({ _id: { $in: assessment.class_id?.students || [] } }, 'name email')
      .sort({ name: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ assessment_id: assessment._id }).lean();
    const byStudent = {};
    attempts.forEach(a => { const k = a.student_id.toString(); (byStudent[k] = byStudent[k] || []).push(a); });

    const totalAgg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: assessment._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    const maxMarks = totalAgg[0]?.total || 0;
    const moduleWeight = assessment.course_id?.total_marks || 100;
    const category = assessment.course_id?.category || 'Complementary modules';

    const header = ['No.', 'Student Name', 'Email', 'Attempts Used', `Score (out of ${maxMarks})`, `MW (out of ${moduleWeight})`, 'Percentage', 'Decision', 'Status'];
    const rows = students.map((s, i) => {
      const list = byStudent[s._id.toString()] || [];
      const graded = list.filter(a => a.status === 'graded');
      const best = [...graded].sort((a, b) => b.total_score - a.total_score)[0];
      const pendingGrading = list.some(a => a.needs_manual_grading && a.status === 'submitted');
      const status = pendingGrading ? 'Needs manual grading' : (best ? 'Graded' : (list.length ? 'Submitted' : 'Not attempted'));
      const bestScore = best ? best.total_score : null;
      const percentage = bestScore != null && maxMarks ? Math.round((bestScore / maxMarks) * 100) : null;
      const decision = computeDecision(percentage, category);
      return [
        i + 1, s.name || '', s.email || '', list.length,
        bestScore != null ? bestScore : '',
        moduleWeight,
        percentage != null ? `${percentage}%` : '',
        decision || '',
        status,
      ];
    });

    const title = `${assessment.title} — ${assessment.course_id?.name || ''} — ${assessment.class_id?.name || ''}`;
    const sheetData = [[title], [], header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mark Sheet');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `assessment-marksheet-${(assessment.title || 'assessment').replace(/[^a-z0-9]+/gi, '-')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.teacherDownloadAttemptsPdf = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, teacher_id: req.user.id })
      .populate('class_id', 'name students').populate('course_id', 'name total_marks category').lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found' });

    const students = await User.find({ _id: { $in: assessment.class_id?.students || [] } }, 'name email')
      .sort({ name: 1 }).lean();
    const attempts = await AssessmentAttempt.find({ assessment_id: assessment._id }).lean();
    const byStudent = {};
    attempts.forEach(a => { const k = a.student_id.toString(); (byStudent[k] = byStudent[k] || []).push(a); });

    const totalAgg = await AssessmentQuestion.aggregate([
      { $match: { assessment_id: assessment._id } },
      { $group: { _id: null, total: { $sum: '$marks' } } },
    ]);
    const maxMarks = totalAgg[0]?.total || 0;
    const moduleWeight = assessment.course_id?.total_marks || 100;
    const category = assessment.course_id?.category || 'Complementary modules';

    const filename = `assessment-marksheet-${(assessment.title || 'assessment').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text(assessment.title, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#555')
      .text(`${assessment.course_id?.name || ''} — ${assessment.class_id?.name || ''}`, { align: 'center' })
      .text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.2);
    doc.fillColor('#000');

    const cols = [
      { label: 'No.', width: 26 },
      { label: 'Name', width: 158 },
      { label: 'Attempts', width: 58 },
      { label: 'Score', width: 55 },
      { label: 'Max', width: 45 },
      { label: 'MW', width: 45 },
      { label: 'Decision', width: 65 },
    ];
    const startX = doc.page.margins.left;
    let y = doc.y;

    const drawRow = (values, opts = {}) => {
      let x = startX;
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      cols.forEach((c, i) => {
        if (opts.colors && opts.colors[i]) doc.fillColor(opts.colors[i]); else doc.fillColor('#000');
        doc.text(String(values[i] ?? ''), x, y, { width: c.width, ellipsis: true });
        x += c.width;
      });
      doc.fillColor('#000');
      y += 18;
    };

    drawRow(cols.map(c => c.label), { bold: true });
    doc.moveTo(startX, y).lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y).strokeColor('#ccc').stroke();
    y += 4;

    students.forEach((s, i) => {
      if (y > 760) { doc.addPage(); y = doc.page.margins.top; }
      const list = byStudent[s._id.toString()] || [];
      const graded = list.filter(a => a.status === 'graded');
      const best = [...graded].sort((a, b) => b.total_score - a.total_score)[0];
      const bestScore = best ? best.total_score : null;
      const percentage = bestScore != null && maxMarks ? Math.round((bestScore / maxMarks) * 100) : null;
      const decision = computeDecision(percentage, category);
      drawRow(
        [
          i + 1, s.name || '', list.length,
          bestScore != null ? bestScore : '—',
          maxMarks || '—',
          moduleWeight || '—',
          decision || (list.length ? '—' : 'Not attempted'),
        ],
        { colors: { 6: decision === 'C' ? '#10b981' : (decision === 'NYC' ? '#ef4444' : undefined) } }
      );
    });

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

/* ═══════════════════════ STUDENT: Browse / instructions ═══════════════ */

exports.studentGetSharedAssessments = async (req, res) => {
  try {
    const cls = await Class.findOne({ students: req.user.id }).lean();
    if (!cls) return res.json({ assessments: [] });

    const assessments = await Assessment.find({ class_id: cls._id, mode: 'quiz', is_shared: true })
      .populate('course_id', 'name code total_marks category')
      .populate('teacher_id', 'name')
      .sort({ shared_at: -1 })
      .lean();

    const enriched = await Promise.all(assessments.map(async a => {
      const attempts = await AssessmentAttempt.find({ assessment_id: a._id, student_id: req.user.id }).lean();
      const graded = attempts.filter(x => x.status === 'graded');
      const best = [...graded].sort((x, y) => y.total_score - x.total_score)[0];
      const inProgress = attempts.find(x => x.status === 'in_progress');
      const expired = a.expires_at ? new Date() > new Date(a.expires_at) : false;
      const attemptsUsed = attempts.length;
      const bestScore = best ? best.total_score : null;
      const moduleWeight = a.course_id?.total_marks || 100;
      const percentage = bestScore != null && a.max_marks ? Math.round((bestScore / a.max_marks) * 100) : null;
      return {
        ...a, id: a._id,
        module_name: a.course_id?.name,
        teacher_name: a.teacher_id?.name,
        attempts_used: attemptsUsed,
        attempts_left: Math.max((a.max_attempts || 1) - attemptsUsed, 0),
        expired,
        can_start: !expired && (a.max_attempts || 1) - attemptsUsed > 0,
        in_progress_attempt_id: inProgress ? inProgress._id : null,
        best_score: bestScore,
        module_weight: moduleWeight,
        marks_on_mw: scaleScore(bestScore, a.max_marks, moduleWeight),
        decision: best ? computeDecision(percentage, a.course_id?.category || 'Complementary modules') : null,
        has_pending_grading: attempts.some(x => x.needs_manual_grading),
      };
    }));

    res.json({ assessments: enriched });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentGetAssessmentInstructions = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, mode: 'quiz', is_shared: true })
      .populate('course_id', 'name')
      .populate('teacher_id', 'name')
      .lean();
    if (!assessment) return res.status(404).json({ message: 'Assessment not found or not shared.' });

    const cls = await Class.findOne({ _id: assessment.class_id, students: req.user.id }).lean();
    if (!cls) return res.status(403).json({ message: 'This assessment is not available to you.' });

    const questions = await AssessmentQuestion.find({ assessment_id: assessment._id }).lean();
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
    const attemptsUsed = await AssessmentAttempt.countDocuments({ assessment_id: assessment._id, student_id: req.user.id });
    const inProgress = await AssessmentAttempt.findOne({
      assessment_id: assessment._id, student_id: req.user.id, status: 'in_progress',
    }).lean();

    res.json({
      id: assessment._id,
      title: assessment.title,
      module_name: assessment.course_id?.name,
      teacher_name: assessment.teacher_id?.name,
      instructions: assessment.instructions,
      duration_minutes: assessment.duration_minutes,
      max_attempts: assessment.max_attempts,
      attempts_used: attemptsUsed,
      attempts_left: Math.max((assessment.max_attempts || 1) - attemptsUsed, 0),
      expires_at: assessment.expires_at,
      expired: assessment.expires_at ? new Date() > new Date(assessment.expires_at) : false,
      question_count: questions.length,
      total_marks: totalMarks,
      in_progress_attempt_id: inProgress ? inProgress._id : null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════ STUDENT: Attempt lifecycle ═══════════════════ */

exports.studentStartAttempt = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, mode: 'quiz', is_shared: true })
      .populate('course_id', 'name');
    if (!assessment) return res.status(404).json({ message: 'Assessment not found or not shared.' });

    const cls = await Class.findOne({ _id: assessment.class_id, students: req.user.id }).lean();
    if (!cls) return res.status(403).json({ message: 'This assessment is not available to you.' });

    if (assessment.expires_at && new Date() > new Date(assessment.expires_at)) {
      return res.status(400).json({ message: 'This assessment has expired.' });
    }

    // Resume an in-progress attempt still within its time window instead of
    // burning a fresh attempt on every page load/refresh.
    const existing = await AssessmentAttempt.findOne({
      assessment_id: assessment._id, student_id: req.user.id, status: 'in_progress',
    });
    if (existing) {
      if (new Date() < new Date(existing.due_at)) {
        return res.json(await buildAttemptPayload(existing, assessment));
      }
      // Time ran out but the client never called auto-submit (e.g. the tab
      // was closed) — finalize it now before deciding on a new attempt.
      await finalizeAttemptSubmission(existing, { autoSubmitted: true, reason: 'timeout' });
    }

    const attemptsUsed = await AssessmentAttempt.countDocuments({ assessment_id: assessment._id, student_id: req.user.id });
    if (attemptsUsed >= (assessment.max_attempts || 1)) {
      return res.status(400).json({ message: 'You have used all your attempts for this assessment.' });
    }

    const questions = await AssessmentQuestion.find({ assessment_id: assessment._id }).sort({ order: 1 }).lean();
    if (!questions.length) return res.status(400).json({ message: 'This assessment has no questions yet.' });

    // Shuffle only matters (and only needs to differ per attempt) when more
    // than one attempt is allowed.
    const ordered = (assessment.max_attempts || 1) > 1 ? shuffleArray(questions) : questions;

    const now = new Date();
    const dueAt = new Date(now.getTime() + (assessment.duration_minutes || 30) * 60000);

    const attempt = await AssessmentAttempt.create({
      assessment_id: assessment._id,
      student_id: req.user.id,
      attempt_number: attemptsUsed + 1,
      question_order: ordered.map(q => q._id),
      answers: ordered.map(q => ({ question_id: q._id, answer: null })),
      started_at: now,
      due_at: dueAt,
      status: 'in_progress',
    });

    res.status(201).json(await buildAttemptPayload(attempt, assessment, ordered));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentGetAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();

    if (attempt.status !== 'in_progress') {
      return res.json({ ended: true, ...buildResultPayload(assessment, attempt) });
    }
    if (new Date() >= new Date(attempt.due_at)) {
      await finalizeAttemptSubmission(attempt, { autoSubmitted: true, reason: 'timeout' });
      return res.json({ ended: true, auto_submitted: true, ...buildResultPayload(assessment, attempt) });
    }
    res.json(await buildAttemptPayload(attempt, assessment));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentSaveAnswer = async (req, res) => {
  try {
    const { question_id, answer } = req.body;
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ message: 'This attempt has already ended.' });
    if (new Date() >= new Date(attempt.due_at)) return res.status(400).json({ message: 'Time is up.' });

    const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
    if (!entry) return res.status(400).json({ message: 'Question not part of this attempt.' });
    entry.answer = answer;
    await attempt.save();
    res.json({ saved: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.studentSubmitAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ message: 'This attempt has already been submitted.' });
    }

    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    incoming.forEach(({ question_id, answer }) => {
      const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
      if (entry) entry.answer = answer;
    });

    await finalizeAttemptSubmission(attempt, { autoSubmitted: false });
    const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();
    res.json({ message: 'Assessment submitted.', ...buildResultPayload(assessment, attempt) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* Called by the client automatically when the timer hits zero, or when the
   student leaves the full-screen exam window (blur / visibility change /
   exits full screen). Idempotent — a second call just reports the result. */
exports.studentAutoSubmitAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, student_id: req.user.id });
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();
      return res.json({ message: 'Already submitted.', ...buildResultPayload(assessment, attempt) });
    }

    const reason = req.body.reason === 'left_screen' ? 'left_screen' : 'timeout';
    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    incoming.forEach(({ question_id, answer }) => {
      const entry = attempt.answers.find(a => a.question_id.toString() === String(question_id));
      if (entry) entry.answer = answer;
    });

    await finalizeAttemptSubmission(attempt, { autoSubmitted: true, reason });
    const assessment = await Assessment.findById(attempt.assessment_id).populate('course_id', 'name total_marks category').lean();
    res.json({
      message: reason === 'left_screen'
        ? 'You left the assessment screen, so it was submitted automatically.'
        : 'Time was up, so the assessment was submitted automatically.',
      reason,
      ...buildResultPayload(assessment, attempt),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};