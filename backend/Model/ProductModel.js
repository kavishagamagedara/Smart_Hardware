const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  category: { type: String, required: true },
  brand: { type: String, required: true },
  inStock: { type: Boolean, default: false },
  stockAmount: { type: Number, default: 0 },
  supplierId: { type: Schema.Types.ObjectId, ref: "User" },
  supplierProductId: { type: Schema.Types.ObjectId, ref: "SupplierProduct" },
  expireTrackingEnabled: { type: Boolean, default: false },
  expiryDate: { type: Date },
  expiryReminderDays: { type: Number, min: 0 },
  expiryNotificationSentAt: { type: Date },
  lastExpiryNotificationId: { type: Schema.Types.ObjectId, ref: "Notification" },
});

module.exports = mongoose.model("ProductModel", productSchema);
