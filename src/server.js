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

    const [users] = await conn.execute(
      `SELECT id, email, role, company_id
       FROM users
       WHERE email = ? AND password = ?`,
      [email, password]
    );

    await conn.end();

    if (users.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = users[0];

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
        email: user.email,
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
   START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
