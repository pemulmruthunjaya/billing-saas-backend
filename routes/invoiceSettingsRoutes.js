const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getInvoiceSettings,
  updateInvoiceSettings,
} = require("../controllers/invoiceSettingsController");

router.get("/", authMiddleware, getInvoiceSettings);
router.put("/", authMiddleware, updateInvoiceSettings);

module.exports = router;
