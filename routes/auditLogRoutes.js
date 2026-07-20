const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getAuditLogs } = require("../controllers/auditLogController");

router.get("/", authMiddleware, roleMiddleware(["owner"]), getAuditLogs);

module.exports = router;
