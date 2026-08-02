const db = require("../db/connection");
const { signAuthToken } = require("../utils/jwtToken");
const { parsePermissions } = require("./userAccessService");

const listCompaniesForUser = async (userId) => {
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.email, m.membership_role AS role,
            m.is_default, m.is_active
       FROM user_company_memberships m
       JOIN companies c ON c.id = m.company_id
      WHERE m.user_id = ? AND m.is_active = 1
      ORDER BY m.is_default DESC, c.name ASC`,
    [userId]
  );
  return rows;
};

const assertCompanyAccess = async (userId, companyId) => {
  const [rows] = await db.query(
    `SELECT membership_role
       FROM user_company_memberships
      WHERE user_id = ? AND company_id = ? AND is_active = 1
      LIMIT 1`,
    [userId, companyId]
  );
  if (!rows.length) {
    const error = new Error("You do not have access to this company");
    error.status = 403;
    throw error;
  }
  return rows[0];
};

const listBranchesForUser = async ({ userId, companyId, role }) => {
  if (role === "owner") {
    const [rows] = await db.query(
      `SELECT id, company_id, name, code, branch_type, phone, email, address,
              city, state, pincode, gstin, is_head_office, is_active
         FROM branches
        WHERE company_id = ? AND is_active = 1
        ORDER BY is_head_office DESC, name ASC`,
      [companyId]
    );
    return rows;
  }

  const [rows] = await db.query(
    `SELECT b.id, b.company_id, b.name, b.code, b.branch_type, b.phone, b.email,
            b.address, b.city, b.state, b.pincode, b.gstin, b.is_head_office,
            b.is_active, ub.is_default
       FROM user_branch_memberships ub
       JOIN branches b ON b.id = ub.branch_id AND b.company_id = ub.company_id
      WHERE ub.user_id = ? AND ub.company_id = ?
        AND ub.is_active = 1 AND b.is_active = 1
      ORDER BY ub.is_default DESC, b.is_head_office DESC, b.name ASC`,
    [userId, companyId]
  );
  return rows;
};

const assertBranchAccess = async ({ userId, companyId, branchId, role }) => {
  const branches = await listBranchesForUser({ userId, companyId, role });
  const branch = branches.find((item) => Number(item.id) === Number(branchId));
  if (!branch) {
    const error = new Error("You do not have access to this branch");
    error.status = 403;
    throw error;
  }
  return branch;
};

const issueContextToken = (user, companyId, branchId = null) =>
  signAuthToken({
    user_id: user.id,
    company_id: Number(companyId),
    branch_id: branchId ? Number(branchId) : null,
    role: user.role,
    access_role: user.role === "owner" ? "owner" : user.access_role || "sales",
    permissions: parsePermissions(
      user.permissions,
      user.role === "owner" ? "owner" : user.access_role || "sales"
    ),
    must_change_password: Number(user.must_change_password) === 1,
  });

module.exports = {
  assertBranchAccess,
  assertCompanyAccess,
  issueContextToken,
  listBranchesForUser,
  listCompaniesForUser,
};
