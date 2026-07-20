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
  getCustomerStatement
} = require(
  "../controllers/customerStatementController"
);

/**
 * =========================================================
 * CUSTOMER STATEMENT
 * =========================================================
 */

router.get(
  "/",
  authMiddleware,
  getCustomerStatement
);

module.exports = router;