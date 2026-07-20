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
  getBankBook
} = require(
  "../controllers/bankBookController"
);

/**
 * =========================================================
 * BANK BOOK
 * =========================================================
 */

router.get(
  "/",
  authMiddleware,
  getBankBook
);

module.exports = router;