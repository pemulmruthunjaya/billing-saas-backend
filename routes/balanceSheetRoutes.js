const express = require("express");

const router = express.Router();

/**
 * =========================================================
 * AUTH MIDDLEWARE
 * =========================================================
 */

const authMiddleware = require(
  "../middleware/authMiddleware"
);

/**
 * =========================================================
 * CONTROLLER
 * =========================================================
 */

const {
  getBalanceSheet
} = require(
  "../controllers/balanceSheetController"
);

/**
 * =========================================================
 * BALANCE SHEET REPORT
 * =========================================================
 */

router.get(
  "/",
  authMiddleware,
  getBalanceSheet
);

module.exports = router;