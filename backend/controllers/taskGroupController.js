const mongoose = require('mongoose');
const { TaskGroup, Assignment, Submission, Class, Course } = require('../models/db');

// A teacher may manage groups for a class they teach (class teacher or
// co-teacher) OR for a class where they teach the module the groups are for.
async function teacherCanUseClass(teacherId, classId, courseId) {
  const [cls, course] = await Promise.all([
    Class.findOne({ _id: classId, $or: [{ teacher_id: teacherId }, { extra_teachers: teacherId }] }, '_id').lean(),
    courseId
      ? Course.findOne({
          _id: courseId, teacher_id: teacherId,
          $or: [{ class_id: classId }, { class_ids: classId }],
        }, '_id').lean()
      : null,
  ]);
  return !!(cls || course);
}

const shape = (g, taskCounts = {}) => ({
  id: g._id,
  name: g.name,
  batch_id: g.batch_id,
  batch_name: g.batch_name,
  class_id: g.class_id,
  course_id: g.course_id,
  created_at: g.created_at,
  members: (g.members || []).map(m => ({ id: m._id || m, name: m.name || null, email: m.email || null })),
  task_count: taskCounts[String(g._id)] || 0,
});

// GET /api/task-groups?classId=&courseId=
const getTaskGroups = async (req, res) => {
  try {
    const { classId, courseId } = req.query;
    if (!classId) return res.status(400).json({ message: 'classId is required' });
    const teacherId = req.session.user.id;
    if (!(await teacherCanUseClass(teacherId, classId, courseId))) {
      return res.status(403).json({ message: 'You are not assigned to this class.' });
    }
    const filter = { class_id: classId };
    if (courseId) filter.course_id = courseId;
    // Groups are private to the teacher who generated them.
    filter.teacher_id = teacherId;

    const groups = await TaskGroup.find(filter)
      .sort({ created_at: -1, name: 1 })
      .populate('members', 'name email')
      .lean();

    const counts = {};
    if (groups.length) {
      const agg = await Assignment.aggregate([
        { $match: { group_ids: { $in: groups.map(g => g._id) } } },
        { $unwind: '$group_ids' },
        { $group: { _id: '$group_ids', n: { $sum: 1 } } },
      ]);
      agg.forEach(a => { counts[String(a._id)] = a.n; });
    }
    res.json({ groups: groups.map(g => shape(g, counts)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/task-groups
// body: { classId, courseId?, batchName?, groups: [{ name, members: [studentId] }] }
// Every group created by one call shares a batch_id.
const createTaskGroups = async (req, res) => {
  try {
    const { classId, courseId, batchName, groups } = req.body;
    if (!classId || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ message: 'Class and at least one group are required' });
    }
    const teacherId = req.session.user.id;
    if (!(await teacherCanUseClass(teacherId, classId, courseId))) {
      return res.status(403).json({ message: 'You are not assigned to this class.' });
    }

    const cls = await Class.findById(classId, 'students').lean();
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    const enrolled = new Set((cls.students || []).map(String));

    const seen = new Set();
    const cleaned = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i] || {};
      const members = [];
      for (const m of (g.members || [])) {
        const id = String(m);
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid student id' });
        if (!enrolled.has(id)) return res.status(400).json({ message: 'A selected student is not enrolled in this class' });
        if (seen.has(id)) return res.status(400).json({ message: 'A student cannot be in two groups of the same set' });
        seen.add(id);
        members.push(id);
      }
      if (members.length === 0) return res.status(400).json({ message: 'Every group needs at least one student' });
      cleaned.push({ name: (g.name || `Group ${i + 1}`).toString().slice(0, 80), members });
    }

    const batchId = new mongoose.Types.ObjectId();
    const label = (batchName || '').toString().trim().slice(0, 80)
      || `Groups ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const created = await TaskGroup.insertMany(cleaned.map(g => ({
      name: g.name, batch_id: batchId, batch_name: label,
      class_id: classId, course_id: courseId || null,
      teacher_id: teacherId, members: g.members,
    })));
    res.status(201).json({ message: 'Groups saved', batch_id: batchId, count: created.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/task-groups/batch/:batchId — remove a whole generated set.
// Refused while any task is still assigned to one of its groups, so students
// never lose access to a task they were given.
const deleteTaskGroupBatch = async (req, res) => {
  try {
    const teacherId = req.session.user.id;
    const groups = await TaskGroup.find({ batch_id: req.params.batchId, teacher_id: teacherId }, '_id').lean();
    if (!groups.length) return res.status(404).json({ message: 'Groups not found' });
    const ids = groups.map(g => g._id);
    const inUse = await Assignment.countDocuments({ group_ids: { $in: ids } });
    if (inUse > 0) {
      return res.status(409).json({
        message: `${inUse} task${inUse === 1 ? ' is' : 's are'} assigned to these groups. Delete ${inUse === 1 ? 'it' : 'them'} first.`,
      });
    }
    await TaskGroup.deleteMany({ _id: { $in: ids } });
    res.json({ message: 'Groups deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/task-groups/:id/progress — how far each task given to this group has
// got: how many of the group's members have submitted / been graded. The task
// details themselves come from the normal task list (filtered by groupId).
const getGroupProgress = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Group not found' });
    const group = await TaskGroup.findOne({ _id: req.params.id, teacher_id: req.session.user.id }, 'members').lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const tasks = await Assignment.find({ group_ids: group._id }, '_id').lean();
    const taskIds = tasks.map(t => t._id);
    const rows = taskIds.length
      ? await Submission.aggregate([
          { $match: { assignment_id: { $in: taskIds }, student_id: { $in: group.members } } },
          { $group: {
              _id: '$assignment_id',
              submitted: { $sum: 1 },
              graded: { $sum: { $cond: [{ $isNumber: '$score' }, 1, 0] } },
              last_submitted_at: { $max: '$submitted_at' },
          } },
        ])
      : [];
    const byTask = new Map(rows.map(r => [String(r._id), r]));
    res.json({
      member_count: (group.members || []).length,
      tasks: taskIds.map(id => {
        const r = byTask.get(String(id));
        return { assignment_id: id, submitted: r?.submitted || 0, graded: r?.graded || 0, last_submitted_at: r?.last_submitted_at || null };
      }),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PATCH /api/task-groups/:id  { name } — rename one saved group.
const renameTaskGroup = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ message: 'Give the group a name' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Group not found' });
    const g = await TaskGroup.findOneAndUpdate(
      { _id: req.params.id, teacher_id: req.session.user.id }, { $set: { name } }, { new: true },
    );
    if (!g) return res.status(404).json({ message: 'Group not found' });
    res.json({ message: 'Group renamed', name: g.name });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getTaskGroups, createTaskGroups, deleteTaskGroupBatch, getGroupProgress, renameTaskGroup };
