/**
 * One-off migration: backfill the new `audience` field on Notification
 * documents that were created before this field existed.
 *
 * Why this is needed:
 *   Submission notifications (created when a student submits an assignment)
 *   were always stored with the SAME shape as teacher→student broadcasts
 *   (assignment posted, document posted, announcement, manual notification),
 *   just stamped with teacher_id/class_id for the teacher's convenience.
 *   Without an explicit audience marker, students could see their own
 *   "submitted, ready to review" notifications meant only for the teacher.
 *
 *   We can reliably identify old submission notifications by their title
 *   pattern ("Submission: <assignment title>"), which is the only call site
 *   that ever created teacher-only events. Everything else defaults to
 *   'students', matching its actual intended audience.
 *
 * Usage:  node migrate_notification_audience.js
 */
require('dotenv').config();
const { connectDB, Notification } = require('./models/db');

async function migrate() {
  await connectDB();

  // 1) Any notification missing the field entirely defaults to 'students'
  //    (assignment posted / document posted / announcement / manual notification).
  const defaulted = await Notification.updateMany(
    { audience: { $exists: false } },
    { $set: { audience: 'students' } }
  );
  console.log(`✅ Defaulted ${defaulted.modifiedCount} notification(s) to audience: 'students'`);

  // 2) Re-classify old submission notifications (teacher-only) that just got
  //    defaulted to 'students' above — they must be 'teacher' instead.
  const reclassified = await Notification.updateMany(
    { audience: 'students', title: { $regex: '^Submission:' } },
    { $set: { audience: 'teacher' } }
  );
  console.log(`✅ Reclassified ${reclassified.modifiedCount} old submission notification(s) to audience: 'teacher'`);

  console.log('\n✅ Migration complete.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });