const AdminOrder = require("../Model/adminOrderModel");   // ✅ FIXED import
const AdminCancelledOrder = require("../Model/adminCancelledOrderModel");

exports.addAdminOrder = async (req, res) => {
  try {
    let { items, totalCost, paymentMethod, contact, notes } = req.body;

    // 🛠 Fix: Parse items if sent as a JSON string (FormData case)
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch (err) {
        console.error("❌ Failed to parse items:", err);
        return res.status(400).json({ message: "Invalid items format" });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    // ✅ Validate supplierId in each item
    for (const item of items) {
      if (!item.supplierId) {
        console.error("❌ Missing supplierId in item:", item);
        return res.status(400).json({ message: "Missing supplierId in some item(s)" });
      }
    }

    // ✅ Handle slip upload (only for Bank Transfer)
    let slipPath = null;
    if (paymentMethod === "Bank Transfer" && req.file) {
      slipPath = `/uploads/slips/${req.file.filename}`;
    }

    const newOrder = new AdminOrder({
      items,
      totalCost,
      paymentMethod,
      contact,
      notes,
      slip: slipPath, // ✅ save slip if exists
      status: "Pending",
    });

    await newOrder.save();

    // Decrease stock for each supplier product
    const SupplierProduct = require("../Model/SupplierProductModel");
    for (const item of items) {
      if (item.productId) {
        const product = await SupplierProduct.findById(item.productId);
        if (product && typeof item.quantity === 'number') {
          // If stockAmount exists, decrease it
          if (typeof product.stockAmount === 'number') {
            product.stockAmount = Math.max(0, product.stockAmount - item.quantity);
            product.inStock = product.stockAmount > 0;
            await product.save();
          }
        }
      }
    }

    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (err) {
    console.error("Add Admin Order Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



// ✅ Get all admin orders (admin view)
exports.getAllAdminOrders = async (_req, res) => {
  try {
    const orders = await AdminOrder.find().populate("items.supplierId", "name email role");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Error fetching admin orders", error: err.message });
  }
};

// ✅ Get single admin order
exports.getAdminOrderById = async (req, res) => {
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
exports.updateAdminOrder = async (req, res) => {
  try {
    const updatedOrder = await AdminOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order updated", order: updatedOrder });
  } catch (err) {
    console.error("Update Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete an admin order
exports.deleteAdminOrder = async (req, res) => {
  try {
    const deleted = await AdminOrder.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Cancel an admin order
exports.cancelAdminOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const cancelledOrder = new AdminCancelledOrder({
      items: order.items,
      totalCost: order.totalCost,
      paymentMethod: order.paymentMethod,
      contact: order.contact,
      notes: order.notes,
      cancelledAt: Date.now(),
    });

    await cancelledOrder.save();
    await AdminOrder.findByIdAndDelete(req.params.id);

    res.json({ message: "Order cancelled successfully", cancelledOrder });
  } catch (err) {
    console.error("Cancel Admin Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Supplier-specific orders
// ✅ Supplier-specific orders
exports.getOrdersForSupplier = async (req, res) => {
  try {
    const supplierId = req.user._id; // logged-in supplier
    const orders = await AdminOrder.find({ "items.supplierId": supplierId });

    // Only return this supplier's items + their subtotal
    const filtered = orders.map((order) => {
      const supplierItems = order.items.filter(
        (item) => item.supplierId.toString() === supplierId.toString()
      );

      // calculate subtotal for this supplier
      const supplierTotal = supplierItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      return {
        ...order.toObject(),
        items: supplierItems,
        totalCost: supplierTotal, // ✅ replace with supplier’s own total
      };
    });

    res.json(filtered);
  } catch (err) {
    console.error("Get Supplier Orders Error:", err);
    res.status(500).json({ message: "Error fetching supplier orders", error: err.message });
  }
};



// Confirm payment (set paymentStatus to Successful)
exports.confirmOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: "Successful" },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Payment confirmed", order });
  } catch (err) {
    console.error("Confirm Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Decline payment (set paymentStatus to Unsuccessful)
exports.declineOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: "Unsuccessful" },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Payment declined", order });
  } catch (err) {
    console.error("Decline Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

