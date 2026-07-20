const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createVendorPayment,
  getVendorPayments
} = require("../controllers/vendorPaymentController");

router.post("/", authMiddleware, createVendorPayment);

router.get("/", authMiddleware, getVendorPayments);

module.exports = router;