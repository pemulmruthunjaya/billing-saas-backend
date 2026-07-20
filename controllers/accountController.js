const db = require("../db/connection");

/**
 * =========================================================
 * CREATE ACCOUNT
 * =========================================================
 */
exports.createAccount = async (req, res) => {

    try {

        const {
            account_code,
            account_name,
            account_type,
            parent_account_id,
            opening_balance,
            balance_type,
            description
        } = req.body;

        const company_id = req.user.company_id;

        /**
         * VALIDATION
         */
        if (!account_name || !account_type) {

            return res.status(400).json({
                success: false,
                message: "Account name and account type are required"
            });

        }

        /**
         * PREVENT SELF PARENT
         */
        if (
            parent_account_id &&
            Number(parent_account_id) === Number(req.body.id)
        ) {

            return res.status(400).json({
                success: false,
                message: "Account cannot be parent of itself"
            });

        }

        /**
         * INSERT ACCOUNT
         */
        const sql = `
            INSERT INTO accounts (
                account_code,
                account_name,
                account_type,
                parent_account_id,
                opening_balance,
                balance_type,
                description,
                company_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(
            sql,
            [
                account_code || null,
                account_name,
                account_type,
                parent_account_id || null,
                opening_balance || 0,
                balance_type || "DEBIT",
                description || null,
                company_id
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            account_id: result.insertId
        });

    } catch (error) {

        console.log("CREATE ACCOUNT ERROR:", error);

        /**
         * DUPLICATE ACCOUNT CODE
         */
        if (error.code === "ER_DUP_ENTRY") {

            return res.status(400).json({
                success: false,
                message: "Account code already exists"
            });

        }

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};



/**
 * =========================================================
 * GET ALL ACCOUNTS
 * =========================================================
 */
exports.getAllAccounts = async (req, res) => {

    try {
        const company_id = req.user.company_id;

        const sql = `
            SELECT
                a.*,
                p.account_name AS parent_account_name
            FROM accounts a
            LEFT JOIN accounts p
            ON a.parent_account_id = p.id
            AND p.company_id = a.company_id
            WHERE a.status = 1
            AND a.company_id = ?
            ORDER BY
                a.account_type ASC,
                a.account_name ASC
        `;

        const [results] = await db.query(sql, [company_id]);

        return res.status(200).json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {

        console.log("GET ACCOUNTS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};



/**
 * =========================================================
 * GET SINGLE ACCOUNT
 * =========================================================
 */
exports.getSingleAccount = async (req, res) => {

    try {

        const { id } = req.params;
        const company_id = req.user.company_id;

        const sql = `
            SELECT
                a.*,
                p.account_name AS parent_account_name
            FROM accounts a
            LEFT JOIN accounts p
            ON a.parent_account_id = p.id
            AND p.company_id = a.company_id
            WHERE a.id = ?
            AND a.company_id = ?
        `;

        const [results] = await db.query(
            sql,
            [id, company_id]
        );

        if (results.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Account not found"
            });

        }

        return res.status(200).json({
            success: true,
            data: results[0]
        });

    } catch (error) {

        console.log("GET SINGLE ACCOUNT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};



/**
 * =========================================================
 * UPDATE ACCOUNT
 * =========================================================
 */
exports.updateAccount = async (req, res) => {

    try {

        const { id } = req.params;
        const company_id = req.user.company_id;

        const {
            account_code,
            account_name,
            account_type,
            parent_account_id,
            opening_balance,
            balance_type,
            description
        } = req.body;

        /**
         * VALIDATION
         */
        if (!account_name || !account_type) {

            return res.status(400).json({
                success: false,
                message: "Account name and account type are required"
            });

        }

        /**
         * PREVENT SELF PARENT
         */
        if (
            parent_account_id &&
            Number(id) === Number(parent_account_id)
        ) {

            return res.status(400).json({
                success: false,
                message: "Account cannot be parent of itself"
            });

        }

        /**
         * UPDATE ACCOUNT
         */
        const sql = `
            UPDATE accounts
            SET
                account_code = ?,
                account_name = ?,
                account_type = ?,
                parent_account_id = ?,
                opening_balance = ?,
                balance_type = ?,
                description = ?
            WHERE id = ?
            AND company_id = ?
        `;

        const [result] = await db.query(
            sql,
            [
                account_code || null,
                account_name,
                account_type,
                parent_account_id || null,
                opening_balance || 0,
                balance_type || "DEBIT",
                description || null,
                id,
                company_id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Account updated successfully"
        });

    } catch (error) {

        console.log("UPDATE ACCOUNT ERROR:", error);

        /**
         * DUPLICATE ACCOUNT CODE
         */
        if (error.code === "ER_DUP_ENTRY") {

            return res.status(400).json({
                success: false,
                message: "Account code already exists"
            });

        }

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};



/**
 * =========================================================
 * DELETE ACCOUNT
 * =========================================================
 */
exports.deleteAccount = async (req, res) => {

    try {

        const { id } = req.params;
        const company_id = req.user.company_id;

        /**
         * SOFT DELETE
         */
        const sql = `
            UPDATE accounts
            SET status = 0
            WHERE id = ?
            AND company_id = ?
        `;

        const [result] = await db.query(sql, [id, company_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Account deleted successfully"
        });

    } catch (error) {

        console.log("DELETE ACCOUNT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server error"
        });

    }

};
