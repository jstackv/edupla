const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/academicYearController');

// Any authenticated role (admin/teacher/student) — read-only, used to show
// "Academic Year: 2026-2027" in dashboards and to stamp new records.
router.get('/active', isAuthenticated, ctrl.getActive);

// School Manager (admin) only — full management.
router.get('/admin',              isAuthenticated, isAdmin, ctrl.adminList);
router.post('/admin',             isAuthenticated, isAdmin, ctrl.adminCreate);
router.post('/admin/:id/activate', isAuthenticated, isAdmin, ctrl.adminActivate);
router.post('/admin/:id/terms/:term/status', isAuthenticated, isAdmin, ctrl.adminSetTermStatus);
router.delete('/admin/:id',       isAuthenticated, isAdmin, ctrl.adminDelete);

module.exports = router;
