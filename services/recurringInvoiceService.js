const db = require("../db/connection");
const invoiceController = require("../controllers/invoiceController");

const FREQUENCIES = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

let schemaReady = false;

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

  schemaReady = true;
};

const toDateString = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const addFrequency = (dateValue, frequency, repeatEvery = 1) => {
  const date = new Date(`${toDateString(dateValue)}T00:00:00Z`);
  const repeat = Math.max(1, Number(repeatEvery));
  const addMonths = (monthCount) => {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + monthCount);
    const lastDayOfTargetMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
    ).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  };

  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + repeat);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + (7 * repeat));
  if (frequency === "monthly") addMonths(repeat);
  if (frequency === "quarterly") addMonths(3 * repeat);
  if (frequency === "yearly") addMonths(12 * repeat);

  return toDateString(date);
};

const invokeExistingInvoiceCreation = (user, payload) =>
  new Promise((resolve, reject) => {
    let statusCode = 200;
    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        if (statusCode >= 400) {
          const error = new Error(data?.message || "Invoice creation failed");
          error.status = statusCode;
          error.data = data;
          reject(error);
          return this;
        }
        resolve(data);
        return this;
      },
    };

    Promise.resolve(
      invoiceController.createInvoice({ body: payload, user }, response)
    ).catch(reject);
  });

const generateRecurringInvoice = async (id, context = {}) => {
  await ensureRecurringInvoiceSchema();

  const companyId = context.company_id || context.companyId;
  if (!companyId) throw new Error("company_id is required");

  const [rows] = await db.query(
    `SELECT ri.*, c.name AS customer_name
     FROM recurring_invoices ri
     INNER JOIN customers c
       ON c.id = ri.customer_id AND c.company_id = ri.company_id
     WHERE ri.id = ? AND ri.company_id = ?
     LIMIT 1`,
    [id, companyId]
  );

  if (!rows.length) throw new Error("Recurring invoice not found");
  const recurring = rows[0];

  if (recurring.status !== "Active") {
    throw new Error("Only active recurring invoices can generate invoices");
  }

  const today = toDateString(new Date());
  const dueDate = toDateString(recurring.next_invoice_date);
  if (dueDate > today) throw new Error("Recurring invoice is not due yet");

  const [items] = await db.query(
    `SELECT rii.*, p.name AS product_name
     FROM recurring_invoice_items rii
     INNER JOIN products p ON p.id = rii.product_id
     WHERE rii.recurring_invoice_id = ?`,
    [id]
  );

  if (!items.length) throw new Error("Recurring invoice has no items");

  const invoice = await invokeExistingInvoiceCreation(
    {
      ...context,
      company_id: companyId,
      user_id: context.user_id || recurring.created_by,
    },
    {
      customer_id: recurring.customer_id,
      customer_name: recurring.customer_name,
      invoice_date: dueDate,
      items: items.map((item) => ({
        product_id: item.product_id,
        name: item.description || item.product_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        gst_rate: Number(item.tax_rate),
      })),
    }
  );

  const nextDate = addFrequency(
    dueDate,
    recurring.frequency,
    recurring.repeat_every
  );
  const completed =
    recurring.end_date && nextDate > toDateString(recurring.end_date);

  await db.query(
    `UPDATE recurring_invoices
     SET next_invoice_date = ?, status = ?
     WHERE id = ? AND company_id = ?`,
    [nextDate, completed ? "Completed" : "Active", id, companyId]
  );

  return {
    ...invoice,
    recurring_invoice_id: Number(id),
    next_invoice_date: nextDate,
    recurring_status: completed ? "Completed" : "Active",
  };
};

module.exports = {
  FREQUENCIES,
  addFrequency,
  ensureRecurringInvoiceSchema,
  generateRecurringInvoice,
  toDateString,
};
