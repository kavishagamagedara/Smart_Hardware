const express = require("express");
const mongoose = require("mongoose");
const orderController = require("../Controlers/orderController");
const CancelledOrder = require("../Model/cancelledOrderModel");
const Order = require("../Model/orderModel");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/* ---------------- Cancelled Orders ---------------- */
router.get("/cancelled", requireAuth, async (req, res) => {
  try {
    let filter = {};

    // Customers see only their own cancelled orders
    const role = String(req.user?.role || "").toLowerCase();
    if (["user", "customer"].includes(role)) {
      filter = { userId: req.user._id };
    }

    const cancelledOrders = await CancelledOrder.find(filter);
    res.status(200).json({ cancelledOrders });
  } catch (error) {
    console.error("Error fetching cancelled orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- Cancel an order ---------------- */
router.put("/cancel/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Order ID" });
  }

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Customers can only cancel their own orders
    const role = String(req.user?.role || "").toLowerCase();
    if (
      ["user", "customer"].includes(role) &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    const customerName =
      req.user?.name ||
      req.user?.fullName ||
      req.user?.username ||
      req.user?.email ||
      "No name";

    const items = Array.isArray(order.items)
      ? order.items.map((item) => ({
          productId: item?.productId || null,
          productName: item?.productName || item?.name || "Unknown product",
          quantity: item?.quantity || 0,
          price: item?.price || 0,
        }))
      : [];

    const cancelledOrder = new CancelledOrder({
      userId: order.userId,
      name: customerName,
      contact: order.contact,
      items,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      cancelReason: req.body?.cancelReason || "Not specified",
      originalOrderId: order._id,
      cancelledAt: new Date(),
    });

    await cancelledOrder.save();
    await Order.findByIdAndDelete(id);

    res.status(200).json({ message: "Order cancelled and moved to history" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Error cancelling order" });
  }
});

/* ---------------- Active Orders ---------------- */
// ✅ Remove the extra /orders
// orderRoute.js
router.get("/", requireAuth, orderController.getAllOrders);
router.post("/", requireAuth, orderController.addOrders);
router.get("/:id", requireAuth, orderController.getOrderById);
router.put("/:id", requireAuth, orderController.updateOrder);
router.delete("/:id", requireAuth, orderController.deleteOrder);


module.exports = router;
