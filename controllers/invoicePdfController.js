const PDFDocument = require("pdfkit");
const db = require("../db/connection");

/**
 * GENERATE INVOICE PDF
 * OWNER & STAFF
 */
exports.generateInvoicePDF = async (req, res) => {
  try {
    const { id: invoiceId } = req.params;
    const company_id = req.user.company_id;

    /* 1️⃣ Fetch invoice */
    const [[invoice]] = await db.query(
      `SELECT *
       FROM invoices
       WHERE id = ? AND company_id = ?`,
      [invoiceId, company_id]
    );

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    /* 2️⃣ Fetch company */
    const [[company]] = await db.query(
      `SELECT name, address, gst_number
       FROM companies
       WHERE id = ?`,
      [company_id]
    );

    /* 3️⃣ Fetch invoice items */
    const [items] = await db.query(
      `SELECT item_name, quantity, unit_price, total_price
       FROM invoice_items
       WHERE invoice_id = ? AND company_id = ?`,
      [invoiceId, company_id]
    );

    /* 4️⃣ Create PDF */
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice.invoice_number}.pdf`
    );
    doc.pipe(res);

    /* ================= HEADER ================= */

    doc
      .fontSize(18)
      .text(company.name || "Your Company Name Pvt Ltd", 50, 50);

    doc
      .fontSize(10)
      .text(company.address || "Address not provided", 50, 75)
      .text(`GSTIN: ${company.gst_number || "N/A"}`, 50, 95);

    doc
      .fontSize(18)
      .text("INVOICE", 400, 50, { align: "right" });

    doc
      .fontSize(10)
      .text(`Invoice No: ${invoice.invoice_number}`, 400, 75, { align: "right" })
      .text(
        `Invoice Date: ${new Date(invoice.invoice_date).toISOString().split("T")[0]}`,
        400,
        90,
        { align: "right" }
      );

    /* ================= BILL TO ================= */

    doc.moveDown(3);
    doc.fontSize(11).text("Bill To:", 50);
    doc.fontSize(10).text(invoice.customer_name, 50);

    /* ================= ITEMS TABLE ================= */

    doc.moveDown(2);

    let tableTop = doc.y;
    const itemX = 50;
    const qtyX = 260;
    const priceX = 320;
    const totalX = 420;

    doc.fontSize(11).text("Item", itemX, tableTop);
    doc.text("Qty", qtyX, tableTop);
    doc.text("Price", priceX, tableTop);
    doc.text("Total", totalX, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;

    items.forEach((item, index) => {
      doc
        .fontSize(10)
        .text(`${index + 1}. ${item.item_name}`, itemX, y, { width: 190 });

      doc.text(Number(item.quantity).toFixed(2), qtyX, y);
      doc.text(Number(item.unit_price).toFixed(2), priceX, y);
      doc.text(Number(item.total_price).toFixed(2), totalX, y);

      y += 18;
    });

    /* ================= TOTALS ================= */

    doc.moveDown(2);

    const summaryY = y + 10;

    doc.fontSize(10).text(`Subtotal: ${invoice.subtotal.toFixed(2)}`, 400, summaryY, {
      align: "right"
    });

    doc.text(
      `Tax (${invoice.tax_rate.toFixed(2)}%): ${invoice.tax_amount.toFixed(2)}`,
      400,
      summaryY + 15,
      { align: "right" }
    );

    doc
      .fontSize(11)
      .text(`Total: ${invoice.total_amount.toFixed(2)}`, 400, summaryY + 30, {
        align: "right"
      });

    /* ================= FOOTER ================= */

    doc.moveDown(4);
    doc.fontSize(10).text("Thank you for your business!", 50);

    doc.end();

  } catch (error) {
    console.error("❌ Invoice PDF error:", error);
    res.status(500).json({ message: "Failed to generate invoice PDF" });
  }
};
