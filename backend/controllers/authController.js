const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Maintenance } = require('../models/db');
const { JWT_SECRET } = require('../middleware/auth');

// Shape the full profile we send to the frontend — everything the Profile
// page (and anywhere else) needs to render real data instead of "N/A",
// without ever leaking the password hash.
function toProfile(userDoc, extra = {}) {
  const u = typeof userDoc.toObject === 'function' ? userDoc.toObject() : userDoc;
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    level: u.level ?? null,
    trade: u.trade ?? null,
    class_year: u.class_year ?? null,
    phone: u.phone ?? null,
    avatar_color: u.avatar_color ?? null,
    is_super_admin: u.is_super_admin || false,
    is_active: u.is_active !== false,
    created_at: u.created_at || u.createdAt || null,
    updated_at: u.updated_at || u.updatedAt || null,
    ...extra,
  };
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    // Block inactive accounts with a clear, role-specific message
    if (user.is_active === false) {
      const roleLabel = user.role === 'teacher' ? 'Teacher' : user.role === 'student' ? 'Student' : 'Admin';
      return res.status(403).json({
        message: `Your ${roleLabel} account has been deactivated. Please contact your administrator to regain access.`,
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // During maintenance mode, only the super admin may sign in — everyone
    // else stays on the maintenance screen until it's switched back off.
    const isSuperAdmin = user.role === 'admin' && user.is_super_admin === true;
    if (!isSuperAdmin) {
      const maintenance = await Maintenance.findOne({ key: 'singleton' }).lean();
      if (maintenance?.enabled) {
        return res.status(503).json({
          message: maintenance.message || 'EDUPLA is currently under maintenance. Please check back shortly.',
          code: 'MAINTENANCE_MODE',
          estimated_back_at: maintenance.estimated_back_at || null,
        });
      }
    }

    // JWT payload stays minimal — it's only used by middleware for auth
    // checks (id / role / is_super_admin), not for rendering the UI.
    const jwtPayload = {
      id: user._id.toString(),
      role: user.role,
      is_super_admin: user.is_super_admin || false,
    };
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '24h' });

    // The `user` object sent back to the frontend is the FULL profile, so
    // Profile.jsx (and anything else reading useAuth().user) has real
    // level/trade/class_year/phone/status data immediately after login.
    res.json({ message: 'Login successful', token, user: toProfile(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

const me = async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userDoc = await User.findById(decoded.id);
    if (!userDoc) return res.status(401).json({ message: 'Account not found.' });

    // Re-fetch from the database on every call so the profile always
    // reflects the latest saved data, not a snapshot frozen at login time.
    // Impersonation flags only ever exist on the token, never in the DB,
    // so they're carried over explicitly — this keeps the impersonation
    // banner (Layout.jsx / App.jsx) working exactly as before.
    const extra = {};
    if (decoded.impersonation_session) {
      extra.impersonation_session = true;
      extra.impersonated_by = decoded.impersonated_by;
    }

    res.json({ user: toProfile(userDoc, extra) });
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { login, logout, me };