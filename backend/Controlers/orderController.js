const Order = require("../Model/orderModel");

/* ------------------- Get all orders ------------------- */
const getAllOrders = async (req, res) => {
  try {
    let filter = {};

    // Customers see only their own orders
    if (req.user.role.toLowerCase() === "user") {
      filter = { userId: req.user._id };
    }

    const orders = await Order.find(filter);

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found" });
    }

    res.status(200).json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching orders", error: err });
  }
};

/* ------------------- Add a new order ------------------- */
const addOrders = async (req, res) => {
  const { contact, items, paymentMethod } = req.body;

  try {
    if (!contact || !items || items.length === 0 || !paymentMethod) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder = new Order({
      userId: req.user._id, // associate with logged-in customer
      contact,
      items,
      paymentMethod,
      totalAmount,
    });

    await newOrder.save();

    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Unable to add order", error: err });
  }
};

/* ------------------- Get order by ID ------------------- */
const getOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Customers can only access their own orders
    if (req.user.role.toLowerCase() === "user" && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    res.status(200).json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching order", error: err });
  }
};

/* ------------------- Update order ------------------- */
const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { contact, items, paymentMethod, status } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Customers cannot update orders that are not theirs
    if (req.user.role.toLowerCase() === "user" && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    order.contact = contact ?? order.contact;
    order.paymentMethod = paymentMethod ?? order.paymentMethod;
    order.status = status ?? order.status;

    if (items && items.length > 0) {
      order.items = items;
      order.totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    await order.save();

    res.status(200).json({ message: "Order updated successfully", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating order", error: err });
  }
};

/* ------------------- Delete order ------------------- */
const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Customers can only delete their own orders
    if (req.user.role.toLowerCase() === "user" && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    await order.deleteOne();

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting order", error: err });
  }
};

module.exports = {
  getAllOrders,
  addOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
};
