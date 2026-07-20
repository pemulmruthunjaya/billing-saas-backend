const db = require("../db/connection");
const { ensureAuditLogTable } = require("../services/auditLogService");

exports.getAuditLogs = async (req, res) => {
  try {
    await ensureAuditLogTable();

    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const moduleKey = String(req.query.module || "").trim();
    const userId = String(req.query.user_id || "").trim();

    const where = ["company_id = ?"];
    const params = [req.user.company_id];

    if (moduleKey) {
      where.push("module_key = ?");
      params.push(moduleKey);
    }

    if (userId) {
      where.push("user_id = ?");
      params.push(userId);
    }

    const [logs] = await db.query(
      `SELECT id, user_id, user_name, user_role, access_role, module_key, action,
              method, path, resource_id, status_code, created_at
       FROM audit_logs
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, limit]
    );

    res.json({ logs });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};
