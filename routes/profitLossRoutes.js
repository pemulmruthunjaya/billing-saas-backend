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
  getProfitLoss
} = require(
  "../controllers/profitLossController"
);



/**
 * =========================================================
 * PROFIT & LOSS REPORT
 * =========================================================
 */

router.get(
  "/",
  authMiddleware,
  getProfitLoss
);



module.exports = router;