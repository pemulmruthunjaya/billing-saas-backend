const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

/**
 * =========================================================
 * CONTROLLER
 * =========================================================
 */

const {
    createReceiptEntry,
    getReceiptEntryById,
    getReceiptOptions,
    getCustomerInvoices
} = require(
    "../controllers/receiptEntryController"
);

/**
 * =========================================================
 * RECEIPT ENTRY
 * =========================================================
 */

router.post(
    "/",
    authMiddleware,
    createReceiptEntry
);

router.get(
    "/options",
    authMiddleware,
    getReceiptOptions
);

router.get(
    "/customers/:customerId/invoices",
    authMiddleware,
    getCustomerInvoices
);

router.get(
    "/:id",
    authMiddleware,
    getReceiptEntryById
);

module.exports = router;
