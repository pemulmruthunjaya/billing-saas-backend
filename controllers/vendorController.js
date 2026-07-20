const pool = require("../db/connection");

// CREATE Vendor
exports.createVendor = async (req, res) => {
    try {
        const { name, phone, email, gst_number, address } = req.body;
        const company_id = req.user.company_id;

        if (!name) {
            return res.status(400).json({ message: "Vendor name is required" });
        }

        const [result] = await pool.query(
            `INSERT INTO vendors (name, phone, email, gst_number, address, company_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, phone, email, gst_number, address, company_id]
        );

        res.status(201).json({
            message: "Vendor created successfully",
            vendorId: result.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET All Vendors
exports.getVendors = async (req, res) => {
    try {
        const company_id = req.user.company_id;

        const [rows] = await pool.query(
            `SELECT
                v.*,
                COALESCE(stats.balance, 0) AS balance,
                COALESCE(stats.paid_total, 0) AS paid_total,
                COALESCE(stats.bill_count, 0) AS bill_count
             FROM vendors v
             LEFT JOIN (
                SELECT
                    b.vendor_id,
                    SUM(
                        GREATEST(
                            b.total_amount -
                            CASE
                                WHEN b.status = 'Paid' THEN b.total_amount
                                ELSE LEAST(COALESCE(payment_totals.paid_amount, 0), b.total_amount)
                            END,
                            0
                        )
                    ) AS balance,
                    SUM(
                        CASE
                            WHEN b.status = 'Paid' THEN b.total_amount
                            ELSE LEAST(COALESCE(payment_totals.paid_amount, 0), b.total_amount)
                        END
                    ) AS paid_total,
                    COUNT(*) AS bill_count
                FROM bills b
                LEFT JOIN (
                    SELECT bill_id, company_id, SUM(amount) AS paid_amount
                    FROM vendor_payments
                    GROUP BY bill_id, company_id
                ) payment_totals
                    ON payment_totals.bill_id = b.id
                   AND payment_totals.company_id = b.company_id
                WHERE b.company_id = ?
                  AND b.total_amount > 0
                GROUP BY b.vendor_id
             ) stats ON stats.vendor_id = v.id
             WHERE v.company_id = ?
               AND (v.status IS NULL OR v.status <> 'Inactive')
             ORDER BY created_at DESC`,
            [company_id, company_id]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET One Vendor
exports.getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;

        const [rows] = await pool.query(
            `SELECT
                v.*,
                COALESCE(stats.balance, 0) AS balance,
                COALESCE(stats.paid_total, 0) AS paid_total,
                COALESCE(stats.bill_count, 0) AS bill_count
             FROM vendors v
             LEFT JOIN (
                SELECT
                    b.vendor_id,
                    SUM(
                        GREATEST(
                            b.total_amount -
                            CASE
                                WHEN b.status = 'Paid' THEN b.total_amount
                                ELSE LEAST(COALESCE(payment_totals.paid_amount, 0), b.total_amount)
                            END,
                            0
                        )
                    ) AS balance,
                    SUM(
                        CASE
                            WHEN b.status = 'Paid' THEN b.total_amount
                            ELSE LEAST(COALESCE(payment_totals.paid_amount, 0), b.total_amount)
                        END
                    ) AS paid_total,
                    COUNT(*) AS bill_count
                FROM bills b
                LEFT JOIN (
                    SELECT bill_id, company_id, SUM(amount) AS paid_amount
                    FROM vendor_payments
                    GROUP BY bill_id, company_id
                ) payment_totals
                    ON payment_totals.bill_id = b.id
                   AND payment_totals.company_id = b.company_id
                WHERE b.company_id = ?
                  AND b.total_amount > 0
                GROUP BY b.vendor_id
             ) stats ON stats.vendor_id = v.id
             WHERE v.id = ?
               AND v.company_id = ?
               AND (v.status IS NULL OR v.status <> 'Inactive')`,
            [company_id, id, company_id]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// UPDATE Vendor
exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, gst_number, address, status } = req.body;
        const company_id = req.user.company_id;

        const [result] = await pool.query(
            `UPDATE vendors
             SET name=?, phone=?, email=?, gst_number=?, address=?, status=?
             WHERE id=? AND company_id=?`,
            [name, phone, email, gst_number, address, status, id, company_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        res.json({ message: "Vendor updated successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE Vendor
exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;

        const [result] = await pool.query(
            `UPDATE vendors SET status='Inactive' WHERE id=? AND company_id=?`,
            [id, company_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        res.json({ message: "Vendor set to Inactive" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
