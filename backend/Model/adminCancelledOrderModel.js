// models/AdminCancelledOrder.js
const mongoose = require("mongoose");

const adminCancelledOrderSchema = new mongoose.Schema(
  {
    supplierId: { 
      type: String,   
      default: "N/A" 
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalCost: { type: Number, required: true },
    status: { 
      type: String, 
      default: "Cancelled" 
    },
    notes: { type: String, default: null },
    cancelledAt: { 
      type: Date, 
      default: Date.now     
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminCancelledOrder", adminCancelledOrderSchema);
