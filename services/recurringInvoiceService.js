const db = require("../db/connection");
const {
  createInvoiceRecord,
  ensureInvoiceCreationSchema,
} = require("../controllers/invoiceController");
const {
  addRecurringFrequency,
  toDateString,
} = require("../utils/recurringDateUtils");

const FREQUENCIES = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

class RecurringInvoiceError extends Error {
  constructor(message, code, status = 409) {
    super(message);
    this.name = "RecurringInvoiceError";
    this.code = code;
    this.status = status;
  }
}

let schemaReady = false;

const ensureColumn = async (table, column, definition) => {
  const [columns] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!columns.length) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
};

const ensureRecurringInvoiceSchema = async () => {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS recurring_invoices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      customer_id BIGINT UNSIGNED NOT NULL,
      frequency ENUM('daily','weekly','monthly','quarterly','yearly') NOT NULL,
      repeat_every INT UNSIGNED NOT NULL DEFAULT 1,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      next_invoice_date DATE NOT NULL,
      max_occurrences INT UNSIGNED NULL,
      generated_count INT UNSIGNED NOT NULL DEFAULT 0,
      auto_email TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('Draft','Active','Paused','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
      notes TEXT NULL,
      company_id BIGINT UNSIGNED NOT NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_recurring_invoices_company_status (company_id, status),
      KEY idx_recurring_invoices_due (company_id, next_invoice_date, status),
      KEY idx_recurring_invoices_customer (company_id, customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn(
    "recurring_invoices",
    "max_occurrences",
    "INT UNSIGNED NULL AFTER next_invoice_date"
  );
  await ensureColumn(
    "recurring_invoices",
    "generated_count",
    "INT UNSIGNED NOT NULL DEFAULT 0 AFTER max_occurrences"
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS recurring_invoice_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      recurring_invoice_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      description VARCHAR(500) NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      amount DECIMAL(15,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_recurring_invoice_items_parent (recurring_invoice_id),
      CONSTRAINT fk_recurring_invoice_items_parent
        FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS recurring_invoice_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      recurring_invoice_id BIGINT UNSIGNED NOT NULL,
      generated_invoice_id BIGINT UNSIGNED NULL,
      scheduled_date DATE NOT NULL,
      status ENUM('PROCESSING','SUCCESS','FAILED') NOT NULL,
      error_message VARCHAR(500) NULL,
      company_id BIGINT UNSIGNED NOT NULL,
      generated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_recurring_invoice_run (recurring_invoice_id, scheduled_date),
      KEY idx_recurring_invoice_runs_company (company_id, recurring_invoice_id),
      CONSTRAINT fk_recurring_invoice_runs_parent
        FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  schemaReady = true;
};

const safeFailureMessage = (error) => {
  if (error?.code === "INSUFFICIENT_STOCK") return "Insufficient product stock";
  if (error?.status && error.status < 500) return error.message.slice(0, 500);
  return "Invoice generation failed";
};

const recordFailedRun = async ({
  recurringInvoiceId,
  companyId,
  scheduledDate,
  error,
}) => {
  if (!scheduledDate || !companyId) return;
  try {
    await db.query(
      `INSERT INTO recurring_invoice_runs
       (recurring_invoice_id, generated_invoice_id, scheduled_date, status,
        error_message, company_id, generated_at)
       VALUES (?, NULL, ?, 'FAILED', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         status = IF(status = 'SUCCESS', status, 'FAILED'),
         error_message = IF(status = 'SUCCESS', error_message, VALUES(error_message)),
         generated_at = IF(status = 'SUCCESS', generated_at, NOW())`,
      [
        recurringInvoiceId,
        scheduledDate,
        safeFailureMessage(error),
        companyId,
      ]
    );
  } catch (historyError) {
    console.error("Recurring invoice failure history could not be saved:", {
      recurringInvoiceId,
      companyId,
      message: historyError.message,
    });
  }
};

const generateRecurringInvoice = async (id, context = {}) => {
  await ensureRecurringInvoiceSchema();
  await ensureInvoiceCreationSchema();
  const connection = await db.getConnection();
  const companyId = Number(context.company_id || context.companyId);
  let scheduledDate = null;

  if (!companyId) {
    connection.release();
    throw new RecurringInvoiceError("Company is required", "COMPANY_REQUIRED", 400);
  }

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT ri.*, c.name AS customer_name
       FROM recurring_invoices ri
       INNER JOIN customers c
         ON c.id = ri.customer_id AND c.company_id = ri.company_id
       WHERE ri.id = ? AND ri.company_id = ?
       LIMIT 1
       FOR UPDATE`,
      [id, companyId]
    );

    if (!rows.length) {
      throw new RecurringInvoiceError(
        "Recurring invoice not found",
        "NOT_FOUND",
        404
      );
    }

    const recurring = rows[0];
    scheduledDate = toDateString(recurring.next_invoice_date);
    const today = toDateString(new Date());

    if (recurring.status !== "Active") {
      throw new RecurringInvoiceError(
        "Only an active recurring invoice can generate an invoice",
        "NOT_ACTIVE"
      );
    }
    if (scheduledDate > today) {
      if (Number(recurring.generated_count || 0) > 0) {
        const [latestSuccessfulRuns] = await connection.query(
          `SELECT generated_invoice_id, scheduled_date
           FROM recurring_invoice_runs
           WHERE recurring_invoice_id = ? AND company_id = ? AND status = 'SUCCESS'
           ORDER BY scheduled_date DESC, id DESC
           LIMIT 1`,
          [id, companyId]
        );
        if (latestSuccessfulRuns.length) {
          await connection.rollback();
          return {
            already_generated: true,
            recurring_invoice_id: Number(id),
            invoice_id: latestSuccessfulRuns[0].generated_invoice_id,
            scheduled_date: toDateString(latestSuccessfulRuns[0].scheduled_date),
          };
        }
      }
      throw new RecurringInvoiceError(
        "Recurring invoice is not due yet",
        "NOT_DUE"
      );
    }
    if (recurring.end_date && scheduledDate > toDateString(recurring.end_date)) {
      await connection.query(
        `UPDATE recurring_invoices SET status = 'Completed'
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );
      await connection.commit();
      throw new RecurringInvoiceError(
        "Recurring invoice has reached its end date",
        "COMPLETED"
      );
    }
    if (
      recurring.max_occurrences &&
      Number(recurring.generated_count) >= Number(recurring.max_occurrences)
    ) {
      await connection.query(
        `UPDATE recurring_invoices SET status = 'Completed'
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );
      await connection.commit();
      throw new RecurringInvoiceError(
        "Recurring invoice has reached its maximum occurrences",
        "COMPLETED"
      );
    }

    const [existingRuns] = await connection.query(
      `SELECT id, status, generated_invoice_id
       FROM recurring_invoice_runs
       WHERE recurring_invoice_id = ? AND scheduled_date = ?
       LIMIT 1
       FOR UPDATE`,
      [id, scheduledDate]
    );
    if (existingRuns[0]?.status === "SUCCESS") {
      await connection.rollback();
      return {
        already_generated: true,
        recurring_invoice_id: Number(id),
        invoice_id: existingRuns[0].generated_invoice_id,
        scheduled_date: scheduledDate,
      };
    }

    if (existingRuns.length) {
      await connection.query(
        `UPDATE recurring_invoice_runs
         SET status = 'PROCESSING', generated_invoice_id = NULL,
             error_message = NULL, generated_at = NULL
         WHERE id = ?`,
        [existingRuns[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO recurring_invoice_runs
         (recurring_invoice_id, scheduled_date, status, company_id)
         VALUES (?, ?, 'PROCESSING', ?)`,
        [id, scheduledDate, companyId]
      );
    }

    const [items] = await connection.query(
      `SELECT rii.*, p.name AS product_name
       FROM recurring_invoice_items rii
       INNER JOIN products p
         ON p.id = rii.product_id AND p.company_id = ?
       WHERE rii.recurring_invoice_id = ?
       ORDER BY rii.id`,
      [companyId, id]
    );
    if (!items.length) {
      throw new RecurringInvoiceError(
        "Recurring invoice has no valid items",
        "NO_ITEMS",
        400
      );
    }

    const invoice = await createInvoiceRecord({
      connection,
      user: {
        ...context,
        company_id: companyId,
        user_id: context.user_id || recurring.created_by,
      },
      body: {
        customer_id: recurring.customer_id,
        customer_name: recurring.customer_name,
        invoice_date: scheduledDate,
        items: items.map((item) => ({
          product_id: item.product_id,
          name: item.description || item.product_name,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          gst_rate: Number(item.tax_rate),
        })),
      },
    });

    const nextDate = addRecurringFrequency(
      scheduledDate,
      recurring.frequency,
      recurring.repeat_every
    );
    const generatedCount = Number(recurring.generated_count || 0) + 1;
    const completedByEndDate =
      recurring.end_date && nextDate > toDateString(recurring.end_date);
    const completedByCount =
      recurring.max_occurrences &&
      generatedCount >= Number(recurring.max_occurrences);
    const nextStatus =
      completedByEndDate || completedByCount ? "Completed" : "Active";

    await connection.query(
      `UPDATE recurring_invoice_runs
       SET generated_invoice_id = ?, status = 'SUCCESS',
           error_message = NULL, generated_at = NOW()
       WHERE recurring_invoice_id = ? AND scheduled_date = ?`,
      [invoice.invoice_id, id, scheduledDate]
    );
    await connection.query(
      `UPDATE recurring_invoices
       SET next_invoice_date = ?, generated_count = ?, status = ?
       WHERE id = ? AND company_id = ?`,
      [nextDate, generatedCount, nextStatus, id, companyId]
    );

    await connection.commit();
    return {
      ...invoice,
      already_generated: false,
      recurring_invoice_id: Number(id),
      scheduled_date: scheduledDate,
      next_invoice_date: nextDate,
      recurring_status: nextStatus,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Recurring invoice rollback failed:", rollbackError.message);
    }

    if (
      scheduledDate &&
      !["NOT_ACTIVE", "NOT_DUE", "COMPLETED", "NOT_FOUND"].includes(error.code)
    ) {
      await recordFailedRun({
        recurringInvoiceId: Number(id),
        companyId,
        scheduledDate,
        error,
      });
    }
    throw error;
  } finally {
    connection.release();
  }
};

const getRecurringInvoiceHistory = async (id, companyId) => {
  await ensureRecurringInvoiceSchema();
  const [templates] = await db.query(
    "SELECT id FROM recurring_invoices WHERE id = ? AND company_id = ? LIMIT 1",
    [id, companyId]
  );
  if (!templates.length) {
    throw new RecurringInvoiceError("Recurring invoice not found", "NOT_FOUND", 404);
  }

  const [rows] = await db.query(
    `SELECT rir.scheduled_date, rir.generated_invoice_id,
            i.invoice_number, rir.generated_at, rir.status, rir.error_message
     FROM recurring_invoice_runs rir
     LEFT JOIN invoices i
       ON i.id = rir.generated_invoice_id AND i.company_id = rir.company_id
     WHERE rir.recurring_invoice_id = ? AND rir.company_id = ?
     ORDER BY rir.scheduled_date DESC, rir.id DESC`,
    [id, companyId]
  );
  return rows;
};

module.exports = {
  FREQUENCIES,
  RecurringInvoiceError,
  addFrequency: addRecurringFrequency,
  ensureRecurringInvoiceSchema,
  generateRecurringInvoice,
  getRecurringInvoiceHistory,
  toDateString,
};
