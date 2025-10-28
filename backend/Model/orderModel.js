const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, 
    contact: { type: String, required: true },
    paymentMethod: { type: String, required: true },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,   // ✅ always store the real productId
        },
        productName: { type: String, required: true }, // keep name for display
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],

    totalAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Delivered", "Canceled"],
      default: "Pending",
    },

    cancelReason: { type: String, default: null },
    stripeSessionId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
