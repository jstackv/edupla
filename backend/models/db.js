const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'edupla',
    });
    console.log('✅ MongoDB connected successfully');
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
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const documentSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  description:    { type: String, default: null },
  filename:       { type: String, required: true },
  original_name:  { type: String, required: true },
  file_size:      { type: Number, default: null },
  mime_type:      { type: String, default: null },
  class_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  teacher_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  start_date:    { type: Date, default: null },
  end_date:      { type: Date, default: null },
  is_active:     { type: Boolean, default: true },
  class_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
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
  read_by:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
  class_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  teacher_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  is_active:    { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Assessment: created by teacher for a specific course and term
const assessmentSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  course_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  teacher_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:           { type: String, enum: ['FA', 'CA'], required: true }, // FA = Formative, CA = Continuous
  term:           { type: String, enum: ['Term 1', 'Term 2', 'Term 3'], required: true },
  academic_year:  { type: String, required: true }, // e.g. "2024-2025"
  max_marks:      { type: Number, default: 100 },
  created_by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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

// ── Models ─────────────────────────────────────────────────────────────
const User         = mongoose.model('User',         userSchema);
const Class        = mongoose.model('Class',        classSchema);
const Document     = mongoose.model('Document',     documentSchema);
const Assignment   = mongoose.model('Assignment',   assignmentSchema);
const Submission   = mongoose.model('Submission',   submissionSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Level        = mongoose.model('Level',        levelSchema);
const Trade        = mongoose.model('Trade',        tradeSchema);
const Course       = mongoose.model('Course',       courseSchema);
const Assessment   = mongoose.model('Assessment',   assessmentSchema);
const Mark         = mongoose.model('Mark',         markSchema);
const AssessmentSubmission = mongoose.model('AssessmentSubmission', assessmentSubmissionSchema);

module.exports = {
  connectDB,
  User, Class, Document, Assignment, Submission, Announcement, Notification, Level, Trade,
  Course, Assessment, Mark, AssessmentSubmission,
};
// This line intentionally left blank - models appended below