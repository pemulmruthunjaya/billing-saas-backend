const express = require("express");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

/* ===============================
   DB CONNECTION
================================ */
async function getDBConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

/* ===============================
   AUTH MIDDLEWARE
================================ */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    req.user = user;
    next();
  });
}

/* ===============================
   ROOT
================================ */
app.get("/", (req, res) => {
  res.json({ message: "Billing SaaS Backend is running 🚀" });
});

/* ===============================
   DB CHECK
================================ */
app.get("/db-check", async (req, res) => {
  try {
    const conn = await getDBConnection();
    await conn.execute("SELECT 1");
    await conn.end();
    res.json({ database: "CONNECTED ✅" });
  } catch (error) {
    res.status(500).json({
      database: "NOT CONNECTED ❌",
      error: error.message,
    });
  }
});

/* ===============================
   LOGIN
================================ */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const conn = await getDBConnection();

    // Validate credentials
    const [authRows] = await conn.execute(
      "SELECT id FROM auth_users WHERE email = ? AND password = ?",
      [email, password]
    );

    if (authRows.length === 0) {
      await conn.end();
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Fetch user profile
    const [userRows] = await conn.execute(
      "SELECT id, role, company_id FROM users WHERE email = ?",
      [email]
    );

    await conn.end();

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User profile not found" });
    }

    const user = userRows[0];

    const token = jwt.sign(
      {
        user_id: user.id,
        role: user.role,
        company_id: user.company_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email,
        role: user.role,
        company_id: user.company_id,
      },
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   CREATE INVOICE
================================ */
app.post("/api/invoices", authenticateToken, async (req, res) => {
  const conn = await getDBConnection();

  try {
    const {
      invoice_number,
      invoice_date,
      due_date,
      customer_name,
      customer_email,
      customer_phone,
      notes,
      tax_rate,
      items
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Invoice must contain items" });
    }

    await conn.beginTransaction();

    let subtotal = 0;

    items.forEach(item => {
      subtotal += Number(item.quantity) * Number(item.unit_price);
    });

    const taxAmount = (subtotal * Number(tax_rate || 0)) / 100;
    const totalAmount = subtotal + taxAmount;

    const [invoiceResult] = await conn.execute(
      `INSERT INTO invoices 
      (company_id, created_by, invoice_number, invoice_date, due_date,
       customer_name, customer_email, customer_phone,
       subtotal, tax_amount, total_amount, tax_rate, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        req.user.user_id,
        invoice_number,
        invoice_date,
        due_date,
        customer_name,
        customer_email,
        customer_phone,
        subtotal,
        taxAmount,
        totalAmount,
        tax_rate,
        notes
      ]
    );

    const invoiceId = invoiceResult.insertId;

    for (const item of items) {
      const total_price = Number(item.quantity) * Number(item.unit_price);

      await conn.execute(
        `INSERT INTO invoice_items
        (invoice_id, company_id, item_name, description, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          req.user.company_id,
          item.item_name,
          item.description,
          item.quantity,
          item.unit_price,
          total_price
        ]
      );
    }

    await conn.commit();
    await conn.end();

    res.status(201).json({
      message: "Invoice created successfully 🎉",
      invoice_id: invoiceId,
      subtotal,
      taxAmount,
      totalAmount
    });

  } catch (error) {
    await conn.rollback();
    await conn.end();
    res.status(500).json({
      message: "Invoice creation failed",
      error: error.message
    });
  }
});

/* ===============================
   GET INVOICES (PAGINATED)
================================ */
app.get("/api/invoices", authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const conn = await getDBConnection();

    let baseQuery = `FROM invoices WHERE company_id = ?`;
    let params = [companyId];

    if (search) {
      baseQuery += ` AND (invoice_number LIKE ? OR customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) as total ${baseQuery}`,
      params
    );

    const total = countRows[0].total;

    const [rows] = await conn.execute(
      `SELECT id, invoice_number, invoice_date,
              customer_name, subtotal, tax_amount,
              total_amount, status
       ${baseQuery}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    await conn.end();

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: rows,
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

/* ===============================
   GET SINGLE INVOICE
================================ */
app.get("/api/invoices/:id", authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const invoiceId = req.params.id;

    const conn = await getDBConnection();

    const [invoiceRows] = await conn.execute(
      `SELECT * FROM invoices
       WHERE id = ? AND company_id = ?`,
      [invoiceId, companyId]
    );

    if (invoiceRows.length === 0) {
      await conn.end();
      return res.status(404).json({ message: "Invoice not found" });
    }

    const [items] = await conn.execute(
      `SELECT * FROM invoice_items
       WHERE invoice_id = ? AND company_id = ?`,
      [invoiceId, companyId]
    );

    await conn.end();

    res.json({
      invoice: invoiceRows[0],
      items,
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
});

/* ===============================
   START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
