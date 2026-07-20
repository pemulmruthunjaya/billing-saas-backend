const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const authMiddleware = require("../middleware/authMiddleware");

// GET SETTINGS
router.get("/", authMiddleware, async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM invoice_settings WHERE company_id=?",
    [req.user.company_id]
  );
  res.json(rows[0]);
});

// UPDATE SETTINGS
router.put("/", authMiddleware, async (req, res) => {
  const { prefix, current_number } = req.body;

  await db.query(
    "UPDATE invoice_settings SET prefix=?, current_number=? WHERE company_id=?",
    [prefix, current_number, req.user.company_id]
  );

  res.json({ message: "Settings updated" });
});

module.exports = router;
