const db = require("../db/connection");

let billStatusColumnReady = false;

const ensureBillStatusColumn = async () => {
  if (billStatusColumnReady) {
    return;
  }

  await db.query(
    "ALTER TABLE bills MODIFY status VARCHAR(30) NOT NULL DEFAULT 'Unpaid'"
  );

  billStatusColumnReady = true;
};

/*
CREATE VENDOR PAYMENT
*/
exports.createVendorPayment = async (req, res) => {
  try {

    const { vendor_id, bill_id, amount, payment_date, payment_method, notes } = req.body;
    const company_id = req.user.company_id;
    const paymentAmount = Number(amount || 0);

    if (!vendor_id || !paymentAmount) {
      return res.status(400).json({
        message: "Vendor and amount are required"
      });
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({
        message: "Payment amount must be greater than zero"
      });
    }

    if (bill_id) {
      await ensureBillStatusColumn();

      const [billRows] = await db.query(
        `SELECT id, vendor_id, total_amount
         FROM bills
         WHERE id = ? AND vendor_id = ? AND company_id = ?`,
        [bill_id, vendor_id, company_id]
      );

      if (!billRows.length) {
        return res.status(404).json({
          message: "Bill not found for this vendor"
        });
      }

      const bill = billRows[0];
      const [paidRows] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid_amount
         FROM vendor_payments
         WHERE bill_id = ? AND company_id = ?`,
        [bill_id, company_id]
      );

      const alreadyPaid = Number(paidRows[0]?.paid_amount || 0);
      const totalAmount = Number(bill.total_amount || 0);

      if (alreadyPaid + paymentAmount > totalAmount) {
        return res.status(400).json({
          message: `Payment exceeds remaining amount. Remaining: ${totalAmount - alreadyPaid}`
        });
      }
    }

    /* 1️⃣ INSERT INTO vendor_payments */
    const [result] = await db.query(
      `INSERT INTO vendor_payments
      (vendor_id, bill_id, amount, payment_date, payment_method, notes, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        vendor_id,
        bill_id || null,
        paymentAmount,
        payment_date || null,
        payment_method || null,
        notes || null,
        company_id
      ]
    );

    const payment_id = result.insertId;

    /* 2️⃣ INSERT LEDGER ENTRY */
    await db.query(
      `INSERT INTO ledger_entries
      (company_id, entity_type, entity_id, reference_type, reference_id, debit, credit, transaction_date)
      VALUES (?, 'vendor', ?, 'payment', ?, 0, ?, ?)`,
      [
        company_id,
        vendor_id,
        payment_id,
        paymentAmount,
        payment_date || new Date()
      ]
    );

    if (bill_id) {
      const [billRows] = await db.query(
        `SELECT total_amount
         FROM bills
         WHERE id = ? AND company_id = ?`,
        [bill_id, company_id]
      );

      const [paidRows] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid_amount
         FROM vendor_payments
         WHERE bill_id = ? AND company_id = ?`,
        [bill_id, company_id]
      );

      const totalAmount = Number(billRows[0]?.total_amount || 0);
      const paidAmount = Number(paidRows[0]?.paid_amount || 0);
      const status = paidAmount >= totalAmount ? "Paid" : "Partial Paid";

      await db.query(
        "UPDATE bills SET status = ? WHERE id = ? AND company_id = ?",
        [status, bill_id, company_id]
      );
    }

    res.status(201).json({
      message: "Vendor payment recorded",
      payment_id: payment_id
    });

  } catch (error) {
    console.error("Create vendor payment error:", error);
    res.status(500).json({
      message: "Failed to record vendor payment"
    });
  }
};


/*
GET VENDOR PAYMENTS
*/
exports.getVendorPayments = async (req, res) => {
  try {

    const { vendor_id } = req.query;
    const company_id = req.user.company_id;

    let query = `
      SELECT * FROM vendor_payments
      WHERE company_id = ?
    `;

    const params = [company_id];

    if (vendor_id) {
      query += " AND vendor_id = ?";
      params.push(vendor_id);
    }

    query += " ORDER BY id DESC";

    const [payments] = await db.query(query, params);

    res.json(payments);

  } catch (error) {
    console.error("Get vendor payments error:", error);
    res.status(500).json({
      message: "Failed to fetch vendor payments"
    });
  }
};
