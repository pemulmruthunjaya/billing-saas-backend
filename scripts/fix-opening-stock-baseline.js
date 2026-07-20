require("dotenv").config();

const db = require("../db/connection");

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const getCompanyIdArg = () => {
  const idArg = process.argv
    .slice(2)
    .find((arg) => /^\d+$/.test(arg));

  return idArg ? Number(idArg) : null;
};

const getActiveCompanyId = async () => {
  const [rows] = await db.query(`
    SELECT company_id, SUM(total_count) AS total_count
    FROM (
      SELECT company_id, COUNT(*) AS total_count FROM products GROUP BY company_id
      UNION ALL
      SELECT company_id, COUNT(*) AS total_count FROM invoices GROUP BY company_id
      UNION ALL
      SELECT company_id, COUNT(*) AS total_count FROM bills GROUP BY company_id
    ) activity
    GROUP BY company_id
    ORDER BY total_count DESC
    LIMIT 1
  `);

  return Number(getCompanyIdArg() || rows[0]?.company_id || 0);
};

const getBaselines = async (companyId) => {
  const [rows] = await db.query(
    `
    SELECT
      p.id,
      p.name,
      COALESCE(p.opening_stock, 0) AS opening_stock,
      COALESCE(p.stock, 0) AS actual_stock,
      (
        COALESCE(p.stock, 0)
        - COALESCE(purchase_qty.qty, 0)
        - COALESCE(dc_in_qty.qty, 0)
        - COALESCE(sales_return_qty.qty, 0)
        + COALESCE(sales_qty.qty, 0)
        + COALESCE(dc_out_qty.qty, 0)
        + COALESCE(purchase_return_qty.qty, 0)
      ) AS required_opening_stock
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM bill_items bi
      INNER JOIN bills b ON b.id = bi.bill_id
      WHERE b.company_id = ? AND b.total_amount > 0
      GROUP BY product_id
    ) purchase_qty ON purchase_qty.product_id = p.id
    LEFT JOIN (
      SELECT p2.id AS product_id, SUM(ii.quantity) AS qty
      FROM invoice_items ii
      INNER JOIN products p2
        ON p2.company_id = ii.company_id
       AND p2.name = ii.item_name
      WHERE ii.company_id = ?
      GROUP BY p2.id
    ) sales_qty ON sales_qty.product_id = p.id
    LEFT JOIN (
      SELECT dci.product_id, SUM(dci.quantity) AS qty
      FROM delivery_challan_items dci
      INNER JOIN delivery_challans dc ON dc.id = dci.challan_id
      WHERE dc.company_id = ? AND dc.type = 'in'
      GROUP BY dci.product_id
    ) dc_in_qty ON dc_in_qty.product_id = p.id
    LEFT JOIN (
      SELECT dci.product_id, SUM(dci.quantity) AS qty
      FROM delivery_challan_items dci
      INNER JOIN delivery_challans dc ON dc.id = dci.challan_id
      WHERE dc.company_id = ? AND dc.type = 'out'
      GROUP BY dci.product_id
    ) dc_out_qty ON dc_out_qty.product_id = p.id
    LEFT JOIN (
      SELECT ri.product_id, SUM(ri.quantity) AS qty
      FROM return_items ri
      INNER JOIN product_returns pr ON pr.id = ri.return_id
      WHERE pr.company_id = ? AND pr.type = 'sales'
      GROUP BY ri.product_id
    ) sales_return_qty ON sales_return_qty.product_id = p.id
    LEFT JOIN (
      SELECT ri.product_id, SUM(ri.quantity) AS qty
      FROM return_items ri
      INNER JOIN product_returns pr ON pr.id = ri.return_id
      WHERE pr.company_id = ? AND pr.type = 'purchase'
      GROUP BY ri.product_id
    ) purchase_return_qty ON purchase_return_qty.product_id = p.id
    WHERE p.company_id = ?
    ORDER BY p.name
    `,
    [companyId, companyId, companyId, companyId, companyId, companyId, companyId]
  );

  return rows
    .map((row) => ({
      ...row,
      opening_stock: money(row.opening_stock),
      actual_stock: money(row.actual_stock),
      required_opening_stock: money(row.required_opening_stock),
    }))
    .filter(
      (row) =>
        row.required_opening_stock > 0 &&
        Math.abs(row.required_opening_stock - row.opening_stock) > 0.01
    );
};

const main = async () => {
  const companyId = await getActiveCompanyId();

  if (!companyId) {
    throw new Error("No company data found.");
  }

  const dryRun = !process.argv.includes("--apply");
  const rows = await getBaselines(companyId);

  console.log("\n=== Opening Stock Baseline Fix ===");
  console.log(`Company ID: ${companyId}`);
  console.log(`Mode: ${dryRun ? "Preview only" : "Apply changes"}`);

  if (!rows.length) {
    console.log("No opening stock baseline changes needed.");
    return;
  }

  rows.forEach((row) => {
    console.log(
      `${row.name}: opening_stock ${row.opening_stock} -> ${row.required_opening_stock}`
    );
  });

  if (dryRun) {
    console.log("\nNothing changed. Run again with --apply to save these baselines.");
    return;
  }

  for (const row of rows) {
    await db.query(
      "UPDATE products SET opening_stock = ? WHERE id = ? AND company_id = ?",
      [row.required_opening_stock, row.id, companyId]
    );
  }

  console.log(`\nUpdated ${rows.length} product opening stock baseline(s).`);
};

main()
  .catch((error) => {
    console.error("Fix failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
