const jwt = require('jsonwebtoken');
const { Maintenance, User, Payment, SubscriptionPlan } = require('../models/db');
const { invalidateCache } = require('../middleware/maintenance');
const { invalidateBillingCache, getOrInitBilling } = require('../middleware/billing');
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

// ── Schools & Billing oversight (super admin only) ──────────────────────

function computeSchoolBilling(admin) {
  const now = Date.now();
  const billing = admin.billing || {};
  const paidUntil = billing.paid_until ? new Date(billing.paid_until) : null;
  const trialEndsAt = billing.trial_ends_at ? new Date(billing.trial_ends_at) : null;
  const isLocked = billing.locked === true;
  const isActive = !isLocked && paidUntil && paidUntil.getTime() > now;
  const isTrialing = !isLocked && !isActive && trialEndsAt && trialEndsAt.getTime() > now;
  const status = isLocked ? 'locked' : isActive ? 'active' : isTrialing ? 'trialing' : 'overdue';
  const relevantDate = isActive ? paidUntil : trialEndsAt;
  const daysRemaining = relevantDate
    ? Math.max(0, Math.ceil((relevantDate.getTime() - now) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    status,
    trial_ends_at: trialEndsAt,
    paid_until: paidUntil,
    days_remaining: daysRemaining,
    locked: isLocked,
    locked_payable: isLocked ? billing.locked_payable === true : false,
    locked_reason: billing.locked_reason || null,
    locked_at: billing.locked_at || null,
  };
}

// GET /api/system/billing/schools — super admin only. One row per school
// (i.e. per admin account, since teachers/students don't have their own
// billing state — see middleware/billing.js).
const listSchoolsBilling = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin', is_super_admin: { $ne: true } })
      .select('name email phone created_at billing')
      .sort({ created_at: -1 })
      .lean();

    const schools = admins.map((admin) => ({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      created_at: admin.created_at,
      billing: computeSchoolBilling(admin),
    }));

    res.json({ schools });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/system/billing/schools/:adminId/lock — super admin only.
// Immediate override: blocks the school regardless of trial/paid state.
// Useful for testing, abuse, or non-payment escalation outside the
// automatic trial/subscription lifecycle.
const lockSchool = async (req, res) => {
  try {
    const { reason, payable } = req.body;
    const admin = await User.findOne({ _id: req.params.adminId, role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'School admin not found.' });
    if (admin.is_super_admin) {
      return res.status(403).json({ message: 'Cannot lock a super admin account.' });
    }

    admin.billing = admin.billing || {};
    admin.billing.locked = true;
    admin.billing.locked_payable = payable === true;
    admin.billing.locked_reason = (reason && String(reason).trim()) || 'Locked by Edupla administrator';
    admin.billing.locked_at = new Date();
    admin.billing.locked_by = req.user.id;
    await admin.save();

    invalidateBillingCache(String(admin._id));

    res.json({ message: `${admin.name}'s school has been locked.`, billing: computeSchoolBilling(admin.toObject()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/system/billing/schools/:adminId/unlock — super admin only.
// Clears the manual lock; the school then falls back to whatever its
// normal trial/paid state computes to (does NOT grant extra paid time).
const unlockSchool = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.adminId, role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'School admin not found.' });

    admin.billing = admin.billing || {};
    admin.billing.locked = false;
    admin.billing.locked_payable = false;
    admin.billing.locked_reason = null;
    admin.billing.locked_at = null;
    admin.billing.locked_by = null;
    await admin.save();

    invalidateBillingCache(String(admin._id));

    // Billing might not have been initialized yet for a brand-new admin —
    // make sure trial_ends_at exists so the frontend has something to show.
    await getOrInitBilling(String(admin._id));

    res.json({ message: `${admin.name}'s school has been unlocked.`, billing: computeSchoolBilling(admin.toObject()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/system/billing/schools/:adminId/extend — super admin only.
// Manually grants extra paid days without going through MTN — useful for
// comps, goodwill extensions, or fixing a payment that succeeded on MTN's
// side but didn't get recorded for some reason.
const extendSchool = async (req, res) => {
  try {
    const days = parseInt(req.body?.days, 10);
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ message: '"days" must be a positive number.' });
    }

    const admin = await User.findOne({ _id: req.params.adminId, role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'School admin not found.' });

    const now = new Date();
    const currentPaidUntil = admin.billing?.paid_until ? new Date(admin.billing.paid_until) : null;
    const base = currentPaidUntil && currentPaidUntil.getTime() > now.getTime() ? currentPaidUntil : now;
    const paidUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    admin.billing = admin.billing || {};
    admin.billing.paid_until = paidUntil;
    await admin.save();

    invalidateBillingCache(String(admin._id));

    res.json({ message: `Extended ${admin.name}'s school by ${days} day(s).`, billing: computeSchoolBilling(admin.toObject()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.listSchoolsBilling = listSchoolsBilling;
module.exports.lockSchool = lockSchool;
module.exports.unlockSchool = unlockSchool;
module.exports.extendSchool = extendSchool;

// ── Subscription plans (super admin only) ────────────────────────────────
// The tiers school admins choose from in the manual-payment flow. Editing
// these never touches past Payment records — each one snapshots the
// plan's name/amount/days at the time it was created.

// GET /api/system/billing/plans — includes inactive plans, unlike the
// school-facing /api/billing/plans which only shows active ones.
const listPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ sort_order: 1, amount: 1 }).lean();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createPlan = async (req, res) => {
  try {
    const { name, amount, currency, days, sort_order } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Plan name is required.' });
    const amt = Number(amount);
    const d = parseInt(days, 10);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Amount must be a positive number.' });
    if (!Number.isFinite(d) || d <= 0) return res.status(400).json({ message: 'Days must be a positive number.' });

    const plan = await SubscriptionPlan.create({
      name: String(name).trim(),
      amount: amt,
      currency: (currency && String(currency).trim()) || 'RWF',
      days: d,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
    });
    res.status(201).json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    const { name, amount, currency, days, active, sort_order } = req.body;
    const plan = await SubscriptionPlan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });

    if (name !== undefined) plan.name = String(name).trim();
    if (currency !== undefined) plan.currency = String(currency).trim();
    if (active !== undefined) plan.active = !!active;
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Amount must be a positive number.' });
      plan.amount = amt;
    }
    if (days !== undefined) {
      const d = parseInt(days, 10);
      if (!Number.isFinite(d) || d <= 0) return res.status(400).json({ message: 'Days must be a positive number.' });
      plan.days = d;
    }
    if (sort_order !== undefined && Number.isFinite(Number(sort_order))) plan.sort_order = Number(sort_order);

    await plan.save();
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    res.json({ message: `"${plan.name}" plan deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Manual payment review (super admin only) ─────────────────────────────
// The school-facing half of this lives in billingController.submitManualPayment
// — this is where a super admin, after manually checking their own MoMo
// wallet, confirms or rejects each claim.

// GET /api/system/billing/manual-payments?status=PENDING
const listManualPayments = async (req, res) => {
  try {
    const filter = { method: 'manual' };
    if (req.query.status) filter.status = req.query.status;

    const payments = await Payment.find(filter)
      .sort({ created_at: -1 })
      .limit(200)
      .populate('admin_id', 'name email phone')
      .populate('reviewed_by', 'name')
      .lean();

    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/system/billing/manual-payments/pending-count — cheap polling
// endpoint for the sidebar badge / notification toast.
const getPendingManualPaymentsCount = async (req, res) => {
  try {
    const count = await Payment.countDocuments({ method: 'manual', status: 'PENDING' });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/system/billing/manual-payments/:paymentId/confirm — call this
// only after verifying the money actually landed in your own MoMo wallet.
const confirmManualPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.paymentId, method: 'manual' });
    if (!payment) return res.status(404).json({ message: 'Payment claim not found.' });
    if (payment.status !== 'PENDING') {
      return res.status(409).json({ message: `This claim was already ${payment.status.toLowerCase()}.` });
    }

    // Reuse the exact same billing-application logic the automated MTN
    // flow uses, so manual and API payments extend access identically.
    const { applySuccessfulPayment } = require('./billingController');
    const paidUntil = await applySuccessfulPayment(payment);

    payment.reviewed_by = req.user.id;
    payment.reviewed_at = new Date();
    await payment.save();

    res.json({ message: 'Payment confirmed. School access has been restored.', paid_until: paidUntil });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/system/billing/manual-payments/:paymentId/reject
const rejectManualPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findOne({ _id: req.params.paymentId, method: 'manual' });
    if (!payment) return res.status(404).json({ message: 'Payment claim not found.' });
    if (payment.status !== 'PENDING') {
      return res.status(409).json({ message: `This claim was already ${payment.status.toLowerCase()}.` });
    }

    payment.status = 'REJECTED';
    payment.review_note = (reason && String(reason).trim()) || null;
    payment.reviewed_by = req.user.id;
    payment.reviewed_at = new Date();
    await payment.save();

    res.json({ message: 'Payment claim rejected. The school remains locked out.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.listPlans = listPlans;
module.exports.createPlan = createPlan;
module.exports.updatePlan = updatePlan;
module.exports.deletePlan = deletePlan;
module.exports.listManualPayments = listManualPayments;
module.exports.getPendingManualPaymentsCount = getPendingManualPaymentsCount;
module.exports.confirmManualPayment = confirmManualPayment;
module.exports.rejectManualPayment = rejectManualPayment;