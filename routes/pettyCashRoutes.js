const express = require("express");
const controller = require("../controllers/pettyCashController");
const upload = require("../middleware/pettyCashUpload");
const { requirePermission } = require("../services/pettyCashService");

const router = express.Router();

router.get("/permissions", controller.getPermissions);
router.get("/dashboard", controller.getDashboard);
router.get("/transactions", controller.listTransactions);
router.get("/reports", controller.getReports);
router.get("/settings", controller.getSettings);
router.put("/settings", requirePermission("post"), controller.updateSettings);
router.get("/permissions/users", requirePermission("view_all"), controller.listUserPermissions);
router.put("/permissions/users/:userId", requirePermission("post"), controller.updateUserPermissions);
router.post(
  "/transactions",
  requirePermission("create"),
  upload.array("attachments", 5),
  controller.createTransaction
);
router.get("/transactions/:id", controller.getTransaction);
router.put(
  "/transactions/:id",
  requirePermission("edit_own"),
  upload.array("attachments", 5),
  controller.updateTransaction
);
router.post("/transactions/:id/submit", requirePermission("submit"), controller.submitTransaction);
router.post("/transactions/:id/manager-approve", requirePermission("approve"), controller.managerApprove);
router.post("/transactions/:id/accounts-approve", requirePermission("approve"), controller.accountsApprove);
router.post("/transactions/:id/reject", requirePermission("reject"), controller.rejectTransaction);
router.post("/transactions/:id/post", requirePermission("post"), controller.postTransaction);
router.get("/attachments/:id", controller.getAttachment);
router.delete("/attachments/:id", requirePermission("edit_own"), controller.deleteAttachment);

module.exports = router;
