const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Maintenance } = require('../models/db');
const { JWT_SECRET } = require('../middleware/auth');

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

    const payload = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      is_super_admin: user.is_super_admin || false,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({ message: 'Login successful', token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

const me = (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    res.json({ user });
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { login, logout, me };