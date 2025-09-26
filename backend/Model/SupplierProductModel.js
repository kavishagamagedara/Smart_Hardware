const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SupplierProductSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  supplierId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("SupplierProduct", SupplierProductSchema);
