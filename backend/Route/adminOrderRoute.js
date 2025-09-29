const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  addAdminOrder,
  getAllAdminOrders,
  getAdminOrderById,
  updateAdminOrder,
  deleteAdminOrder,
  cancelAdminOrder,
  getOrdersForSupplier,
  confirmOrder,
  declineOrder,
} = require("../Controlers/adminOrderController");

const { requireAuth } = require("../middleware/auth"); // ✅ make sure suppliers are authenticated

const router = express.Router();

// Upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/slips"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
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

// Confirm payment (supplier)
router.put("/:id/confirm", requireAuth, confirmOrder);
// Decline payment (supplier)
router.put("/:id/decline", requireAuth, declineOrder);
router.put("/:id/cancel", requireAuth, cancelAdminOrder);

module.exports = router;
