const db = require("../db/connection");

/**
 * =========================================================
 * GENERATE RECEIPT NUMBER
 * =========================================================
 */
const generateReceiptNumber = async (company_id) => {

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

    return `RCPT-${String(nextId).padStart(5, "0")}`;

};

/**
 * =========================================================
 * CREATE RECEIPT ENTRY
 * =========================================================
 */
exports.createReceiptEntry = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            receipt_date,
            received_in_account_id,
            received_from_account_id,
            amount,
            narration
        } = req.body;

        const company_id = req.user.company_id;

        /**
         * VALIDATION
         */
        if (
            !receipt_date ||
            !received_in_account_id ||
            !received_from_account_id ||
            !amount
        ) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }

        if (
            Number(received_in_account_id) ===
            Number(received_from_account_id)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Received In and Received From cannot be same account"
            });

        }

        const receiptNo =
            await generateReceiptNumber(company_id);

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
                    receiptNo,
                    receipt_date,
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
         * CASH / BANK RECEIVED
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
                received_in_account_id,
                amount,
                0,
                narration || "Receipt Entry"
            ]

        );

        /**
         * CREDIT ENTRY
         * RECEIVED FROM ACCOUNT
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
                received_from_account_id,
                0,
                amount,
                narration || "Receipt Entry"
            ]

        );

        await connection.commit();

        return res.status(201).json({

            success: true,

            message:
                "Receipt Entry created successfully",

            receipt_no:
                receiptNo,

            journal_entry_id:
                journalEntryId

        });

    } catch (error) {

        await connection.rollback();

        console.log(
            "RECEIPT ENTRY ERROR:",
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
 * GET RECEIPT VOUCHER BY JOURNAL ID
 * =========================================================
 */
exports.getReceiptEntryById = async (req, res) => {

    try {

        const { id } = req.params;
        const company_id = req.user.company_id;

        const [rows] = await db.query(
            `
            SELECT
                je.id,
                je.journal_no AS receipt_no,
                je.journal_date AS receipt_date,
                je.narration,
                je.total_debit AS amount,
                received_in.account_id AS received_in_account_id,
                received_in.account_name AS received_in_account_name,
                received_in.account_code AS received_in_account_code,
                received_from.account_id AS received_from_account_id,
                received_from.account_name AS received_from_account_name,
                received_from.account_code AS received_from_account_code
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
            ) received_in
              ON received_in.journal_entry_id = je.id
            LEFT JOIN (
                SELECT
                    jed.journal_entry_id,
                    jed.account_id,
                    a.account_name,
                    a.account_code
                FROM journal_entry_details jed
                LEFT JOIN accounts a ON a.id = jed.account_id
                WHERE jed.credit > 0
            ) received_from
              ON received_from.journal_entry_id = je.id
            WHERE je.id = ?
              AND je.company_id = ?
              AND je.journal_no LIKE 'RCPT-%'
            LIMIT 1
            `,
            [id, company_id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Receipt voucher not found"
            });
        }

        return res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {

        console.log("GET RECEIPT VOUCHER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};
