// Backend/middleware/permissions.js
const jwt = require("jsonwebtoken");
const User = require("../Model/UserModel");
const Role = require("../Model/RoleModel");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/* ------------------------- Get permissions for a role ------------------------ */
async function getPermsForRole(roleName) {
  if (!roleName) return [];
  const role = await Role.findOne({ name: String(roleName).toLowerCase() });
  return Array.isArray(role?.privileges) ? role.privileges : [];
}

/* ------------------------ Require authentication ---------------------------- */
async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const payload = jwt.verify(token, JWT_SECRET); // expects payload.sub
    if (!payload?.sub) return res.status(401).json({ message: "Invalid token" });

    const user = await User.findById(payload.sub).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    req.userPerms = await getPermsForRole(user.role);
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ message: "Unauthorized" });
  }
}

/* ------------------------ Require specific permission ------------------------ */
function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const userPerms = new Set(req.userPerms || []);
    const allowed = perms.some((p) => userPerms.has(p));
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

/* ----------------------------- Require admin role ---------------------------- */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if ((req.user.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
}

module.exports = { requireAuth, requirePermission, requireAdmin, getPermsForRole };
