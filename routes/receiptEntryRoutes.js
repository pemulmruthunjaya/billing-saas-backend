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
    getReceiptEntryById
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
    "/:id",
    authMiddleware,
    getReceiptEntryById
);

module.exports = router;
