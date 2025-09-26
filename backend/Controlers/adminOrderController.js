// controllers/adminOrderController.js
const AdminOrder = require("../Model/adminOrderModel");
const AdminCancelledOrder = require("../Model/adminCancelledOrderModel");

// ✅ Add new admin order
const addAdminOrder = async (req, res) => {
  try {
    const { items, totalCost, paymentMethod, contact } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    const newOrder = new AdminOrder({
      items,
      totalCost,
      paymentMethod,
      contact,
      status: "Pending", // default status
      createdAt: Date.now(),
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (err) {
    console.error("Add Admin Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get all admin orders
const getAllAdminOrders = async (req, res) => {
  try {
    const orders = await AdminOrder.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Get Orders Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get single admin order
const getAdminOrderById = async (req, res) => {
  try {
    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error("Get Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update an admin order
const updateAdminOrder = async (req, res) => {
  try {
    const updatedOrder = await AdminOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedOrder)
      return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order updated", order: updatedOrder });
  } catch (err) {
    console.error("Update Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete an admin order
const deleteAdminOrder = async (req, res) => {
  try {
    const deleted = await AdminOrder.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Cancel an admin order (move to cancelled collection)
const cancelAdminOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const cancelledOrder = new AdminCancelledOrder({
      supplierId: order.supplierId,
      items: order.items,
      totalCost: order.totalCost,
      paymentMethod: order.paymentMethod,
      contact: order.contact,
      notes: order.notes,
      cancelledAt: Date.now(),
    });

    await cancelledOrder.save();

    // Remove from active orders
    await AdminOrder.findByIdAndDelete(req.params.id);

    res.json({ message: "Order cancelled successfully", cancelledOrder });
  } catch (err) {
    console.error("Cancel Admin Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addAdminOrder,
  getAllAdminOrders,
  getAdminOrderById,
  updateAdminOrder,
  deleteAdminOrder,
  cancelAdminOrder, // ✅ included export
};
