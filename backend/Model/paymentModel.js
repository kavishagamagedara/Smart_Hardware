const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      default: () => `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      unique: true,
    },
    paymentName: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "requires_action", "paid", "failed", "canceled"],
      default: "pending",
      index: true,
    },
    method: { type: String, enum: ["slip", "stripe"], required: true },
    amount: { type: Number },
    currency: { type: String, default: "usd" },
    customerEmail: { type: String },
    description: { type: String },

    // Stripe-only
    stripeSessionId: { type: String },
    stripePaymentIntentId: { type: String },
    cardBrand: String,
    cardLast4: String,
    receiptUrl: String,

    // Slip-only
    slipUrl: String,
    slipPath: String,
    slipOriginalName: String,
    slipMimeType: String,
    slipSize: Number,
    slipUploadedAt: Date,
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1, paymentId: 1, method: 1 }, { unique: true });
PaymentSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: "string" } } }
);

module.exports = mongoose.model("Payment", PaymentSchema);
