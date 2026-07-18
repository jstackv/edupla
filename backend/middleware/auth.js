const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'edupla_jwt_secret_2024';

const isAuthenticated = async (req, res, next) => {
  // Browser-native embeds (<iframe src>, <img src>, <video>/<audio> <source src>)
  // can't attach an Authorization header, and we don't set an auth cookie on
  // login (token lives in sessionStorage, per-tab, by design — see api.js).
  // So the file viewer/download endpoints pass the token as a query param instead.
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1] || req.query?.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.session = req.session || {};
    req.session.user = req.user;

    // ── Session termination check ──────────────────────────────────────
    // If the account was deactivated AFTER this token was issued, kill the session.
    const { User } = require('../models/db');
    const userDoc = await User.findById(decoded.id).select('is_active deactivated_at').lean();
    if (!userDoc) {
      return res.status(401).json({ message: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });
    }
    if (userDoc.is_active === false) {
      // deactivated_at is set when account is deactivated; JWT iat is in seconds
      const tokenIssuedAt = decoded.iat * 1000; // convert to ms
      const deactivatedAt = userDoc.deactivated_at ? userDoc.deactivated_at.getTime() : 0;
      if (deactivatedAt >= tokenIssuedAt) {
        return res.status(403).json({
          message: 'Your account has been deactivated by the administrator. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }
    }

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const isTeacher = (req, res, next) => {
  if (req.user?.role === 'teacher') return next();
  return res.status(403).json({ message: 'Access denied. Teachers only.' });
};

const isStudent = (req, res, next) => {
  if (req.user?.role === 'student') return next();
  return res.status(403).json({ message: 'Access denied. Students only.' });
};

const isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ message: 'Access denied. Admins only.' });
};

const isTeacherOrAdmin = (req, res, next) => {
  if (req.user?.role === 'teacher' || req.user?.role === 'admin') return next();
  return res.status(403).json({ message: 'Access denied.' });
};

const isSuperAdmin = (req, res, next) => {
  if (req.user?.role === 'admin' && req.user?.is_super_admin) return next();
  return res.status(403).json({ message: 'Access denied. Only the primary admin can manage admin accounts.' });
};

module.exports = { isAuthenticated, isTeacher, isStudent, isAdmin, isTeacherOrAdmin, isSuperAdmin, JWT_SECRET };