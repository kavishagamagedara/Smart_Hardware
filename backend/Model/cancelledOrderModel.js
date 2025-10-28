const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cancelledOrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "No name" },
    contact: { type: String, required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, default: 0 },
      },
    ],
    paymentMethod: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    cancelReason: { type: String, default: "Not specified" },
    cancelledAt: { type: Date, default: Date.now },
    originalOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  {
    timestamps: true,
    collection: "cancelled orders",
  }
);

module.exports = mongoose.model("CancelledOrder", cancelledOrderSchema, "cancelled orders");
































































