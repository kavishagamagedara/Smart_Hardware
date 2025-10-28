const mongoose = require('mongoose');

const AdminCartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'SupplierProduct' },
  productName: { type: String },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
}, { _id: false });

const AdminCartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: [AdminCartItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('AdminCart', AdminCartSchema);
