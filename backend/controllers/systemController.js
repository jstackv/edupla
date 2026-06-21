const { Maintenance } = require('../models/db');
const { invalidateCache } = require('../middleware/maintenance');

// GET /api/system/status — public, no auth. Lets the frontend know whether
// to show the maintenance screen before it even knows who's logged in.
const getStatus = async (req, res) => {
  try {
    const doc = await Maintenance.findOne({ key: 'singleton' }).lean();
    res.json({
      enabled: doc?.enabled || false,
      message: doc?.message || null,
      estimated_back_at: doc?.estimated_back_at || null,
      enabled_at: doc?.enabled_at || null,
    });
  } catch (err) {
    // Fail "open" — never let a DB hiccup lock everyone out of the app.
    res.json({ enabled: false, message: null, estimated_back_at: null, enabled_at: null });
  }
};

// PUT /api/system/maintenance — super admin only.
const updateMaintenance = async (req, res) => {
  try {
    const { enabled, message, estimated_back_at } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: '"enabled" must be true or false' });
    }

    const update = { enabled };
    if (typeof message === 'string' && message.trim()) update.message = message.trim();
    if (enabled) {
      update.enabled_at = new Date();
      update.enabled_by = req.user.id;
      update.estimated_back_at = estimated_back_at ? new Date(estimated_back_at) : null;
    } else {
      update.estimated_back_at = null;
    }

    const doc = await Maintenance.findOneAndUpdate(
      { key: 'singleton' },
      { $set: update },
      { upsert: true, new: true }
    );

    invalidateCache();

    res.json({
      message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
      enabled: doc.enabled,
      status: {
        enabled: doc.enabled,
        message: doc.message,
        estimated_back_at: doc.estimated_back_at,
        enabled_at: doc.enabled_at,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStatus, updateMaintenance };