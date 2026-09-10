// ── Student class-access helpers ───────────────────────────────────────────
// A student belongs to exactly one class (see Class.students), but for
// shared resources like Notes & Documents they should also be able to see
// material posted for the SAME trade at a LOWER level — e.g. an L5 SOD
// student can see L5 SOD, L4 SOD and L3 SOD notes, an L4 SOD student can see
// L4 SOD and L3 SOD (but not L5 SOD), and nobody can see another trade's
// notes at all. This mirrors how TVET programs stack: higher levels build on
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
 * (and same school, via created_by) whose level is the same or lower.
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
      if (siblingLevelNum != null && siblingLevelNum <= myLevelNum) {
        idSet.add(String(sibling._id));
      }
    }
  }

  return Array.from(idSet);
}

module.exports = { getAccessibleClassIds, parseLevelNumber };
