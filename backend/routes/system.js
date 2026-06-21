const express = require('express');
const router = express.Router();
const { isAuthenticated, isSuperAdmin } = require('../middleware/auth');
const { getStatus, updateMaintenance } = require('../controllers/systemController');

// Public — no auth required. The frontend polls this to know whether to
// show the maintenance screen, even before it knows who's logged in.
router.get('/status', getStatus);

// Super admin only — turn maintenance mode on/off, set the message shown
// to everyone else, and (optionally) an estimated "back online" time.
router.put('/maintenance', isAuthenticated, isSuperAdmin, updateMaintenance);

module.exports = router;