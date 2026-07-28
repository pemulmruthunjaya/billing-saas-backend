const cron = require("node-cron");
const db = require("../db/connection");
const {
  ensureRecurringInvoiceSchema,
  generateRecurringInvoice,
} = require("../services/recurringInvoiceService");

let scheduledTask = null;

const processDueRecurringInvoices = async () => {
  await ensureRecurringInvoiceSchema();
  await db.query(
    `UPDATE recurring_invoices
     SET status = 'Completed'
     WHERE status = 'Active'
       AND (
         (end_date IS NOT NULL AND next_invoice_date > end_date)
         OR
         (max_occurrences IS NOT NULL AND generated_count >= max_occurrences)
       )`
  );
  const [dueInvoices] = await db.query(
    `SELECT id, company_id, created_by
     FROM recurring_invoices
     WHERE status = 'Active'
       AND next_invoice_date <= UTC_DATE()
       AND company_id IS NOT NULL
       AND (end_date IS NULL OR next_invoice_date <= end_date)
       AND (max_occurrences IS NULL OR generated_count < max_occurrences)
     ORDER BY next_invoice_date, id`
  );

  const summary = { found: dueInvoices.length, generated: 0, skipped: 0, failed: 0 };

  for (const recurring of dueInvoices) {
    try {
      const result = await generateRecurringInvoice(recurring.id, {
        company_id: recurring.company_id,
        user_id: recurring.created_by,
      });
      if (result.already_generated) summary.skipped += 1;
      else summary.generated += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("Recurring invoice scheduler item failed:", {
        recurringInvoiceId: recurring.id,
        companyId: recurring.company_id,
        code: error.code || "GENERATION_FAILED",
        message: error.status && error.status < 500
          ? error.message
          : "Internal generation error",
      });
    }
  }

  console.log("Recurring invoice scheduler completed:", summary);
  return summary;
};

const startRecurringInvoiceScheduler = () => {
  if (process.env.RECURRING_INVOICE_SCHEDULER_ENABLED !== "true") {
    console.log("Recurring invoice scheduler is disabled");
    return null;
  }
  if (scheduledTask) return scheduledTask;

  const schedule = process.env.RECURRING_INVOICE_CRON || "0 1 * * *";
  if (!cron.validate(schedule)) {
    console.error("Recurring invoice scheduler was not started: invalid cron expression");
    return null;
  }

  scheduledTask = cron.schedule(
    schedule,
    async () => {
      try {
        await processDueRecurringInvoices();
      } catch (error) {
        console.error("Recurring invoice scheduler run failed:", error.message);
      }
    },
    { noOverlap: true }
  );

  console.log(`Recurring invoice scheduler started with cron: ${schedule}`);
  return scheduledTask;
};

module.exports = {
  processDueRecurringInvoices,
  startRecurringInvoiceScheduler,
};
