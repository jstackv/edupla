// ── Academic Year helpers ────────────────────────────────────────────────
// Shared by academicYearController.js (admin-facing CRUD) and
// assessmentController.js (server-side stamping of marks/assessments with
// the active year) so both always agree on "who owns this school" and
// "what year is active for them".

/**
 * Every teacher/student belongs to exactly one school, identified by the
 * `created_by` field on their User doc (same convention already used for
 * Level/Trade/Course scoping and for billing — see middleware/billing.js).
 * An admin IS the school, so for an admin user their own id is the owner id.
 */
async function resolveOwnerId(reqUser) {
  if (!reqUser) return null;
  if (reqUser.role === "admin") return String(reqUser.id);

  const { User } = require("../models/db");
  const doc = await User.findById(reqUser.id).select("created_by").lean();
  // Fallback to the user's own id if for some reason created_by is missing —
  // keeps things from hard-failing for legacy/orphaned accounts, though in
  // practice every teacher/student is created by an admin.
  return doc?.created_by ? String(doc.created_by) : String(reqUser.id);
}

function defaultYearName(date = new Date()) {
  const y = date.getFullYear();
  return `${y}-${y + 1}`;
}

/**
 * Returns the active AcademicYear document for a school (by owner/admin id),
 * lazily provisioning one if the school predates this feature and has never
 * configured an academic year at all. This keeps existing schools working
 * without forcing a one-time setup step before teachers can keep recording
 * marks.
 */
async function getActiveYearDoc(ownerId) {
  const { AcademicYear } = require("../models/db");
  if (!ownerId) return null;

  let active = await AcademicYear.findOne({ created_by: ownerId, is_active: true });
  if (active) return active;

  const count = await AcademicYear.countDocuments({ created_by: ownerId });
  if (count === 0) {
    // Brand-new / legacy school with no academic years configured yet —
    // auto-create and activate a sensible default so nothing breaks.
    try {
      return await AcademicYear.create({
        name: defaultYearName(),
        created_by: ownerId,
        is_active: true,
      });
    } catch (err) {
      // Extremely rare race (two requests provisioning at once) — re-read.
      return AcademicYear.findOne({ created_by: ownerId, is_active: true });
    }
  }

  // Years exist but none is flagged active (shouldn't normally happen —
  // e.g. manual DB edit). Fall back to the most recently created one.
  const fallback = await AcademicYear.findOne({ created_by: ownerId }).sort({ created_at: -1 });
  if (fallback) {
    fallback.is_active = true;
    await fallback.save();
  }
  return fallback;
}

// Canonical term list — mirrors the `term` enum on the Assessment schema.
const TERMS = ["Term 1", "Term 2", "Term 3"];

function isTermOpen(academicYearDoc, term) {
  if (!academicYearDoc) return true; // no year configured -> don't block on term state
  const disabled = academicYearDoc.disabled_terms || [];
  return !disabled.includes(term);
}

/**
 * Checks whether `term` is open for a specific academic year NAME (as
 * stored on an Assessment doc, e.g. "2025-2026") rather than the currently
 * active year. Used when acting on an assessment that already exists —
 * its own academic_year might not be the one that's active anymore, but a
 * School Manager can still have closed one of its terms after the fact.
 * Returns true (open) if the year can't be found at all, so a data
 * inconsistency never blocks legitimate work.
 */
async function isTermOpenForYearName(ownerId, yearName, term) {
  if (!ownerId || !yearName) return true;
  const { AcademicYear } = require("../models/db");
  const doc = await AcademicYear.findOne({ created_by: ownerId, name: yearName }).lean();
  return isTermOpen(doc, term);
}

module.exports = {
  resolveOwnerId,
  defaultYearName,
  getActiveYearDoc,
  TERMS,
  isTermOpen,
  isTermOpenForYearName,
};
