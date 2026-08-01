const assert = require("assert");
const db = require("../db/connection");

const originalExecute = db.execute;
const calls = [];
db.execute = async (sql, params) => {
  calls.push({ sql: String(sql), params });
  return [[{ id: 8, journal_no: "VPAY-00008", source_type: "vendor_payment", source_category: "automatic" }]];
};

const { getAllJournalEntries } = require("../controllers/journalEntryController");

const run = async () => {
  let response;
  await getAllJournalEntries(
    {
      user: { company_id: 42 },
      query: {
        search: "VPAY-00008",
        date_from: "2026-08-01",
        date_to: "2026-08-02",
        source_type: "automatic",
      },
    },
    {
      status(code) {
        return { json(body) { response = { code, body }; } };
      },
    }
  );

  assert.equal(response.code, 200);
  assert.equal(response.body.data[0].journal_no, "VPAY-00008");
  assert.ok(calls[0].sql.includes("je.company_id = ?"), "history must be company scoped");
  assert.ok(calls[0].sql.includes("je.source_type IS NOT NULL"), "automatic filter must exclude manual entries");
  assert.ok(calls[0].sql.includes("je.journal_no LIKE ? OR je.narration LIKE ?"), "search must cover voucher and narration");
  assert.deepEqual(calls[0].params, [42, "2026-08-01", "2026-08-02", "%VPAY-00008%", "%VPAY-00008%"]);
  console.log("journal entry history tests passed");
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => { db.execute = originalExecute; });
