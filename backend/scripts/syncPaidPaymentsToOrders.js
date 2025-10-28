/*
  One-off script: find all payments with paymentStatus==='paid'
  and ensure their orders have status === 'Confirmed'.

  Usage (PowerShell):
    $env:MONGODB_LOCAL_URI = 'mongodb://127.0.0.1:27017/smarthardware'
    node backend/scripts/syncPaidPaymentsToOrders.js

*/
const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('../Model/paymentModel');
const Order = require('../Model/orderModel');

async function connect() {
  const local = process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/smarthardware';
  const atlas = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
  const uri = (atlas && !String(atlas).includes('username:password')) ? atlas : local;
  console.log('Connecting to MongoDB:', uri.includes('@') ? uri.split('@').pop() : uri);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
}

async function run() {
  try {
    await connect();
    console.log('Connected. Scanning paid payments...');

    const payments = await Payment.find({ paymentStatus: 'paid' }).lean();
    console.log('Found paid payments:', payments.length);

    let updatedCount = 0;
    for (const p of payments) {
      const oid = p.orderId;
      if (!oid) continue;
      try {
        const order = await Order.findById(oid).lean();
        if (!order) {
          console.warn('Order not found for payment', p._id, 'orderId=', oid);
          continue;
        }
        if (String(order.status) === 'Confirmed') continue;
        await Order.findByIdAndUpdate(oid, { $set: { status: 'Confirmed' } });
        console.log('Marked order Confirmed for payment', String(p._id), 'orderId=', String(oid));
        updatedCount++;
      } catch (e) {
        console.error('Error processing payment', p._id, e.message);
      }
    }

    console.log(`Done. Orders updated: ${updatedCount}`);
  } catch (err) {
    console.error('Script failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
