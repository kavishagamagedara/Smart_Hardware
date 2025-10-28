// controllers/orderController.js
const mongoose = require("mongoose");
const Order = require("../Model/orderModel");
const Payment = require("../Model/paymentModel");
const Product = require("../Model/ProductModel");
const UserActivity = require("../Model/UserActivityModel");

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const normalizePaymentAmount = (amount, currency, method) => {
  if (String(method || "").toLowerCase() !== "stripe") return amount;
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency || "").toLowerCase())
    ? value
    : value / 100;
};

const recordActivity = async ({
  userId,
  type,
  description,
  metadata,
  actorId,
  request,
}) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (!userId || !type) return;
    const payload = {
      user: userId,
      type,
      description,
      metadata: metadata || {},
    };
    if (actorId) payload.actor = actorId;
    if (request) {
      payload.ip = request.ip || request.headers["x-forwarded-for"] || request.connection?.remoteAddress;
      payload.userAgent = request.headers?.["user-agent"];
    }
    await UserActivity.create(payload);
  } catch (err) {
    console.error("recordActivity error:", err.message || err);
  }
};

/* ------------------- Get all orders ------------------- */
const getAllOrders = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const ownsOnly = ["user", "customer"].includes(role);
    const stripeOnlyFlag = String(
      req.query?.paidStripeOnly ||
      req.query?.stripePaidOnly ||
      req.query?.stripePaid ||
      ""
    ).toLowerCase();
    const requireStripePaid = stripeOnlyFlag === "true" || stripeOnlyFlag === "1";

    const filter = ownsOnly ? { userId: req.user._id } : {};

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    if (orders.length === 0) {
      return res.status(200).json({ orders: [] });
    }

    const orderIds = orders.map((order) => order._id);
    const paymentFilter = { orderId: { $in: orderIds } };
    if (ownsOnly) {
      paymentFilter.userId = req.user._id;
    }

    const payments = await Payment.find(paymentFilter).sort({ createdAt: -1 }).lean();
    const paymentMap = new Map();

    const scoreStatus = (status = "") => {
      const normalized = String(status).toLowerCase();
      if (normalized === "paid") return 3;
      if (normalized === "requires_action") return 2;
      if (normalized === "pending") return 1;
      return 0;
    };

    for (const payment of payments) {
      const key = payment.orderId?.toString();
      if (!key) continue;
      const existing = paymentMap.get(key);
      if (!existing) {
        paymentMap.set(key, payment);
        continue;
      }

      const nextScore = scoreStatus(payment.paymentStatus);
      const currentScore = scoreStatus(existing.paymentStatus);
      if (
        nextScore > currentScore ||
        (nextScore === currentScore && new Date(payment.updatedAt) > new Date(existing.updatedAt))
      ) {
        paymentMap.set(key, payment);
      }
    }

    const enrichedOrders = orders.map((order) => {
      const payment = paymentMap.get(order._id.toString());
      if (!payment) return order;

      const paymentStatus = payment.paymentStatus || "pending";
      const normalizedStatus = String(paymentStatus).toLowerCase();
      const isPaid = normalizedStatus === "paid";
      const computedReceiptUrl = isPaid ? payment.receiptUrl || payment.slipUrl || null : null;

      return {
        ...order,
        paymentInfo: {
          paymentId: payment.paymentId || payment._id?.toString(),
          method: payment.method,
          paymentStatus,
          amount: normalizePaymentAmount(payment.amount, payment.currency, payment.method),
          rawAmount: payment.amount,
          currency: payment.currency,
          receiptUrl: computedReceiptUrl,
          slipUrl: payment.slipUrl || null,
          cardBrand: payment.cardBrand || null,
          cardLast4: payment.cardLast4 || null,
          updatedAt: payment.updatedAt,
          supplierId: payment.supplierId ? payment.supplierId.toString() : null,
        },
      };
    });

    const filteredOrders = requireStripePaid
      ? enrichedOrders.filter((order) => {
          const info = order.paymentInfo;
          if (!info) return false;
          const method = String(info.method || "").toLowerCase();
          const status = String(info.paymentStatus || "").toLowerCase();
          const supplierLinked = Boolean(info.supplierId);
          return method === "stripe" && status === "paid" && !supplierLinked;
        })
      : enrichedOrders;

    // ✅ Always 200; return empty array instead of 404
    return res.status(200).json({ orders: filteredOrders });
  } catch (err) {
    console.error("❌ getAllOrders error:", err);
    res.status(500).json({ message: "Error fetching orders", error: err.message });
  }
};

/* ------------------- Add a new order ------------------- */
const ALLOWED_PAYMENT_METHODS = ["Pay Online", "Pay Later", "Cash", "Card"];

// Contact must be exactly 10 digits (local phone number requirement)
const isValidContact = (c) => typeof c === "string" && /^\d{10}$/.test(c.trim());

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const addOrders = async (req, res) => {
  const { contact, items, paymentMethod } = req.body;

  const productRequests = new Map();
  const productAdjustments = [];
  const adjustedProducts = [];

  try {
    if (!contact || !items || items.length === 0 || !paymentMethod) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidContact(contact)) {
      return res.status(400).json({ message: "Invalid contact format" });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    for (const item of items) {
      const rawId = item?.productId || item?._id;
      const pid = String(rawId || "").trim();

      if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
        return res.status(400).json({ message: `Invalid productId for item "${item?.productName || item?.name || "Unknown"}"` });
      }

      const quantity = Number(item?.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for item "${item?.productName || item?.name || "Unknown"}"` });
      }

      const current = productRequests.get(pid) || 0;
      productRequests.set(pid, current + quantity);
    }

    if (productRequests.size === 0) {
      return res.status(400).json({ message: "At least one valid product is required" });
    }

  const sanitizedItems = [];
  let totalAmount = 0;

    for (const [productId, quantity] of productRequests.entries()) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ message: "One or more products in your cart are no longer available" });
      }

      if (!Number.isFinite(product.price) || Number(product.price) < 0) {
        return res.status(400).json({ message: `Invalid price for product ${product.name}` });
      }

      if (product.stockAmount < quantity) {
        return res.status(409).json({ message: `Only ${product.stockAmount} item(s) of ${product.name} left in stock` });
      }

      sanitizedItems.push({
        productId: product._id,
        productName: product.name,
        price: product.price,
        quantity,
      });

      totalAmount += Number(product.price || 0) * quantity;
      productAdjustments.push({ product, quantity });
    }

    for (const { product, quantity } of productAdjustments) {
      product.stockAmount = Math.max(0, product.stockAmount - quantity);
      product.inStock = product.stockAmount > 0;
      await product.save();
      adjustedProducts.push({ product, quantity });
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "Computed total amount is invalid" });
    }

    const newOrder = new Order({
      userId: req.user._id,
      contact,
      items: sanitizedItems,
      paymentMethod,
      totalAmount,
    });

    await newOrder.save();

    await recordActivity({
      userId: req.user._id,
      type: "custom",
      description: `Placed order #${newOrder._id} (${sanitizedItems.length} items, ${paymentMethod})`,
      metadata: {
        orderId: newOrder._id.toString(),
        paymentMethod,
        totalAmount,
        itemCount: sanitizedItems.length,
      },
      actorId: req.user._id,
      request: req,
    });

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (err) {
    console.error("❌ addOrders error:", err);

    if (adjustedProducts.length) {
      try {
        await Promise.all(
          adjustedProducts.map(async ({ product, quantity }) => {
            product.stockAmount += quantity;
            product.inStock = product.stockAmount > 0;
            await product.save();
          })
        );
      } catch (rollbackErr) {
        console.error("❌ Failed to rollback stock adjustment:", rollbackErr);
      }
    }

    const statusCode = err && err.statusCode ? err.statusCode : 500;
    res.status(statusCode).json({ message: "Unable to add order", error: err.message || String(err) });
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
  const { contact, items, status } = req.body;
  const stockAdjustments = [];

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

    if (contact) {
      if (!isValidContact(contact)) return res.status(400).json({ message: "Invalid contact format" });
      order.contact = contact;
    }

    order.status = status ?? order.status;

    if (items && items.length > 0) {
      const normalizedItemsMap = new Map();
      const existingItemsMap = new Map();
      const productCache = new Map();

      for (const existingItem of order.items) {
        if (!existingItem?.productId) continue;
        const key = existingItem.productId.toString();
        existingItemsMap.set(key, {
          quantity: Number(existingItem.quantity) || 0,
          price: Number(existingItem.price) || 0,
          productName: existingItem.productName,
        });
      }

      for (const item of items) {
        const rawId = item?.productId || item?._id;
        const pid = String(rawId || "").trim();
        if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
          throw createHttpError(
            `Invalid productId for item "${item?.productName || item?.name || "Unknown"}"`
          );
        }

        const quantity = Number(item?.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw createHttpError(
            `Invalid quantity for item "${item?.productName || item?.name || "Unknown"}"`
          );
        }

        let productDoc = productCache.get(pid);
        if (!productDoc) {
          productDoc = await Product.findById(pid);
          if (!productDoc) {
            throw createHttpError(
              `Product "${item?.productName || item?.name || "Unknown"}" is no longer available`
            );
          }
          productCache.set(pid, productDoc);
        }

        const existing = normalizedItemsMap.get(pid);
        const unitPriceCandidate = Number(item?.price);
        const existingPriceCandidate = Number(existing?.price);
        const productPriceCandidate = Number(productDoc.price);

        let basePrice = null;
        if (Number.isFinite(unitPriceCandidate) && unitPriceCandidate > 0) {
          basePrice = unitPriceCandidate;
        } else if (
          Number.isFinite(existingPriceCandidate) &&
          existingPriceCandidate > 0
        ) {
          basePrice = existingPriceCandidate;
        } else if (
          Number.isFinite(productPriceCandidate) &&
          productPriceCandidate > 0
        ) {
          basePrice = productPriceCandidate;
        }

        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          throw createHttpError(
            `Invalid price for item "${item?.productName || item?.name || productDoc.name || "Unknown"}"`
          );
        }

        const aggregateQuantity = (existing?.quantity || 0) + quantity;

        normalizedItemsMap.set(pid, {
          quantity: aggregateQuantity,
          price: basePrice,
          productName:
            item?.productName ||
            item?.name ||
            existing?.productName ||
            productDoc.name ||
            "Unknown Product",
          product: productDoc,
        });
      }

      const sanitizedItems = [];
      let computedTotal = 0;
      // Reconcile inventory changes against prior order state
      const allProductIds = new Set([
        ...existingItemsMap.keys(),
        ...normalizedItemsMap.keys(),
      ]);

      for (const pid of allProductIds) {
        const previous = existingItemsMap.get(pid);
        const next = normalizedItemsMap.get(pid);

        const previousQty = previous?.quantity || 0;
        const nextQty = next?.quantity || 0;
        const delta = nextQty - previousQty;

        let productDoc = next?.product;
        if (!productDoc && mongoose.Types.ObjectId.isValid(pid)) {
          productDoc = await Product.findById(pid);
        }

        if (delta > 0) {
          if (!productDoc) {
            throw createHttpError(
              "Unable to increase quantity for an unavailable product",
              404
            );
          }
          if (productDoc.stockAmount < delta) {
            throw createHttpError(
              `Only ${productDoc.stockAmount} item(s) of ${productDoc.name} left in stock`,
              409
            );
          }
        }

        if (productDoc && delta !== 0) {
          productDoc.stockAmount = Math.max(0, productDoc.stockAmount - delta);
          productDoc.inStock = productDoc.stockAmount > 0;
          await productDoc.save();
          stockAdjustments.push({ product: productDoc, delta });
        }

        if (next) {
          sanitizedItems.push({
            productId: productDoc ? productDoc._id : mongoose.Types.ObjectId(pid),
            productName: next.productName,
            price: Number(next.price),
            quantity: next.quantity,
          });
          computedTotal += Number(next.price) * next.quantity;
        }
      }

      if (sanitizedItems.length === 0) {
        throw createHttpError("At least one item must remain in the order");
      }

      if (!Number.isFinite(computedTotal) || computedTotal <= 0) {
        throw createHttpError("Computed total amount is invalid");
      }

      order.items = sanitizedItems;
      order.totalAmount = computedTotal;
    }

    await order.save();
    res.status(200).json({ message: "Order updated successfully", order });
  } catch (err) {
    if (stockAdjustments.length) {
      await Promise.all(
        stockAdjustments.map(async ({ product, delta }) => {
          try {
            product.stockAmount += delta;
            product.inStock = product.stockAmount > 0;
            await product.save();
          } catch (rollbackErr) {
            console.error("❌ Failed to rollback stock adjustment:", rollbackErr);
          }
        })
      );
    }

    console.error("❌ updateOrder error:", err);
    const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
    res.status(statusCode).json({
      message: statusCode === 500 ? "Error updating order" : err.message,
      error: err.message,
    });
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
