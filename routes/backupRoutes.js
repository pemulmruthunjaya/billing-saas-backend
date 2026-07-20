const express = require("express");
const router = express.Router();

const {
  exportCompanyBackup,
  exportModuleData,
  getDataHistory,
  importMasterData,
  importTransactions,
  previewRestoreBackup,
  rollbackImport,
} = require("../controllers/backupController");

router.get("/history", getDataHistory);
router.get("/export", exportCompanyBackup);
router.get("/export/:type", exportModuleData);
router.post("/restore/preview", previewRestoreBackup);
router.post("/import/:type", importMasterData);
router.post("/transactions/:type", importTransactions);
router.post("/rollback/:id", rollbackImport);

module.exports = router;
