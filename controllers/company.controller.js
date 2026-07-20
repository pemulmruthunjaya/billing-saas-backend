const db = require("../db/connection");

exports.createCompany = async ({ name, email }) => {
    const [result] = await db.query(
        "INSERT INTO companies (name, email) VALUES (?, ?)",
        [name, email]
    );

    return result.insertId;
};
