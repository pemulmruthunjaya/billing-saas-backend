const db = require("../db/connection");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { createCompany } = require("./company.controller");
const { signAuthToken } = require("../utils/jwtToken");
const {
  ensureUserAccessColumns,
  getDefaultPermissions,
  parsePermissions,
} = require("../services/userAccessService");
const { sendPasswordReset } = require("../services/emailService");

const RESET_TOKEN_MINUTES = 30;
const hashResetToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const buildLoginResponse = (message, token, user) => ({
  message,
  token,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    must_change_password: Number(user.must_change_password) === 1,
  },
  must_change_password: Number(user.must_change_password) === 1,
});

/**
 * OWNER REGISTER
 */
exports.register = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { company_name, name, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!company_name || !name || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "company_name, name, email and password are required"
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    const [existingUser] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ message: "User already exists" });
    }

    const companyId = await createCompany({
      name: company_name,
      email: normalizedEmail
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userResult] = await db.query(
      `INSERT INTO users (name, email, password, company_id, role, access_role)
       VALUES (?, ?, ?, ?, 'owner', 'owner')`,
      [name, normalizedEmail, hashedPassword, companyId]
    );

    const token = signAuthToken(
      {
        user_id: userResult.insertId,
        company_id: companyId,
        role: "owner",
        access_role: "owner",
        permissions: getDefaultPermissions("owner")
      }
    );

    res.status(201).json({
      message: "Company and owner registered successfully",
      token
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
};

/**
 * OWNER LOGIN
 */
exports.login = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? AND role = 'owner'",
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signAuthToken(
      {
        user_id: user.id,
        company_id: user.company_id,
        role: user.role,
        access_role: user.access_role || "owner",
        permissions: parsePermissions(user.permissions, "owner"),
        must_change_password: Number(user.must_change_password) === 1
      }
    );

    await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);

    res.json(buildLoginResponse("Login successful", token, user));

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
};

/**
 * ✅ STAFF LOGIN (NEW)
 */
exports.staffLogin = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? AND role = 'staff'",
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: "Invalid staff credentials"
      });
    }

    const staff = users[0];

    if (Number(staff.is_active) !== 1) {
      return res.status(403).json({
        message: "This staff account is inactive"
      });
    }

    const isMatch = await bcrypt.compare(password, staff.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid staff credentials"
      });
    }

    const token = signAuthToken(
      {
        user_id: staff.id,
        company_id: staff.company_id,
        role: "staff",
        access_role: staff.access_role || "sales",
        permissions: parsePermissions(staff.permissions, staff.access_role || "sales"),
        must_change_password: Number(staff.must_change_password) === 1
      }
    );

    await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [staff.id]);

    res.json(buildLoginResponse("Staff login successful", token, staff));

  } catch (error) {
    console.error("Staff login error:", error);
    res.status(500).json({
      message: "Staff login failed"
    });
  }
};

exports.forgotPassword = async (req, res) => {
  const genericResponse = {
    message: "If an active account exists, password reset instructions have been sent.",
  };

  try {
    await ensureUserAccessColumns();
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const [users] = await db.query(
      `SELECT id, name, email, role, is_active
       FROM users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    if (!users.length || (users[0].role === "staff" && Number(users[0].is_active) !== 1)) {
      return res.json(genericResponse);
    }

    const user = users[0];
    const token = crypto.randomBytes(32).toString("hex");
    await db.query(
      `UPDATE users
       SET password_reset_token_hash = ?,
           password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`,
      [hashResetToken(token), RESET_TOKEN_MINUTES, user.id]
    );

    const delivery = await sendPasswordReset({
      name: user.name,
      email: user.email,
      token,
    });

    if (!delivery.sent) {
      await db.query(
        `UPDATE users
         SET password_reset_token_hash = NULL, password_reset_expires_at = NULL
         WHERE id = ?`,
        [user.id]
      );
      console.error(`Password reset email unavailable for user ${user.id}: ${delivery.reason}`);
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.json(genericResponse);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    await ensureUserAccessColumns();
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");

    if (!token || password.length < 8) {
      return res.status(400).json({
        message: "A valid reset token and password of at least 8 characters are required",
      });
    }

    const [users] = await db.query(
      `SELECT id FROM users
       WHERE password_reset_token_hash = ?
         AND password_reset_expires_at > NOW()
       LIMIT 1`,
      [hashResetToken(token)]
    );

    if (!users.length) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE users
       SET password = ?,
           must_change_password = 0,
           password_changed_at = NOW(),
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL
       WHERE id = ? AND password_reset_token_hash = ?`,
      [hashedPassword, users[0].id, hashResetToken(token)]
    );

    return res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.current_password || "");
    const newPassword = String(req.body.new_password || "");

    if (!currentPassword || newPassword.length < 8) {
      return res.status(400).json({
        message: "Current password and a new password of at least 8 characters are required",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different" });
    }

    const [users] = await db.query(
      "SELECT id, password FROM users WHERE id = ? AND company_id = ? LIMIT 1",
      [req.user.user_id, req.user.company_id]
    );

    if (!users.length || !(await bcrypt.compare(currentPassword, users[0].password))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
      `UPDATE users
       SET password = ?, must_change_password = 0, password_changed_at = NOW(),
           password_reset_token_hash = NULL, password_reset_expires_at = NULL
       WHERE id = ?`,
      [hashedPassword, users[0].id]
    );

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Password change failed" });
  }
};
