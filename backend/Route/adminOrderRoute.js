// routes/adminOrders.js
const express = require("express");
const router = express.Router();

const {
  getAllAdminOrders,
  addAdminOrder,
  getAdminOrderById,
  updateAdminOrder,
  deleteAdminOrder,
  cancelAdminOrder, // ✅ moved cancel logic to controller
} = require("../Controlers/adminOrderController");

// ✅ CRUD Routes
router.get("/", getAllAdminOrders);
router.post("/", addAdminOrder);
router.get("/:id", getAdminOrderById);
router.put("/:id", updateAdminOrder);
router.delete("/:id", deleteAdminOrder);

// ✅ Cancel an order
router.put("/:id/cancel", cancelAdminOrder);

module.exports = router;
