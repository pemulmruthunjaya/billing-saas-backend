require("dotenv").config();
const db = require("../connection");

const run = async () => {
  await db.query(
    "ALTER TABLE invoices MODIFY status VARCHAR(30) NOT NULL DEFAULT 'pending'"
  );
  console.log("Invoice status column ready for pending, partial, and paid");
  await db.end();
};

run().catch(async (error) => {
  console.error("Invoice status migration failed:", error.message);
  await db.end();
  process.exit(1);
});
