// models/AdminCancelledOrder.js
const mongoose = require("mongoose");

const adminCancelledOrderSchema = new mongoose.Schema(
  {
    originalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminOrder" },
    supplierId: { type: String, default: "N/A" },
    supplierIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    contact: { type: String, default: "N/A" },
    paymentMethod: { type: String, default: "Cash Payment" },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierProduct", default: null },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        lineSubtotal: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        discountValue: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
        supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        supplierStatus: { type: String, default: "Pending" },
      },
    ],
    totalCost: { type: Number, required: true },
    status: { type: String, default: "Cancelled" },
    notes: { type: String, default: null },
    cancelledAt: { type: Date, default: Date.now },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledByName: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "admincancelledorders",
  }
);

module.exports = mongoose.model("AdminCancelledOrder", adminCancelledOrderSchema, "admincancelledorders");
