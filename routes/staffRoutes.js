const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  getStaffList,
  createStaff,
  deleteStaff,
  updateStaffAccessRole,
  updateStaffPermissions,
  updateStaffStatus,
} = require("../controllers/staffController");

// OWNER only — list staff
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["owner"]),
  getStaffList
);

// OWNER only — create staff
router.post(
  "/create",
  authMiddleware,
  roleMiddleware(["owner"]),
  createStaff
);

router.put(
  "/:id/access-role",
  authMiddleware,
  roleMiddleware(["owner"]),
  updateStaffAccessRole
);

router.put(
  "/:id/permissions",
  authMiddleware,
  roleMiddleware(["owner"]),
  updateStaffPermissions
);

router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["owner"]),
  updateStaffStatus
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["owner"]),
  deleteStaff
);

module.exports = router;
