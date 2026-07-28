const db = require("../db/connection");
const {
  FREQUENCIES,
  ensureRecurringInvoiceSchema,
  generateRecurringInvoice,
  toDateString,
} = require("../services/recurringInvoiceService");

const STATUSES = ["Draft", "Active", "Paused", "Completed", "Cancelled"];

const normalizePayload = (body = {}) => ({
  customer_id: Number(body.customer_id),
  frequency: String(body.frequency || "").toLowerCase(),
  repeat_every: Number(body.repeat_every),
  start_date: toDateString(body.start_date),
  end_date: toDateString(body.end_date),
  next_invoice_date: toDateString(body.next_invoice_date || body.start_date),
  auto_email: body.auto_email === true || Number(body.auto_email) === 1 ? 1 : 0,
  status: STATUSES.includes(body.status) ? body.status : "Draft",
  notes: String(body.notes || "").trim() || null,
  items: Array.isArray(body.items) ? body.items : [],
});

const validatePayload = async (payload, companyId) => {
  if (!payload.customer_id) return "Customer is required";
  if (!payload.items.length) return "At least one item is required";
  if (!payload.start_date) return "Start date is required";
  if (!FREQUENCIES.includes(payload.frequency)) return "Frequency is required";
  if (!Number.isInteger(payload.repeat_every) || payload.repeat_every < 1) {
    return "Repeat every must be at least 1";
  }
  if (payload.end_date && payload.end_date < payload.start_date) {
    return "End date cannot be before start date";
  }

  const [customers] = await db.query(
    "SELECT id FROM customers WHERE id = ? AND company_id = ? LIMIT 1",
    [payload.customer_id, companyId]
  );
  if (!customers.length) return "Customer not found";

  const productIds = payload.items.map((item) => Number(item.product_id));
  if (productIds.some((id) => !id)) return "Each item must have a product";

  for (const item of payload.items) {
    if (Number(item.quantity) <= 0) return "Item quantity must be greater than zero";
    if (Number(item.unit_price) < 0) return "Item price cannot be negative";
    if (Number(item.tax_rate) < 0) return "Tax rate cannot be negative";
  }

  const placeholders = productIds.map(() => "?").join(",");
  const [products] = await db.query(
    `SELECT id FROM products WHERE company_id = ? AND id IN (${placeholders})`,
    [companyId, ...productIds]
  );
  if (new Set(products.map((product) => Number(product.id))).size !== new Set(productIds).size) {
    return "One or more products were not found";
  }

  return null;
};

const insertItems = async (connection, recurringInvoiceId, items) => {
  for (const item of items) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const amount = quantity * unitPrice;
    await connection.query(
      `INSERT INTO recurring_invoice_items
       (recurring_invoice_id, product_id, description, quantity, unit_price, tax_rate, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        recurringInvoiceId,
        Number(item.product_id),
        String(item.description || item.name || "").trim(),
        quantity,
        unitPrice,
        Number(item.tax_rate || 0),
        amount,
      ]
    );
  }
};

exports.getAll = async (req, res) => {
  try {
    await ensureRecurringInvoiceSchema();
    const [rows] = await db.query(
      `SELECT ri.*, c.name AS customer_name,
              COUNT(rii.id) AS item_count,
              COALESCE(SUM(rii.amount), 0) AS subtotal
       FROM recurring_invoices ri
       INNER JOIN customers c
         ON c.id = ri.customer_id AND c.company_id = ri.company_id
       LEFT JOIN recurring_invoice_items rii ON rii.recurring_invoice_id = ri.id
       WHERE ri.company_id = ?
       GROUP BY ri.id, c.name
       ORDER BY ri.created_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Get recurring invoices error:", error);
    res.status(500).json({ message: "Failed to load recurring invoices" });
  }
};

exports.getOne = async (req, res) => {
  try {
    await ensureRecurringInvoiceSchema();
    const [rows] = await db.query(
      `SELECT ri.*, c.name AS customer_name
       FROM recurring_invoices ri
       INNER JOIN customers c
         ON c.id = ri.customer_id AND c.company_id = ri.company_id
       WHERE ri.id = ? AND ri.company_id = ?
       LIMIT 1`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ message: "Recurring invoice not found" });

    const [items] = await db.query(
      `SELECT rii.*, p.name AS product_name, p.mrp, p.hsn
       FROM recurring_invoice_items rii
       INNER JOIN products p ON p.id = rii.product_id
       WHERE rii.recurring_invoice_id = ?
       ORDER BY rii.id`,
      [req.params.id]
    );
    res.json({ ...rows[0], items });
  } catch (error) {
    console.error("Get recurring invoice error:", error);
    res.status(500).json({ message: "Failed to load recurring invoice" });
  }
};

exports.create = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureRecurringInvoiceSchema();
    const payload = normalizePayload(req.body);
    const validationError = await validatePayload(payload, req.user.company_id);
    if (validationError) return res.status(400).json({ message: validationError });

    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO recurring_invoices
       (customer_id, frequency, repeat_every, start_date, end_date,
        next_invoice_date, auto_email, status, notes, company_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.customer_id,
        payload.frequency,
        payload.repeat_every,
        payload.start_date,
        payload.end_date,
        payload.next_invoice_date,
        payload.auto_email,
        payload.status,
        payload.notes,
        req.user.company_id,
        req.user.user_id,
      ]
    );
    await insertItems(connection, result.insertId, payload.items);
    await connection.commit();
    res.status(201).json({ id: result.insertId, message: "Recurring invoice created" });
  } catch (error) {
    await connection.rollback();
    console.error("Create recurring invoice error:", error);
    res.status(500).json({ message: "Failed to create recurring invoice" });
  } finally {
    connection.release();
  }
};

exports.update = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureRecurringInvoiceSchema();
    const payload = normalizePayload(req.body);
    const validationError = await validatePayload(payload, req.user.company_id);
    if (validationError) return res.status(400).json({ message: validationError });

    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE recurring_invoices
       SET customer_id = ?, frequency = ?, repeat_every = ?, start_date = ?,
           end_date = ?, next_invoice_date = ?, auto_email = ?, status = ?, notes = ?
       WHERE id = ? AND company_id = ?`,
      [
        payload.customer_id,
        payload.frequency,
        payload.repeat_every,
        payload.start_date,
        payload.end_date,
        payload.next_invoice_date,
        payload.auto_email,
        payload.status,
        payload.notes,
        req.params.id,
        req.user.company_id,
      ]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ message: "Recurring invoice not found" });
    }

    await connection.query(
      "DELETE FROM recurring_invoice_items WHERE recurring_invoice_id = ?",
      [req.params.id]
    );
    await insertItems(connection, req.params.id, payload.items);
    await connection.commit();
    res.json({ message: "Recurring invoice updated" });
  } catch (error) {
    await connection.rollback();
    console.error("Update recurring invoice error:", error);
    res.status(500).json({ message: "Failed to update recurring invoice" });
  } finally {
    connection.release();
  }
};

exports.remove = async (req, res) => {
  try {
    await ensureRecurringInvoiceSchema();
    const [result] = await db.query(
      "DELETE FROM recurring_invoices WHERE id = ? AND company_id = ?",
      [req.params.id, req.user.company_id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Recurring invoice not found" });
    res.json({ message: "Recurring invoice deleted" });
  } catch (error) {
    console.error("Delete recurring invoice error:", error);
    res.status(500).json({ message: "Failed to delete recurring invoice" });
  }
};

const setStatus = (status) => async (req, res) => {
  try {
    await ensureRecurringInvoiceSchema();
    const allowedCurrent =
      status === "Paused" ? ["Active"] : ["Paused"];
    const [result] = await db.query(
      `UPDATE recurring_invoices SET status = ?
       WHERE id = ? AND company_id = ? AND status IN (?)`,
      [status, req.params.id, req.user.company_id, allowedCurrent]
    );
    if (!result.affectedRows) {
      return res.status(409).json({
        message: status === "Paused"
          ? "Only an active recurring invoice can be paused"
          : "Only a paused recurring invoice can be resumed",
      });
    }
    res.json({ message: `Recurring invoice ${status === "Paused" ? "paused" : "resumed"}` });
  } catch (error) {
    console.error("Recurring invoice status error:", error);
    res.status(500).json({ message: "Failed to update recurring invoice status" });
  }
};

exports.pause = setStatus("Paused");
exports.resume = setStatus("Active");
exports.generateRecurringInvoice = generateRecurringInvoice;
