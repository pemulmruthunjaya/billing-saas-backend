const express = require("express");

const router = express.Router();

/**
 * AUTH MIDDLEWARE
 */
const authMiddleware = require(
  "../middleware/authMiddleware"
);

/**
 * CONTROLLER
 */
const {
  getTrialBalance
} = require(
  "../controllers/trialBalanceController"
);



/**
 * =========================================================
 * TRIAL BALANCE
 * =========================================================
 */

router.get(
  "/",
  authMiddleware,
  getTrialBalance
);



module.exports = router;