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
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  role:         { type: String, enum: ['teacher', 'student', 'admin'], required: true },
  level:        { type: String, default: null },
  trade:        { type: String, default: null },
  class_year:   { type: String, default: null },
  phone:        { type: String, default: null },
  avatar_color: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const classSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: null },
  level:       { type: String, default: null },
  trade:       { type: String, default: null },
  teacher_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // extra teachers (many-to-many equivalent)
  extra_teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // enrolled students (replaces class_students junction table)
  students:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const assignmentSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  description:   { type: String, default: null },
  filename:      { type: String, default: null },
  original_name: { type: String, default: null },
  mime_type:     { type: String, default: null },
  deadline:      { type: Date, required: true },
  class_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  max_score:     { type: Number, default: 100 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const submissionSchema = new mongoose.Schema({
  assignment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename:      { type: String, default: null },
  original_name: { type: String, default: null },
  notes:         { type: String, default: null },
  score:         { type: Number, default: null },
  feedback:      { type: String, default: null },
  submitted_at:  { type: Date, default: Date.now },
  graded_at:     { type: Date, default: null },
});
// Unique constraint: one submission per student per assignment
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

const levelSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true, uppercase: true },
  label: { type: String },
}, { timestamps: { createdAt: 'created_at' } });

const tradeSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true, uppercase: true },
  label: { type: String },
}, { timestamps: { createdAt: 'created_at' } });

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

module.exports = {
  connectDB,
  User, Class, Document, Assignment, Submission, Announcement, Notification, Level, Trade,
};
