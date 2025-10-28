/**
 * create-admin-cart.js
 *
 * Usage (PowerShell example):
 *  $env:MONGODB_URI = "mongodb://127.0.0.1:27017/smarthardware";
 *  $env:ADMIN_USER_ID = "64f1a1b2c3d4e5f678901234";
 *  node create-admin-cart.js
 *
 * Or pass MONGODB_URI via .env and set ADMIN_USER_ID env var before running.
 */

const mongoose = require('mongoose');
const AdminCart = require('./Model/AdminCartModel');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/smarthardware';
  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    console.error('ERROR: ADMIN_USER_ID environment variable must be set to the admin user id to create a sample cart.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB:', uri.includes('@') ? uri.split('@').pop() : uri);
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected');

    const sample = {
      userId: mongoose.Types.ObjectId(String(adminUserId)),
      items: [
        {
          productId: mongoose.Types.ObjectId(),
          productName: 'Sample supplier product',
          supplierId: mongoose.Types.ObjectId(),
          price: 1000,
          quantity: 2,
        },
      ],
    };

    const existing = await AdminCart.findOne({ userId: sample.userId });
    if (existing) {
      console.log('An admin cart already exists for this user. Updating it with sample items...');
      existing.items = sample.items;
      await existing.save();
      console.log('Updated admin cart:', existing);
    } else {
      const created = await AdminCart.create(sample);
      console.log('Created admin cart:', created);
    }

    console.log('Done. Check your MongoDB for the `admincarts` collection (collection name is admincarts).');
  } catch (err) {
    console.error('Failed:', err.message || err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(0);
  }
}

main();
