const assert = require("assert");
const { calculatePaymentState } = require("../services/vendorPaymentService");

assert.deepStrictEqual(calculatePaymentState(1000, 0, 0), {
  paidAmount: 0,
  dueAmount: 1000,
  status: "Unpaid",
});
assert.deepStrictEqual(calculatePaymentState(1000, 0, 250), {
  paidAmount: 250,
  dueAmount: 750,
  status: "Partial Paid",
});
assert.deepStrictEqual(calculatePaymentState(1000, 250, 750), {
  paidAmount: 1000,
  dueAmount: 0,
  status: "Paid",
});

console.log("Vendor payment state: partial and full payment checks passed");
