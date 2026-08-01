const assert = require("node:assert/strict");
const {
  isCashBankAccount,
  isOtherCreditAccount,
  receiptJournalSourceType,
} = require("../services/receiptEntryService");

const account = (account_name, account_type, parent_account_name = "") => ({
  account_name,
  account_type,
  parent_account_name,
  description: "",
});

assert.equal(isCashBankAccount(account("Cash in Hand", "ASSET")), true);
assert.equal(isCashBankAccount(account("Petty Cash", "ASSET")), true);
assert.equal(isCashBankAccount(account("HDFC Bank", "ASSET")), true);
assert.equal(isCashBankAccount(account("SBI Current Account", "ASSET")), true);
assert.equal(isCashBankAccount(account("Counter Till", "ASSET", "Cash")), true);
assert.equal(isCashBankAccount(account("Salary Payable", "LIABILITY")), false);
assert.equal(isCashBankAccount(account("Office Expense", "EXPENSE")), false);

assert.equal(isOtherCreditAccount(account("Interest Income", "INCOME")), true);
assert.equal(isOtherCreditAccount(account("Director Capital", "EQUITY")), true);
assert.equal(isOtherCreditAccount(account("Customer Advances", "LIABILITY")), true);
assert.equal(isOtherCreditAccount(account("Salary Payable", "LIABILITY")), false);
assert.equal(isOtherCreditAccount(account("Cash in Hand", "ASSET")), false);
assert.equal(isOtherCreditAccount(account("Office Expense", "EXPENSE")), false);

assert.equal(receiptJournalSourceType("CUSTOMER"), "customer_receipt");
assert.equal(receiptJournalSourceType("OTHER"), "receipt_entry");
assert.equal(receiptJournalSourceType("ADVANCE"), "receipt_entry");

console.log("Receipt account and journal-source classification: 16 checks passed");
