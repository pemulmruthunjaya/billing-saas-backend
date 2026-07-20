const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  addPayment,
  getPaymentsByInvoice
} = require("../controllers/paymentController");

/**
 * 🔐 ADD PAYMENT
 */
router.post(
  "/:invoiceId/payments",
  authMiddleware,
  addPayment
);

/**
 * 🔐 LIST PAYMENTS
 */
router.get(
  "/:invoiceId/payments",
  authMiddleware,
  getPaymentsByInvoice
);

module.exports = router;
