const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 10000;

// Root check
app.get("/", (req, res) => {
  res.json({ message: "Billing SaaS Backend is running 🚀" });
});

// DB health check
app.get("/db-check", async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    await connection.execute("SELECT 1");
    await connection.end();

    res.json({
      database: "CONNECTED ✅",
      host: process.env.DB_HOST,
    });
  } catch (error) {
    console.error("DB ERROR:", error);

    res.status(500).json({
      database: "NOT CONNECTED ❌",
      error: error.message || String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
