const router = require('express').Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getTaskGroups, createTaskGroups, deleteTaskGroupBatch, getGroupProgress, renameTaskGroup } = require('../controllers/taskGroupController');

router.use(isAuthenticated, isTeacher);
router.get('/', getTaskGroups);
router.post('/', createTaskGroups);
router.delete('/batch/:batchId', deleteTaskGroupBatch);
router.get('/:id/progress', getGroupProgress);
router.patch('/:id', renameTaskGroup);

module.exports = router;
