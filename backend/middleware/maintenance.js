const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

// ── Small in-memory cache so we don't hit Mongo on every single request ──
// Invalidated immediately whenever the super admin toggles maintenance mode
// (see invalidateCache, called from systemController).
const CACHE_TTL_MS = 5000;
let cache = { data: null, fetchedAt: 0 };

function invalidateCache() {
  cache = { data: null, fetchedAt: 0 };
}

async function getMaintenanceState() {
  const now = Date.now();
  if (cache.data && (now - cache.fetchedAt) < CACHE_TTL_MS) return cache.data;

  const { Maintenance } = require('../models/db');
  const doc = await Maintenance.findOne({ key: 'singleton' }).lean();
  const data = doc || { enabled: false };
  cache = { data, fetchedAt: now };
  return data;
}

// Requests that must always go through, regardless of maintenance state —
// just enough surface area for the login screen and identity checks to work.
const ALLOWLIST = [
  { method: 'GET',  path: '/api/system/status' },
  { method: 'GET',  path: '/api/health' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET',  path: '/api/auth/me' },
];

function isAllowlisted(req) {
  return ALLOWLIST.some(rule => rule.method === req.method && rule.path === req.path);
}

function decodeUserSafely(req) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Global gate — mounted in server.js before the route handlers.
// When maintenance mode is OFF, this is a no-op.
// When it's ON, only the super admin (and the allowlisted auth endpoints)
// may pass through; everyone else gets a 503 with code MAINTENANCE_MODE.
const maintenanceGate = async (req, res, next) => {
  try {
    if (isAllowlisted(req)) return next();

    const state = await getMaintenanceState();
    if (!state.enabled) return next();

    const decoded = decodeUserSafely(req);
    const isSuperAdmin = decoded?.role === 'admin' && decoded?.is_super_admin === true;
    if (isSuperAdmin) return next();

    // Tokens issued by the super admin via POST /api/system/impersonate carry
    // `impersonation_session: true`. This lets the super admin browse the app
    // as a regular user during maintenance to verify bug fixes, without
    // needing to disable maintenance mode for everyone.
    const isImpersonationSession = decoded?.impersonation_session === true
      && typeof decoded?.impersonated_by === 'string';
    if (isImpersonationSession) return next();

    return res.status(503).json({
      message: state.message || 'EDUPLA is currently under maintenance. Please check back shortly.',
      code: 'MAINTENANCE_MODE',
      estimated_back_at: state.estimated_back_at || null,
    });
  } catch (err) {
    // Never let a maintenance-check failure take the whole API down.
    console.error('maintenanceGate error:', err.message);
    return next();
  }
};

module.exports = { maintenanceGate, invalidateCache, getMaintenanceState };