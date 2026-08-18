const express = require('express');
const router = express.Router();
const { isAuthenticated, isSuperAdmin } = require('../middleware/auth');
const {
  getStatus, updateMaintenance, impersonate,
  listSchoolsBilling, lockSchool, unlockSchool, extendSchool,
  listPlans, createPlan, updatePlan, deletePlan,
  listManualPayments, getPendingManualPaymentsCount, confirmManualPayment, rejectManualPayment,
} = require('../controllers/systemController');

// Public — no auth required. The frontend polls this to know whether to
// show the maintenance screen, even before it knows who's logged in.
router.get('/status', getStatus);

// Super admin only — turn maintenance mode on/off, set the message shown
// to everyone else, and (optionally) an estimated "back online" time.
router.put('/maintenance', isAuthenticated, isSuperAdmin, updateMaintenance);

// Super admin only — generate a short-lived (2h) impersonation token for
// any non-super-admin user. Use this during maintenance to log in as that
// user and verify bug fixes without disabling maintenance for everyone.
router.post('/impersonate/:userId', isAuthenticated, isSuperAdmin, impersonate);

// Super admin only — Schools & Billing oversight.
router.get('/billing/schools', isAuthenticated, isSuperAdmin, listSchoolsBilling);
router.post('/billing/schools/:adminId/lock', isAuthenticated, isSuperAdmin, lockSchool);
router.post('/billing/schools/:adminId/unlock', isAuthenticated, isSuperAdmin, unlockSchool);
router.post('/billing/schools/:adminId/extend', isAuthenticated, isSuperAdmin, extendSchool);

// Super admin only — subscription plan tiers for the manual payment flow.
router.get('/billing/plans', isAuthenticated, isSuperAdmin, listPlans);
router.post('/billing/plans', isAuthenticated, isSuperAdmin, createPlan);
router.put('/billing/plans/:planId', isAuthenticated, isSuperAdmin, updatePlan);
router.delete('/billing/plans/:planId', isAuthenticated, isSuperAdmin, deletePlan);

// Super admin only — review manual payment claims.
router.get('/billing/manual-payments', isAuthenticated, isSuperAdmin, listManualPayments);
router.get('/billing/manual-payments/pending-count', isAuthenticated, isSuperAdmin, getPendingManualPaymentsCount);
router.post('/billing/manual-payments/:paymentId/confirm', isAuthenticated, isSuperAdmin, confirmManualPayment);
router.post('/billing/manual-payments/:paymentId/reject', isAuthenticated, isSuperAdmin, rejectManualPayment);

module.exports = router;