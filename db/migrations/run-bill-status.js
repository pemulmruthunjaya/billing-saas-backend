require("dotenv").config();
const db = require("../connection");

const run = async () => {
  await db.query(
    "ALTER TABLE bills MODIFY status VARCHAR(30) NOT NULL DEFAULT 'Unpaid'"
  );
  console.log("Bill status column ready for Unpaid, Partial Paid, and Paid");
  await db.end();
};

run().catch(async (error) => {
  console.error("Bill status migration failed:", error.message);
  await db.end();
  process.exit(1);
});
