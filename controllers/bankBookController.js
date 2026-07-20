const db = require("../db/connection");

/**
 * =========================================================
 * BANK BOOK
 * =========================================================
 */

exports.getBankBook = async (req, res) => {

    try {
        const company_id = req.user.company_id;

        const {
            from_date,
            to_date
        } = req.query;

        /**
         * =====================================================
         * GET BANK ACCOUNT
         * =====================================================
         */

        const [bankAccounts] = await db.query(

            `
            SELECT id
            FROM accounts
            WHERE LOWER(account_name) = 'bank'
            AND company_id = ?
            LIMIT 1
            `,
            [company_id]

        );

        if (!bankAccounts.length) {

            return res.status(404).json({

                success: false,

                message:
                    "Bank account not found"

            });

        }

        const bankAccountId =
            bankAccounts[0].id;

        /**
         * =====================================================
         * DATE FILTER
         * =====================================================
         */

        let dateFilter = "";

        const params = [bankAccountId, company_id];

        if (
            from_date &&
            to_date
        ) {

            dateFilter = `
                AND je.journal_date
                BETWEEN ? AND ?
            `;

            params.push(
                from_date,
                to_date
            );

        }

        /**
         * =====================================================
         * FETCH BANK ENTRIES
         * =====================================================
         */

        const [rows] = await db.query(

            `
            SELECT

                je.id,
                je.journal_no,
                je.journal_date,
                je.narration,

                jed.debit,
                jed.credit

            FROM journal_entry_details jed

            INNER JOIN journal_entries je
                ON je.id = jed.journal_entry_id

            WHERE
                jed.account_id = ?
                AND je.company_id = ?
                ${dateFilter}

            ORDER BY
                je.journal_date ASC,
                je.id ASC
            `,

            params

        );

        /**
         * =====================================================
         * TOTALS
         * =====================================================
         */

        let totalReceipts = 0;
        let totalPayments = 0;

        const data = rows.map(
            (row) => {

                const debit =
                    Number(
                        row.debit || 0
                    );

                const credit =
                    Number(
                        row.credit || 0
                    );

                totalReceipts += debit;
                totalPayments += credit;

                return {

                    id: row.id,

                    journal_no:
                        row.journal_no,

                    journal_date:
                        row.journal_date,

                    narration:
                        row.narration,

                    receipt:
                        debit,

                    payment:
                        credit

                };

            }
        );

        /**
         * =====================================================
         * RESPONSE
         * =====================================================
         */

        res.status(200).json({

            success: true,

            summary: {

                total_receipts:
                    totalReceipts,

                total_payments:
                    totalPayments,

                closing_balance:
                    totalReceipts -
                    totalPayments

            },

            data

        });

    } catch (error) {

        console.error(
            "Bank Book Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to fetch Bank Book",

            error:
                error.message

        });

    }

};
