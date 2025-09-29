// controllers/orderController.js
const mongoose = require("mongoose");              // ✅ ADD THIS
const Order = require("../Model/orderModel");

/* ------------------- Get all orders ------------------- */
const getAllOrders = async (req, res) => {
  try {
    let filter = {};
    if ((req.user.role || "").toLowerCase() === "user") {
      filter = { userId: req.user._id };
    }

    const orders = await Order.find(filter);

    // ✅ Always 200; return empty array instead of 404
    return res.status(200).json({ orders });
  } catch (err) {
    console.error("❌ getAllOrders error:", err);
    res.status(500).json({ message: "Error fetching orders", error: err.message });
  }
};

/* ------------------- Add a new order ------------------- */
const addOrders = async (req, res) => {
  const { contact, items, paymentMethod } = req.body;

  try {
    if (!contact || !items || items.length === 0 || !paymentMethod) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Normalize & validate items — must include a valid Mongo ObjectId
    const normalizedItems = items.map((item) => {
      const rawId = item.productId || item._id;
      const pid = String(rawId || "").trim();

      if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
        throw new Error(
          `Invalid productId for item "${item.productName || item.name || "Unknown"}"`
        );
      }

      return {
        productId: pid,
        productName: item.productName || item.name || "Unknown Product",
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      };
    });

    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const newOrder = new Order({
      userId: req.user._id,
      contact,
      items: normalizedItems,
      paymentMethod,
      totalAmount,
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (err) {
    console.error("❌ addOrders error:", err);
    res.status(500).json({ message: "Unable to add order", error: err.message });
  }
};

/* ------------------- Get order by ID ------------------- */
const getOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      (req.user.role || "").toLowerCase() === "user" &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    res.status(200).json({ order });
  } catch (err) {
    console.error("❌ getOrderById error:", err);
    res.status(500).json({ message: "Error fetching order", error: err.message });
  }
};

/* ------------------- Update order ------------------- */
const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { contact, items, paymentMethod, status } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      (req.user.role || "").toLowerCase() === "user" &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    order.contact = contact ?? order.contact;
    order.paymentMethod = paymentMethod ?? order.paymentMethod;
    order.status = status ?? order.status;

    if (items && items.length > 0) {
      order.items = items.map((item) => {
        const rawId = item.productId || item._id;
        const pid = String(rawId || "").trim();
        if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
          throw new Error(
            `Invalid productId for item "${item.productName || item.name || "Unknown"}"`
          );
        }
        return {
          productId: pid,
          productName: item.productName || item.name || "Unknown Product",
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
        };
      });

      order.totalAmount = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
    }

    await order.save();
    res.status(200).json({ message: "Order updated successfully", order });
  } catch (err) {
    console.error("❌ updateOrder error:", err);
    res.status(500).json({ message: "Error updating order", error: err.message });
  }
};

/* ------------------- Delete order ------------------- */
const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      (req.user.role || "").toLowerCase() === "user" &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    await order.deleteOne();
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ deleteOrder error:", err);
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
};

module.exports = {
  getAllOrders,
  addOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
};
