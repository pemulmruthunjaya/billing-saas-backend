const db = require("../db/connection");
const {
  ensureVendorPaymentSchema,
  recordVendorPayment,
} = require("../services/vendorPaymentService");

exports.createPaymentEntry = async (req, res) => {
  try {
    const result = await recordVendorPayment(req.body, req.user);
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "Payment was already recorded"
        : "Payment Entry created successfully",
      ...result,
    });
  } catch (error) {
    console.error("PAYMENT ENTRY ERROR:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to record vendor payment",
    });
  }
};

exports.getPaymentEntryById = async (req, res) => {
  try {
    await ensureVendorPaymentSchema();
    const [rows] = await db.query(
      `SELECT je.id,je.journal_no payment_no,je.journal_date payment_date,
              je.narration,je.total_debit amount,je.vendor_id,v.name vendor_name,
              paid_to.account_id paid_to_account_id,
              paid_to.account_name paid_to_account_name,
              paid_to.account_code paid_to_account_code,
              paid_from.account_id paid_from_account_id,
              paid_from.account_name paid_from_account_name,
              paid_from.account_code paid_from_account_code
       FROM journal_entries je
       LEFT JOIN vendors v ON v.id=je.vendor_id AND v.company_id=je.company_id
       LEFT JOIN (
         SELECT jed.journal_entry_id,jed.account_id,a.account_name,a.account_code
         FROM journal_entry_details jed LEFT JOIN accounts a ON a.id=jed.account_id
         WHERE jed.debit>0
       ) paid_to ON paid_to.journal_entry_id=je.id
       LEFT JOIN (
         SELECT jed.journal_entry_id,jed.account_id,a.account_name,a.account_code
         FROM journal_entry_details jed LEFT JOIN accounts a ON a.id=jed.account_id
         WHERE jed.credit>0
       ) paid_from ON paid_from.journal_entry_id=je.id
       WHERE je.id=? AND je.company_id=?
         AND (je.journal_no LIKE 'PAY-%' OR je.journal_no LIKE 'VPAY-%')
       LIMIT 1`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Payment voucher not found" });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("GET PAYMENT VOUCHER ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch payment voucher" });
  }
};
