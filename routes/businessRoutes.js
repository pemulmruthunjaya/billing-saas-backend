const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  saveBusinessProfile,
  getBusinessProfile,
} = require("../controllers/businessController");

/**
 * GET BUSINESS PROFILE
 */
router.get("/", authMiddleware, getBusinessProfile);

/**
 * CREATE / UPDATE BUSINESS PROFILE
 */
router.post("/", authMiddleware, saveBusinessProfile);

module.exports = router;