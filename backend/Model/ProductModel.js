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
});

module.exports = mongoose.model("ProductModel", productSchema);
