const express = require("express");
const router = express.Router();
const AdminCancelledOrder = require("../Model/adminCancelledOrderModel");

// GET all cancelled orders
router.get("/", async (req, res) => {
  try {
    const cancelledOrders = await AdminCancelledOrder.find().sort({ cancelledAt: -1 });
    res.json({ orders: cancelledOrders }); // <-- key is "orders"
  } catch (err) {
    console.error("Error fetching cancelled orders:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
