const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const UserController = require("../Controlers/UserController"); 
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/* --------------------------- Multer for avatars -------------------------- */
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
});

/* ------------------------------- Public ---------------------------------- */
router.post("/", UserController.createUser); // Signup
router.post("/register-supplier", UserController.registerSupplier);
router.post("/login", UserController.login); // Login

/* ------------------------------- Authenticated --------------------------- */
router.get("/me", requireAuth, UserController.getMe);
router.delete("/me", requireAuth, UserController.deleteSelf);

// ✅ Only admins can view all users
router.get("/", requireAuth, requireAdmin, UserController.getAllUsers);

// ✅ Export user activity report
router.get("/report", requireAuth, requireAdmin, UserController.exportUserReport);

// ✅ User can only see their own profile unless admin
router.get("/:id", requireAuth, UserController.getUserById);

// ✅ User can update only their own profile unless admin
router.put("/:id", requireAuth, UserController.updateUser);

// ✅ User can only change their own password
router.put("/:id/password", requireAuth, UserController.changePassword);

// ✅ User can upload/delete only their own avatar
router.post("/:id/avatar", requireAuth, upload.single("avatar"), UserController.setAvatar);
router.delete("/:id/avatar", requireAuth, UserController.deleteAvatar);

// ✅ Only admin can delete any user
router.delete("/:id", requireAuth, requireAdmin, UserController.deleteUser);

module.exports = router;
