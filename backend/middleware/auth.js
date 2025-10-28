// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../Model/UserModel");
const Role = require("../Model/RoleModel");

// JWT secret management with fallback support
const DEFAULT_JWT_SECRET = "dev_secret_change_me";
const PRIMARY_JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const FALLBACK_SECRETS = [
  process.env.JWT_FALLBACK_SECRET,
  PRIMARY_JWT_SECRET === DEFAULT_JWT_SECRET ? null : DEFAULT_JWT_SECRET,
]
  .filter(Boolean)
  .filter((secret, index, arr) => arr.indexOf(secret) === index);

// Verify token against primary and fallback secrets
function verifyTokenWithFallback(token) {
  let lastErr;
  const tried = new Set();
  for (const secret of [PRIMARY_JWT_SECRET, ...FALLBACK_SECRETS]) {
    if (tried.has(secret)) continue;
    tried.add(secret);
    try {
      const payload = jwt.verify(token, secret);
      return { payload, secret };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Mock permissions for development/testing without DB
const MOCK_PERMISSIONS = {
  admin: [
    "manage_users",
    "manage_roles",
    "manage_inventory",
    "manage_products",
    "manage_all_orders",
    "moderate_feedback",
    "refund_view_requests",
    "refund_manage_requests",
    "manage_suppliers",
    "view_analytics",
    "system_config",
    "export_data",
  ],
  "inventory manager": ["inventory:read", "inventory:write", "products:read", "products:write"],
  "finance manager": ["finance:read", "finance:write", "orders:read", "payments:read"],
  "feedback manager": [
    "moderate_feedback", 
    "cc_view_feedback", 
    "cc_respond_feedback", 
    "cc_manage_returns",
    "refund_view_requests",
    "refund_manage_requests",
  ],
  "sales manager": ["sales:read", "sales:write", "orders:read", "customers:read"],
  "customer care manager": [
    "moderate_feedback", 
    "cc_view_feedback", 
    "cc_respond_feedback", 
    "cc_manage_returns",
    "refund_view_requests",
    "refund_manage_requests",
    "support:read", 
    "support:write", 
    "notifications:write"
  ],
  supplier: ["supplier:read", "supplier:write", "products:read"],
  user: ["profile:read", "profile:write", "orders:read"],
};

async function permsForRole(roleName) {
  if (!roleName) return [];

  const dbConnected = mongoose.connection.readyState === 1;
  if (!dbConnected) {
    const raw = MOCK_PERMISSIONS[String(roleName).toLowerCase()] || [];
    const normalized = Array.from(
      new Set(
        (Array.isArray(raw) ? raw : [])
          .map((p) => String(p).trim().toLowerCase())
          .filter(Boolean)
      )
    );
    return normalized;
  }

  const r = await Role.findOne({ name: String(roleName).toLowerCase() });
  const raw = Array.isArray(r?.privileges) ? r.privileges : [];
  const normalized = Array.from(
    new Set(
      (Array.isArray(raw) ? raw : [])
        .map((p) => String(p).trim().toLowerCase())
        .filter(Boolean)
    )
  );
  return normalized;
}

// Middleware to require authentication
async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided" }); // no token provided

    const { payload, secret } = verifyTokenWithFallback(token);
    const userId = payload.id || payload.sub; // ✅ Support both id and sub

    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const dbConnected = mongoose.connection.readyState === 1;

    if (!dbConnected) {
      const mockUser = {
        _id: userId,
        email: payload.email || "mock@example.com",
        role: payload.role || "user",
        name: payload.name || "Mock User",
      };
      req.user = mockUser;
      req.userPerms = await permsForRole(mockUser.role);
      return next();
    }

    if (!mongoose.isValidObjectId(userId)) {
      console.warn(
        "Auth warning: rejecting token with non ObjectId payload",
        userId
      );
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid token user" });

    req.user = user;
    req.userPerms = await permsForRole(user.role);
    if (secret !== PRIMARY_JWT_SECRET) {
      console.warn("Auth warning: accepted legacy JWT signature. Prompting client to refresh token.");
      req.legacyToken = true;
      if (!res.headersSent) {
        res.set("x-token-refresh", "1");
      }
    }
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
}
// Middleware to require admin role
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if ((req.user.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
}

const FINANCE_PRIVS = new Set([
  // Views and dashboards
  "fin_view_dashboard",
  "fin_view_online_payments",
  "fin_view_supplier_payments",
  "fin_view_declined_payments",
  // Actions and management
  "fin_manage_declined_payments",
  "fin_record_payments",
  "fin_export_statements",
  "fin_view_finance_notifications",
  "fin_view_notifications",
  "fin_payroll",
  "fin_payments",
  "fin_payouts",
  "fin_reconcile",
  "fin_reports",
  "fin_statements",
  // Salary management (used for payroll console access)
  "fin_manage_salary",
]);

function requireFinanceOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const role = String(req.user.role || "").toLowerCase();
  if (role === "admin") return next();

  const perms = Array.isArray(req.userPerms) ? req.userPerms : [];
  const allowed = perms.some((perm) => FINANCE_PRIVS.has(String(perm).toLowerCase()));
  if (!allowed) {
    return res.status(403).json({ message: "Forbidden: Finance access required" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireFinanceOrAdmin, permsForRole };
