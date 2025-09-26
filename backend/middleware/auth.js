// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../Model/UserModel");
const Role = require("../Model/RoleModel");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

async function permsForRole(roleName) {
  if (!roleName) return [];
  const r = await Role.findOne({ name: String(roleName).toLowerCase() });
  return Array.isArray(r?.privileges) ? r.privileges : [];
}

async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.id || payload.sub; // ✅ Support both id and sub

    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid token user" });

    req.user = user;
    req.userPerms = await permsForRole(user.role);
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if ((req.user.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, permsForRole };
