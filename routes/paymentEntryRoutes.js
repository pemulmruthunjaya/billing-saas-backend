const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

/**
 * =========================================================
 * CONTROLLER
 * =========================================================
 */

const {
    createPaymentEntry,
    getPaymentEntryById
} = require(
    "../controllers/paymentEntryController"
);

/**
 * =========================================================
 * PAYMENT ENTRY
 * =========================================================
 */

router.post(
    "/",
    authMiddleware,
    createPaymentEntry
);

router.get(
    "/:id",
    authMiddleware,
    getPaymentEntryById
);

module.exports = router;
