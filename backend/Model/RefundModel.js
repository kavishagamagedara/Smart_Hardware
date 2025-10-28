const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    authorType: {
      type: String,
      enum: ["user", "staff"],
      required: true,
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const HistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "processing", "accepted", "declined"],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 1000 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RefundRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    item: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      productName: { type: String, required: true, trim: true, maxlength: 200 },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 },
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "accepted", "declined"],
      default: "pending",
      index: true,
    },
    decision: {
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      decidedAt: { type: Date },
      note: { type: String, trim: true, maxlength: 1000 },
    },
    messages: [MessageSchema],
    history: [HistorySchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

RefundRequestSchema.index({ user: 1, "item.productId": 1, status: 1 });
RefundRequestSchema.index({ order: 1, "item.productId": 1 });

module.exports =
  mongoose.models.RefundRequest ||
  mongoose.model("RefundRequest", RefundRequestSchema);
