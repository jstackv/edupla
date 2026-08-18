const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const {
  getStatus,
  initiatePayment,
  checkPaymentStatus,
  momoWebhook,
  getPaymentHistory,
} = require("../controllers/billingController");

// Any authenticated user (admin/teacher/student) can read their school's
// billing status — teachers/students need it to know why they're blocked.
router.get("/status", isAuthenticated, getStatus);

// Only the school admin can actually pay.
router.post("/pay", isAuthenticated, isAdmin, initiatePayment);
router.get("/pay/:referenceId/status", isAuthenticated, isAdmin, checkPaymentStatus);
router.get("/history", isAuthenticated, isAdmin, getPaymentHistory);

// Public — MTN calls this directly, no user session involved.
router.post("/momo/callback", momoWebhook);

module.exports = router;
