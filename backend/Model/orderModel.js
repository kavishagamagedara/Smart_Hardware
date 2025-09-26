const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
    contact: { type: String, required: true },
    paymentMethod: { type: String, required: true }, 
    items: [
      {
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, 
      },
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Canceled"], 
      default: "Pending",
    },
    cancelReason: { type: String, default: null }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
