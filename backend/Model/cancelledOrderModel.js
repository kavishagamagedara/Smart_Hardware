const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cancelledOrderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, 
  name: { type: String, default: "No name" }, 
  contact: { type: String, required: true },
  items: [
    {
      productName: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number } // optional
    }
  ],
  paymentMethod: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  cancelReason: { type: String, default: "Not specified" },
  cancelledAt: { type: Date, default: Date.now },
  originalOrderId: { type: Schema.Types.ObjectId, ref: "Order" }
});

module.exports = mongoose.model("CancelledOrder", cancelledOrderSchema);
































































