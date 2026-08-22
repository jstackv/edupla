const { AcademicYear, Course, Assessment } = require("../models/db");
const { resolveOwnerId, getActiveYearDoc, TERMS } = require("../utils/academicYear");

// "2025-2026", "2026-2027", etc. — two consecutive 4-digit years joined by a
// hyphen, second year = first + 1.
const YEAR_NAME_RE = /^(\d{4})-(\d{4})$/;

function validYearName(name) {
  const m = YEAR_NAME_RE.exec(String(name || "").trim());
  if (!m) return false;
  return Number(m[2]) === Number(m[1]) + 1;
}

// ── Admin: list every academic year this school has ever created ────────
exports.adminList = async (req, res) => {
  try {
    const years = await AcademicYear.find({ created_by: req.user.id })
      .sort({ name: -1 })
      .lean();
    res.json({ academicYears: years.map((y) => ({ ...y, id: y._id })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: create a new academic year (e.g. "2027-2028") ────────────────
// The very first academic year a school ever creates is activated
// automatically, since there'd otherwise be no active year at all.
exports.adminCreate = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!validYearName(name)) {
      return res.status(400).json({
        message: 'Academic year must look like "2026-2027" (two consecutive years).',
      });
    }

    const existingCount = await AcademicYear.countDocuments({ created_by: req.user.id });

    const year = await AcademicYear.create({
      name,
      created_by: req.user.id,
      is_active: existingCount === 0, // first one ever -> active by default
    });

    res.status(201).json({ message: "Academic year created", academicYear: { ...year.toObject(), id: year._id } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: `Academic year "${req.body.name}" already exists.` });
    }
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: make one academic year the active/current one ────────────────
// There is only ever one active academic year per school. From this point
// on, every NEW mark-recording activity (assessments/marks teachers create)
// automatically belongs to this year.
exports.adminActivate = async (req, res) => {
  try {
    const year = await AcademicYear.findOne({ _id: req.params.id, created_by: req.user.id });
    if (!year) return res.status(404).json({ message: "Academic year not found" });

    if (!year.is_active) {
      await AcademicYear.updateMany(
        { created_by: req.user.id, is_active: true },
        { $set: { is_active: false } },
      );
      year.is_active = true;
      await year.save();
    }

    res.json({ message: `${year.name} is now the active academic year`, academicYear: { ...year.toObject(), id: year._id } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: delete an academic year that was never used ───────────────────
// Refuses to delete the currently active year (there must always be one
// once a school has created at least one) or a year that already has
// assessments/marks recorded against it — deleting that data silently
// would be far more surprising than a blocked delete.
exports.adminDelete = async (req, res) => {
  try {
    const year = await AcademicYear.findOne({ _id: req.params.id, created_by: req.user.id });
    if (!year) return res.status(404).json({ message: "Academic year not found" });

    if (year.is_active) {
      return res.status(400).json({ message: "Cannot delete the active academic year. Activate a different year first." });
    }

    const courseIds = await Course.find({ created_by: req.user.id }, "_id").lean();
    const inUse = await Assessment.exists({
      course_id: { $in: courseIds.map((c) => c._id) },
      academic_year: year.name,
    });
    if (inUse) {
      return res.status(400).json({ message: `"${year.name}" already has assessments/marks recorded and can't be deleted.` });
    }

    await year.deleteOne();
    res.json({ message: "Academic year deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: open or close a specific term within an academic year ────────
// A closed term can't be used to create/record NEW assessments in it (see
// teacherCreateAssessment) — it doesn't touch assessments/marks already
// recorded there. Works on any academic year, not just the active one, so
// a School Manager can pre-close terms on a future year too.
exports.adminSetTermStatus = async (req, res) => {
  try {
    const { term } = req.params;
    const { open } = req.body; // true = open/enabled, false = closed/disabled
    if (!TERMS.includes(term)) {
      return res.status(400).json({ message: `Invalid term. Must be one of: ${TERMS.join(', ')}` });
    }

    const year = await AcademicYear.findOne({ _id: req.params.id, created_by: req.user.id });
    if (!year) return res.status(404).json({ message: "Academic year not found" });

    const disabled = new Set(year.disabled_terms || []);
    if (open) disabled.delete(term); else disabled.add(term);
    year.disabled_terms = TERMS.filter((t) => disabled.has(t));
    await year.save();

    res.json({
      message: `${term} is now ${open ? 'open' : 'closed'} for ${year.name}`,
      academicYear: { ...year.toObject(), id: year._id },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Any authenticated role: read-only lookup of the currently active
// academic year for their school. Teachers/students use this purely for
// display — they can never change it. Auto-provisions a default year the
// first time it's ever called for a school that hasn't set one up yet. ──
exports.getActive = async (req, res) => {
  try {
    const ownerId = await resolveOwnerId(req.user);
    const active = await getActiveYearDoc(ownerId);
    if (!active) return res.json({ academicYear: null });
    res.json({ academicYear: { ...active.toObject(), id: active._id } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
