const db = require("../db/connection");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendStaffInvitation } = require("../services/emailService");
const {
  ensureUserAccessColumns,
  getDefaultPermissions,
  normalizePermissions,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  normalizeAccessRole,
  STAFF_ACCESS_ROLES,
} = require("../services/userAccessService");

const safePermissions = (permissions, role) => {
  try {
    return normalizePermissions(
      permissions ? JSON.parse(permissions) : null,
      role
    );
  } catch {
    return normalizePermissions(null, role);
  }
};

/**
 * CREATE STAFF (OWNER only)
 */
exports.createStaff = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { name, email, access_role, permissions } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedAccessRole = normalizeAccessRole(access_role);
    const normalizedPermissions = normalizePermissions(
      permissions,
      normalizedAccessRole
    );

    if (!name || !normalizedEmail) {
      return res.status(400).json({
        message: "name and email are required"
      });
    }

    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (existingUsers.length) {
      return res.status(409).json({
        message: "User already exists"
      });
    }

    const temporaryPassword = `Bs!${crypto.randomBytes(9).toString("base64url")}`;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const [result] = await db.query(
      `INSERT INTO users
        (name, email, password, role, access_role, permissions, is_active, company_id, must_change_password)
       VALUES (?, ?, ?, 'staff', ?, ?, 1, ?, 1)`,
      [
        name,
        normalizedEmail,
        hashedPassword,
        normalizedAccessRole,
        JSON.stringify(normalizedPermissions),
        req.user.company_id
      ]
    );

    const delivery = await sendStaffInvitation({
      name,
      email: normalizedEmail,
      temporaryPassword,
    });

    res.status(201).json({
      message: delivery.sent
        ? "Staff user created and login details emailed"
        : "Staff user created. Share the temporary password manually.",
      id: result.insertId,
      access_role: normalizedAccessRole,
      permissions: normalizedPermissions,
      email_sent: delivery.sent,
      email_status: delivery.sent ? "sent" : delivery.reason,
      ...(delivery.sent ? {} : { temporary_password: temporaryPassword }),
    });

  } catch (error) {
    console.error("Create staff error:", error);
    res.status(500).json({
      message: "Failed to create staff"
    });
  }
};

/**
 * GET STAFF LIST (OWNER only)
 */
exports.getStaffList = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const [staff] = await db.query(
      `SELECT id, name, email, role, access_role, permissions, is_active, last_login_at, created_at
       FROM users
       WHERE company_id = ? AND role = 'staff'`,
      [req.user.company_id]
    );

    res.json({
      count: staff.length,
      roles: Array.from(STAFF_ACCESS_ROLES),
      modules: PERMISSION_MODULES,
      actions: PERMISSION_ACTIONS,
      staff: staff.map((entry) => ({
        ...entry,
        permissions: safePermissions(entry.permissions, entry.access_role),
        is_active: Number(entry.is_active) === 1,
      }))
    });

  } catch (error) {
    console.error("Get staff list error:", error);
    res.status(500).json({
      message: "Failed to fetch staff list"
    });
  }
};

exports.updateStaffAccessRole = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { id } = req.params;
    const accessRole = normalizeAccessRole(req.body.access_role);
    const permissions = getDefaultPermissions(accessRole);

    const [result] = await db.query(
      `UPDATE users
       SET access_role = ?, permissions = ?
       WHERE id = ? AND company_id = ? AND role = 'staff'`,
      [accessRole, JSON.stringify(permissions), id, req.user.company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Staff user not found" });
    }

    res.json({
      message: "Staff role updated",
      access_role: accessRole,
      permissions,
    });
  } catch (error) {
    console.error("Update staff role error:", error);
    res.status(500).json({
      message: "Failed to update staff role",
    });
  }
};

exports.updateStaffPermissions = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { id } = req.params;

    const [staff] = await db.query(
      "SELECT access_role FROM users WHERE id = ? AND company_id = ? AND role = 'staff' LIMIT 1",
      [id, req.user.company_id]
    );

    if (!staff.length) {
      return res.status(404).json({ message: "Staff user not found" });
    }

    const permissions = normalizePermissions(req.body.permissions, staff[0].access_role);

    await db.query(
      `UPDATE users
       SET permissions = ?
       WHERE id = ? AND company_id = ? AND role = 'staff'`,
      [JSON.stringify(permissions), id, req.user.company_id]
    );

    res.json({
      message: "Staff permissions updated",
      permissions,
    });
  } catch (error) {
    console.error("Update staff permissions error:", error);
    res.status(500).json({
      message: "Failed to update staff permissions",
    });
  }
};

exports.updateStaffStatus = async (req, res) => {
  try {
    await ensureUserAccessColumns();

    const { id } = req.params;
    const isActive = req.body.is_active ? 1 : 0;

    const [result] = await db.query(
      `UPDATE users
       SET is_active = ?
       WHERE id = ? AND company_id = ? AND role = 'staff'`,
      [isActive, id, req.user.company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Staff user not found" });
    }

    res.json({
      message: isActive ? "Staff user activated" : "Staff user deactivated",
      is_active: Boolean(isActive),
    });
  } catch (error) {
    console.error("Update staff status error:", error);
    res.status(500).json({
      message: "Failed to update staff status",
    });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM users WHERE id = ? AND company_id = ? AND role = 'staff'",
      [id, req.user.company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Staff user not found" });
    }

    res.json({ message: "Staff user deleted" });
  } catch (error) {
    console.error("Delete staff error:", error);
    res.status(500).json({
      message: "Failed to delete staff user",
    });
  }
};
