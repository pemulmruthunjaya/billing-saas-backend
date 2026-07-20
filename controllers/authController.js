const db = require("../db/connection");
const bcrypt = require("bcryptjs");
const { createCompany } = require("./company.controller");
const { signAuthToken } = require("../utils/jwtToken");
const {
  ensureUserAccessColumns,
  getDefaultPermissions,
  parsePermissions,
} = require("../services/userAccessService");

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
        permissions: parsePermissions(user.permissions, "owner")
      }
    );

    await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);

    res.json({ message: "Login successful", token });

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
        permissions: parsePermissions(staff.permissions, staff.access_role || "sales")
      }
    );

    await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [staff.id]);

    res.json({
      message: "Staff login successful",
      token
    });

  } catch (error) {
    console.error("Staff login error:", error);
    res.status(500).json({
      message: "Staff login failed"
    });
  }
};
