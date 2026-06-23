// ── DiscussionGroup — teacher-created student collaboration groups ──────────
// A teacher picks a class, names the group, and assigns a subset of students.
// Once created, those students share a private chat thread among themselves
// (no teacher in the conversation). The teacher can see the group exists and
// its metadata but does NOT participate in the chat.
const groupMessageSchema = new mongoose.Schema({
  author_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  author_name: { type: String, required: true },   // denormalised for speed
  content:     { type: String, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const discussionGroupSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  class_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  members:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // student ids
  messages:   [groupMessageSchema],
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const DiscussionGroup = mongoose.model('DiscussionGroup', discussionGroupSchema);

// Add to module.exports alongside existing models:
// DiscussionGroup,
