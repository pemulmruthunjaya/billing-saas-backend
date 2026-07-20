const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
    createJournalEntry,
    getAllJournalEntries,
    getSingleJournalEntry,
    deleteJournalEntry
} = require("../controllers/journalEntryController");

/**
 * ROUTES
 */

router.post("/", authMiddleware, createJournalEntry);

router.get("/", authMiddleware, getAllJournalEntries);

router.get("/:id", authMiddleware, getSingleJournalEntry);

router.delete("/:id", authMiddleware, deleteJournalEntry);

module.exports = router;
