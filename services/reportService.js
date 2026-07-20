const db = require("../db/connection");

/**
 * 📊 GST SUMMARY (SALES ONLY - SAFE VERSION)
 */
const getGSTSummary = async (fromDate, toDate) => {
  try {
    const salesQuery = `
      SELECT 
        SUM(cgst) as sales_cgst,
        SUM(sgst) as sales_sgst,
        SUM(igst) as sales_igst
      FROM invoices
      WHERE DATE(created_at) BETWEEN ? AND ?
    `;

    const [sales] = await db.query(salesQuery, [fromDate, toDate]);

    return {
      sales: {
        sales_cgst: sales[0]?.sales_cgst || 0,
        sales_sgst: sales[0]?.sales_sgst || 0,
        sales_igst: sales[0]?.sales_igst || 0,
      },
      purchase: {
        purchase_cgst: 0,
        purchase_sgst: 0,
        purchase_igst: 0,
      },
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 💰 PROFIT & LOSS
 */
const getProfitLoss = async (fromDate, toDate) => {
  try {
    const revenueQuery = `
      SELECT SUM(total_amount) as total_revenue
      FROM invoices
      WHERE DATE(created_at) BETWEEN ? AND ?
    `;

    const expenseQuery = `
      SELECT SUM(amount) as total_expense
      FROM expenses
      WHERE DATE(created_at) BETWEEN ? AND ?
    `;

    const purchaseQuery = `
      SELECT SUM(total_amount) as total_purchase
      FROM bills
      WHERE DATE(created_at) BETWEEN ? AND ?
    `;

    const [revenue] = await db.query(revenueQuery, [fromDate, toDate]);
    const [expense] = await db.query(expenseQuery, [fromDate, toDate]);
    const [purchase] = await db.query(purchaseQuery, [fromDate, toDate]);

    const totalRevenue = revenue[0]?.total_revenue || 0;
    const totalExpense = expense[0]?.total_expense || 0;
    const totalPurchase = purchase[0]?.total_purchase || 0;

    const netProfit = totalRevenue - (totalExpense + totalPurchase);

    return {
      totalRevenue,
      totalExpense,
      totalPurchase,
      netProfit,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getGSTSummary,
  getProfitLoss,
};