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
    if (req.user.role.toLowerCase() === "user") {
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
    if (req.user.role.toLowerCase() === "user" && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    const cancelledOrder = new CancelledOrder({
      contact: order.contact,
      items: order.items,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      cancelReason: req.body.cancelReason || "Not specified",
      originalOrderId: order._id,
      cancelledAt: new Date(),
      userId: order.userId, // keep user reference
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
router.get("/orders", requireAuth, orderController.getAllOrders);
router.post("/orders", requireAuth, orderController.addOrders);
router.get("/orders/:id", requireAuth, orderController.getOrderById);
router.put("/orders/:id", requireAuth, orderController.updateOrder);
router.delete("/orders/:id", requireAuth, orderController.deleteOrder);

module.exports = router;
