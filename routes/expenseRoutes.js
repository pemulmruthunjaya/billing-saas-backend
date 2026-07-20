const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createExpense,
  getExpenses,
  getExpenseById,
  deleteExpense
} = require("../controllers/expenseController");

router.post("/", authMiddleware, createExpense);
router.get("/", authMiddleware, getExpenses);
router.get("/:id", authMiddleware, getExpenseById);
router.delete("/:id", authMiddleware, deleteExpense);

module.exports = router;