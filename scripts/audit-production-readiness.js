require("dotenv").config();

const db = require("../db/connection");
const {
  buildProductionReadinessReport,
} = require("../services/productionReadinessService");

const formatStatus = (check) => {
  if (check.warning) return "WARN";
  return check.ok ? "OK" : "FAIL";
};

const run = async () => {
  const report = await buildProductionReadinessReport();

  console.log("=== Production Readiness Audit ===");
  console.log(`Checked At: ${report.checkedAt}`);
  console.log(`Environment: ${report.environment}`);
  console.log("");

  console.table(
    Object.entries(report.checks).map(([name, check]) => ({
      check: name,
      status: formatStatus(check),
      required: check.required ? "Yes" : "No",
      message: check.message,
    }))
  );

  if (report.warnings.length) {
    console.log("");
    console.log("Warnings:");
    report.warnings.forEach((warning) => {
      console.log(`- ${warning.name}: ${warning.message}`);
    });
  }

  console.log("");
  console.log(
    `Final Status: ${report.success ? "OK" : "Needs attention"}`
  );
  console.log("JSON_RESULT_START");
  console.log(JSON.stringify(report, null, 2));
  console.log("JSON_RESULT_END");

  process.exitCode = report.success ? 0 : 1;
};

run()
  .catch((error) => {
    console.error("Production readiness audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof db.end === "function") {
      await db.end();
    }
  });
