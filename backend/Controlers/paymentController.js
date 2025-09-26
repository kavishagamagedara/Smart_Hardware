// controllers/paymentController.js
const Payment = require("../Model/paymentModel");
require("dotenv").config()
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ----------------------------- helpers ----------------------------- */

// map amount into Stripe’s expected minor units
function toStripeAmount(amount, currency = "usd") {
  const zeroDecimal = new Set([
    "bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
  ]);
  const a = Number(amount);
  if (!Number.isFinite(a)) return null;
  return zeroDecimal.has(String(currency).toLowerCase()) ? Math.round(a) : Math.round(a * 100);
}

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id));

/* ------------------------- BASIC CRUD (used by admin UI) ------------------------- */

// GET /api/payments?method=&status=&orderId=
exports.getAllPayments = async (req, res) => {
  try {
    const { method, status, orderId } = req.query;
    const q = {};
    if (method) q.method = method;
    if (status) q.paymentStatus = status;
    if (orderId) q.orderId = orderId;

    const payments = await Payment.find(q).sort({ createdAt: -1 });
    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { orderId, amount, currency = "usd" } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ message: "orderId and amount are required" });
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
            product_data: { name: `Order ${orderId}` },
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
        orderId: orderId.toString(),
        userId: userId,   // ✅ always a valid ObjectId now
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
      expand: ["payment_intent"],
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
    const existing = await Payment.findOne({ stripeSessionId: session.id });
    if (existing) {
      return res.status(200).json({ message: "Payment already recorded", payment: existing });
    }

    const payment = await Payment.create({
  paymentName: `Order ${metadata.orderId}`,
  orderId: metadata.orderId,
  userId: metadata.userId,   // ✅ always valid
  paymentStatus: session.payment_status === "paid" ? "paid" : "pending",
  method: "stripe",
  amount: session.amount_total,
  currency: session.currency,
  customerEmail: session.customer_email,
  stripeSessionId: session.id,
  stripePaymentIntentId: session.payment_intent?.id || null,
});


    res.status(201).json({ message: "✅ Payment recorded successfully", payment });
  } catch (err) {
    console.error("❌ Error recording payment:", err);
    res.status(500).json({ message: "Error recording payment", error: err.message });
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
    const { paymentId, paymentName, orderId, description } = req.body;

    if (!paymentId || !paymentName || !orderId) {
      return res.status(400).json({ message: "paymentId, paymentName, orderId are required" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Slip file is required" });
    }

    const file = req.file;
    const slipUrl = `${req.protocol}://${req.get("host")}/uploads/slips/${file.filename}`;

    const paymentData = {
      paymentId,
      paymentName,
      orderId,
      paymentStatus: "pending",
      method: "slip",
      slipUrl,
      slipPath: file.path,
      slipOriginalName: file.originalname,
      slipMimeType: file.mimetype,
      slipSize: file.size,
      slipUploadedAt: new Date(),
    };

    // Add description if provided
    if (description && description.trim()) {
      paymentData.description = description.trim();
    }

    const payment = await Payment.create(paymentData);

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
    let { amount, currency = "usd", orderId, paymentName } = req.body;

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

        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          update,
          { new: true }
        );
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

    const orderId = session.metadata?.orderId;
    const userIdMeta = session.metadata?.userId || req.user?._id;

    if (!orderId || !userIdMeta) {
      return res.status(400).json({ message: "Missing orderId or userId in metadata" });
    }

    const pi = session.payment_intent;
    const charge =
      typeof pi !== "string" ? pi?.charges?.data?.[0] : null;

    // Build payment record
    const paymentData = {
      paymentId: session.id,
      paymentName: `Order ${orderId}`,
      orderId,
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

    // Upsert: update if exists, else insert
    const payment = await Payment.findOneAndUpdate(
      { stripeSessionId: session.id },
      paymentData,
      { new: true, upsert: true }
    );

    return res.status(200).json({ message: "Payment saved", payment });
  } catch (err) {
    console.error("Error recording checkout session:", err);
    return res.status(500).json({
      message: "Failed to save payment",
      error: err.message,
    });
  }
};


