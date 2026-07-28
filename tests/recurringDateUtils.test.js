const assert = require("node:assert/strict");
const {
  addRecurringFrequency,
} = require("../utils/recurringDateUtils");

const cases = [
  ["daily", "2026-07-28", "daily", 1, "2026-07-29"],
  ["every two weeks", "2026-07-28", "weekly", 2, "2026-08-11"],
  ["monthly", "2026-07-28", "monthly", 1, "2026-08-28"],
  ["every three months", "2026-07-28", "monthly", 3, "2026-10-28"],
  ["quarterly", "2026-07-28", "quarterly", 1, "2026-10-28"],
  ["yearly", "2026-07-28", "yearly", 1, "2027-07-28"],
  ["January 31", "2026-01-31", "monthly", 1, "2026-02-28"],
  ["leap-year February", "2024-01-31", "monthly", 1, "2024-02-29"],
  ["leap day yearly", "2024-02-29", "yearly", 1, "2025-02-28"],
];

for (const [name, date, frequency, repeatEvery, expected] of cases) {
  assert.equal(
    addRecurringFrequency(date, frequency, repeatEvery),
    expected,
    name
  );
}

assert.throws(
  () => addRecurringFrequency("2026-07-28", "unsupported", 1),
  /Unsupported/
);

console.log(`Recurring date utility: ${cases.length + 1} checks passed`);
