const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createBranch,
  createBusiness,
  getContext,
  saveBusinessProfile,
  getBusinessProfile,
  switchBranch,
  switchCompany,
  updateBranch,
} = require("../controllers/businessController");

/**
 * GET BUSINESS PROFILE
 */
router.get("/", authMiddleware, getBusinessProfile);

/**
 * CREATE / UPDATE BUSINESS PROFILE
 */
router.post("/", authMiddleware, saveBusinessProfile);

router.get("/context", authMiddleware, getContext);
router.post("/companies", authMiddleware, createBusiness);
router.post("/switch-company", authMiddleware, switchCompany);
router.post("/switch-branch", authMiddleware, switchBranch);
router.post("/branches", authMiddleware, createBranch);
router.put("/branches/:id", authMiddleware, updateBranch);

module.exports = router;
