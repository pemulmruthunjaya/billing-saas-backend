require("dotenv").config();

const db = require("../db/connection");
const { getAccountingSummary, toTrialRow } = require("../controllers/accountingSummary");

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const closeEnough = (a, b) => Math.abs(money(a) - money(b)) <= 0.01;

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

const queryOne = async (sql, params = []) => {
  const [rows] = await db.query(sql, params);
  return rows[0] || {};
};

const queryRows = async (sql, params = []) => {
  const [rows] = await db.query(sql, params);
  return rows;
};

const getCounts = async (companyId) => {
  const counts = await queryOne(
    `
    SELECT
      (SELECT COUNT(*) FROM products WHERE company_id = ?) AS products,
      (SELECT COUNT(*) FROM invoices WHERE company_id = ?) AS invoices,
      (SELECT COUNT(*) FROM bills WHERE company_id = ? AND total_amount > 0) AS bills,
      (SELECT COUNT(*) FROM delivery_challans WHERE company_id = ? AND type = 'in') AS dc_in,
      (SELECT COUNT(*) FROM delivery_challans WHERE company_id = ? AND type = 'out') AS dc_out,
      (SELECT COUNT(*) FROM product_returns WHERE company_id = ? AND type = 'sales') AS sales_returns,
      (SELECT COUNT(*) FROM product_returns WHERE company_id = ? AND type = 'purchase') AS purchase_returns
    `,
    [companyId, companyId, companyId, companyId, companyId, companyId, companyId]
  );

  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, Number(value || 0)])
  );
};

const getSalesAndPurchaseTotals = async (companyId) => {
  const sales = await queryOne(
    `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(subtotal), 0) AS taxable,
      COALESCE(SUM(tax_amount), 0) AS gst,
      COALESCE(SUM(total_amount), 0) AS total
    FROM invoices
    WHERE company_id = ?
    `,
    [companyId]
  );

  const purchases = await queryOne(
    `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(item_totals.taxable), 0) AS taxable,
      COALESCE(SUM(item_totals.gst), 0) AS gst,
      COALESCE(SUM(b.total_amount), 0) AS total
    FROM bills b
    LEFT JOIN (
      SELECT
        bill_id,
        SUM(quantity * price) AS taxable,
        SUM(COALESCE(total, 0) - (quantity * price)) AS gst
      FROM bill_items
      GROUP BY bill_id
    ) item_totals ON item_totals.bill_id = b.id
    WHERE b.company_id = ?
      AND b.total_amount > 0
    `,
    [companyId]
  );

  const returns = await queryOne(
    `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'sales' THEN subtotal ELSE 0 END), 0) AS sales_taxable,
      COALESCE(SUM(CASE WHEN type = 'sales' THEN tax_amount ELSE 0 END), 0) AS sales_gst,
      COALESCE(SUM(CASE WHEN type = 'sales' THEN total_amount ELSE 0 END), 0) AS sales_total,
      COALESCE(SUM(CASE WHEN type = 'purchase' THEN subtotal ELSE 0 END), 0) AS purchase_taxable,
      COALESCE(SUM(CASE WHEN type = 'purchase' THEN tax_amount ELSE 0 END), 0) AS purchase_gst,
      COALESCE(SUM(CASE WHEN type = 'purchase' THEN total_amount ELSE 0 END), 0) AS purchase_total
    FROM product_returns
    WHERE company_id = ?
    `,
    [companyId]
  );

  return {
    grossSales: {
      taxable: money(sales.taxable),
      gst: money(sales.gst),
      total: money(sales.total),
    },
    grossPurchases: {
      taxable: money(purchases.taxable),
      gst: money(purchases.gst),
      total: money(purchases.total),
    },
    returns: {
      salesTaxable: money(returns.sales_taxable),
      salesGst: money(returns.sales_gst),
      salesTotal: money(returns.sales_total),
      purchaseTaxable: money(returns.purchase_taxable),
      purchaseGst: money(returns.purchase_gst),
      purchaseTotal: money(returns.purchase_total),
    },
  };
};

const getStockAudit = async (companyId) => {
  const [columns] = await db.query("SHOW COLUMNS FROM products");
  const hasOpeningStock = columns.some((column) => column.Field === "opening_stock");
  const openingColumn = hasOpeningStock ? "p.opening_stock" : "0";

  return queryRows(
    `
    SELECT
      p.id,
      p.name,
      COALESCE(${openingColumn}, 0) AS opening_stock,
      COALESCE(p.stock, 0) AS actual_stock,
      COALESCE(purchase_qty.qty, 0) AS purchase_qty,
      COALESCE(sales_qty.qty, 0) AS sales_qty,
      COALESCE(dc_in_qty.qty, 0) AS dc_in_qty,
      COALESCE(dc_out_qty.qty, 0) AS dc_out_qty,
      COALESCE(sales_return_qty.qty, 0) AS sales_return_qty,
      COALESCE(purchase_return_qty.qty, 0) AS purchase_return_qty,
      (
        COALESCE(${openingColumn}, 0)
        + COALESCE(purchase_qty.qty, 0)
        + COALESCE(dc_in_qty.qty, 0)
        + COALESCE(sales_return_qty.qty, 0)
        - COALESCE(sales_qty.qty, 0)
        - COALESCE(dc_out_qty.qty, 0)
        - COALESCE(purchase_return_qty.qty, 0)
      ) AS expected_stock
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
};

const getAccountingAudit = async (companyId) => {
  const summary = await getAccountingSummary(db, companyId);
  const trialRows = [
    toTrialRow({ id: "cash-bank", code: "1000", name: "Cash / Bank", type: "ASSET", amount: summary.cash, normal: "DEBIT" }),
    toTrialRow({ id: "customer-receivables", code: "1100", name: "Customer Receivables", type: "ASSET", amount: summary.receivables, normal: "DEBIT" }),
    toTrialRow({ id: "gst-input", code: "1200", name: "GST Input Credit", type: "ASSET", amount: summary.gstInput, normal: "DEBIT" }),
    toTrialRow({ id: "vendor-credits", code: "1300", name: "Vendor Credits", type: "ASSET", amount: summary.vendorCredits, normal: "DEBIT" }),
    toTrialRow({ id: "vendor-payables", code: "2100", name: "Vendor Payables", type: "LIABILITY", amount: summary.payables, normal: "CREDIT" }),
    toTrialRow({ id: "customer-credits", code: "2150", name: "Customer Credits", type: "LIABILITY", amount: summary.customerCredits, normal: "CREDIT" }),
    toTrialRow({ id: "gst-output", code: "2200", name: "GST Output Payable", type: "LIABILITY", amount: summary.gstOutput, normal: "CREDIT" }),
    toTrialRow({ id: "salary-payable", code: "2300", name: "Salary Payable", type: "LIABILITY", amount: summary.salaryPayable, normal: "CREDIT" }),
    toTrialRow({ id: "sales", code: "4000", name: "Sales", type: "INCOME", amount: summary.sales, normal: "CREDIT" }),
    toTrialRow({ id: "purchases", code: "5000", name: "Purchases", type: "EXPENSE", amount: summary.purchases, normal: "DEBIT" }),
    toTrialRow({ id: "salaries", code: "5100", name: "Salaries", type: "EXPENSE", amount: summary.payrollExpense, normal: "DEBIT" }),
  ].filter((row) => Number(row.debit || 0) !== 0 || Number(row.credit || 0) !== 0);

  const totalDebit = money(trialRows.reduce((sum, row) => sum + Number(row.debit || 0), 0));
  const totalCredit = money(trialRows.reduce((sum, row) => sum + Number(row.credit || 0), 0));
  const totalAssets = money(
    Math.max(summary.cash, 0) +
    summary.receivables +
    summary.gstInput +
    summary.vendorCredits
  );
  const totalLiabilities = money(
    Math.max(-summary.cash, 0) +
    summary.payables +
    summary.customerCredits +
    summary.gstOutput +
    summary.salaryPayable
  );
  const currentYearProfit = money(summary.profit);
  const balanceSheetDifference = money(totalAssets - (totalLiabilities + currentYearProfit));

  return {
    summary,
    trialBalance: {
      totalDebit,
      totalCredit,
      difference: money(totalDebit - totalCredit),
      balanced: closeEnough(totalDebit, totalCredit),
    },
    profitAndLoss: {
      sales: summary.sales,
      purchases: summary.purchases,
      payrollExpense: summary.payrollExpense,
      netProfit: currentYearProfit,
    },
    balanceSheet: {
      totalAssets,
      totalLiabilities,
      currentYearProfit,
      difference: balanceSheetDifference,
      balanced: closeEnough(balanceSheetDifference, 0),
    },
  };
};

const main = async () => {
  const companyId = await getActiveCompanyId();

  if (!companyId) {
    throw new Error("No company data found to audit.");
  }

  const [counts, totals, stockRows, accounting] = await Promise.all([
    getCounts(companyId),
    getSalesAndPurchaseTotals(companyId),
    getStockAudit(companyId),
    getAccountingAudit(companyId),
  ]);

  const stockMismatches = stockRows
    .map((row) => ({
      product: row.name,
      actual: money(row.actual_stock),
      expected: money(row.expected_stock),
      difference: money(Number(row.actual_stock || 0) - Number(row.expected_stock || 0)),
    }))
    .filter((row) => !closeEnough(row.actual, row.expected));

  const missingHsn = await queryRows(
    `SELECT id, name FROM products WHERE company_id = ? AND (hsn IS NULL OR hsn = '') ORDER BY name`,
    [companyId]
  );

  const result = {
    checkedAt: new Date().toISOString(),
    companyId,
    counts,
    totals,
    accounting,
    stock: {
      checkedProducts: stockRows.length,
      mismatches: stockMismatches,
    },
    productSetup: {
      productsMissingHsn: missingHsn.map((row) => row.name),
    },
    status: {
      stockOk: stockMismatches.length === 0,
      trialBalanceOk: accounting.trialBalance.balanced,
      balanceSheetOk: accounting.balanceSheet.balanced,
    },
  };

  console.log("\n=== Business Flow Audit ===");
  console.log(`Company ID: ${companyId}`);
  console.log("\nDocuments:", result.counts);
  console.log("\nSales/Purchase/Return Totals:", result.totals);
  console.log("\nTrial Balance:", result.accounting.trialBalance);
  console.log("\nProfit & Loss:", result.accounting.profitAndLoss);
  console.log("\nBalance Sheet:", result.accounting.balanceSheet);
  console.log("\nStock Check:", result.stock);
  console.log("\nProducts Missing HSN:", result.productSetup.productsMissingHsn);
  console.log("\nFinal Status:", result.status);
  console.log("\nJSON_RESULT_START");
  console.log(JSON.stringify(result, null, 2));
  console.log("JSON_RESULT_END\n");
};

main()
  .catch((error) => {
    console.error("Audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
