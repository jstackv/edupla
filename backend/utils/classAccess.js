// ── Student class-access helpers ───────────────────────────────────────────
// A student belongs to exactly one class (see Class.students), but for
// shared resources like Notes & Documents they should also be able to see
// material posted for the SAME trade at a STRICTLY LOWER level — e.g. an L5
// SOD student can see L5 SOD, L4 SOD and L3 SOD notes, an L4 SOD student can
// see L4 SOD and L3 SOD (but not L5 SOD), and nobody can see another trade's
// notes at all. A parallel section at the SAME level (e.g. "L4 SOD A" vs
// "L4 SOD B") is never auto-included — only their own section, plus earlier
// levels. This mirrors how TVET programs stack: higher levels build on
// lower ones, so it's normal (and desired) for material from earlier levels
// of the same trade to stay visible as a student progresses.
//
// This module is the single source of truth for "which classes can this
// student see resources from" so every endpoint (documents, and anything
// else scoped by class) agrees.

/**
 * Extracts the numeric RTQF level out of a level value like "L3", "Level 4",
 * "L5" etc. Returns null if no number can be found, so callers can fail
 * safe (treat the level as unorderable rather than guessing).
 */
function parseLevelNumber(level) {
  if (!level) return null;
  const match = String(level).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Returns the list of Class _ids (as strings) a student is allowed to pull
 * shared resources (notes/documents) from: every class they're enrolled in,
 * plus — for each of those classes — every OTHER class in the same trade
 * (and same school, via created_by) whose level is STRICTLY LOWER.
 *
 * Same-level classes (e.g. "L4 SOD A" vs "L4 SOD B" — two sections of the
 * same level) are deliberately NOT included here: a class only ever widens
 * downward to earlier levels of its own trade, never sideways to a parallel
 * section. Browsing another section at your own level isn't "notes for a
 * lower trade class" — it's a different class outright.
 *
 * A class whose level can't be parsed into a number is only ever matched
 * against itself (no cross-class widening), so mis-configured level labels
 * never accidentally leak or hide material.
 */
async function getAccessibleClassIds(studentId) {
  const { Class } = require("../models/db");

  const myClasses = await Class.find({ students: studentId }).lean();
  if (!myClasses.length) return [];

  const idSet = new Set(myClasses.map((c) => String(c._id)));

  for (const cls of myClasses) {
    const myLevelNum = parseLevelNumber(cls.level);
    if (!cls.trade || myLevelNum == null) continue; // can't safely widen

    const siblings = await Class.find({
      _id: { $ne: cls._id },
      trade: cls.trade,
      created_by: cls.created_by,
    }).lean();

    for (const sibling of siblings) {
      const siblingLevelNum = parseLevelNumber(sibling.level);
      if (siblingLevelNum != null && siblingLevelNum < myLevelNum) {
        idSet.add(String(sibling._id));
      }
    }
  }

  return Array.from(idSet);
}

/**
 * Returns the full Class documents (not just ids) a student can browse
 * OTHER than their own — i.e. every strictly-lower-level class in the same
 * trade. This powers the "View other contents" class picker: a student
 * picks one of these, then the notes/modules views re-scope to it.
 *
 * Sorted highest level first (closest to the student's own level), then by
 * name, so the picker reads like "the level right below mine, and so on".
 */
async function getOtherAccessibleClasses(studentId) {
  const { Class } = require("../models/db");

  const myClasses = await Class.find({ students: studentId }).lean();
  if (!myClasses.length) return [];

  const seen = new Set(myClasses.map((c) => String(c._id)));
  const result = [];

  for (const cls of myClasses) {
    const myLevelNum = parseLevelNumber(cls.level);
    if (!cls.trade || myLevelNum == null) continue;

    const siblings = await Class.find({
      _id: { $ne: cls._id },
      trade: cls.trade,
      created_by: cls.created_by,
    }).lean();

    for (const sibling of siblings) {
      const siblingLevelNum = parseLevelNumber(sibling.level);
      const key = String(sibling._id);
      if (siblingLevelNum != null && siblingLevelNum < myLevelNum && !seen.has(key)) {
        seen.add(key);
        result.push(sibling);
      }
    }
  }

  result.sort((a, b) => {
    const diff = (parseLevelNumber(b.level) ?? -1) - (parseLevelNumber(a.level) ?? -1);
    if (diff !== 0) return diff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return result;
}

module.exports = { getAccessibleClassIds, getOtherAccessibleClasses, parseLevelNumber };
