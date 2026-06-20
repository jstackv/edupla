/**
 * migrate_assessment_class.js
 *
 * Backfills the new `class_id` field on existing Assessment documents.
 *
 * Why this is needed:
 *   Assessments used to have no class_id at all — they only referenced a
 *   course_id. Since a module/course can be assigned to multiple classes,
 *   this made it impossible to tell which class an assessment was actually
 *   created for (the bug where an assessment "created in one class" looked
 *   like it had also been created in every other class sharing that module).
 *
 * What this script does:
 *   For every Assessment missing class_id, it looks at the Assessment's
 *   course and assigns the FIRST class that course is linked to
 *   (course.class_ids[0] or the legacy course.class_id). Because the old
 *   duplicate-guard only ever allowed ONE assessment per course+type+term+year
 *   combination, there is at most one existing assessment per combination, so
 *   this backfill cannot create new duplicate-key conflicts.
 *
 * Run once, after deploying the updated model/controller code, and BEFORE
 * (or right after) restarting the server:
 *
 *   node migrate_assessment_class.js
 */
require('dotenv').config();
const { connectDB, Assessment, Course } = require('./models/db');

async function migrate() {
  await connectDB();

  const assessments = await Assessment.find({
    $or: [{ class_id: null }, { class_id: { $exists: false } }],
  }).lean();

  console.log(`Found ${assessments.length} assessment(s) without a class_id.`);

  let updated = 0;
  let skipped = 0;

  for (const a of assessments) {
    const course = await Course.findById(a.course_id).lean();
    const classId =
      (Array.isArray(course?.class_ids) && course.class_ids.length > 0)
        ? course.class_ids[0]
        : course?.class_id || null;

    if (!classId) {
      console.warn(`⚠️  Skipping assessment ${a._id} — its module has no class assigned. Please set class_id manually.`);
      skipped++;
      continue;
    }

    await Assessment.updateOne({ _id: a._id }, { $set: { class_id: classId } });
    updated++;
  }

  console.log(`✅ Updated ${updated} assessment(s). Skipped ${skipped}.`);
  console.log('Mongoose will create the new unique index (course_id + class_id + type + term + academic_year) automatically on next server start.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });