require("dotenv").config();

const db = require("../db/connection");
const { getAccountingSummary, toTrialRow } = require("../controllers/accountingSummary");

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const closeEnough = (a, b) => Math.abs(money(a) - money(b)) <= 0.01;

const getCompanyIdArg = () => {
  const idArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
  return idArg ? Number(idArg) : null;
};

const queryOne = async (sql, params = []) => {
  const [rows] = await db.query(sql, params);
  return rows[0] || {};
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
      UNION ALL
      SELECT company_id, COUNT(*) AS total_count FROM payroll_entries GROUP BY company_id
    ) activity
    GROUP BY company_id
    ORDER BY total_count DESC
    LIMIT 1
  `);

  return Number(getCompanyIdArg() || rows[0]?.company_id || 0);
};

const getPayrollTotals = async (companyId) =>
  queryOne(
    `
    SELECT
      COUNT(*) AS entries,
      COUNT(DISTINCT employee_id) AS employees,
      COALESCE(SUM(basic_salary), 0) AS basic_salary,
      COALESCE(SUM(allowances), 0) AS allowances,
      COALESCE(SUM(deductions), 0) AS deductions,
      COALESCE(SUM(net_amount), 0) AS net_payroll,
      COALESCE(SUM(CASE WHEN LOWER(status) = 'paid' THEN net_amount ELSE 0 END), 0) AS paid_payroll,
      COALESCE(SUM(CASE WHEN LOWER(status) <> 'paid' THEN net_amount ELSE 0 END), 0) AS salary_payable
    FROM payroll_entries
    WHERE company_id = ?
    `,
    [companyId]
  );

const buildTrialRows = (summary) =>
  [
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
    toTrialRow({ id: "salaries", code: "5100", name: "Salaries", type: "EXPENSE", amount: summary.payrollExpense, normal: "DEBIT" })
  ].filter((row) => Number(row.debit || 0) !== 0 || Number(row.credit || 0) !== 0);

const run = async () => {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error("No company data found.");
  }

  const payrollRaw = await getPayrollTotals(companyId);
  const summary = await getAccountingSummary(db, companyId);

  const payroll = {
    entries: Number(payrollRaw.entries || 0),
    employees: Number(payrollRaw.employees || 0),
    basicSalary: money(payrollRaw.basic_salary),
    allowances: money(payrollRaw.allowances),
    deductions: money(payrollRaw.deductions),
    netPayroll: money(payrollRaw.net_payroll),
    paidPayroll: money(payrollRaw.paid_payroll),
    salaryPayable: money(payrollRaw.salary_payable)
  };

  const trialRows = buildTrialRows(summary);
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
  const balanceSheetDifference = money(totalAssets - (totalLiabilities + summary.profit));

  const checks = {
    payrollExpenseMatches: closeEnough(summary.payrollExpense, payroll.netPayroll),
    paidPayrollMatches: closeEnough(summary.paidPayroll, payroll.paidPayroll),
    salaryPayableMatches: closeEnough(summary.salaryPayable, payroll.salaryPayable),
    profitIncludesPayroll: closeEnough(summary.profit, summary.sales - summary.purchases - summary.payrollExpense),
    trialBalanceBalanced: closeEnough(totalDebit, totalCredit),
    balanceSheetBalanced: closeEnough(balanceSheetDifference, 0)
  };

  const ok = Object.values(checks).every(Boolean);

  console.log("\n=== Payroll Accounting Audit ===");
  console.log(`Company ID: ${companyId}`);
  console.log("\nPayroll:");
  console.table(payroll);
  console.log("\nAccounting Summary:");
  console.table({
    sales: summary.sales,
    purchases: summary.purchases,
    payrollExpense: summary.payrollExpense,
    paidPayroll: summary.paidPayroll,
    salaryPayable: summary.salaryPayable,
    cash: summary.cash,
    profit: summary.profit
  });
  console.log("\nTrial Balance:");
  console.table({ totalDebit, totalCredit, difference: money(totalDebit - totalCredit) });
  console.log("\nBalance Sheet:");
  console.table({
    totalAssets,
    totalLiabilities,
    currentYearProfit: summary.profit,
    difference: balanceSheetDifference
  });
  console.log("\nChecks:");
  console.table(checks);
  console.log(`\nFinal Status: ${ok ? "OK" : "CHECK REQUIRED"}`);

  process.exitCode = ok ? 0 : 1;
};

run()
  .catch((error) => {
    console.error("Payroll accounting audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
