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
            SELECT a.id
            FROM accounts a
            LEFT JOIN accounts p
              ON p.id = a.parent_account_id AND p.company_id = a.company_id
            WHERE a.company_id = ?
              AND a.status = 1
              AND a.account_type = 'ASSET'
              AND LOWER(CONCAT_WS(' ', a.account_name, p.account_name, a.description))
                  REGEXP 'bank|current account|savings account'
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

        const bankAccountIds = bankAccounts.map((account) => account.id);
        const accountPlaceholders = bankAccountIds.map(() => "?").join(",");

        /**
         * =====================================================
         * DATE FILTER
         * =====================================================
         */

        let dateFilter = "";

        const params = [...bankAccountIds, company_id];

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
                a.account_name,

                jed.debit,
                jed.credit

            FROM journal_entry_details jed

            INNER JOIN journal_entries je
                ON je.id = jed.journal_entry_id
            INNER JOIN accounts a
                ON a.id = jed.account_id
               AND a.company_id = je.company_id

            WHERE
                jed.account_id IN (${accountPlaceholders})
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

                    account_name:
                        row.account_name,

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
