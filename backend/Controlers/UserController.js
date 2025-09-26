// backend/Controllers/UserController.js
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Model/UserModel");
const { permsForRole } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const safe = (doc) => {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  delete o.password;
  return o;
};

async function attachPerms(uDocOrPlain) {
  const u = uDocOrPlain?.toObject ? safe(uDocOrPlain) : { ...uDocOrPlain };
  u.permissions = await permsForRole(u.role);
  return u;
}

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
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ Use "id" instead of "sub"
const token = jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  JWT_SECRET,
  { expiresIn: "7d" }
);

    const payload = await attachPerms(user);

    res.json({ user: payload, token });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------------- Create ---------------------------------- */
const createUser = async (req, res) => {
  const { name, email, password, age, address, role } = req.body;
  if (!name || !email || !password)
    return res
      .status(400)
      .json({ message: "Name, email, and password are required" });

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    // only admin can set role
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

    const hashed = await bcrypt.hash(password, 10);
    const doc = new User({
      name,
      email,
      password: hashed,
      age,
      address,
      role: callerIsAdmin && role ? String(role).toLowerCase() : "user",
    });

    await doc.save();
    const payload = await attachPerms(doc);
    res
      .status(201)
      .json({ message: "User created successfully", user: payload });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* -------------------------------- Read ----------------------------------- */
const getAllUsers = async (_req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("-password");
    if (!u) return res.status(404).json({ message: "User not found" });
    const payload = await attachPerms(u);
    res.status(200).json(payload);
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------------- Update ---------------------------------- */
const updateUser = async (req, res) => {
  try {
    const { password, role, ...rest } = req.body;
    const update = { ...rest };

    const isAdmin =
      (req.user?.role || "").toLowerCase() === "admin" ||
      (req.userPerms || []).includes("manage_users");

    if (role !== undefined) {
      if (!isAdmin)
        return res.status(403).json({ message: "Forbidden to change role" });
      update.role = String(role).toLowerCase();
    }

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
    const u = await User.findByIdAndDelete(req.params.id);
    if (!u) return res.status(404).json({ message: "User not found" });

    if (u.avatar && u.avatar.startsWith("/uploads/")) {
      const fp = path.join(__dirname, "..", u.avatar.replace(/^\//, ""));
      fs.unlink(fp, () => {});
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* --------------------------- Change password ----------------------------- */
const changePassword = async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: "Both passwords required" });

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok)
      return res.status(401).json({ message: "Current password incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------- Set avatar -------------------------------- */
const setAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const avatar = `/uploads/${req.file.filename}`;
    const u = await User.findByIdAndUpdate(id, { avatar }, { new: true });
    if (!u) return res.status(404).json({ message: "User not found" });

    const payload = await attachPerms(u);
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
    res.json({ message: "Avatar removed", user: payload });
  } catch (err) {
    console.error("deleteAvatar error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMe,
  login,
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  setAvatar,
  deleteAvatar,
};
