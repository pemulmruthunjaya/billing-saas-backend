const db = require("../db/connection");

/**
 * GET BUSINESS PROFILE
 */
exports.getBusinessProfile = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const [rows] = await db.query(
      "SELECT * FROM business_profiles WHERE company_id = ? LIMIT 1",
      [company_id]
    );

    res.json(rows[0] || {});
  } catch (error) {
    console.error("Get business profile error:", error);
    res.status(500).json({
      message: "Failed to fetch business profile",
      error: error.message
    });
  }
};

/**
 * CREATE OR UPDATE BUSINESS PROFILE
 */
exports.saveBusinessProfile = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const {
      name,
      gstin,
      address,
      phone,
      email,
      logo
    } = req.body;

    // Check if profile exists
    const [existing] = await db.query(
      "SELECT id FROM business_profiles WHERE company_id = ?",
      [company_id]
    );

    if (existing.length > 0) {
      // UPDATE
      await db.query(
        `UPDATE business_profiles 
         SET name=?, gstin=?, address=?, phone=?, email=?, logo=?
         WHERE company_id=?`,
        [name, gstin, address, phone, email, logo || null, company_id]
      );
    } else {
      // INSERT
      await db.query(
        `INSERT INTO business_profiles 
        (company_id, name, gstin, address, phone, email, logo)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [company_id, name, gstin, address, phone, email, logo || null]
      );
    }

    res.json({
      message: "Business profile saved successfully"
    });

  } catch (error) {
    console.error("Save business profile error:", error);
    res.status(500).json({
      message: "Failed to save business profile",
      error: error.message
    });
  }
};