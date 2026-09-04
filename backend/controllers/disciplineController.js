const { Class, User, DisciplineRecord, DisciplineMark } = require('../models/db');
const { resolveOwnerId, isTermOpenForYearName, getActiveYearDoc } = require('../utils/academicYear');

function pct(obtained, max) {
  if (obtained == null || !max) return null;
  return Math.round((obtained / max) * 100);
}

/* ═══════════════════════════════════════════════════
   TEACHER — record discipline/behavior marks for the ONE class
   they are the class teacher of (Class.teacher_id === req.user.id).
   Subject/module teachers listed only in extra_teachers cannot record this.
═══════════════════════════════════════════════════ */

// The class(es) this user is the class teacher of — in practice just one,
// but the shape stays a list so a school that ever lets one person be class
// teacher of more than one class isn't blocked by this feature.
exports.teacherMyClassTeacherClasses = async (req, res) => {
  try {
    const classes = await Class.find({ teacher_id: req.user.id })
      .select('name level trade students is_active')
      .lean();
    res.json({
      classes: classes.map(c => ({
        id: c._id, name: c.name, level: c.level, trade: c.trade,
        student_count: c.students?.length || 0, is_active: c.is_active,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

async function assertIsClassTeacher(classId, userId) {
  const cls = await Class.findById(classId).select('teacher_id name students is_active').lean();
  if (!cls) return { error: 404, message: 'Class not found' };
  if (String(cls.teacher_id) !== String(userId)) {
    return { error: 403, message: 'Only this class\'s own class teacher can record its discipline marks.' };
  }
  return { cls };
}

// Roster + current marks (draft or otherwise) for one class/term/year.
exports.teacherGetDisciplineSheet = async (req, res) => {
  try {
    const { term, academic_year } = req.query;
    if (!term || !academic_year) return res.status(400).json({ message: 'term and academic_year are required' });

    const check = await assertIsClassTeacher(req.params.classId, req.user.id);
    if (check.error) return res.status(check.error).json({ message: check.message });
    const cls = await Class.findById(req.params.classId).populate('students', 'name email').lean();

    const record = await DisciplineRecord.findOne({ class_id: req.params.classId, term, academic_year }).lean();
    const marks = record
      ? await DisciplineMark.find({ discipline_record_id: record._id }).lean()
      : [];
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const maxMarks = record?.max_marks ?? 20;
    const students = (cls.students || []).map(s => {
      const m = markMap[s._id.toString()];
      return {
        student_id: s._id, name: s.name, email: s.email,
        marks: m?.marks ?? null,
        approved_marks: m?.approved_marks ?? null,
        remarks: m?.remarks ?? '',
        percentage: pct(m?.marks, maxMarks),
      };
    });

    res.json({
      class: { id: cls._id, name: cls.name },
      record: {
        status: record?.status || 'draft',
        max_marks: maxMarks,
        submitted_at: record?.submitted_at || null,
        reviewed_at: record?.reviewed_at || null,
        review_note: record?.review_note || null,
      },
      students,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Save (draft) discipline marks — always allowed while the record is
// draft/rejected. A submitted/approved record is locked until the admin
// rejects it (mirrors the academic Marks Recording workflow exactly).
exports.teacherSaveDisciplineSheet = async (req, res) => {
  try {
    const { term, academic_year, max_marks, entries = [] } = req.body;
    if (!term || !academic_year) return res.status(400).json({ message: 'term and academic_year are required' });

    const check = await assertIsClassTeacher(req.params.classId, req.user.id);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const ownerId = await resolveOwnerId(req.user);
    if (!(await isTermOpenForYearName(ownerId, academic_year, term))) {
      return res.status(400).json({
        message: `${term} is closed for ${academic_year} by your School Manager. Discipline marks can no longer be recorded for this term.`,
      });
    }

    let record = await DisciplineRecord.findOne({ class_id: req.params.classId, term, academic_year });
    if (record && (record.status === 'submitted' || record.status === 'approved')) {
      return res.status(403).json({ message: 'These discipline marks have already been submitted and can\'t be edited until an admin rejects them.' });
    }

    const cappedMax = Math.max(1, Number(max_marks) || record?.max_marks || 20);

    if (!record) {
      record = await DisciplineRecord.create({
        class_id: req.params.classId, teacher_id: req.user.id, term, academic_year,
        max_marks: cappedMax, status: 'draft', created_by: ownerId,
      });
    } else {
      record.max_marks = cappedMax;
      await record.save();
    }

    if (Array.isArray(entries) && entries.length > 0) {
      const overLimit = entries.filter(e => e.marks != null && Number(e.marks) > cappedMax);
      if (overLimit.length > 0) {
        return res.status(400).json({ message: `One or more marks exceed the maximum allowed (${cappedMax}).` });
      }
      const ops = entries.map(e => ({
        updateOne: {
          filter: { discipline_record_id: record._id, student_id: e.student_id },
          update: { $set: { marks: e.marks, remarks: e.remarks || null, entered_by: req.user.id } },
          upsert: true,
        },
      }));
      await DisciplineMark.bulkWrite(ops);
    }

    res.json({ message: 'Discipline marks saved', status: record.status });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Submit for admin review — every enrolled student needs a mark first.
exports.teacherSubmitDisciplineSheet = async (req, res) => {
  try {
    const { term, academic_year } = req.body;
    if (!term || !academic_year) return res.status(400).json({ message: 'term and academic_year are required' });

    const check = await assertIsClassTeacher(req.params.classId, req.user.id);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const ownerId = await resolveOwnerId(req.user);
    if (!(await isTermOpenForYearName(ownerId, academic_year, term))) {
      return res.status(400).json({
        message: `${term} is closed for ${academic_year} by your School Manager. Discipline marks can no longer be submitted for this term.`,
      });
    }

    const record = await DisciplineRecord.findOne({ class_id: req.params.classId, term, academic_year });
    if (!record) return res.status(400).json({ message: 'Save discipline marks before submitting them.' });
    if (record.status === 'submitted' || record.status === 'approved') {
      return res.status(403).json({ message: 'Discipline marks have already been submitted.' });
    }

    const totalStudents = check.cls.students?.length || 0;
    if (totalStudents > 0) {
      const marks = await DisciplineMark.find({ discipline_record_id: record._id }).lean();
      const recordedCount = marks.filter(m => m.marks != null).length;
      if (recordedCount < totalStudents) {
        return res.status(400).json({
          message: `Cannot submit — ${totalStudents - recordedCount} of ${totalStudents} student(s) still need a discipline mark before this can be submitted for review.`,
        });
      }
    }

    record.status = 'submitted';
    record.submitted_at = new Date();
    record.reviewed_by = null;
    record.reviewed_at = null;
    record.review_note = null;
    await record.save();

    res.json({ message: 'Discipline marks submitted for review', status: 'submitted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ═══════════════════════════════════════════════════
   ADMIN — review discipline mark submissions
═══════════════════════════════════════════════════ */

exports.adminListDisciplineSubmissions = async (req, res) => {
  try {
    const { status, class_id, term, academic_year } = req.query;
    const filter = { created_by: req.user.id };
    if (status) filter.status = status;
    if (class_id) filter.class_id = class_id;
    if (term) filter.term = term;
    if (academic_year) filter.academic_year = academic_year;

    const records = await DisciplineRecord.find(filter)
      .populate('class_id', 'name students')
      .populate('teacher_id', 'name email')
      .sort({ submitted_at: -1, created_at: -1 })
      .lean();

    const recordIds = records.map(r => r._id);
    const allMarks = await DisciplineMark.find({ discipline_record_id: { $in: recordIds } }).lean();
    const markedCount = {};
    let sumByRecord = {};
    allMarks.forEach(m => {
      const key = m.discipline_record_id.toString();
      if (m.marks != null) {
        markedCount[key] = (markedCount[key] || 0) + 1;
        sumByRecord[key] = sumByRecord[key] || { sum: 0, count: 0 };
        sumByRecord[key].sum += m.marks;
        sumByRecord[key].count += 1;
      }
    });

    const result = records.map(r => {
      const key = r._id.toString();
      const totalStudents = r.class_id?.students?.length || 0;
      const avg = sumByRecord[key] ? sumByRecord[key].sum / sumByRecord[key].count : null;
      return {
        id: r._id,
        class_name: r.class_id?.name || 'Unknown class',
        class_id: r.class_id?._id,
        teacher_name: r.teacher_id?.name || 'Unassigned',
        teacher_email: r.teacher_id?.email,
        term: r.term, academic_year: r.academic_year, max_marks: r.max_marks,
        status: r.status, submitted_at: r.submitted_at, reviewed_at: r.reviewed_at, review_note: r.review_note,
        total_students: totalStudents,
        marked_count: markedCount[key] || 0,
        average_percentage: avg != null ? pct(avg, r.max_marks) : null,
      };
    });

    res.json({ records: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminViewDisciplineSubmission = async (req, res) => {
  try {
    const record = await DisciplineRecord.findOne({ _id: req.params.id, created_by: req.user.id })
      .populate({ path: 'class_id', select: 'name students', populate: { path: 'students', select: 'name email' } })
      .populate('teacher_id', 'name email')
      .lean();
    if (!record) return res.status(404).json({ message: 'Discipline record not found' });

    const marks = await DisciplineMark.find({ discipline_record_id: record._id }).lean();
    const markMap = {};
    marks.forEach(m => { markMap[m.student_id.toString()] = m; });

    const students = (record.class_id?.students || []).map(s => {
      const m = markMap[s._id.toString()];
      return {
        student_id: s._id, name: s.name, email: s.email,
        marks: m?.marks ?? null, approved_marks: m?.approved_marks ?? null,
        remarks: m?.remarks || '', percentage: pct(m?.marks, record.max_marks),
      };
    });

    res.json({
      record: {
        id: record._id, class_name: record.class_id?.name, class_id: record.class_id?._id,
        teacher_name: record.teacher_id?.name, teacher_email: record.teacher_id?.email,
        term: record.term, academic_year: record.academic_year, max_marks: record.max_marks,
        status: record.status, submitted_at: record.submitted_at,
        reviewed_at: record.reviewed_at, review_note: record.review_note,
      },
      students,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminApproveDisciplineSubmission = async (req, res) => {
  try {
    const record = await DisciplineRecord.findOne({ _id: req.params.id, created_by: req.user.id });
    if (!record) return res.status(404).json({ message: 'Discipline record not found' });
    if (record.status !== 'submitted') return res.status(400).json({ message: 'These discipline marks have not been submitted for review.' });

    const marks = await DisciplineMark.find({ discipline_record_id: record._id });
    await Promise.all(marks.map(m => { m.approved_marks = m.marks; return m.save(); }));

    record.status = 'approved';
    record.reviewed_by = req.user.id;
    record.reviewed_at = new Date();
    record.review_note = null;
    await record.save();

    res.json({ message: 'Discipline marks approved. Reports now reflect these marks.', status: 'approved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.adminRejectDisciplineSubmission = async (req, res) => {
  try {
    const record = await DisciplineRecord.findOne({ _id: req.params.id, created_by: req.user.id });
    if (!record) return res.status(404).json({ message: 'Discipline record not found' });
    if (record.status !== 'submitted' && record.status !== 'approved') {
      return res.status(400).json({ message: 'Only submitted or approved discipline marks can be rejected.' });
    }

    const { note } = req.body;
    record.status = 'rejected';
    record.reviewed_by = req.user.id;
    record.reviewed_at = new Date();
    record.review_note = note || null;
    await record.save();

    res.json({ message: 'Discipline marks rejected. The class teacher can now edit them again.', status: 'rejected' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};