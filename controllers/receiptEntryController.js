const db = require("../db/connection");
const {
  createReceipt,
  ensureReceiptEntrySchema,
  getCustomerOpenInvoices,
  listAccountOptions,
} = require("../services/receiptEntryService");

exports.getReceiptOptions = async (req, res) => {
  try {
    await ensureReceiptEntrySchema();
    const [{ received_in_accounts, other_credit_accounts }, [customers]] =
      await Promise.all([
        listAccountOptions(req.user.company_id),
        db.query(
          `SELECT id, name
           FROM customers
           WHERE company_id = ?
           ORDER BY name`,
          [req.user.company_id]
        ),
      ]);

    res.json({
      success: true,
      data: {
        received_in_accounts,
        other_credit_accounts,
        customers,
      },
    });
  } catch (error) {
    console.error("Receipt options error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load receipt options",
    });
  }
};

exports.getCustomerInvoices = async (req, res) => {
  try {
    await ensureReceiptEntrySchema();
    const result = await getCustomerOpenInvoices(
      req.user.company_id,
      req.params.customerId
    );
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Receipt customer invoices error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load customer invoices",
    });
  }
};

exports.createReceiptEntry = async (req, res) => {
  try {
    const result = await createReceipt(req.body, req.user);
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "This receipt was already saved"
        : "Receipt created successfully",
      ...result,
    });
  } catch (error) {
    console.error("Receipt creation error:", {
      companyId: req.user.company_id,
      status: error.status || 500,
      message: error.status ? error.message : "Internal receipt error",
    });
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to create receipt",
    });
  }
};

exports.getReceiptEntryById = async (req, res) => {
  try {
    await ensureReceiptEntrySchema();
    const [rows] = await db.query(
      `SELECT re.id, re.receipt_number AS receipt_no, re.receipt_date,
              re.receipt_type, re.amount, re.payment_mode, re.reference_number,
              re.narration, re.customer_id, re.invoice_id, re.journal_entry_id,
              received_in.account_name AS received_in_account_name,
              received_in.account_code AS received_in_account_code,
              received_from.account_name AS received_from_account_name,
              received_from.account_code AS received_from_account_code,
              c.name AS customer_name, i.invoice_number
       FROM receipt_entries re
       INNER JOIN accounts received_in
         ON received_in.id = re.received_in_account_id
        AND received_in.company_id = re.company_id
       INNER JOIN accounts received_from
         ON received_from.id = re.received_from_account_id
        AND received_from.company_id = re.company_id
       LEFT JOIN customers c
         ON c.id = re.customer_id AND c.company_id = re.company_id
       LEFT JOIN invoices i
         ON i.id = re.invoice_id AND i.company_id = re.company_id
       WHERE re.id = ? AND re.company_id = ?
       LIMIT 1`,
      [req.params.id, req.user.company_id]
    );

    if (!rows.length) {
      const [legacyRows] = await db.query(
        `SELECT je.id, je.journal_no AS receipt_no,
                je.journal_date AS receipt_date, je.narration,
                je.total_debit AS amount,
                received_in.account_name AS received_in_account_name,
                received_in.account_code AS received_in_account_code,
                received_from.account_name AS received_from_account_name,
                received_from.account_code AS received_from_account_code
         FROM journal_entries je
         LEFT JOIN journal_entry_details debit_line
           ON debit_line.journal_entry_id = je.id AND debit_line.debit > 0
         LEFT JOIN accounts received_in
           ON received_in.id = debit_line.account_id
          AND received_in.company_id = je.company_id
         LEFT JOIN journal_entry_details credit_line
           ON credit_line.journal_entry_id = je.id AND credit_line.credit > 0
         LEFT JOIN accounts received_from
           ON received_from.id = credit_line.account_id
          AND received_from.company_id = je.company_id
         WHERE je.id = ? AND je.company_id = ?
           AND je.journal_no LIKE 'RCPT-%'
         LIMIT 1`,
        [req.params.id, req.user.company_id]
      );
      if (!legacyRows.length) {
        return res.status(404).json({
          success: false,
          message: "Receipt voucher not found",
        });
      }
      return res.json({ success: true, data: legacyRows[0] });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Get receipt voucher error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load receipt voucher",
    });
  }
};
