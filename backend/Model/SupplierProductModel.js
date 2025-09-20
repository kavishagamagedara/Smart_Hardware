const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SupplierProductSchema = new Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
});

module.exports = mongoose.model('SupplierProductModel', SupplierProductSchema);
