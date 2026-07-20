require("dotenv").config();

const db = require("../connection");

const TABLES = [
  "products",
  "vendors",
  "bills",
  "accounts",
  "journal_entries",
];

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );

  return Number(rows[0].count) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, indexName]
  );

  return Number(rows[0].count) > 0;
}

async function ensureCompanyColumn(table) {
  if (!(await columnExists(table, "company_id"))) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN company_id INT NULL`);
  }

  await db.query(`UPDATE ${table} SET company_id = 1 WHERE company_id IS NULL`);
  await db.query(`ALTER TABLE ${table} MODIFY company_id INT NOT NULL`);

  const indexName = `idx_${table}_company_id`;

  if (!(await indexExists(table, indexName))) {
    await db.query(`CREATE INDEX ${indexName} ON ${table}(company_id)`);
  }
}

(async () => {
  try {
    for (const table of TABLES) {
      await ensureCompanyColumn(table);
      console.log(`Company isolation ready for ${table}`);
    }
  } finally {
    await db.end();
  }
})();
