const db = require("../db/connection");

/**
 * GET DASHBOARD DATA
 */
exports.getDashboardData = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    /* ---------------- SALES ---------------- */

    // Total Revenue (Paid invoices)
    const [revenueResult] = await db.query(
      `SELECT IFNULL(SUM(total_amount),0) as totalRevenue 
       FROM invoices 
       WHERE company_id = ? AND LOWER(status) = 'paid'`,
      [company_id]
    );

    // Pending Amount (Unpaid + Partial Paid invoices)
    const [pendingResult] = await db.query(
      `SELECT IFNULL(SUM(total_amount),0) as pendingAmount 
       FROM invoices 
       WHERE company_id = ? AND LOWER(status) IN ('pending','partial','unpaid','partial paid')`,
      [company_id]
    );

    // Invoice Count
    const [invoiceCountResult] = await db.query(
      `SELECT COUNT(*) as invoiceCount 
       FROM invoices 
       WHERE company_id = ?`,
      [company_id]
    );

    // Customer Count
    const [customerCountResult] = await db.query(
      `SELECT COUNT(*) as customerCount 
       FROM customers 
       WHERE company_id = ?`,
      [company_id]
    );

    /* ---------------- PURCHASES ---------------- */

    // Total Purchases (All bills)
    const [purchaseResult] = await db.query(
      `SELECT IFNULL(SUM(total_amount),0) as totalPurchases 
       FROM bills 
       WHERE company_id = ?`,
      [company_id]
    );

    // Total Expenses
    const [expenseResult] = await db.query(
      `SELECT IFNULL(SUM(amount),0) as totalExpenses 
       FROM expenses 
       WHERE company_id = ?`,
      [company_id]
    );

    // Total Payables (Unpaid + Partial Paid bills)
    const [payableResult] = await db.query(
      `SELECT IFNULL(SUM(total_amount),0) as totalPayables 
       FROM bills 
       WHERE company_id = ? 
       AND status IN ('Unpaid','Partial Paid')`,
      [company_id]
    );

    res.json({
      totalRevenue: revenueResult[0].totalRevenue,
      pendingAmount: pendingResult[0].pendingAmount,
      invoiceCount: invoiceCountResult[0].invoiceCount,
      customerCount: customerCountResult[0].customerCount,

      totalPurchases: purchaseResult[0].totalPurchases,
      totalExpenses: expenseResult[0].totalExpenses,
      totalPayables: payableResult[0].totalPayables
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
};
