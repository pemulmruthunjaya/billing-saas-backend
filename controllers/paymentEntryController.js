const db = require("../db/connection");

/**
 * =========================================================
 * GENERATE PAYMENT NUMBER
 * =========================================================
 */
const generatePaymentNumber = async (company_id) => {

    const [rows] = await db.query(`
        SELECT id
        FROM journal_entries
        WHERE company_id = ?
        ORDER BY id DESC
        LIMIT 1
    `, [company_id]);

    const nextId =
        rows.length > 0
            ? rows[0].id + 1
            : 1;

    return `PAY-${String(nextId).padStart(5, "0")}`;

};

/**
 * =========================================================
 * CREATE PAYMENT ENTRY
 * =========================================================
 */
exports.createPaymentEntry = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            payment_date,
            paid_from_account_id,
            paid_to_account_id,
            amount,
            narration
        } = req.body;

        const company_id = req.user.company_id;

        /**
         * VALIDATION
         */
        if (
            !payment_date ||
            !paid_from_account_id ||
            !paid_to_account_id ||
            !amount
        ) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }

        if (
            Number(paid_from_account_id) ===
            Number(paid_to_account_id)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Paid From and Paid To cannot be same account"
            });

        }

        const paymentNo =
            await generatePaymentNumber(company_id);

        /**
         * CREATE JOURNAL ENTRY
         */
        const [journalResult] =
            await connection.query(

                `
                INSERT INTO journal_entries
                (
                    journal_no,
                    journal_date,
                    narration,
                    total_debit,
                    total_credit,
                    company_id
                )
                VALUES
                (?, ?, ?, ?, ?, ?)
                `,

                [
                    paymentNo,
                    payment_date,
                    narration || null,
                    amount,
                    amount,
                    company_id
                ]

            );

        const journalEntryId =
            journalResult.insertId;

        /**
         * DEBIT ENTRY
         * EXPENSE / VENDOR ACCOUNT
         */
        await connection.query(

            `
            INSERT INTO journal_entry_details
            (
                journal_entry_id,
                account_id,
                debit,
                credit,
                description
            )
            VALUES
            (?, ?, ?, ?, ?)
            `,

            [
                journalEntryId,
                paid_to_account_id,
                amount,
                0,
                narration || "Payment Entry"
            ]

        );

        /**
         * CREDIT ENTRY
         * CASH / BANK ACCOUNT
         */
        await connection.query(

            `
            INSERT INTO journal_entry_details
            (
                journal_entry_id,
                account_id,
                debit,
                credit,
                description
            )
            VALUES
            (?, ?, ?, ?, ?)
            `,

            [
                journalEntryId,
                paid_from_account_id,
                0,
                amount,
                narration || "Payment Entry"
            ]

        );

        await connection.commit();

        return res.status(201).json({

            success: true,

            message:
                "Payment Entry created successfully",

            payment_no:
                paymentNo,

            journal_entry_id:
                journalEntryId

        });

    } catch (error) {

        await connection.rollback();

        console.log(
            "PAYMENT ENTRY ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message || "Server error"

        });

    } finally {

        connection.release();

    }

};

/**
 * =========================================================
 * GET PAYMENT VOUCHER BY JOURNAL ID
 * =========================================================
 */
exports.getPaymentEntryById = async (req, res) => {

    try {

        const { id } = req.params;
        const company_id = req.user.company_id;

        const [rows] = await db.query(
            `
            SELECT
                je.id,
                je.journal_no AS payment_no,
                je.journal_date AS payment_date,
                je.narration,
                je.total_debit AS amount,
                paid_to.account_id AS paid_to_account_id,
                paid_to.account_name AS paid_to_account_name,
                paid_to.account_code AS paid_to_account_code,
                paid_from.account_id AS paid_from_account_id,
                paid_from.account_name AS paid_from_account_name,
                paid_from.account_code AS paid_from_account_code
            FROM journal_entries je
            LEFT JOIN (
                SELECT
                    jed.journal_entry_id,
                    jed.account_id,
                    a.account_name,
                    a.account_code
                FROM journal_entry_details jed
                LEFT JOIN accounts a ON a.id = jed.account_id
                WHERE jed.debit > 0
            ) paid_to
              ON paid_to.journal_entry_id = je.id
            LEFT JOIN (
                SELECT
                    jed.journal_entry_id,
                    jed.account_id,
                    a.account_name,
                    a.account_code
                FROM journal_entry_details jed
                LEFT JOIN accounts a ON a.id = jed.account_id
                WHERE jed.credit > 0
            ) paid_from
              ON paid_from.journal_entry_id = je.id
            WHERE je.id = ?
              AND je.company_id = ?
              AND je.journal_no LIKE 'PAY-%'
            LIMIT 1
            `,
            [id, company_id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Payment voucher not found"
            });
        }

        return res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {

        console.log("GET PAYMENT VOUCHER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};
