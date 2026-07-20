const db = require("../db/connection");
const { verifyAuthToken } = require("../utils/jwtToken");
const {
  ensureUserAccessColumns,
  parsePermissions,
} = require("../services/userAccessService");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    const decoded = verifyAuthToken(token);

    await ensureUserAccessColumns();

    const [users] = await db.query(
      `SELECT id, name, email, role, access_role, permissions, is_active, company_id
       FROM users
       WHERE id = ? AND company_id = ?
       LIMIT 1`,
      [decoded.user_id, decoded.company_id]
    );

    if (!users.length) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    const user = users[0];

    if (user.role === "staff" && Number(user.is_active) !== 1) {
      return res.status(403).json({ message: "This staff account is inactive" });
    }

    req.user = {
      ...decoded,
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      access_role: user.role === "owner" ? "owner" : user.access_role || "sales",
      permissions: parsePermissions(
        user.permissions,
        user.role === "owner" ? "owner" : user.access_role || "sales"
      ),
      is_active: Number(user.is_active),
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    if (error.name !== "JsonWebTokenError") {
      console.error("AUTH ERROR:", error.message);
    }

    return res.status(401).json({ message: "Unauthorized" });
  }
};
