require("dotenv").config();

const db = require("../db/connection");
const { ensureAuditLogTable } = require("../services/auditLogService");
const { ensurePayrollTables } = require("../services/payrollService");
const { ensureUserAccessColumns } = require("../services/userAccessService");

const requiredBackupTables = [
  { key: "company", table: "companies", whereColumn: "id" },
  { key: "users", table: "users", forbiddenColumns: ["password"] },
  { key: "business_profiles", table: "business_profiles" },
  { key: "invoice_settings", table: "invoice_settings" },
  { key: "customers", table: "customers" },
  { key: "vendors", table: "vendors" },
  { key: "products", table: "products" },
  { key: "invoices", table: "invoices" },
  { key: "invoice_items", table: "invoice_items" },
  { key: "payments", table: "payments" },
  { key: "bills", table: "bills" },
  { key: "bill_items", table: "bill_items", via: "bills", foreignKey: "bill_id" },
  { key: "vendor_payments", table: "vendor_payments" },
  { key: "delivery_challans", table: "delivery_challans" },
  { key: "delivery_challan_items", table: "delivery_challan_items" },
  { key: "product_returns", table: "product_returns" },
  { key: "return_items", table: "return_items" },
  { key: "quotations", table: "quotations" },
  { key: "quotation_items", table: "quotation_items", via: "quotations", foreignKey: "quotation_id" },
  { key: "purchase_orders", table: "purchase_orders" },
  { key: "purchase_order_items", table: "purchase_order_items", via: "purchase_orders", foreignKey: "purchase_order_id" },
  { key: "accounts", table: "accounts" },
  { key: "journal_entries", table: "journal_entries" },
  { key: "receipt_entries", table: "receipt_entries", optional: true },
  { key: "payment_entries", table: "payment_entries", optional: true },
  { key: "expenses", table: "expenses" },
  { key: "payroll_employees", table: "payroll_employees" },
  { key: "payroll_entries", table: "payroll_entries" },
  { key: "payroll_attendance_imports", table: "payroll_attendance_imports" },
  { key: "payroll_attendance_lines", table: "payroll_attendance_lines" },
  { key: "audit_logs", table: "audit_logs" },
  { key: "data_import_batches", table: "data_import_batches" },
  { key: "data_import_changes", table: "data_import_changes" },
];

const quoteId = (identifier) => `\`${identifier.replace(/`/g, "``")}\``;

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

const tableExists = async (table) => {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [table]);
  return rows.length > 0;
};

const getColumnSet = async (table) => {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${quoteId(table)}`);
  return new Set(rows.map((row) => row.Field));
};

const getDefaultCompanyId = async () => {
  const [rows] = await db.query(
    "SELECT company_id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1"
  );
  return rows[0]?.company_id || null;
};

const countRows = async (spec, companyId, columns) => {
  if (spec.via) {
    if (!(await tableExists(spec.via))) return 0;
    const viaColumns = await getColumnSet(spec.via);
    if (!viaColumns.has("company_id")) return 0;

    const [[count]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM ${quoteId(spec.table)} child
       INNER JOIN ${quoteId(spec.via)} parent
         ON parent.id = child.${quoteId(spec.foreignKey)}
       WHERE parent.company_id = ?`,
      [companyId]
    );
    return Number(count.total || 0);
  }

  const whereColumn = spec.whereColumn || "company_id";
  if (!columns.has(whereColumn)) return 0;

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM ${quoteId(spec.table)} WHERE ${quoteId(whereColumn)} = ?`,
    [companyId]
  );
  return Number(count.total || 0);
};

const main = async () => {
  await ensureUserAccessColumns();
  await ensureAuditLogTable();
  await ensurePayrollTables();

  const companyId = Number(
    getArg("company-id") || process.env.BACKUP_COMPANY_ID || (await getDefaultCompanyId())
  );

  if (!companyId) {
    throw new Error("No company found. Pass --company-id=YOUR_COMPANY_ID.");
  }

  const checkedAt = new Date().toISOString();
  const missingTables = [];
  const optionalMissingTables = [];
  const unsafeColumns = [];
  const counts = {};

  for (const spec of requiredBackupTables) {
    if (!(await tableExists(spec.table))) {
      if (spec.optional) {
        optionalMissingTables.push(spec.table);
      } else {
        missingTables.push(spec.table);
      }
      counts[spec.key] = 0;
      continue;
    }

    const columns = await getColumnSet(spec.table);
    const forbiddenColumns = spec.forbiddenColumns || [];
    forbiddenColumns.forEach((column) => {
      if (columns.has(column)) {
        unsafeColumns.push(`${spec.table}.${column}`);
      }
    });

    counts[spec.key] = await countRows(spec, companyId, columns);
  }

  const exportSafe = unsafeColumns.every((column) => column === "users.password");
  const backupReady = missingTables.length === 0 && exportSafe;

  console.log("=== Backup Readiness Audit ===");
  console.log(`Company ID: ${companyId}`);
  console.log(`Checked At: ${checkedAt}`);
  console.table(counts);
  console.log("Missing Tables:", missingTables);
  console.log("Optional Tables Not Found:", optionalMissingTables);
  console.log("Sensitive Columns Excluded By Backup:", ["users.password"]);
  console.log("Final Status:", backupReady ? "OK" : "Needs attention");

  console.log("JSON_RESULT_START");
  console.log(
    JSON.stringify(
      {
        checkedAt,
        companyId,
        counts,
        missingTables,
        optionalMissingTables,
        sensitiveColumnsExcludedByBackup: ["users.password"],
        status: {
          backupReady,
          requiredTablesOk: missingTables.length === 0,
          passwordsExcluded: exportSafe,
        },
      },
      null,
      2
    )
  );
  console.log("JSON_RESULT_END");

  if (!backupReady) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error("Backup readiness audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
