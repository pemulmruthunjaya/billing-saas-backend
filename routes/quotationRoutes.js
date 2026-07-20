const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  convertQuotationToInvoice,
  createQuotation,
  deleteQuotation,
  getQuotationById,
  getQuotations,
  updateQuotation,
  updateQuotationStatus,
} = require("../controllers/quotationController");

router.post("/", authMiddleware, createQuotation);
router.get("/", authMiddleware, getQuotations);
router.get("/:id", authMiddleware, getQuotationById);
router.put("/:id", authMiddleware, updateQuotation);
router.put("/:id/status", authMiddleware, updateQuotationStatus);
router.post("/:id/convert-to-invoice", authMiddleware, convertQuotationToInvoice);
router.delete("/:id", authMiddleware, deleteQuotation);

module.exports = router;
