const mongoose = require("mongoose");

const adminOrderSchema = new mongoose.Schema(
  {
    supplierId: { 
      type: String,  
      default: "N/A" 
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
      }
    ],
    totalCost: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Ordered", "Cancelled"],
      default: "Pending"
    },
    notes: { type: String, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminOrder", adminOrderSchema);
