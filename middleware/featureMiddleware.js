const db = require("../db/connection");

module.exports = (featureName) => {
  return (req, res, next) => {
    const companyId = req.user.company_id;

    const sql = `
      SELECT p.${featureName}
      FROM companies c
      JOIN plans p ON c.plan_id = p.id
      WHERE c.id = ?
    `;

    db.query(sql, [companyId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!results.length || !results[0][featureName]) {
        return res.status(403).json({
          message: `${featureName} feature not enabled in your plan`
        });
      }

      next();
    });
  };
};