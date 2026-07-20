const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
    createVendor,
    getVendors,
    getVendorById,
    updateVendor,
    deleteVendor
} = require("../controllers/vendorController");

router.post("/", authMiddleware, createVendor);
router.get("/", authMiddleware, getVendors);
router.get("/:id", authMiddleware, getVendorById);
router.put("/:id", authMiddleware, updateVendor);
router.delete("/:id", authMiddleware, deleteVendor);

module.exports = router;
