require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../db/connection");

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

const sanitizeFilePart = (value) =>
  String(value || "")
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const getTableNames = async () => {
  const [rows] = await db.query("SHOW TABLES");
  return rows.map((row) => Object.values(row)[0]).filter(Boolean);
};

const getColumns = async (tableName) => {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((row) => row.Field);
};

const getDefaultCompanyId = async () => {
  const [rows] = await db.query(
    "SELECT company_id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1"
  );
  return rows[0]?.company_id || null;
};

const exportTable = async ({ tableName, columns, companyId }) => {
  if (columns.includes("company_id")) {
    const selectColumns = columns
      .filter((column) => !(tableName === "users" && column === "password"))
      .map((column) => `\`${column}\``)
      .join(", ");

    const [rows] = await db.query(
      `SELECT ${selectColumns} FROM \`${tableName}\` WHERE company_id = ?`,
      [companyId]
    );

    return rows;
  }

  if (tableName === "companies" && columns.includes("id")) {
    const [rows] = await db.query(
      `SELECT * FROM \`${tableName}\` WHERE id = ?`,
      [companyId]
    );
    return rows;
  }

  return null;
};

const main = async () => {
  const companyId = Number(
    getArg("company-id") || process.env.BACKUP_COMPANY_ID || (await getDefaultCompanyId())
  );

  if (!companyId) {
    throw new Error("No company found. Pass --company-id=YOUR_COMPANY_ID.");
  }

  const outputDir = path.resolve(
    getArg("out") || process.env.BACKUP_DIR || path.join(__dirname, "..", "backups")
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const tables = await getTableNames();
  const exported = {};
  const skipped = [];

  for (const tableName of tables) {
    const columns = await getColumns(tableName);
    const rows = await exportTable({ tableName, columns, companyId });

    if (rows === null) {
      skipped.push(tableName);
      continue;
    }

    exported[tableName] = rows;
  }

  const checkedAt = new Date().toISOString();
  const fileName = `company-${companyId}-backup-${sanitizeFilePart(checkedAt)}.json`;
  const filePath = path.join(outputDir, fileName);

  const payload = {
    type: "billing-saas-company-backup",
    checkedAt,
    companyId,
    note: "Password hashes are intentionally excluded from user rows.",
    tables: exported,
    skippedTables: skipped,
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

  console.log("Company backup created:");
  console.log(filePath);
  console.log(
    JSON.stringify(
      {
        companyId,
        exportedTables: Object.keys(exported).length,
        skippedTables: skipped.length,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error("Backup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
