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
  getCashBook
} = require(
  "../controllers/cashBookController"
);

/**
 * =========================================================
 * CASH BOOK
 * =========================================================
 */

router.get(
  "/",
  authMiddleware,
  getCashBook
);

module.exports = router;