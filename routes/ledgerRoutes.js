const express = require("express");

const router = express.Router();

/**
 * AUTH MIDDLEWARE
 */
const authMiddleware = require(
  "../middleware/authMiddleware"
);

/**
 * CONTROLLERS
 */
const {
  getVendorLedger,
  getAccountLedger
} = require(
  "../controllers/ledgerController"
);



/**
 * =========================================================
 * VENDOR LEDGER
 * =========================================================
 */
router.get(
  "/vendor/:vendor_id",
  authMiddleware,
  getVendorLedger
);



/**
 * =========================================================
 * ACCOUNT LEDGER
 * =========================================================
 */
router.get(
  "/account/:account_id",
  authMiddleware,
  getAccountLedger
);



module.exports = router;