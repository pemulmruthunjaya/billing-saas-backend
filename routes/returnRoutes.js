const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  createReturn,
  deleteReturn,
  getReturnById,
  getReturns,
} = require("../controllers/returnController");

router.get("/", authMiddleware, getReturns);
router.post("/", authMiddleware, createReturn);
router.get("/:id", authMiddleware, getReturnById);
router.delete("/:id", authMiddleware, deleteReturn);

module.exports = router;
