// ── Class activation rule ────────────────────────────────────────────────
// A class is only ever considered active once it has BOTH a class teacher
// (Class.teacher_id) assigned AND at least one enrolled student. This is
// re-derived — never set by hand — every time either of those two things
// changes: creating/updating a class, assigning/reassigning its teacher,
// enrolling/removing/moving students.
//
// `manually_disabled` is the one deliberate override on top of that rule:
// an admin can still force a fully-staffed class offline (e.g. suspending
// it mid-year) via the Classes page toggle. That flag is only ever touched
// by the toggle endpoint itself — this helper respects it but never sets
// it — so an unrelated roster/teacher change elsewhere in the app can't
// silently undo an admin's explicit "turn this off" decision.
//
// Call this after ANY write that touches Class.teacher_id or Class.students.
async function recomputeClassActive(classId) {
  const { Class } = require("../models/db");
  const cls = await Class.findById(classId).select("teacher_id students manually_disabled is_active");
  if (!cls) return null;

  const qualifies = Boolean(cls.teacher_id) && (cls.students?.length || 0) > 0;
  const nextActive = !cls.manually_disabled && qualifies;

  if (cls.is_active !== nextActive) {
    cls.is_active = nextActive;
    await cls.save();
  }
  return cls;
}

module.exports = { recomputeClassActive };