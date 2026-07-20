const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
    createAccount,
    getAllAccounts,
    getSingleAccount,
    updateAccount,
    deleteAccount
} = require("../controllers/accountController");

/**
 * ROUTES
 */

router.post("/", authMiddleware, createAccount);

router.get("/", authMiddleware, getAllAccounts);

router.get("/:id", authMiddleware, getSingleAccount);

router.put("/:id", authMiddleware, updateAccount);

router.delete("/:id", authMiddleware, deleteAccount);

module.exports = router;
