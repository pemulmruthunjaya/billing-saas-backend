const { recordAuditLog } = require("../services/auditLogService");

const auditLogMiddleware = (req, res, next) => {
  const shouldAudit =
    req.originalUrl?.startsWith("/api/") &&
    !req.originalUrl?.startsWith("/api/auth") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  if (shouldAudit) {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        recordAuditLog(req, res).catch((error) => {
          console.error("Audit log error:", error.message);
        });
      }
    });
  }

  next();
};

module.exports = auditLogMiddleware;
