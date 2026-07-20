const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  createCustomer,
  getCustomers,
  deleteCustomer
} = require("../controllers/customerController");

router.post("/", authMiddleware, createCustomer);
router.get("/", authMiddleware, getCustomers);
router.delete("/:id", authMiddleware, deleteCustomer);

module.exports = router;