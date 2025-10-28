// backend/Controllers/UserController.js
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../Model/UserModel");
const UserActivity = require("../Model/UserActivityModel");
const { permsForRole } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findUserByEmailInsensitive(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  let user = await User.findOne({ email: normalized });
  if (user) return user;

  user = await User.findOne({
    email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
  });

  if (user && user.email !== normalized) {
    user.email = normalized;
    try {
      await user.save();
    } catch (err) {
      console.warn("⚠️  Failed to normalize email for user", user._id, err.message);
    }
  }

  return user;
}
// Create a mock user based on email patterns for testing without DB
function createMockUser(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  if (!email || !password) return null;

  let role = "user";
  if (email.includes("admin")) role = "admin";
  else if (email.includes("inventory")) role = "inventory manager";
  else if (email.includes("finance")) role = "finance manager";
  else if (email.includes("sales")) role = "sales manager";
  else if (email.includes("care")) role = "customer care manager";
  else if (email.includes("supplier")) role = "supplier";

  return {
    _id: `mock_${Date.now()}`,
    email,
    role,
    name: "Mock User",
    firstName: "Mock",
    lastName: "User",
  };
}

const safe = (doc) => {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  delete o.password;
  return o;
};

const recordActivity = async ({
  userId,
  type,
  description,
  metadata,
  actorId,
  request,
}) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (!userId || !type) return;
    const payload = {
      user: userId,
      type,
      description,
      metadata: metadata || {},
    };
    if (actorId) payload.actor = actorId;
    if (request) {
      payload.ip = request.ip || request.headers["x-forwarded-for"] || request.connection?.remoteAddress;
      payload.userAgent = request.headers?.["user-agent"];
    }
    await UserActivity.create(payload);
  } catch (err) {
    console.error("recordActivity error:", err.message || err);
  }
};

async function attachPerms(uDocOrPlain) {
  const u = uDocOrPlain?.toObject ? safe(uDocOrPlain) : { ...uDocOrPlain };
  u.permissions = await permsForRole(u.role);
  return u;
}

const purgeUserArtifacts = (userDoc) => {
  if (!userDoc) return;
  const avatarPath = userDoc.avatar || "";
  if (avatarPath && avatarPath.startsWith("/uploads/")) {
    const fp = path.join(__dirname, "..", avatarPath.replace(/^\//, ""));
    fs.unlink(fp, () => {});
  }
};

/* ------------------------------- /users/me -------------------------------- */
const getMe = async (req, res) => {
  try {
    const enriched = await attachPerms(req.user);
    res.json(enriched);
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* -------------------------------- Login ---------------------------------- */
const login = async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";
//   if (rawPassword.length < 12) return res.status(400).json({ message: "Password must be 12+ characters" });
  const email = normalizeEmail(rawEmail);
  const password = rawPassword;
  
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const dbConnected = mongoose.connection.readyState === 1;

    if (!dbConnected) {
      console.warn("🔧 DB unavailable – falling back to mock authentication");
      const mockUser = createMockUser(email, password);
      if (!mockUser) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const tokenPayload = {
        sub: mockUser._id,
        id: mockUser._id,
        role: mockUser.role,
        email: mockUser.email,
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

      const payload = await attachPerms(mockUser);
      return res.json({ user: payload, token, mock: true });
    }

    const user = await findUserByEmailInsensitive(email);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    let ok = false;
    if (user.password) {
      try {
        ok = await bcrypt.compare(password, user.password);
      } catch (compareErr) {
        console.warn("⚠️  bcrypt.compare failed, attempting legacy password fallback", compareErr.message);
        ok = false;
      }
    }

    if (!ok && typeof user.password === "string" && user.password.length && user.password === password) {
      ok = true;
      try {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
        console.info(`🔐 Upgraded legacy plaintext password for user ${user._id}`);
      } catch (rehashErr) {
        console.error("Failed to upgrade legacy password hash", rehashErr.message);
      }
    }

    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const now = new Date();
    try {
      await User.updateOne(
        { _id: user._id },
        {
          $set: { lastLoginAt: now },
          $inc: { loginCount: 1 },
        }
      );
      user.lastLoginAt = now;
      user.loginCount = (user.loginCount || 0) + 1;
    } catch (updateErr) {
      console.error("⚠️  Failed to update login metadata", updateErr.message);
    }

    await recordActivity({
      userId: user._id,
      type: "login",
      description: "User signed in",
      metadata: { email: user.email },
      actorId: user._id,
      request: req,
    });

    const tokenPayload = {
      sub: user._id,
      id: user._id,
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    const payload = await attachPerms(user);

    res.json({ user: payload, token, mock: false });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------------- Create ---------------------------------- */
const createUser = async (req, res) => {
  const { name, email, password, age, address, role } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !password)
    return res
      .status(400)
      .json({ message: "Name, email, and password are required" });

  try {
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "User already exists" });


    // Only allow valid roles from Role collection, fallback to 'user'
    let assignedRole = "user";
    if (role) {
      const roleDoc = await require("../Model/RoleModel").findOne({ name: String(role).toLowerCase() });
      if (roleDoc) assignedRole = roleDoc.name;
    }

    // only admin can set non-default roles
    let callerIsAdmin = false;
    try {
      const hdr = req.headers.authorization || "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET);
        const caller = await User.findById(payload.id);
        callerIsAdmin = (caller?.role || "").toLowerCase() === "admin";
      }
    } catch {
      callerIsAdmin = false;
    }
    if (!callerIsAdmin && assignedRole !== "user") assignedRole = "user";
    
    const hashed = await bcrypt.hash(password, 10);
    const doc = new User({ // create user with provided role or default 'user'
      name,
      email: normalizedEmail,
      password: hashed,
      age,
      address,
      role: assignedRole,
    });

    await doc.save();
    await recordActivity({
      userId: doc._id,
      type: "account_created",
      description: "Account created",
      metadata: { role: assignedRole },
      actorId: req.user?._id,
      request: req,
    });
    const payload = await attachPerms(doc);
    res
      .status(201)
      .json({ message: "User created successfully", user: payload });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: err.message });
  }
};
// Register a new supplier
const registerSupplier = async (req, res) => {
  const { name, email, password, age, address } = req.body; // Extract fields from request body
  const normalizedEmail = normalizeEmail(email);
//   if (password.length < 12) return res.status(400).json({ message: "Password must be 12+ characters" });
  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  try {
    const exists = await User.findOne({ email: normalizedEmail }); // Check if user already exists
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }
    // Suppliers get 'supplier' role by default
    const hashed = await bcrypt.hash(password, 10);
    const doc = new User({
      name,
      email: normalizedEmail,
      password: hashed,
      age,
      address,
      role: "supplier",
    });
    
    await doc.save();
    await recordActivity({
      userId: doc._id,
      type: "account_created",
      description: "Supplier account registered",
      metadata: { role: "supplier" },
      request: req,
    });
    const payload = await attachPerms(doc);
    res.status(201).json({ message: "Supplier registered successfully", user: payload });
  } catch (err) {
    console.error("registerSupplier error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* -------------------------------- Read ----------------------------------- */
const getAllUsers = async (_req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude passwords
    res.status(200).json(users);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getUserById = async (req, res) => { // GET /users/:id
  try {
    const u = await User.findById(req.params.id).select("-password");
    if (!u) return res.status(404).json({ message: "User not found" });
    const payload = await attachPerms(u);

    const updatedFields = Object.keys(update || {});
    if (updatedFields.length) {
      const type = updatedFields.includes("role") ? "role_changed" : "account_updated";
      await recordActivity({
        userId: u._id,
        type,
        description:
          type === "role_changed"
            ? `Role updated to ${payload.role || update.role}`
            : "Account details updated",
        metadata: {
          fields: updatedFields,
          actor: req.user?._id,
        },
        actorId: req.user?._id,
        request: req,
      });
    }
    res.status(200).json(payload);
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------------- Update ---------------------------------- */
const updateUser = async (req, res) => {
  try {
    // Extract fields except password and role
    const { password, role, ...rest } = req.body;
    const update = { ...rest };
    // if password provided, hash it
    if (typeof update.email === "string") {
      update.email = normalizeEmail(update.email);
    }
    
    const isAdmin =
      (req.user?.role || "").toLowerCase() === "admin" || // admin role
      (req.userPerms || []).includes("manage_users");

    // Check if user is trying to change their own role
    if (role !== undefined) {
      // Only allow valid roles from Role collection, fallback to 'user'
      let assignedRole = "user";
      if (role) {
        const roleDoc = await require("../Model/RoleModel").findOne({ name: String(role).toLowerCase() });
        if (roleDoc) assignedRole = roleDoc.name;
      }
      if (!isAdmin && assignedRole !== "user") {
        return res.status(403).json({ message: "Forbidden to change role" });
      }
      update.role = assignedRole;
    }
    // Only admin or user themselves can update
    const u = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!u) return res.status(404).json({ message: "User not found" });

    const payload = await attachPerms(u);
    res.status(200).json(payload);
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------------- Delete ---------------------------------- */
const deleteUser = async (req, res) => {
  try {
    const u = await User.findByIdAndDelete(req.params.id);// delete user by ID
    if (!u) return res.status(404).json({ message: "User not found" });

    purgeUserArtifacts(u);

    await recordActivity({
      userId: u._id,
      type: "account_deleted",
      description: "Account deleted",
      metadata: { email: u.email, role: u.role },
      actorId: req.user?._id,
      request: req,
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteSelf = async (req, res) => {
  try {
    const actor = req.user;
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const role = String(actor.role || "").toLowerCase();
    if (role === "admin") {
      return res.status(403).json({ message: "Admins cannot delete their account from here" });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Account deletion unavailable while offline" });
    }

    const userId = actor._id?.toString() || actor.id?.toString() || actor.userId?.toString();
    if (!userId) return res.status(400).json({ message: "Unable to determine account" });

    const u = await User.findByIdAndDelete(userId);
    if (!u) return res.status(404).json({ message: "User not found" });

    purgeUserArtifacts(u);

    await recordActivity({
      userId,
      type: "account_deleted",
      description: "User deleted their own account",
      actorId: userId,
      request: req,
    });

    res.status(200).json({ message: "Account deleted" });
  } catch (err) {
    console.error("deleteSelf error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* --------------------------- Change password ----------------------------- */
const changePassword = async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: "Both passwords required" }); // both passwords required

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.password);// verify current password
    if (!ok)
      return res.status(401).json({ message: "Current password incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await recordActivity({
      userId: user._id,
      type: "password_changed",
      description: "Password updated",
      actorId: req.user?._id,
      request: req,
    });

    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------- Set avatar -------------------------------- */
const setAvatar = async (req, res) => {
  try {
    const { id } = req.params; // user ID from URL params
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const avatar = `/uploads/${req.file.filename}`;
    const u = await User.findByIdAndUpdate(id, { avatar }, { new: true });
    if (!u) return res.status(404).json({ message: "User not found" });

    const payload = await attachPerms(u);
    await recordActivity({
      userId: u._id,
      type: "avatar_updated",
      description: "Avatar updated",
      actorId: req.user?._id,
      request: req,
    });
    res.json({ message: "Avatar updated", user: payload });
  } catch (err) {
    console.error("setAvatar error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ---------------------------- Delete avatar ------------------------------ */
const deleteAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "User not found" });

    const old = u.avatar || "";
    u.avatar = "";
    await u.save();

    if (old && old.startsWith("/uploads/")) {
      const fp = path.join(__dirname, "..", old.replace(/^\//, ""));
      fs.unlink(fp, () => {});
    }

    const payload = await attachPerms(u);
    await recordActivity({
      userId: u._id,
      type: "avatar_updated",
      description: "Avatar removed",
      actorId: req.user?._id,
      request: req,
    });
    res.json({ message: "Avatar removed", user: payload });
  } catch (err) {
    console.error("deleteAvatar error:", err);
    res.status(500).json({ message: err.message });
  }
};

const sanitizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const formatISO = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
};

const escapeCsvField = (input) => {
  if (input == null) return "";
  const str = String(input);
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
};

const exportUserReport = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    const {
      from: rawCreatedFrom,
      to: rawCreatedTo,
      activityFrom: rawActivityFrom,
      activityTo: rawActivityTo,
      format = "csv",
      activityLimit: rawActivityLimit,
    } = req.query || {};

    const createdFrom = sanitizeDate(rawCreatedFrom);
    const createdTo = sanitizeDate(rawCreatedTo);
    const activityFrom = sanitizeDate(rawActivityFrom);
    const activityTo = sanitizeDate(rawActivityTo);
    const activityLimit = Math.max(1, Math.min(Number(rawActivityLimit) || 5, 20));

    const userQuery = {};
    if (createdFrom || createdTo) {
      userQuery.createdAt = {};
      if (createdFrom) userQuery.createdAt.$gte = createdFrom;
      if (createdTo) userQuery.createdAt.$lte = createdTo;
    }

    const users = await User.find(userQuery).select("-password").sort({ createdAt: 1 }).lean();
    const userIds = users.map((u) => u._id);

    const activityQuery = { user: { $in: userIds } };
    if (activityFrom || activityTo) {
      activityQuery.createdAt = {};
      if (activityFrom) activityQuery.createdAt.$gte = activityFrom;
      if (activityTo) activityQuery.createdAt.$lte = activityTo;
    }

    const activities = userIds.length
      ? await UserActivity.find(activityQuery)
          .sort({ createdAt: -1 })
          .limit(userIds.length * activityLimit)
          .lean()
      : [];

    const groupedActivities = new Map();
    activities.forEach((activity) => {
      const id = activity.user?.toString();
      if (!id) return;
      if (!groupedActivities.has(id)) groupedActivities.set(id, []);
      const bucket = groupedActivities.get(id);
      if (bucket.length >= activityLimit) return;
      bucket.push(activity);
    });

    const rows = users.map((user) => {
      const id = user._id?.toString();
      const activityList = groupedActivities.get(id) || [];
      const lastActivity = activityList[0];
      const activitySummary = activityList
        .map((item) => {
          const stamp = formatISO(item.createdAt);
          const detail = item.description || item.type;
          return `${stamp} • ${detail}`;
        })
        .join(" | ");

      return {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: formatISO(user.createdAt),
        updatedAt: formatISO(user.updatedAt),
        lastLoginAt: formatISO(user.lastLoginAt),
        loginCount: user.loginCount || 0,
        lastActivityAt: formatISO(lastActivity?.createdAt),
        recentActivities: activitySummary,
      };
    });

    if (format === "json") {
      return res.json({
        generatedAt: new Date().toISOString(),
        count: rows.length,
        filters: {
          createdFrom: formatISO(createdFrom),
          createdTo: formatISO(createdTo),
          activityFrom: formatISO(activityFrom),
          activityTo: formatISO(activityTo),
          activityLimit,
        },
        rows,
      });
    }

    const header = [
      "Name",
      "Email",
      "Role",
      "Account created",
      "Last updated",
      "Last login",
      "Login count",
      "Last activity",
      "Recent activities (most recent first)",
    ];

    const csvLines = [header.map(escapeCsvField).join(",")];
    rows.forEach((row) => {
      csvLines.push(
        [
          row.name,
          row.email,
          row.role,
          row.createdAt,
          row.updatedAt,
          row.lastLoginAt,
          row.loginCount,
          row.lastActivityAt,
          row.recentActivities,
        ]
          .map(escapeCsvField)
          .join(",")
      );
    });

    const csv = csvLines.join("\n");
    const filenameStamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="user-report-${filenameStamp}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error("exportUserReport error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMe,
  login,
  createUser,
  registerSupplier,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  deleteSelf,
  changePassword,
  setAvatar,
  deleteAvatar,
  exportUserReport,
};
