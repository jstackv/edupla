const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'edupla_jwt_secret_2024';

const isAuthenticated = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    // keep backward compat: controllers use req.session.user
    req.session = req.session || {};
    req.session.user = req.user;
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
