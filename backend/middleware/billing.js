const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./auth");

// ── Small in-memory caches, same pattern as middleware/maintenance.js ────
// ownerCache: teacher/student userId -> their owning admin's userId
// billingCache: admin userId -> their billing sub-document
const CACHE_TTL_MS = 5000;
const ownerCache = new Map();
const billingCache = new Map();

function invalidateBillingCache(adminId) {
  if (adminId) billingCache.delete(String(adminId));
  else billingCache.clear();
}

// Requests that must always go through, regardless of billing state — auth
// itself, the maintenance/health checks, and the billing endpoints (an
// admin blocked by their own overdue subscription still needs to be able
// to see the paywall and pay).
const ALLOWED_PREFIXES = ["/api/auth", "/api/system", "/api/billing"];

function isAllowlisted(req) {
  return ALLOWED_PREFIXES.some((prefix) => req.path.startsWith(prefix));
}

function decodeUserSafely(req) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1] || req.query?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function getOwnerId(decoded) {
  if (decoded.role === "admin") return decoded.id;

  const cached = ownerCache.get(decoded.id);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.ownerId;

  const { User } = require("../models/db");
  const doc = await User.findById(decoded.id).select("created_by").lean();
  const ownerId = doc?.created_by ? String(doc.created_by) : null;
  ownerCache.set(decoded.id, { ownerId, fetchedAt: now });
  return ownerId;
}

/**
 * Reads (and lazily initializes) an admin's billing sub-document. The trial
 * clock starts from the admin's own created_at the first time this ever
 * runs for them, then is frozen in the DB — so later changes to TRIAL_DAYS
 * don't retroactively shorten or extend a trial already in progress.
 */
async function getOrInitBilling(ownerId) {
  const cached = billingCache.get(ownerId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const { User } = require("../models/db");
  let owner = await User.findById(ownerId).select("billing created_at").lean();
  if (!owner) return null;

  if (!owner.billing?.trial_ends_at) {
    const trialDays = parseInt(process.env.TRIAL_DAYS || "30", 10);
    const trialEndsAt = new Date(
      (owner.created_at || new Date()).getTime() + trialDays * 24 * 60 * 60 * 1000,
    );
    owner = await User.findOneAndUpdate(
      { _id: ownerId, "billing.trial_ends_at": null },
      { $set: { "billing.trial_ends_at": trialEndsAt, "billing.status": "trialing" } },
      { new: true },
    )
      .select("billing created_at")
      .lean() || owner;
  }

  billingCache.set(ownerId, { data: owner.billing, fetchedAt: now });
  return owner.billing;
}

function computeIsBlocked(billing) {
  if (billing?.locked === true) return true;

  const now = Date.now();
  const paidUntil = billing?.paid_until ? new Date(billing.paid_until).getTime() : 0;
  if (paidUntil > now) return false;

  const trialEndsAt = billing?.trial_ends_at ? new Date(billing.trial_ends_at).getTime() : 0;
  if (trialEndsAt > now) return false;

  return true;
}

// Global gate — mounted in server.js right after maintenanceGate. No-op for
// requests it can't evaluate (no token, unknown owner) so unauthenticated
// traffic and the login flow are never touched here — only isAuthenticated
// routes actually get blocked in practice.
const billingGate = async (req, res, next) => {
  try {
    if (isAllowlisted(req)) return next();

    const decoded = decodeUserSafely(req);
    if (!decoded) return next();

    // Edupla's own platform super admin is never locked out by a school's
    // billing state.
    if (decoded.role === "admin" && decoded.is_super_admin === true) return next();

    // Same impersonation carve-out as maintenanceGate.
    const isImpersonationSession =
      decoded.impersonation_session === true && typeof decoded.impersonated_by === "string";
    if (isImpersonationSession) return next();

    const ownerId = await getOwnerId(decoded);
    if (!ownerId) return next();

    const billing = await getOrInitBilling(ownerId);
    if (!billing) return next();

    if (!computeIsBlocked(billing)) return next();

    return res.status(402).json({
      message:
        billing?.locked === true
          ? "This school's Edupla access has been locked by Edupla administrators."
          : decoded.role === "admin"
            ? "Your Edupla subscription has ended. Please complete payment to continue."
            : "Access to Edupla is paused until your school renews its subscription. Please contact your school administrator.",
      code: "SUBSCRIPTION_REQUIRED",
      is_payer: decoded.role === "admin",
      is_locked: billing?.locked === true,
    });
  } catch (err) {
    // Never let a billing-check failure take the whole API down.
    console.error("billingGate error:", err.message);
    return next();
  }
};

module.exports = { billingGate, invalidateBillingCache, getOrInitBilling, computeIsBlocked };