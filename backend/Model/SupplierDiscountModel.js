const mongoose = require("mongoose");

const SupplierDiscountSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProduct",
      required: true,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    minQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 400,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

SupplierDiscountSchema.index({ supplierId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.model("SupplierDiscount", SupplierDiscountSchema);
