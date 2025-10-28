// models/adminOrderModel.js
const mongoose = require("mongoose");

const adminOrderSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierProduct", required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        lineSubtotal: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        discountValue: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
        appliedDiscountId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierDiscount", default: null },
        supplierStatus: {
          type: String,
          enum: ["Pending", "Accepted", "Declined"],
          default: "Pending",
        },
      },
    ],
    totalCost: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    contact: { type: String, required: true },
    paymentMethod: { type: String, default: "Cash Payment" },
    slip: { type: String, default: null }, // ✅ Added field for bank transfer slip
    status: {
      type: String,
      enum: ["Pending", "Ordered", "Cancelled", "Declined"],
      default: "Pending",
    },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminOrder", adminOrderSchema);
