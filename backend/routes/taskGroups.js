const router = require('express').Router();
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { getTaskGroups, createTaskGroups, deleteTaskGroupBatch } = require('../controllers/taskGroupController');

router.use(isAuthenticated, isTeacher);
router.get('/', getTaskGroups);
router.post('/', createTaskGroups);
router.delete('/batch/:batchId', deleteTaskGroupBatch);

module.exports = router;
