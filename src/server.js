const express = require("express");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 10000;

/* ===============================
   MIDDLEWARE
================================ */
app.use(express.json());

/* ===============================
   ROOT & HEALTH
================================ */
app.get("/", (req, res) => {
  res.json({ message: "Billing SaaS Backend is running 🚀" });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ===============================
   DB HELPER
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
   AUTH MIDDLEWARE (NEW)
================================ */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      message: "Access token required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Invalid token format",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Invalid or expired token",
      });
    }

    req.user = user;
    next();
  });
}

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
    console.error("DB CHECK ERROR:", error);
    res.status(500).json({
      database: "NOT CONNECTED ❌",
      error: error.message,
    });
  }
});

/* ===============================
   AUTH LOGIN
================================ */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const conn = await getDBConnection();

    // Validate credentials
    const [authRows] = await conn.execute(
      "SELECT id, email FROM auth_users WHERE email = ? AND password = ?",
      [email, password]
    );

    if (authRows.length === 0) {
      await conn.end();
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Fetch user profile
    const [userRows] = await conn.execute(
      "SELECT id, role, company_id FROM users WHERE email = ?",
      [email]
    );

    await conn.end();

    if (userRows.length === 0) {
      return res.status(404).json({
        message: "User profile not found",
      });
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
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   PROTECTED TEST ROUTE
================================ */
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({
    message: "Protected route accessed successfully 🎉",
    user: req.user,
  });
});

/* ===============================
   SECURE INVOICE LIST (NEW)
   Multi-tenant company isolation
================================ */
app.get("/api/invoices", authenticateToken, async (req, res) => {
  try {
    const conn = await getDBConnection();

    const [rows] = await conn.execute(
      "SELECT * FROM invoices WHERE company_id = ?",
      [req.user.company_id]
    );

    await conn.end();

    res.json(rows);
  } catch (error) {
    console.error("INVOICE FETCH ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
