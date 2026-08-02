const assert = require("node:assert/strict");
const { getAccountingSummary } = require("../controllers/accountingSummary");
const { ensureSystemAccount } = require("../services/receiptEntryService");

const run = async () => {
  const calls = [];
  const mockDb = {
    async query(sql, params = []) {
      const text = String(sql);
      calls.push({ sql: text, params });
      if (text.includes("CREATE TABLE")) return [[], []];
      if (text.includes("FROM invoices i")) {
        return [[{
          sales: "1200.00",
          gst_output: "216.00",
          total_sales: "1416.00",
          paid_sales: "0.00",
          receivables: "1416.00",
        }]];
      }
      if (text.includes("FROM bills b")) {
        return [[{ purchases: 0, gst_input: 0, total_purchases: 0, paid_purchases: 0, payables: 0 }]];
      }
      if (text.includes("FROM product_returns")) {
        return [[{
          sales_return_subtotal: 0, sales_return_tax: 0, sales_return_total: 0,
          purchase_return_subtotal: 0, purchase_return_tax: 0, purchase_return_total: 0,
        }]];
      }
      if (text.includes("FROM payroll_entries")) {
        return [[{ payroll_expense: 0, paid_payroll: 0, salary_payable: 0 }]];
      }
      throw new Error(`Unexpected SQL: ${text}`);
    },
  };

  const summary = await getAccountingSummary(mockDb, 4);
  const invoiceQuery = calls.find(({ sql }) => sql.includes("FROM invoices i"));
  assert.match(
    invoiceQuery.sql,
    /SUM\(subtotal - COALESCE\(discount_amount, 0\)\)/,
    "sales must be reported net of invoice discounts"
  );
  assert.equal(summary.sales, 1200);
  assert.equal(summary.gstOutput, 216);
  assert.equal(summary.receivables, 1416);
  assert.equal(summary.receivables, summary.sales + summary.gstOutput);
  assert.deepEqual(invoiceQuery.params, [4], "summary must remain company scoped");

  const controlCalls = [];
  const establishedReceivable = {
    id: 90,
    account_code: "1100",
    account_name: "Customer Receivables",
    account_type: "ASSET",
  };
  const mockConnection = {
    async query(sql, params) {
      controlCalls.push({ sql: String(sql), params });
      return [[establishedReceivable]];
    },
  };
  const account = await ensureSystemAccount(mockConnection, 4, {
    code: "SYS-AR-4",
    name: "Accounts Receivable",
    type: "ASSET",
    alternateCode: "1100",
    alternateName: "Customer Receivables",
  });
  assert.equal(account.id, establishedReceivable.id);
  assert.equal(controlCalls.length, 1, "an established control account must not be duplicated");
  assert.deepEqual(controlCalls[0].params, [4, "Accounts Receivable", "Customer Receivables", "SYS-AR-4", "1100"]);

  console.log("accounting summary and control-account regression tests passed");
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
