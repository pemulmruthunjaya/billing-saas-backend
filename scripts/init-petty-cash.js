require("dotenv").config();
const db = require("../db/connection");
const { ensurePettyCashSchema } = require("../services/pettyCashService");

(async () => {
  try {
    await ensurePettyCashSchema();
    console.log("Petty Cash schema is ready.");
    process.exitCode = 0;
  } catch (error) {
    console.error("Unable to initialize Petty Cash schema:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
