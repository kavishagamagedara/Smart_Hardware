// controllers/receiptController.js
const Order = require("../Model/orderModel");
const Payment = require("../Model/paymentModel");
const User = require("../Model/UserModel");
const mongoose = require("mongoose");

/**
 * Generate receipt data for a specific order
 * GET /api/receipts/:orderId
 */
const generateReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Find the order
    const order = await Order.findById(orderId).lean();
    if (!order) {
      console.log("❌ Order not found:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("✅ Order found:", {
      orderId: order._id,
      userId: order.userId,
      itemsCount: order.items?.length || 0,
      hasItems: !!order.items,
    });

    // Authorization: customers can only view their own receipts
    const role = String(req.user?.role || "").toLowerCase();
    if (
      ["user", "customer"].includes(role) &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized to view this receipt" });
    }

    // Find associated payment
    const payment = await Payment.findOne({ orderId: order._id })
      .sort({ updatedAt: -1 })
      .lean();

    if (!payment) {
      return res.status(404).json({ message: "No payment found for this order" });
    }

    // Only allow receipt generation for paid orders
    const paymentStatus = String(payment.paymentStatus || "").toLowerCase();
    if (paymentStatus !== "paid") {
      return res.status(400).json({
        message: "Receipt can only be generated for paid orders",
        paymentStatus: payment.paymentStatus,
      });
    }

    // Get customer information
    const customer = await User.findById(order.userId).select("name email").lean();

    console.log("📄 Generating receipt for order:", {
      orderId: order._id,
      itemsCount: order.items?.length || 0,
      items: order.items,
      totalAmount: order.totalAmount,
      paymentStatus: payment.paymentStatus,
      paymentMethod: payment.method,
      rawPaymentAmount: payment.amount,
    });

    // Convert Stripe amount from cents to actual currency
    // Stripe stores amounts in cents (smallest currency unit)
    const actualPaymentAmount = payment.method === "stripe" && payment.amount
      ? payment.amount / 100
      : payment.amount || order.totalAmount || 0;

    console.log("💰 Payment amount conversion:", {
      method: payment.method,
      rawAmount: payment.amount,
      convertedAmount: actualPaymentAmount,
    });

    // Build receipt data
    const receiptData = {
      receiptNumber: `REC-${order._id.toString().slice(-8).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      order: {
        orderId: order._id,
        orderNumber: `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
        createdAt: order.createdAt,
        status: order.status,
        contact: order.contact,
        items: order.items || [],
        totalAmount: order.totalAmount || 0,
      },
      payment: {
        paymentId: payment.paymentId || payment._id?.toString(),
        method: payment.method || "N/A",
        paymentStatus: payment.paymentStatus || "unknown",
        amount: actualPaymentAmount,
        currency: payment.currency || "LKR",
        paidAt: payment.updatedAt,
        receiptUrl: payment.receiptUrl || null,
        cardBrand: payment.cardBrand || null,
        cardLast4: payment.cardLast4 || null,
      },
      customer: {
        name: customer?.name || "N/A",
        email: customer?.email || order.contact || "N/A",
      },
      company: {
        name: "Smart Hardware Shop",
        address: "123 Hardware Street, Colombo, Sri Lanka",
        phone: "+94 11 234 5678",
        email: "support@smarthardware.lk",
      },
    };

    console.log("✅ Receipt generated successfully with", receiptData.order.items.length, "items");

    res.status(200).json({ receipt: receiptData });
  } catch (error) {
    console.error("❌ Error generating receipt:", error);
    res.status(500).json({ message: "Error generating receipt", error: error.message });
  }
};

module.exports = {
  generateReceipt,
};
