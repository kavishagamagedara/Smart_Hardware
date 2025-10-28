const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      default: () => `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      unique: true,
    },
    paymentName: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paymentStatus: {
      type: String,
      enum: ["pending", "requires_action", "paid", "failed", "canceled"],
      default: "pending",
      index: true,
    },
    method: { type: String, enum: ["slip", "stripe"], required: true },
    amount: { type: Number },
  currency: { type: String, default: "lkr" },
    customerEmail: { type: String },
    description: { type: String },

    // Stripe-only
    stripeSessionId: { type: String },
    stripePaymentIntentId: { type: String },
    cardBrand: String,
    cardLast4: String,
    receiptUrl: String,
      // arbitrary metadata saved from Stripe session (optional)
      metadata: { type: mongoose.Schema.Types.Mixed },

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

// Post-save hook: when a payment is saved with status 'paid', mark the related order Confirmed
try {
  const Order = require('./orderModel');
  PaymentSchema.post('save', async function (doc) {
    try {
      if (doc && doc.paymentStatus === 'paid' && doc.orderId) {
        if (mongoose.Types.ObjectId.isValid(doc.orderId)) {
          const updated = await Order.findByIdAndUpdate(doc.orderId, { $set: { status: 'Confirmed' } }, { new: true });
          console.log('Order marked Confirmed via Payment.post.save:', String(doc.orderId), 'orderStatus=', updated?.status);
        }
      }
    } catch (err) {
      console.error('Error in Payment post-save hook:', err);
    }
  });

  // Post findOneAndUpdate hook: triggered when controllers update payments via findOneAndUpdate
  PaymentSchema.post('findOneAndUpdate', async function (doc) {
    try {
      if (doc && doc.paymentStatus === 'paid' && doc.orderId) {
        if (mongoose.Types.ObjectId.isValid(doc.orderId)) {
          const updated = await Order.findByIdAndUpdate(doc.orderId, { $set: { status: 'Confirmed' } }, { new: true });
          console.log('Order marked Confirmed via Payment.post.findOneAndUpdate:', String(doc.orderId), 'orderStatus=', updated?.status);
        }
      }
    } catch (err) {
      console.error('Error in Payment post-findOneAndUpdate hook:', err);
    }
  });
} catch (err) {
  console.error('Failed to attach payment hooks:', err);
}
