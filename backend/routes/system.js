const express = require('express');
const router = express.Router();
const { isAuthenticated, isSuperAdmin } = require('../middleware/auth');
const { getStatus, updateMaintenance, impersonate } = require('../controllers/systemController');

// Public — no auth required. The frontend polls this to know whether to
// show the maintenance screen, even before it knows who's logged in.
router.get('/status', getStatus);

// Super admin only — turn maintenance mode on/off, set the message shown
// to everyone else, and (optionally) an estimated "back online" time.
router.put('/maintenance', isAuthenticated, isSuperAdmin, updateMaintenance);

// Super admin only — generate a short-lived (2h) impersonation token for
// any non-super-admin user. Use this during maintenance to log in as that
// user and verify bug fixes without disabling maintenance for everyone.
router.post('/impersonate/:userId', isAuthenticated, isSuperAdmin, impersonate);

module.exports = router;