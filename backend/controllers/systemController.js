const jwt = require('jsonwebtoken');
const { Maintenance, User } = require('../models/db');
const { invalidateCache } = require('../middleware/maintenance');
const { JWT_SECRET } = require('../middleware/auth');

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

// POST /api/system/impersonate/:userId — super admin only.
// Issues a short-lived token (2 h) that bypasses the maintenance gate,
// so the super admin can log in AS any user to verify bug fixes while
// the system is still in maintenance mode.
// The token is flagged with `impersonated_by` so it is clearly auditable,
// and it is explicitly rejected by the maintenance gate for everyone
// except the super admin who requested it (see maintenance middleware).
const impersonate = async (req, res) => {
  try {
    const { userId } = req.params;
    const target = await User.findById(userId)
      .select('name email role is_super_admin is_active')
      .lean();

    if (!target) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // Never allow impersonating another super admin — that would be a
    // privilege-escalation path if this endpoint were ever misused.
    if (target.is_super_admin) {
      return res.status(403).json({ message: 'Cannot impersonate another super admin.' });
    }
    if (target.is_active === false) {
      return res.status(400).json({ message: 'Cannot impersonate a deactivated account.' });
    }

    const payload = {
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      is_super_admin: false,
      // These two flags are checked by the maintenance gate so the token
      // can pass through even while maintenance is active.
      impersonation_session: true,
      impersonated_by: req.user.id,
    };

    // 2-hour window — enough to reproduce and verify a bug, short enough
    // to limit exposure if the token is somehow leaked.
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

    res.json({
      message: `Impersonation token issued for ${target.name} (${target.role})`,
      token,
      user: payload,
      expires_in: '2 hours',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStatus, updateMaintenance, impersonate };