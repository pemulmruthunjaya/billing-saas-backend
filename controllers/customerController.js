const db = require("../db/connection");

/**
 * CREATE CUSTOMER
 */
exports.createCustomer = async (req, res) => {
  try {
    if (!req.user || !req.user.company_id) {
      return res.status(401).json({
        message: "Invalid token or company not found in token"
      });
    }

    const { name, email, phone, address } = req.body;
    const company_id = req.user.company_id;

    if (!name) {
      return res.status(400).json({
        message: "Customer name is required"
      });
    }

    const [result] = await db.query(
      `INSERT INTO customers (name, email, phone, address, company_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        email || null,
        phone || null,
        address || null,
        company_id
      ]
    );

    res.status(201).json({
      message: "Customer created successfully",
      customer_id: result.insertId
    });

  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({
      message: "Failed to create customer",
      error: error.message
    });
  }
};

/**
 * GET ALL CUSTOMERS
 */
exports.getCustomers = async (req, res) => {
  try {
    if (!req.user || !req.user.company_id) {
      return res.status(401).json({
        message: "Invalid token"
      });
    }

    const company_id = req.user.company_id;

    const [customers] = await db.query(
      `SELECT * FROM customers 
       WHERE company_id = ? 
       ORDER BY id DESC`,
      [company_id]
    );

    res.json(customers);

  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({
      message: "Failed to fetch customers",
      error: error.message
    });
  }
};

/**
 * DELETE CUSTOMER
 */
exports.deleteCustomer = async (req, res) => {
  try {
    if (!req.user || !req.user.company_id) {
      return res.status(401).json({
        message: "Invalid token"
      });
    }

    const { id } = req.params;
    const company_id = req.user.company_id;

    const [result] = await db.query(
      `DELETE FROM customers 
       WHERE id = ? AND company_id = ?`,
      [id, company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    res.json({
      message: "Customer deleted successfully"
    });

  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({
      message: "Failed to delete customer",
      error: error.message
    });
  }
};
