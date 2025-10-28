const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  addAdminOrder,
  getAllAdminOrders,
  getAdminOrderById,
  updateAdminOrder,
  deleteAdminOrder,
  cancelAdminOrder,
  getOrdersForSupplier, // ✅ import supplier-specific controller
  respondToSupplierOrder,
} = require("../Controlers/adminOrderController");

const { requireAuth } = require("../middleware/auth"); // ✅ make sure suppliers are authenticated

const router = express.Router();

const uploadDir = path.join(__dirname, "../uploads/slips");
fs.mkdirSync(uploadDir, { recursive: true });

// Upload config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ✅ Order with optional slip
router.post("/", upload.single("slip"), addAdminOrder);

// ✅ Admin: get all orders
router.get("/", requireAuth, getAllAdminOrders);

// ✅ Supplier: get only their received orders
router.get("/supplier", requireAuth, getOrdersForSupplier);

router.get("/:id", requireAuth, getAdminOrderById);
router.put("/:id", requireAuth, updateAdminOrder);
router.delete("/:id", requireAuth, deleteAdminOrder);
router.put("/:id/cancel", requireAuth, cancelAdminOrder);
router.put("/:id/respond", requireAuth, respondToSupplierOrder);

module.exports = router;
