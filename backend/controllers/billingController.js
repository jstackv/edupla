const crypto = require("crypto");
const { User, Payment } = require("../models/db");
const { getOrInitBilling, invalidateBillingCache } = require("../middleware/billing");
const momoService = require("../services/momoService");

// Single source of truth for what a subscription costs and how long it
// lasts. Sandbox only accepts EUR, so SUBSCRIPTION_AMOUNT/MOMO_CURRENCY
// should be small test values until you switch MOMO_ENV to production —
// at which point set MOMO_CURRENCY=RWF (or your country's currency) and a
// real price here.
function getPlan() {
  return {
    amount: process.env.SUBSCRIPTION_AMOUNT || "1",
    currency: process.env.MOMO_CURRENCY || "EUR",
    days: parseInt(process.env.SUBSCRIPTION_PLAN_DAYS || "30", 10),
  };
}

async function resolveOwnerId(user) {
  if (user.role === "admin") return user.id;
  const doc = await User.findById(user.id).select("created_by").lean();
  return doc?.created_by ? String(doc.created_by) : null;
}

// GET /api/billing/status
const getStatus = async (req, res) => {
  try {
    const ownerId = await resolveOwnerId(req.user);
    if (!ownerId) {
      return res.status(404).json({ message: "No school/admin association found for this account." });
    }

    const billing = await getOrInitBilling(ownerId);
    const owner = await User.findById(ownerId).select("name phone").lean();
    const now = Date.now();
    const paidUntil = billing?.paid_until ? new Date(billing.paid_until) : null;
    const trialEndsAt = billing?.trial_ends_at ? new Date(billing.trial_ends_at) : null;

    const isActive = paidUntil && paidUntil.getTime() > now;
    const isTrialing = !isActive && trialEndsAt && trialEndsAt.getTime() > now;
    const isLocked = billing?.locked === true;
    const status = isLocked ? "locked" : isActive ? "active" : isTrialing ? "trialing" : "overdue";

    const relevantDate = isActive ? paidUntil : trialEndsAt;
    const daysRemaining = relevantDate
      ? Math.max(0, Math.ceil((relevantDate.getTime() - now) / (24 * 60 * 60 * 1000)))
      : 0;

    const plan = getPlan();
    res.json({
      status,
      is_payer: req.user.role === "admin",
      trial_ends_at: trialEndsAt,
      paid_until: paidUntil,
      days_remaining: daysRemaining,
      locked_reason: isLocked ? billing.locked_reason : null,
      locked_payable: isLocked ? billing.locked_payable === true : false,
      school_admin_name: owner?.name || null,
      default_phone: req.user.role === "admin" ? owner?.phone || null : null,
      plan,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/billing/pay  — admin (payer) only
const initiatePayment = async (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: "A phone number is required to receive the payment prompt." });
    }

    const plan = getPlan();

    // Amount is editable (useful for sandbox testing and one-off amounts);
    // plan_days stays fixed — Edupla doesn't yet prorate access by amount
    // paid, so any amount buys the same SUBSCRIPTION_PLAN_DAYS block.
    let chargeAmount = plan.amount;
    if (amount !== undefined && amount !== null && String(amount).trim() !== "") {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number." });
      }
      chargeAmount = String(parsed);
    }

    const referenceId = crypto.randomUUID();
    const externalId = `EDUPLA-${req.user.id}-${Date.now()}`;

    const owner = await User.findById(req.user.id).select("billing").lean();
    if (owner?.billing?.locked === true && owner.billing.locked_payable !== true) {
      return res.status(403).json({
        message: "Your school's access has been locked by Edupla administrators. Payment won't restore access — please contact support.",
        code: "ACCOUNT_LOCKED",
      });
    }
    const paidUntilBefore = owner?.billing?.paid_until || null;

    await momoService.requestToPay({
      amount: chargeAmount,
      currency: plan.currency,
      phone,
      externalId,
      referenceId,
      payerMessage: "Edupla subscription payment",
      payeeNote: `Edupla subscription - ${plan.days} days`,
    });

    await Payment.create({
      admin_id: req.user.id,
      reference_id: referenceId,
      external_id: externalId,
      amount: chargeAmount,
      currency: plan.currency,
      phone,
      plan_days: plan.days,
      status: "PENDING",
      paid_until_before: paidUntilBefore,
    });

    res.status(202).json({
      message: "Payment request sent. Approve it on your phone, then check status.",
      reference_id: referenceId,
    });
  } catch (err) {
    if (err.code === "MOMO_NOT_CONFIGURED") {
      return res.status(503).json({ message: err.message, code: err.code });
    }
    res.status(500).json({ message: err.message });
  }
};

// Shared: apply a confirmed successful payment to the admin's billing state.
async function applySuccessfulPayment(payment) {
  const owner = await User.findById(payment.admin_id).select("billing").lean();
  const now = new Date();
  const currentPaidUntil = owner?.billing?.paid_until ? new Date(owner.billing.paid_until) : null;
  const base = currentPaidUntil && currentPaidUntil.getTime() > now.getTime() ? currentPaidUntil : now;
  const paidUntilAfter = new Date(base.getTime() + payment.plan_days * 24 * 60 * 60 * 1000);

  const wasPayableLock = owner?.billing?.locked === true && owner.billing.locked_payable === true;

  const update = { "billing.status": "active", "billing.paid_until": paidUntilAfter };
  if (wasPayableLock) {
    // Paying off a payable lock lifts it entirely — same as a super admin
    // unlock, just triggered by the payment instead.
    update["billing.locked"] = false;
    update["billing.locked_payable"] = false;
    update["billing.locked_reason"] = null;
    update["billing.locked_at"] = null;
    update["billing.locked_by"] = null;
  }

  await User.findByIdAndUpdate(payment.admin_id, { $set: update });
  invalidateBillingCache(String(payment.admin_id));

  payment.status = "SUCCESSFUL";
  payment.paid_until_after = paidUntilAfter;
  await payment.save();

  return paidUntilAfter;
}

// GET /api/billing/pay/:referenceId/status — admin (payer) only
const checkPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      reference_id: req.params.referenceId,
      admin_id: req.user.id,
    });
    if (!payment) return res.status(404).json({ message: "Payment not found." });

    // Already resolved — no need to hit MTN again.
    if (payment.status !== "PENDING") {
      return res.json({ status: payment.status, paid_until: payment.paid_until_after });
    }

    const momoResult = await momoService.getRequestToPayStatus(payment.reference_id);
    payment.momo_status_raw = momoResult;

    if (momoResult.status === "SUCCESSFUL") {
      const paidUntil = await applySuccessfulPayment(payment);
      return res.json({ status: "SUCCESSFUL", paid_until: paidUntil });
    }

    if (momoResult.status === "FAILED") {
      payment.status = "FAILED";
      payment.failure_reason = momoResult.reason?.message || momoResult.reason || "Payment failed";
      await payment.save();
      return res.json({ status: "FAILED", reason: payment.failure_reason });
    }

    await payment.save();
    return res.json({ status: "PENDING" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/billing/momo/callback — public. MTN calls this when a payment
// resolves, IF MOMO_CALLBACK_HOST is a real, publicly reachable HTTPS host
// at go-live. In local development this endpoint is unreachable from MTN,
// so client-side polling (checkPaymentStatus above) is the primary path —
// this is a defense-in-depth backstop for production.
const momoWebhook = async (req, res) => {
  try {
    const referenceId = req.body?.referenceId || req.params?.referenceId;
    if (!referenceId) return res.status(400).end();

    const payment = await Payment.findOne({ reference_id: referenceId });
    if (!payment || payment.status !== "PENDING") return res.status(200).end();

    const momoResult = await momoService.getRequestToPayStatus(referenceId);
    payment.momo_status_raw = momoResult;

    if (momoResult.status === "SUCCESSFUL") {
      await applySuccessfulPayment(payment);
    } else if (momoResult.status === "FAILED") {
      payment.status = "FAILED";
      payment.failure_reason = momoResult.reason?.message || momoResult.reason || "Payment failed";
      await payment.save();
    }

    res.status(200).end();
  } catch (err) {
    console.error("momoWebhook error:", err.message);
    res.status(200).end(); // always 200 so MTN doesn't retry-storm us
  }
};

// GET /api/billing/history — admin (payer) only
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ admin_id: req.user.id }).sort({ created_at: -1 }).limit(50).lean();
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStatus, initiatePayment, checkPaymentStatus, momoWebhook, getPaymentHistory };