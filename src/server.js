const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({
    message: "Billing SaaS Backend is running 🚀"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "billing-saas-backend",
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
