const db = require("../db/connection");

let invoiceStatusColumnReady = false;

const ensureInvoiceStatusColumn = async () => {
  if (invoiceStatusColumnReady) {
    return;
  }

  await db.query(
    "ALTER TABLE invoices MODIFY status VARCHAR(30) NOT NULL DEFAULT 'pending'"
  );

  invoiceStatusColumnReady = true;
};

/**
 * ADD PAYMENT
 * OWNER & STAFF
 */
exports.addPayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amount, payment_date, payment_method, reference_number } = req.body;
    const paymentAmount = Number(amount || 0);

    if (!paymentAmount || !payment_date || !payment_method) {
      return res.status(400).json({
        message: "amount, payment_date, payment_method are required"
      });
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({
        message: "Payment amount must be greater than zero"
      });
    }

    const company_id = req.user.company_id;
    await ensureInvoiceStatusColumn();

    // 🔍 Fetch invoice
    const [invoices] = await db.query(
      "SELECT id, total_amount, status FROM invoices WHERE id = ? AND company_id = ?",
      [invoiceId, company_id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const invoice = invoices[0];

    if (invoice.status === "cancelled") {
      return res.status(400).json({ message: "Cannot pay a cancelled invoice" });
    }

    // 🔢 Get total paid so far
    const [paidRows] = await db.query(
      "SELECT IFNULL(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND company_id = ?",
      [invoiceId, company_id]
    );

    const totalPaid = Number(paidRows[0].paid || 0);
    const remaining = Number(invoice.total_amount || 0) - totalPaid;

    if (paymentAmount > remaining) {
      return res.status(400).json({
        message: "Payment exceeds remaining invoice amount"
      });
    }

    // 💾 Insert payment
    await db.query(
      `INSERT INTO payments (
        invoice_id,
        company_id,
        amount,
        payment_date,
        payment_method,
        reference_number
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        company_id,
        paymentAmount,
        payment_date,
        payment_method,
        reference_number || null
      ]
    );

    const newPaidAmount = totalPaid + paymentAmount;
    const status = newPaidAmount >= Number(invoice.total_amount || 0)
      ? "paid"
      : "partial";

    await db.query(
      "UPDATE invoices SET status = ? WHERE id = ? AND company_id = ?",
      [status, invoiceId, company_id]
    );

    res.status(201).json({
      message: "Payment recorded successfully",
      remaining_amount: remaining - paymentAmount
    });

  } catch (error) {
    console.error("Add payment error:", error);
    res.status(500).json({
      message: "Failed to record payment"
    });
  }
};

/**
 * LIST PAYMENTS FOR AN INVOICE
 */
exports.getPaymentsByInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const company_id = req.user.company_id;

    const [payments] = await db.query(
      `SELECT id, amount, payment_date, payment_method, reference_number
       FROM payments
       WHERE invoice_id = ? AND company_id = ?
       ORDER BY created_at DESC`,
      [invoiceId, company_id]
    );

    res.json({
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({
      message: "Failed to fetch payments"
    });
  }
};
