const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: 'Unauthorized. Please log in.' });
};

const isTeacher = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'teacher') return next();
  return res.status(403).json({ message: 'Access denied. Teachers only.' });
};

const isStudent = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'student') return next();
  return res.status(403).json({ message: 'Access denied. Students only.' });
};

const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Access denied. Admins only.' });
};

const isTeacherOrAdmin = (req, res, next) => {
  if (req.session && req.session.user && (req.session.user.role === 'teacher' || req.session.user.role === 'admin')) return next();
  return res.status(403).json({ message: 'Access denied.' });
};

module.exports = { isAuthenticated, isTeacher, isStudent, isAdmin, isTeacherOrAdmin };
