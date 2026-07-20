const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  createChallan,
  deleteChallan,
  getChallanById,
  getChallans,
} = require("../controllers/deliveryChallanController");

router.get("/", authMiddleware, getChallans);
router.post("/", authMiddleware, createChallan);
router.get("/:id", authMiddleware, getChallanById);
router.delete("/:id", authMiddleware, deleteChallan);

module.exports = router;
