const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  addInvoiceItem,
  updateInvoiceItem,
  deleteInvoiceItem,
  getInvoiceItems
} = require("../controllers/invoiceItemController");

/**
 * 🔐 ADD invoice item
 * POST /invoices/:invoiceId/items
 */
router.post(
  "/:invoiceId/items",
  authMiddleware,
  roleMiddleware(["owner", "staff"]),
  addInvoiceItem
);

/**
 * 🔐 LIST invoice items
 * GET /invoices/:invoiceId/items
 */
router.get(
  "/:invoiceId/items",
  authMiddleware,
  roleMiddleware(["owner", "staff"]),
  getInvoiceItems
);

/**
 * 🔐 UPDATE invoice item
 * PUT /invoices/:invoiceId/items/:itemId
 */
router.put(
  "/:invoiceId/items/:itemId",
  authMiddleware,
  roleMiddleware(["owner", "staff"]),
  updateInvoiceItem
);

/**
 * 🔐 DELETE invoice item
 * DELETE /invoices/:invoiceId/items/:itemId
 */
router.delete(
  "/:invoiceId/items/:itemId",
  authMiddleware,
  roleMiddleware(["owner", "staff"]),
  deleteInvoiceItem
);

module.exports = router;
