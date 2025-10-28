// controllers/paymentController.js
const Payment = require("../Model/paymentModel");
const Notification = require("../Model/NotificationModel");
const Order = require("../Model/orderModel");
const Product = require("../Model/ProductModel");
const mongoose = require("mongoose");
require("dotenv").config();
const Stripe = require("stripe");

function createMockStripe() {
  console.warn("⚠️  STRIPE_SECRET_KEY missing - using mock Stripe client");
  const mockSession = (overrides = {}) => ({ id: `mock_session_${Date.now()}`, metadata: {}, payment_status: 'paid', ...overrides });
  const mockPaymentIntent = (overrides = {}) => ({
    id: `mock_pi_${Date.now()}`,
    status: "succeeded",
    amount: 0,
    currency: "lkr",
    charges: { data: [] },
    ...overrides,
  });

  return {
    checkout: {
      sessions: {
        create: async (opts) => mockSession({ metadata: opts?.metadata || {} }),
        retrieve: async (id) => mockSession({ id }),
      },
    },
    paymentIntents: {
      retrieve: async (id) => mockPaymentIntent({ id }),
      update: async (id, updates) => mockPaymentIntent({ id, ...updates }),
      create: async (opts) => mockPaymentIntent(opts),
    },
    webhooks: {
      constructEvent: (rawBody, sig, secret) => ({ id: `mock_event_${Date.now()}`, type: "checkout.session.completed", data: { object: {} } }),
    },
  };
}

const stripeSecret = (process.env.STRIPE_SECRET_KEY || "").trim();
const stripe = stripeSecret ? new Stripe(stripeSecret) : createMockStripe();

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sanitizePendingItemsAndAdjustStock = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createHttpError("Unable to create order: no items submitted");
  }

  const productRequests = new Map();
  for (const item of rawItems) {
    const rawId = item?.productId || item?._id || item?.id;
    const pid = String(rawId || "").trim();
    if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
      throw createHttpError(`Invalid productId for item "${item?.productName || item?.name || "Unknown"}"`);
    }

    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw createHttpError(`Invalid quantity for item "${item?.productName || item?.name || "Unknown"}"`);
    }

    const current = productRequests.get(pid) || 0;
    productRequests.set(pid, current + quantity);
  }

  if (productRequests.size === 0) {
    throw createHttpError("Unable to create order: invalid item payload");
  }

  const sanitizedItems = [];
  const adjustments = [];
  let totalAmount = 0;

  for (const [productId, quantity] of productRequests.entries()) {
    const product = await Product.findById(productId);
    if (!product) {
      throw createHttpError("One or more products are no longer available", 404);
    }

    if (product.stockAmount < quantity) {
      throw createHttpError(
        `Only ${product.stockAmount} item(s) of ${product.name} left in stock`,
        409
      );
    }

    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) {
      throw createHttpError(`Invalid price for product ${product.name}`);
    }

    sanitizedItems.push({
      productId: product._id,
      productName: product.name,
      price,
      quantity,
    });

    totalAmount += price * quantity;

    product.stockAmount = Math.max(0, product.stockAmount - quantity);
    product.inStock = product.stockAmount > 0;
    await product.save();
    adjustments.push({ product, quantity });
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw createHttpError("Computed total amount is invalid");
  }

  return { sanitizedItems, totalAmount, adjustments };
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
  "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

// Helper: safe IO getter
function getIo(req) {
  try {
    if (req && req.app && req.app.locals && req.app.locals.io) return req.app.locals.io;
    const app = require('../app');
    return app && app.locals && app.locals.io ? app.locals.io : null;
  } catch (e) {
    return null;
  }
}

// Helper: create Order from payment metadata or stripe session metadata
async function createOrderFromPayment(payment, req) {
  let stockAdjustments = [];
  let stripeSessionId = null;
  try {
    if (!payment) return null;
    if (payment.orderId) return payment.orderId;

    let pending = null;
    try {
      if (payment.metadata && payment.metadata.pendingOrder) {
        pending = typeof payment.metadata.pendingOrder === 'string'
          ? JSON.parse(payment.metadata.pendingOrder)
          : payment.metadata.pendingOrder;
      }
    } catch (e) {
      console.warn('Failed to parse pendingOrder from payment.metadata', e);
    }

    if (!pending && payment.stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
        if (session && session.metadata && session.metadata.pendingOrder) {
          pending = JSON.parse(session.metadata.pendingOrder);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!pending) return null;

    stripeSessionId =
      payment.stripeSessionId ||
      pending.stripeSessionId ||
      pending.sessionId ||
      null;

    if (stripeSessionId) {
      const existingOrder = await Order.findOne({ stripeSessionId }).lean();
      if (existingOrder) {
        if (!payment.orderId || payment.orderId.toString() !== existingOrder._id.toString()) {
          await Payment.updateOne(
            { _id: payment._id },
            { $set: { orderId: existingOrder._id } }
          );
        }
        return existingOrder._id;
      }
    }

    const contactValue = String(pending.contact || pending.customer || '').trim();
    if (!contactValue) {
      throw createHttpError('Missing contact information for order creation');
    }

    const { sanitizedItems, totalAmount, adjustments } = await sanitizePendingItemsAndAdjustStock(
      pending.items || []
    );
    stockAdjustments = adjustments;

    const orderPayload = {
      userId: payment.userId,
      contact: contactValue,
      items: sanitizedItems,
      paymentMethod: pending.paymentMethod || 'Pay Online',
      totalAmount,
      status: 'Confirmed',
    };
    if (stripeSessionId) {
      orderPayload.stripeSessionId = stripeSessionId;
    }

    const newOrder = new Order(orderPayload);
    await newOrder.save();

    await Payment.updateOne(
      { _id: payment._id },
      { $set: { orderId: newOrder._id } }
    );
    try {
      payment.orderId = newOrder._id;
    } catch (e) {
      // ignore assignment failures on plain objects
    }

    try {
      const normalizedMethod = String(payment.method || '').toLowerCase();
      const normalizedStatus = String(payment.paymentStatus || '').toLowerCase();
      const supplierLinked = Boolean(payment.supplierId);
      if (normalizedMethod === 'stripe' && normalizedStatus === 'paid' && !supplierLinked) {
        const io = getIo(req);
        if (io) {
          const normalizedAmount = typeof newOrder.totalAmount === 'number'
            ? newOrder.totalAmount
            : fromStripeAmount(payment.amount, payment.currency);
          io.emit('sales:confirmed', {
            orderId: String(newOrder._id),
            paymentId: String(payment._id),
            amount: normalizedAmount,
            currency: payment.currency,
            items: Array.isArray(newOrder.items) ? newOrder.items : [],
            method: normalizedMethod,
            status: normalizedStatus,
            supplierId: null,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn('Emit failed for created order from payment', e);
    }

    return newOrder._id;
  } catch (e) {
    if (stockAdjustments.length) {
      await Promise.all(
        stockAdjustments.map(async ({ product, quantity }) => {
          try {
            product.stockAmount += quantity;
            product.inStock = product.stockAmount > 0;
            await product.save();
          } catch (rollbackErr) {
            console.error('Failed to rollback stock adjustment after payment error:', rollbackErr);
          }
        })
      );
    }
    console.error('Failed creating order from payment:', e);
    try {
      if (stripeSessionId) {
        const existingOrder = await Order.findOne({ stripeSessionId }).lean();
        if (existingOrder) {
          await Payment.updateOne(
            { _id: payment._id },
            { $set: { orderId: existingOrder._id } }
          );
          return existingOrder._id;
        }
      }
    } catch (lookupErr) {
      console.error('Follow-up lookup after order creation failure failed:', lookupErr);
    }
    return null;
  }
}

const emitFinanceNotification = async ({
  type,
  title,
  message,
  payment,
  metadata = {},
  dedupeKey,
  recipientRoles,
}) => {
  try {
    if (!title || !message) return;

    const paymentId = payment?._id ? String(payment._id) : metadata.paymentId;
    const orderId = payment?.orderId ? String(payment.orderId) : metadata.orderId;
    const status = payment?.paymentStatus || metadata.status;
    const method = payment?.method || metadata.method;
    const normalizedType = type && type.startsWith("payment") ? type : `payment-${type || status || "status"}`;

    const effectiveDedupeKey =
      dedupeKey || metadata.dedupeKey || (paymentId && status ? `${normalizedType}:${paymentId}:${status}` : null);
    const rolesInput = Array.isArray(recipientRoles)
      ? recipientRoles
      : recipientRoles
      ? [recipientRoles]
      : ["admin", "finance manager"];

    const roles = Array.from(
      new Set(
        rolesInput
          .map((role) => (typeof role === "string" ? role.trim().toLowerCase() : ""))
          .filter(Boolean)
      )
    );

    if (!roles.length) roles.push("admin");

    for (const role of roles) {
      if (effectiveDedupeKey) {
        const exists = await Notification.exists({
          recipientRole: role,
          "metadata.dedupeKey": effectiveDedupeKey,
        });
        if (exists) continue;
      }

      const notificationMetadata = {
        ...metadata,
        paymentId,
        orderId,
        status,
        method,
        dedupeKey: effectiveDedupeKey || metadata.dedupeKey,
      };

      await Notification.create({
        recipientRole: role,
        title,
        message,
        type: normalizedType,
        metadata: notificationMetadata,
      });
    }
  } catch (err) {
    console.error("Failed to emit finance notification", err);
  }
};

// Safe getter for Socket.IO instance. Some handlers (webhooks) don't have access to req.app,
// so we try several fallback locations.
function getIo(req) {
  try {
    if (req && req.app && req.app.locals && req.app.locals.io) return req.app.locals.io;
  } catch (e) {}
  try {
    const app = require('../app');
    if (app && app.locals && app.locals.io) return app.locals.io;
  } catch (e) {}
  return null;
}

/* ----------------------------- helpers ----------------------------- */

// map amount into Stripe’s expected minor units
function toStripeAmount(amount, currency = "lkr") {
  const a = Number(amount);
  if (!Number.isFinite(a)) return null;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase())
    ? Math.round(a)
    : Math.round(a * 100);
}

function fromStripeAmount(amount, currency = "lkr") {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase()) ? a : a / 100;
}

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id));

/* ------------------------- BASIC CRUD (used by admin UI) ------------------------- */

// GET /api/payments?method=&status=&orderId=
exports.getAllPayments = async (req, res) => {
  try {
    const { method, status, orderId, debug } = req.query;
    const q = {};
    if (method) q.method = method;
    if (status) q.paymentStatus = status;
    if (orderId) q.orderId = orderId;

    console.log(`[PAYMENT API] Query filters:`, q);
    
    const payments = await Payment.find(q).sort({ createdAt: -1 });
    
    console.log(`[PAYMENT API] Found ${payments.length} payments matching filters`);
    if (payments.length > 0) {
      console.log(`[PAYMENT API] Sample payments:`, payments.slice(0, 3).map(p => ({
        id: p._id,
        paymentName: p.paymentName,
        status: p.paymentStatus,
        method: p.method,
        orderId: p.orderId,
        supplierId: p.supplierId
      })));
    }
    
    // If debug=true, return additional statistics
    if (debug === 'true') {
      const allPayments = await Payment.find({});
      const stats = {
        total: allPayments.length,
        byStatus: {},
        byMethod: {},
        recentDeclines: allPayments.filter(p => p.paymentStatus === 'failed').slice(0, 5).map(p => ({
          id: p._id,
          paymentName: p.paymentName,
          orderId: p.orderId,
          updatedAt: p.updatedAt
        }))
      };
      
      allPayments.forEach(p => {
        stats.byStatus[p.paymentStatus] = (stats.byStatus[p.paymentStatus] || 0) + 1;
        stats.byMethod[p.method] = (stats.byMethod[p.method] || 0) + 1;
      });
      
      return res.status(200).json({ payments, debug: stats });
    }
    
    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    // We accept either an existing orderId OR a pendingOrder object (which will be stored in session metadata)
    const { orderId, amount, currency = "lkr", pendingOrder } = req.body;

    if (!amount || (!orderId && !pendingOrder)) {
      return res.status(400).json({ message: "amount and (orderId or pendingOrder) are required" });
    }

    // ✅ ensure we have a logged-in user
    const userId = req.user._id.toString();
    const customerEmail = req.user.email;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "Vintora Hardware",
              description: `Order ${String(orderId)}`,
            },
            unit_amount: parseInt(amount, 10),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:3000/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/payment-cancel",
      customer_email: customerEmail,
      metadata: {
        orderId: orderId ? String(orderId) : undefined,
        userId: userId, // always a valid ObjectId
        // Attach pendingOrder as JSON string so we can recreate it after payment
        pendingOrder: pendingOrder ? JSON.stringify(pendingOrder) : undefined,
      },
    });

    console.log("✅ Created Checkout Session with metadata:", session.metadata);
    return res.json({ id: session.id });
  } catch (err) {
    console.error("Error creating Checkout Session:", err.message);
    return res.status(500).json({ error: err.message });
  }
};


exports.recordCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.charges"],
    });

    console.log("✅ Stripe session retrieved:", session);

    const { metadata } = session;
    if (!metadata?.orderId || !metadata?.userId) {
      return res.status(400).json({ message: "Missing orderId or userId in metadata" });
    }

    // ✅ Ensure IDs are valid ObjectId strings
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(metadata.orderId) || !mongoose.Types.ObjectId.isValid(metadata.userId)) {
      return res.status(400).json({ message: "Invalid orderId or userId format" });
    }

    // ✅ Prevent duplicate payments
    const paymentIntent = session.payment_intent;
    const charge = paymentIntent?.charges?.data?.[0] || null;
    const paymentStatus = session.payment_status === "paid" ? "paid" : session.payment_status || "pending";

    const paymentPayload = {
  paymentName: `Vintora Hardware Order ${metadata.orderId}`,
      orderId: metadata.orderId,
      userId: metadata.userId,
      paymentStatus,
      method: "stripe",
      amount: session.amount_total ?? null,
      currency: session.currency,
      customerEmail: session.customer_email,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntent?.id || null,
      cardBrand: charge?.payment_method_details?.card?.brand || null,
      cardLast4: charge?.payment_method_details?.card?.last4 || null,
      receiptUrl: charge?.receipt_url || null,
    };

    const existing = await Payment.findOne({ stripeSessionId: session.id });

    let savedPayment;
    let statusCode;
    let responseBody;

    if (existing) {
      savedPayment = await Payment.findByIdAndUpdate(
        existing._id,
        { $set: paymentPayload },
        { new: true, runValidators: true }
      );
      statusCode = 200;
      responseBody = { message: "Payment already recorded", payment: savedPayment };
    } else {
      savedPayment = await Payment.create(paymentPayload);
      statusCode = 201;
      responseBody = { message: "✅ Payment recorded successfully", payment: savedPayment };
    }

    if (savedPayment?.paymentStatus === "paid") {
      const paymentTargetLabel = orderId ? `order ${orderId}` : 'online checkout';
      await emitFinanceNotification({
        type: "payment-online",
        title: "Customer payment received",
        message: `Payment received for ${paymentTargetLabel}.`,
        payment: savedPayment,
        metadata: {
          event: "paid",
        },
        dedupeKey: `payment-online-paid:${savedPayment._id}`,
      });
    }

    return res.status(statusCode).json(responseBody);
  } catch (err) {
    console.error("❌ Error recording payment:", err);
    res.status(500).json({ message: "Error recording payment", error: err.message });
  }
};

// POST /api/payments/repair-missing-orders
// Scans paid Payments without orderId and attempts to create/link Orders from metadata
exports.repairMissingOrders = async (req, res) => {
  try {
    const Payment = require('../Model/paymentModel');
    const payments = await Payment.find({ paymentStatus: 'paid', $or: [ { orderId: { $exists: false } }, { orderId: null } ] }).limit(500).lean();
    const results = [];
    for (const p of payments) {
      try {
        // Re-fetch as model instance to use helper
        const inst = await Payment.findById(p._id);
        const createdOrderId = await createOrderFromPayment(inst, req);
        results.push({ paymentId: String(p._id), createdOrderId: createdOrderId ? String(createdOrderId) : null });
      } catch (e) {
        results.push({ paymentId: String(p._id), error: String(e) });
      }
    }
    return res.json({ repaired: results.length, details: results });
  } catch (e) {
    console.error('repairMissingOrders error', e);
    return res.status(500).json({ message: 'repair failed', error: String(e) });
  }
};



// POST /api/payments  (admin creates a record manually)
exports.addPayment = async (req, res) => {
  try {
    const {
      paymentId,
      paymentName,
      orderId,
      paymentStatus,
      method,
      amount,
      currency,
      customerEmail,
    } = req.body;

    if (!paymentId || !paymentName || !orderId || !paymentStatus) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const payment = await Payment.create({
      paymentId,
      paymentName,
      orderId,
      paymentStatus,
      method: method || "slip",
      amount,
      currency,
      customerEmail,
    });

    return res.status(201).json({ payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating payment", error: err.message });
  }
};

// GET /api/payments/:id
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid payment id" });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    return res.status(200).json({ payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching payment", error: err.message });
  }
};

// PUT /api/payments/:id  (admin approve/reject/pending from dashboard)
exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid payment id" });

    const allowed = [
      "paymentId",
      "paymentName",
      "orderId",
      "paymentStatus",
      "method",
      "amount",
      "currency",
      "customerEmail",
    ];

    const updateFields = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k) && req.body[k] !== undefined) {
        updateFields[k] = req.body[k];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    const payment = await Payment.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!payment) return res.status(404).json({ message: "Payment not found" });
    return res.status(200).json({ payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error updating payment", error: err.message });
  }
};

// DELETE /api/payments/:id
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid payment id" });

    const payment = await Payment.findByIdAndDelete(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    return res.status(200).json({ message: "Payment deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error deleting payment", error: err.message });
  }
};

/* --------------------------- User slip creation --------------------------- */
// POST /api/payments/slip  (user creates a new payment by uploading a slip)
// expects multipart/form-data: paymentId, paymentName, orderId, slip(file)
exports.createPaymentWithSlip = async (req, res) => {
  try {
    let {
      paymentId,
      paymentName,
      orderId,
      description,
      supplierId,
      amount,
      currency = "lkr",
    } = req.body;

    if (!paymentName) {
      return res.status(400).json({ message: "paymentName is required" });
    }

    if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ message: "A valid supplierId is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Slip file is required" });
    }

    const supplierObjectId = new mongoose.Types.ObjectId(supplierId);

    const resolvedPaymentId = (paymentId || ``).trim() || `PAY-${Date.now()}`;
    const resolvedOrderId =
      orderId && mongoose.Types.ObjectId.isValid(orderId)
        ? new mongoose.Types.ObjectId(orderId)
        : new mongoose.Types.ObjectId();

    const numericAmount = Number(amount);
    const sanitizedAmount = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : undefined;
    const normalizedCurrency = String(currency || "lkr").toLowerCase();

    const file = req.file;
    const slipUrl = `${req.protocol}://${req.get("host")}/uploads/slips/${file.filename}`;

    const paymentData = {
      paymentId: resolvedPaymentId,
      paymentName,
      orderId: resolvedOrderId,
      userId: supplierObjectId,
      supplierId: supplierObjectId,
      paymentStatus: "pending",
      method: "slip",
      currency: normalizedCurrency,
      slipUrl,
      slipPath: file.path,
      slipOriginalName: file.originalname,
      slipMimeType: file.mimetype,
      slipSize: file.size,
      slipUploadedAt: new Date(),
    };

    if (description && description.trim()) {
      paymentData.description = description.trim();
    }

    if (sanitizedAmount !== undefined) {
      paymentData.amount = sanitizedAmount;
    }

    const payment = await Payment.create(paymentData);

    await emitFinanceNotification({
      type: "payment-supplier-pending",
      title: "Supplier payment slip submitted",
      message: `Supplier ${String(supplierObjectId)} submitted a payment slip for order ${payment.orderId}.`,
      payment,
      metadata: {
        supplierId: String(supplierObjectId),
        event: "submitted",
      },
      dedupeKey: `supplier-slip-submitted:${payment._id}`,
    });

    return res.status(201).json({ payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating payment with slip", error: err.message });
  }
};

/* --------------------------- Slip upload (replace) --------------------------- */
// PUT /api/payments/:id/slip  (requires multer single('slip'))
exports.uploadSlip = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid payment id" });
    if (!req.file) return res.status(400).json({ message: "Slip file is required" });

    const file = req.file;
    const slipUrl = `${req.protocol}://${req.get("host")}/uploads/slips/${file.filename}`;

    const update = {
      paymentStatus: "pending",
      method: "slip",
      slipUrl,
      slipPath: file.path,
      slipOriginalName: file.originalname,
      slipMimeType: file.mimetype,
      slipSize: file.size,
      slipUploadedAt: new Date(),
    };

    const payment = await Payment.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const slipStamp =
      payment?.slipUploadedAt instanceof Date
        ? payment.slipUploadedAt.getTime()
        : new Date(payment.slipUploadedAt || Date.now()).getTime();

    await emitFinanceNotification({
      type: "payment-supplier-pending",
      title: "Supplier resubmitted payment slip",
      message: `Updated slip received for payment ${payment.paymentId}.`,
      payment,
      metadata: {
        supplierId: payment.supplierId ? String(payment.supplierId) : undefined,
        event: "resubmitted",
      },
      dedupeKey: `supplier-slip-resubmitted:${payment._id}:${slipStamp}`,
    });

    return res.status(200).json({ payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error uploading slip", error: err.message });
  }
};

/* --------------------------- STRIPE INTEGRATION -------------------------- */

// POST /api/payments/stripe/create-intent
exports.createStripePaymentIntent = async (req, res) => {
  try {
    console.log("=== CREATE STRIPE PAYMENT INTENT ===");
    console.log("Request body:", req.body);

    // Only take what user should provide
  let { amount, currency = "lkr", orderId, paymentName } = req.body;

    // Require amount + orderId + name
    if (amount == null || !orderId || !paymentName) {
      console.log("Missing required fields:", { amount, orderId, paymentName });
      return res.status(400).json({ message: "amount, orderId, paymentName are required" });
    }

    // Convert amount into cents
    const stripeAmount = Number(amount);
    if (!Number.isFinite(stripeAmount) || stripeAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number (in minor units)" });
    }
    currency = String(currency).toLowerCase();

    // Pull logged-in user info
    const userId = req.user._id;
    const customerEmail = req.user.email;

    console.log("Processed values:", { stripeAmount, currency, orderId, userId, paymentName });

    // 1) Try to find existing payment for this order
    let payment = await Payment.findOne({ orderId, userId, method: "stripe" });
    console.log("Existing payment found:", payment ? "Yes" : "No");

    // Helper for creating/updating PI
    const ensurePI = async () => {
      if (payment.stripePaymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        const updatable = new Set([
          "requires_payment_method",
          "requires_confirmation",
          "requires_action",
          "processing",
        ]);

        if (pi.amount !== stripeAmount && updatable.has(pi.status)) {
          const updated = await stripe.paymentIntents.update(pi.id, { amount: stripeAmount });
          payment.amount = stripeAmount;
          payment.currency = currency;
          await payment.save();
          return updated.client_secret;
        }

        if (pi.status === "canceled" || ["succeeded", "processing"].includes(pi.status)) {
          const fresh = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency,
            receipt_email: customerEmail,
            metadata: { mongoPaymentId: payment._id.toString(), orderId },
            automatic_payment_methods: { enabled: true },
          });
          payment.stripePaymentIntentId = fresh.id;
          payment.amount = stripeAmount;
          payment.currency = currency;
          await payment.save();
          return fresh.client_secret;
        }

        return pi.client_secret; // reuse if still valid
      } else {
        const intent = await stripe.paymentIntents.create({
          amount: stripeAmount,
          currency,
          receipt_email: customerEmail,
          metadata: { mongoPaymentId: payment._id.toString(), orderId },
          automatic_payment_methods: { enabled: true },
        });
        payment.stripePaymentIntentId = intent.id;
        payment.amount = stripeAmount;
        payment.currency = currency;
        await payment.save();
        return intent.client_secret;
      }
    };

    // 2) If not found, create one
    if (!payment) {
      try {
        payment = await Payment.create({
          paymentName,
          orderId,
          userId,
          paymentStatus: "pending",
          method: "stripe",
          amount: stripeAmount,
          currency,
          customerEmail,
        });
      } catch (e) {
        if (e?.code === 11000) {
          payment = await Payment.findOne({ orderId, userId, method: "stripe" });
          if (!payment) throw e;
        } else {
          throw e;
        }
      }
    }

    const clientSecret = await ensurePI();
    return res.status(201).json({ clientSecret, payment });

  } catch (err) {
    console.error("=== ERROR IN CREATE PAYMENT INTENT ===", err);
    return res.status(500).json({ message: "Error creating Stripe PaymentIntent", error: err.message });
  }
};


// POST /api/webhooks/stripe   (use express.raw for this path in app.js)
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, // set in app.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const charge = intent.charges?.data?.[0];

        const update = { paymentStatus: "paid" };
        if (charge) {
          update.cardBrand = charge.payment_method_details?.card?.brand;
          update.cardLast4 = charge.payment_method_details?.card?.last4;
          update.receiptUrl = charge.receipt_url;
        }

        const paymentDoc = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          update,
          { new: true }
        );

        if (paymentDoc) {
          await emitFinanceNotification({
            type: "payment-online",
            title: "Customer payment received",
            message: `Online payment received for order ${paymentDoc.orderId}.`,
            payment: paymentDoc,
            metadata: {
              event: "webhook",
            },
            dedupeKey: `payment-online-paid:${paymentDoc._id}`,
          });
          try {
            // If there's an existing order, mark it Confirmed; otherwise try to create one from metadata
            if (paymentDoc.orderId && mongoose.Types.ObjectId.isValid(paymentDoc.orderId)) {
              const updated = await Order.findByIdAndUpdate(paymentDoc.orderId, { $set: { status: 'Confirmed' } }, { new: true });
              console.log('Order marked Confirmed via webhook:', String(paymentDoc.orderId), 'orderStatus=', updated?.status);
              // emit event with order details
              try {
                const io = getIo(req);
                if (io) {
                  const ord = await Order.findById(paymentDoc.orderId).lean().catch(() => null);
                  const normalizedMethod = String(paymentDoc.method || '').toLowerCase();
                  const normalizedStatus = String(paymentDoc.paymentStatus || '').toLowerCase();
                  const supplierLinked = Boolean(paymentDoc.supplierId);
                  if (normalizedMethod === 'stripe' && normalizedStatus === 'paid' && !supplierLinked) {
                    const orderTotal = ord && typeof ord.totalAmount === 'number' ? ord.totalAmount : null;
                    const normalizedAmount = orderTotal ?? fromStripeAmount(paymentDoc.amount, paymentDoc.currency);
                    io.emit('sales:confirmed', {
                      orderId: String(paymentDoc.orderId),
                      paymentId: String(paymentDoc._id),
                      amount: normalizedAmount,
                      currency: paymentDoc.currency,
                      items: ord && Array.isArray(ord.items) ? ord.items : [],
                      method: normalizedMethod,
                      status: normalizedStatus,
                      supplierId: null,
                      timestamp: new Date().toISOString(),
                    });
                  }
                }
              } catch (e) {
                console.warn('Failed to emit socket event for webhook-confirmed payment', e);
              }
            } else {
              // create an order from payment metadata if possible
              await createOrderFromPayment(paymentDoc, req);
            }
          } catch (e) {
            console.error('Failed to mark order Confirmed after webhook payment:', e);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          { paymentStatus: "failed" }
        );
        break;
      }

      case "payment_intent.processing": {
        const intent = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          { paymentStatus: "requires_action" }
        );
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ message: "Webhook handler error", error: err.message });
  }
};

// Update payment status when payment succeeds (fallback for local development)
exports.updatePaymentStatus = async (req, res) => {
  try {
    console.log("=== UPDATE PAYMENT STATUS ===");
    console.log("Request body:", req.body);
    
    const { paymentIntentId, status } = req.body;
    
    if (!paymentIntentId || !status) {
      return res.status(400).json({ message: "paymentIntentId and status are required" });
    }

    // Find the payment by Stripe payment intent ID
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
    
    if (!payment) {
      console.log("Payment not found for paymentIntentId:", paymentIntentId);
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update payment status
    payment.paymentStatus = status;
    await payment.save();

    if (status === "paid") {
      await emitFinanceNotification({
        type: "payment-status",
        title: "Customer payment confirmed",
        message: `Payment ${payment.paymentId} has been marked as paid.`,
        payment,
        metadata: {
          event: "status-update",
        },
        dedupeKey: `payment-status-paid:${payment._id}`,
      });
          try {
            if (payment.orderId && mongoose.Types.ObjectId.isValid(payment.orderId)) {
              const updated = await Order.findByIdAndUpdate(payment.orderId, { $set: { status: 'Confirmed' } }, { new: true });
              console.log('Order marked Confirmed via updatePaymentStatus:', String(payment.orderId), 'orderStatus=', updated?.status);
              try {
                const io = getIo(req);
                if (io) {
                  const ord = await Order.findById(payment.orderId).lean().catch(() => null);
                  const normalizedMethod = String(payment.method || '').toLowerCase();
                  const normalizedStatus = String(payment.paymentStatus || '').toLowerCase();
                  const supplierLinked = Boolean(payment.supplierId);
                  if (normalizedMethod === 'stripe' && normalizedStatus === 'paid' && !supplierLinked) {
                    const orderTotal = ord && typeof ord.totalAmount === 'number' ? ord.totalAmount : null;
                    const normalizedAmount = orderTotal ?? fromStripeAmount(payment.amount, payment.currency);
                    io.emit('sales:confirmed', {
                      orderId: String(payment.orderId),
                      paymentId: String(payment._id),
                      amount: normalizedAmount,
                      currency: payment.currency,
                      items: ord && Array.isArray(ord.items) ? ord.items : [],
                      method: normalizedMethod,
                      status: normalizedStatus,
                      supplierId: null,
                      timestamp: new Date().toISOString(),
                    });
                  }
                }
              } catch (e) {
                console.warn('Failed to emit socket event for status-update payment', e);
              }
            } else {
              // create order from payment metadata when missing
              await createOrderFromPayment(payment, req);
            }
          } catch (e) {
            console.error('Failed to mark order Confirmed after payment status update:', e);
          }
    }
    
    console.log("Payment status updated:", {
      paymentId: payment._id,
      orderId: payment.orderId,
      status: payment.paymentStatus
    });

    res.status(200).json({ 
      message: "Payment status updated successfully",
      payment: {
        id: payment._id,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        status: payment.paymentStatus
      }
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ message: "Error updating payment status", error: error.message });
  }
};

// POST /api/payments/stripe/record-session
exports.recordCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method", "payment_intent.charges.data"],
    });

    const metadata = session.metadata || {};
    const rawOrderId = metadata.orderId;
    const rawUserId = metadata.userId || req.user?._id;
    const pendingOrderRaw = metadata.pendingOrder;

    if (!rawUserId) {
      return res.status(400).json({ message: "Missing userId in checkout session metadata" });
    }

    const userIdMeta = mongoose.Types.ObjectId.isValid(rawUserId)
      ? rawUserId
      : null;

    if (!userIdMeta) {
      return res.status(400).json({ message: "Invalid userId in checkout session metadata" });
    }

    const orderId = rawOrderId && mongoose.Types.ObjectId.isValid(rawOrderId)
      ? rawOrderId
      : null;

    if (!orderId && !pendingOrderRaw) {
      return res.status(400).json({ message: "Missing order reference in metadata" });
    }

    const pi = session.payment_intent;
    const charge =
      typeof pi !== "string" ? pi?.charges?.data?.[0] : null;

    // Build payment record
    const paymentData = {
      paymentId: session.id,
  paymentName: orderId ? `Order ${orderId}` : `Online checkout ${session.id}`,
      orderId: orderId || undefined,
      userId: userIdMeta,
      amount: session.amount_total,
      currency: session.currency,
      method: "stripe",
      customerEmail: session.customer_email,
      paymentStatus:
        session.payment_status === "paid" || session.status === "complete"
          ? "paid"
          : "pending",
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof pi === "string" ? pi : pi?.id,
      cardBrand: charge?.payment_method_details?.card?.brand,
      cardLast4: charge?.payment_method_details?.card?.last4,
      receiptUrl: charge?.receipt_url,
    };

    if (!orderId) {
      delete paymentData.orderId;
    }

    // Upsert: update if exists, else insert
    const payment = await Payment.findOneAndUpdate(
      { stripeSessionId: session.id },
  { $set: { ...paymentData, metadata } },
      { new: true, upsert: true }
    );

    // If session indicates paid, mark order Confirmed immediately
    try {
      if ((paymentData.paymentStatus === 'paid' || paymentData.paymentStatus === 'complete')) {
        // If payment references an existing orderId, mark it Confirmed
        if (paymentData.orderId && mongoose.Types.ObjectId.isValid(paymentData.orderId)) {
          const updated = await Order.findByIdAndUpdate(paymentData.orderId, { $set: { status: 'Confirmed' } }, { new: true });
          console.log('Order marked Confirmed via recordCheckoutSession:', String(paymentData.orderId), 'orderStatus=', updated?.status);
        } else {
          try {
            await createOrderFromPayment(payment, req);
          } catch (e) {
            console.error('Failed to create order from pending metadata:', e);
          }
        }
      }
    } catch (e) {
      console.error('Failed to mark order Confirmed after recording checkout session:', e);
    }

    return res.status(200).json({ message: "Payment saved", payment });
  } catch (err) {
    console.error("Error recording checkout session:", err);
    return res.status(500).json({
      message: "Failed to save payment",
      error: err.message,
    });
  }
};


