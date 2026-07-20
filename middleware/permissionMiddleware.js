const getAccessRole = (user = {}) => {
  if (user.role === "owner") return "owner";
  return user.access_role || user.staff_role || "sales";
};

const isReadMethod = (method) => ["GET", "HEAD", "OPTIONS"].includes(method);

const getActionFromMethod = (method) => {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return "view";
  if (method === "POST") return "create";
  if (["PUT", "PATCH"].includes(method)) return "edit";
  if (method === "DELETE") return "delete";
  return "view";
};

const hasModulePermission = (user = {}, moduleKey, action) => {
  if (!moduleKey || !user.permissions) {
    return null;
  }

  const modulePermissions = user.permissions[moduleKey];
  if (!modulePermissions || typeof modulePermissions[action] !== "boolean") {
    return null;
  }

  return modulePermissions[action];
};

const allowAccess = (allowedRoles = [], options = {}) => {
  const readOnlyRoles = options.readOnlyRoles || [];

  return (req, res, next) => {
    const role = getAccessRole(req.user);
    const action = options.action || getActionFromMethod(req.method);
    const permissionAllowed = hasModulePermission(
      req.user,
      options.moduleKey,
      action
    );

    if (role === "owner") {
      return next();
    }

    if (permissionAllowed === true) {
      return next();
    }

    if (permissionAllowed === false) {
      return res.status(403).json({
        message: "You do not have permission for this action",
      });
    }

    if (allowedRoles.includes(role)) {
      return next();
    }

    if (readOnlyRoles.includes(role) && isReadMethod(req.method)) {
      return next();
    }

    return res.status(403).json({
      message: "You do not have permission for this action",
    });
  };
};

const ownerOnly = allowAccess(["owner"]);

module.exports = {
  allowAccess,
  getActionFromMethod,
  getAccessRole,
  ownerOnly,
};
