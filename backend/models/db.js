const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'edupla',
    });
    console.log('✅ MongoDB connected successfully');

    // The Attendance model's unique index changed from (class_id, date) to
    // (class_id, date, teacher_id) so each teacher can take attendance
    // independently. Mongoose won't drop the old index on its own — without
    // this, a second teacher taking attendance for the same class+date hits
    // an E11000 duplicate key error against the stale index. syncIndexes()
    // reconciles the live indexes with the current schema on every boot.
    try {
      await Attendance.syncIndexes();
    } catch (err) {
      console.error('⚠️  Attendance index sync failed:', err.message);
    }

    // The Assessment model's unique index changed from
    // (course_id, class_id, type, term, academic_year, mode) to
    // (course_id, class_id, term, academic_year, mode, title) so a teacher
    // can create more than one assessment of the same type (e.g. two or
    // more Formative Assessments) in the same term. Without a sync, the old
    // index stays live and blocks the very thing this change is meant to allow.
    try {
      await Assessment.syncIndexes();
    } catch (err) {
      console.error('⚠️  Assessment index sync failed:', err.message);
    }
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

// ── Schemas ────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name:            { type: String, required: true },
  email:           { type: String, required: true, unique: true, lowercase: true },
  password:        { type: String, required: true },
  role:            { type: String, enum: ['teacher', 'student', 'admin'], required: true },
  level:           { type: String, default: null },
  trade:           { type: String, default: null },
  class_year:      { type: String, default: null },
  phone:           { type: String, default: null },
  avatar_color:    { type: String, default: null },
  is_super_admin:  { type: Boolean, default: false },
  is_active:       { type: Boolean, default: true },
  // When set, any JWT issued BEFORE this timestamp is treated as expired (session kill)
  deactivated_at:  { type: Date, default: null },
  created_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const classSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: null },
  level:       { type: String, default: null },
  trade:       { type: String, default: null },
  teacher_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  extra_teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  students:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  is_active:   { type: Boolean, default: true },
  created_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Link to the TVET program configuration (sector/trade/qualification/RTQF level) chosen at class creation.
  program_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProgramConfig', default: null },
  // Snapshot of the program fields at the time they were assigned — keeps reports stable
  // even if the ProgramConfig is later edited or removed.
  program_sector:              { type: String, default: null },
  program_trade:                { type: String, default: null },
  program_qualification_title:  { type: String, default: null },
  program_rtqf_level:           { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const documentSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  description:    { type: String, default: null },
  filename:       { type: String, required: true },
  original_name:  { type: String, required: true },
  file_size:      { type: Number, default: null },
  mime_type:      { type: String, default: null },
  class_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Class',  default: null },
  course_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  teacher_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  download_count: { type: Number, default: 0 },
  file_url:       { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const assignmentSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  description:   { type: String, default: null },
  filename:      { type: String, default: null },
  original_name: { type: String, default: null },
  mime_type:     { type: String, default: null },
  file_url:      { type: String, default: null },
  deadline:      { type: Date, required: true },
  is_active:     { type: Boolean, default: true },
  class_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  course_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  teacher_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  max_score:     { type: Number, default: 100 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const submissionSchema = new mongoose.Schema({
  assignment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename:      { type: String, default: null },
  original_name: { type: String, default: null },
  file_url:      { type: String, default: null },
  notes:         { type: String, default: null },
  score:         { type: Number, default: null },
  feedback:      { type: String, default: null },
  submitted_at:  { type: Date, default: Date.now },
  graded_at:     { type: Date, default: null },
});
submissionSchema.index({ assignment_id: 1, student_id: 1 }, { unique: true });

const announcementSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  content:    { type: String, required: true },
  class_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const notificationSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  type:       { type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info' },
  class_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Who this notification is FOR — not just who it's about/scoped to.
  // 'students': a teacher broadcasting to the students of class_id (assignment/document/
  //             announcement posted, or a manual notification). Visible only to students.
  // 'teacher':  an event raised BY a student (e.g. assignment submission) that should be
  //             visible only to the teacher (teacher_id), never to any student.
  audience:   { type: String, enum: ['students', 'teacher'], default: 'students' },
  // When set, this notification is meant for this ONE user only (e.g. "you were
  // added to a group"), regardless of the usual class/teacher broadcast scoping.
  // Left null for normal class-wide broadcasts (assignments, documents, etc.).
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Deep-link target so clicking the notification can jump straight to where
  // the action lives (the document, assignment, announcement, or submission
  // that triggered it), instead of just opening the notification panel.
  link_type:  { type: String, enum: ['document', 'assignment', 'announcement', 'submission', 'group', 'teacher_dm', 'attendance', 'assessment', null], default: null },
  link_id:    { type: mongoose.Schema.Types.ObjectId, default: null },
  course_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  read_by:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Users who have "cleared" this notification from their own notification panel.
  // Clearing is per-user: it hides the notification for that user only, it does NOT
  // delete the underlying document or affect what other recipients see.
  cleared_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ── ProgramConfig — one document per program row (sector + trade + qualTitle + rtqfLevel) ──
const programConfigSchema = new mongoose.Schema({
  sector:             { type: String, required: true },
  trade:              { type: String, required: true },
  qualificationTitle: { type: String, required: true },
  rtqfLevel:          { type: String, required: true },
  created_by:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ── ReportConfig — one document per admin: the header/branding info that
// appears on every printed assessment report (school name, address, manager,
// etc). Stored server-side so it is shared across devices/browsers instead
// of living in localStorage.
const reportConfigSchema = new mongoose.Schema({
  created_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Government / authority header
  republic:      { type: String, default: 'REPUBLIC OF RWANDA' },
  ministry:      { type: String, default: 'MINISTRY OF EDUCATION' },
  district:      { type: String, default: '' },

  // School identity
  schoolName:    { type: String, default: 'EDUPLA Academy' },
  schoolMotto:   { type: String, default: 'Excellence Through Knowledge' },
  schoolLogoUrl: { type: String, default: '' },
  schoolLogoPublicId: { type: String, default: '' }, // Cloudinary public_id, so the old logo can be deleted when replaced

  // Contact information
  schoolAddress: { type: String, default: '' },
  schoolPhone:   { type: String, default: '' },
  schoolEmail:   { type: String, default: '' },
  schoolWebsite: { type: String, default: '' },

  // Signatory
  managerName:   { type: String, default: '' },
  managerTitle:  { type: String, default: 'School Principal' },

  // Footer legend shown below the marks table
  footerNote:    { type: String, default: "Module Weight = Module's learning hours = Credit × 10. Passing Line: 50% for mathematics, sciences and complementary modules while 70% is for core modules (specific and general modules). Module Annual Average: (Average of Integrated A + Average of Comprehensive A) / number of assessed terms." },

  // Cosmetic
  primaryColor:  { type: String, default: '#1a3a6b' },
  accentColor:   { type: String, default: '#1565c0' },
  academicYear:  { type: String, default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Levels & Trades are now admin-scoped: created_by links to the admin who owns them
const levelSchema = new mongoose.Schema({
  value:      { type: String, required: true, uppercase: true },
  label:      { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at' } });
levelSchema.index({ value: 1, created_by: 1 }, { unique: true });

const tradeSchema = new mongoose.Schema({
  value:      { type: String, required: true, uppercase: true },
  label:      { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at' } });
tradeSchema.index({ value: 1, created_by: 1 }, { unique: true });

// ── Assessment Feature Schemas ──────────────────────────────────────────

// Course: subject/course created by admin and assigned to a teacher
const courseSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  code:         { type: String, default: null },
  description:  { type: String, default: null },
  total_marks:  { type: Number, default: 100 }, // module weight / max marks for this course
  category:     { type: String, default: 'Complementary modules' }, // module type: Complementary / General / Specific / Elective Non Examinable
  // Multi-class assignment (new). A module/course can now belong to one or more classes.
  class_ids:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  // Legacy single-class field — kept in sync with class_ids[0] by the controller for backward compatibility.
  class_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  teacher_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  is_active:    { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Assessment: created by teacher for a specific course, CLASS and term.
//
// A module/course can be assigned to several classes at once (see Course.class_ids
// above). Because of that, the class the assessment was created for must be stored
// on the assessment itself — otherwise an assessment created for one class would be
// indistinguishable from (and wrongly treated as a duplicate of) an assessment for
// a different class sharing the same module.
const assessmentSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  course_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  class_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:           { type: String, enum: ['FA', 'IA', 'CA'], required: true }, // FA = Formative, IA = Integrated, CA = Comprehensive
  term:           { type: String, enum: ['Term 1', 'Term 2', 'Term 3'], required: true },
  academic_year:  { type: String, required: true }, // e.g. "2024-2025"
  max_marks:      { type: Number, default: 100 },
  created_by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Online quiz feature ────────────────────────────────────────────────
  // 'marks' (default/legacy): teacher enters marks manually, exactly as before.
  // 'quiz': the teacher has built a question paper for this assessment that
  //         students attempt online; marks are produced from graded attempts.
  mode:               { type: String, enum: ['marks', 'quiz'], default: 'marks' },
  instructions:       { type: String, default: null },      // shown to the student before starting
  duration_minutes:   { type: Number, default: null },       // time limit per attempt
  shuffle_questions:  { type: Boolean, default: true },      // shuffle order when max_attempts > 1
  max_attempts:       { type: Number, default: 1 },
  expires_at:         { type: Date, default: null },         // no more attempts can start after this
  is_shared:          { type: Boolean, default: false },     // published/visible to students
  shared_at:          { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// A module/class/term/year can now hold MULTIPLE assessments of the same
// type (e.g. two or more Formative Assessments in one term), so `title` is
// part of the uniqueness key instead of being implied by `type` alone.
// `mode` is still part of the key too: the manual "Marks Recording" assessment
// and an independent online-quiz assessment for the same module/class/type/
// term/year are two separate records that live on two separate teacher
// pages, by design.
assessmentSchema.index(
  { course_id: 1, class_id: 1, term: 1, academic_year: 1, mode: 1, title: 1 },
  { unique: true }
);

// Mark: a student's mark in an assessment
const markSchema = new mongoose.Schema({
  assessment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  student_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  marks:         { type: Number, default: null },
  // Approved marks snapshot — this is what reports use until a new submission is approved
  approved_marks: { type: Number, default: null },
  remarks:       { type: String, default: null },
  entered_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
markSchema.index({ assessment_id: 1, student_id: 1 }, { unique: true });

// Assessment submission workflow: tracks the review status of an assessment's marks as a whole
const assessmentSubmissionSchema = new mongoose.Schema({
  assessment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, unique: true },
  status:        { type: String, enum: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft' },
  submitted_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submitted_at:  { type: Date, default: null },
  reviewed_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewed_at:   { type: Date, default: null },
  review_note:   { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Question bank for a quiz-mode Assessment. One document per question.
// `type` decides which of the optional fields are meaningful:
//   mcq         → options[] (with is_correct flags via correct_answer key list)
//   true_false  → correct_answer: 'true' | 'false'
//   fill_gap    → correct_answer: string (or JSON array of acceptable strings)
//   matching    → pairs[]: { left, right } — correct_answer is derived from pairs
//   open        → no auto-grading; correct_answer holds the teacher's model
//                 answer used only as a reference when grading manually
const assessmentQuestionSchema = new mongoose.Schema({
  assessment_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  type:           { type: String, enum: ['mcq', 'true_false', 'fill_gap', 'matching', 'open'], required: true },
  question_text:  { type: String, required: true },
  options:        [{ key: String, text: String }],   // mcq choices, e.g. [{key:'A',text:'...'}]
  pairs:          [{ left: String, right: String }],  // matching pairs (right = correct match for left)
  // Expected answer(s). For mcq: array of correct option keys (usually one).
  // For true_false: 'true'/'false'. For fill_gap: array of accepted strings
  // (case-insensitive exact match). For matching/open: reference answer only.
  correct_answer: { type: mongoose.Schema.Types.Mixed, default: null },
  marks:          { type: Number, required: true, default: 1 },
  order:          { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
assessmentQuestionSchema.index({ assessment_id: 1, order: 1 });

// One attempt of a quiz-mode Assessment by one student.
const assessmentAttemptSchema = new mongoose.Schema({
  assessment_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  student_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attempt_number: { type: Number, required: true, default: 1 },
  // Order the questions were shown in (shuffled per-attempt when the
  // assessment allows more than one attempt) — array of question IDs.
  question_order: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentQuestion' }],
  answers: [{
    question_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentQuestion', required: true },
    answer:       { type: mongoose.Schema.Types.Mixed, default: null }, // string, array, or {left:right} map
    auto_score:   { type: Number, default: null },
    manual_score: { type: Number, default: null },
    is_correct:   { type: Boolean, default: null }, // null until auto/manually graded
  }],
  status:              { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'in_progress' },
  started_at:          { type: Date, default: Date.now },
  due_at:              { type: Date, required: true },   // started_at + duration_minutes
  submitted_at:        { type: Date, default: null },
  auto_submitted:       { type: Boolean, default: false }, // true when time ran out or the student left the exam screen
  auto_submit_reason:   { type: String, enum: ['timeout', 'left_screen', null], default: null },
  needs_manual_grading: { type: Boolean, default: false }, // has ungraded open questions
  total_score:          { type: Number, default: null },   // final score once fully graded
  graded_by:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  graded_at:            { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
assessmentAttemptSchema.index({ assessment_id: 1, student_id: 1, attempt_number: 1 }, { unique: true });

// ── Maintenance Mode — single global settings document ─────────────────
// Only one document ever exists for this collection (key: 'singleton').
// When `enabled` is true, every request is blocked for everyone except the
// super admin (enforced by middleware/maintenance.js), and the frontend
// shows the maintenance screen to everyone else.
const maintenanceSchema = new mongoose.Schema({
  key:                { type: String, default: 'singleton', unique: true },
  enabled:            { type: Boolean, default: false },
  message:            { type: String, default: "We're performing scheduled maintenance to improve EDUPLA. We'll be back online shortly — thank you for your patience." },
  estimated_back_at:  { type: Date, default: null },
  enabled_at:         { type: Date, default: null },
  enabled_by:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ── DiscussionGroup — teacher-created student collaboration groups ──────
// A teacher picks a class, names the group, assigns a subset of students,
// and designates one of those students as the team leader.
//
// Access: any teacher assigned to the class (the creator OR an extra_teacher
// of that class) has full, automatic read/post access to the group
// conversation — no invitation or acceptance step required. Students who
// are members can always read/post. Each message's author may delete their
// own message (single, or all of their own messages at once).
//
// Separately, the team leader has a private 1:1 DM channel with the
// group's owning teacher (teacher_id) — `leader_messages` — used to reach
// the teacher directly without exposing the conversation to the whole group.
const groupMessageSchema = new mongoose.Schema({
  author_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  author_name:     { type: String, required: true },
  // 'student' for any member; 'teacher' for any teacher assigned to the class.
  author_role:     { type: String, enum: ['teacher', 'student'], default: 'student' },
  // 'text' = normal text message; 'voice' = voice note audio;
  // 'image' = shared photo; 'file' = shared document/attachment
  message_type:    { type: String, enum: ['text', 'voice', 'image', 'file'], default: 'text' },
  content:         { type: String, default: '' },   // text body (required when message_type='text')
  voice_url:       { type: String, default: null }, // Cloudinary URL for voice note
  voice_duration:  { type: Number, default: null }, // duration in seconds (client-reported)
  file_url:        { type: String, default: null }, // Cloudinary URL for shared image/file
  file_name:       { type: String, default: null }, // original filename
  file_size:       { type: Number, default: null }, // bytes
  mime_type:       { type: String, default: null }, // e.g. image/png, application/pdf
  // Cloudinary public_id for whichever of voice_url/file_url is set on this
  // message (only one applies per message_type) — required to delete the
  // asset from Cloudinary storage when the message is removed.
  media_public_id: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Private DM thread between the team leader and the group's owning teacher.
const leaderMessageSchema = new mongoose.Schema({
  sender_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender_name: { type: String, required: true },
  sender_role: { type: String, enum: ['teacher', 'student'], required: true },
  content:     { type: String, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const discussionGroupSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  class_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true }, // creator — has full access, and is the team leader's DM recipient
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // student ids
  team_leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true }, // must be one of `members`
  messages:    [groupMessageSchema],
  leader_messages: [leaderMessageSchema], // private team_leader <-> teacher_id DM
  is_ended:    { type: Boolean, default: false },     // teacher ended the conversation (everyone loses typing access)
  ended_at:    { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ── ClassCollaboration — open peer-to-peer messaging sessions ──────────
// A teacher can enable independent student-to-student direct messaging for
// any class they teach. While is_active is true, every enrolled student
// may search for and privately message any other student in that class.
// Only the two participants can read a conversation — teachers cannot.
// One document per (teacher_id, class_id) pair; upserted on open/close.
const classCollaborationSchema = new mongoose.Schema({
  class_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  is_active:  { type: Boolean, default: false },
  opened_at:  { type: Date, default: null },
  closed_at:  { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
classCollaborationSchema.index({ class_id: 1, teacher_id: 1 }, { unique: true });

// ── DirectMessage — private one-to-one messages between students ────────
// Created only when a ClassCollaboration is active for the shared class.
// Access is strictly limited to sender_id and receiver_id — enforced at
// the controller level. The sender may delete their own message (single,
// or all of their own messages in a conversation at once).
const directMessageSchema = new mongoose.Schema({
  class_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sender_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  receiver_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  // 'text' = normal text message; 'voice' = voice note audio;
  // 'image' = shared photo; 'file' = shared document/attachment
  message_type:   { type: String, enum: ['text', 'voice', 'image', 'file'], default: 'text' },
  content:        { type: String, default: '' },    // text body (required when message_type='text')
  voice_url:      { type: String, default: null },  // Cloudinary URL for voice note
  voice_duration: { type: Number, default: null },  // duration in seconds (client-reported)
  file_url:       { type: String, default: null },  // Cloudinary URL for shared image/file
  file_name:      { type: String, default: null },  // original filename
  file_size:      { type: Number, default: null },  // bytes
  mime_type:      { type: String, default: null },  // e.g. image/png, application/pdf
  // Cloudinary public_id for whichever of voice_url/file_url is set —
  // required to delete the asset from Cloudinary when the message is removed.
  media_public_id: { type: String, default: null },
  read:           { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
directMessageSchema.index({ class_id: 1, sender_id: 1, receiver_id: 1, created_at: 1 });
directMessageSchema.index({ class_id: 1, receiver_id: 1, read: 1 });

// ── TeacherDirectMessage — private one-to-one messaging between a teacher
// and a student they teach. Only the teacher can start a thread — it only
// becomes visible to the student, and repliable by them, once the teacher
// has sent at least one message. This is what makes the teacher "the only
// one who can allow" the conversation to exist. After the first message,
// either side may reply freely. Access is strictly limited to the
// teacher_id and student_id on each message.
const teacherDirectMessageSchema = new mongoose.Schema({
  teacher_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true }, // class that established the relationship at send-time
  sender_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender_role: { type: String, enum: ['teacher', 'student'], required: true },
  content:     { type: String, required: true },
  read:        { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
teacherDirectMessageSchema.index({ teacher_id: 1, student_id: 1, created_at: 1 });
teacherDirectMessageSchema.index({ student_id: 1, read: 1 });

// ── TeacherDmConversationState — tracks whether a teacher has paused
// (disabled) their private DM thread with a given student. Only the
// teacher may flip this — while disabled, neither side can send new
// messages, but history stays visible. Restoring re-enables sending.
const teacherDmConversationStateSchema = new mongoose.Schema({
  teacher_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  disabled:     { type: Boolean, default: false },
  disabled_at:  { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
teacherDmConversationStateSchema.index({ teacher_id: 1, student_id: 1 }, { unique: true });

// ── Attendance — one session per teacher, per class, per calendar day ───
// A class can be visited by more than one teacher across different periods
// (e.g. a main teacher plus extra_teachers), so attendance is taken
// independently per teacher: each teacher's session for a given class+date
// is its own document and never blocks or overwrites another teacher's.
// Marking attendance again for the SAME teacher+class+date updates that
// teacher's own session (upsert) rather than creating a duplicate — enforced
// by the unique index below. `date` is normalized to midnight (server-local)
// so multiple marks on the same calendar day always resolve to one session.
const attendanceRecordSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:     { type: String, enum: ['present', 'absent', 'late', 'excused'], default: 'present' },
  remarks:    { type: String, default: null },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  class_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  date:       { type: Date, required: true },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who took this specific session
  records:    [attendanceRecordSchema],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
attendanceSchema.index({ class_id: 1, date: 1, teacher_id: 1 }, { unique: true });

// ── Models ────────────────────────────────────────────────────────────

const User         = mongoose.model('User',         userSchema);
const Class        = mongoose.model('Class',        classSchema);
const Document     = mongoose.model('Document',     documentSchema);
const Assignment   = mongoose.model('Assignment',   assignmentSchema);
const Submission   = mongoose.model('Submission',   submissionSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const ProgramConfig = mongoose.model('ProgramConfig', programConfigSchema);
const ReportConfig  = mongoose.model('ReportConfig',  reportConfigSchema);
const Level        = mongoose.model('Level',        levelSchema);
const Trade        = mongoose.model('Trade',        tradeSchema);
const Course       = mongoose.model('Course',       courseSchema);
const Assessment   = mongoose.model('Assessment',   assessmentSchema);
const Mark         = mongoose.model('Mark',         markSchema);
const AssessmentSubmission = mongoose.model('AssessmentSubmission', assessmentSubmissionSchema);
const AssessmentQuestion = mongoose.model('AssessmentQuestion', assessmentQuestionSchema);
const AssessmentAttempt  = mongoose.model('AssessmentAttempt',  assessmentAttemptSchema);
const Maintenance      = mongoose.model('Maintenance',      maintenanceSchema);
const DiscussionGroup  = mongoose.model('DiscussionGroup',  discussionGroupSchema);
const ClassCollaboration = mongoose.model('ClassCollaboration', classCollaborationSchema);
const DirectMessage      = mongoose.model('DirectMessage',      directMessageSchema);
const TeacherDirectMessage = mongoose.model('TeacherDirectMessage', teacherDirectMessageSchema);
const TeacherDmConversationState = mongoose.model('TeacherDmConversationState', teacherDmConversationStateSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = {
  connectDB,
  User, Class, Document, Assignment, Submission, Announcement, Notification, Level, Trade,
  ProgramConfig, ReportConfig,
  Course, Assessment, Mark, AssessmentSubmission,
  AssessmentQuestion, AssessmentAttempt,
  Maintenance,
  DiscussionGroup,
  ClassCollaboration, DirectMessage,
  TeacherDirectMessage,
  TeacherDmConversationState,
  Attendance,
};