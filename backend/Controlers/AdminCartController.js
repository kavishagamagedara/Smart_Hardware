const mongoose = require('mongoose');
const AdminCart = require('../Model/AdminCartModel');

const getAdminCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const cart = await AdminCart.findOne({ userId }).lean();
    return res.status(200).json({ items: cart ? cart.items : [] });
  } catch (err) {
    console.error('getAdminCart error:', err);
    res.status(500).json({ message: 'Error fetching admin cart', error: err.message });
  }
};

const upsertAdminCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const incoming = Array.isArray(req.body.items) ? req.body.items : [];
    const items = incoming
      .map((it) => {
        const pid = it.productId || it._id;
        if (!pid || !mongoose.Types.ObjectId.isValid(String(pid))) return null;
        const q = Number(it.quantity || 0);
        if (!Number.isInteger(q) || q <= 0) return null;
        const supplierId = it.supplierId || it.supplier || null;
        let supplierObj = undefined;
        if (supplierId && mongoose.Types.ObjectId.isValid(String(supplierId))) {
          supplierObj = new mongoose.Types.ObjectId(String(supplierId));
        }
        return {
          productId: new mongoose.Types.ObjectId(String(pid)),
          productName: it.productName || it.name || '',
          supplierId: supplierObj,
          price: Number(it.price || 0),
          quantity: q,
        };
      })
      .filter(Boolean);

    const updated = await AdminCart.findOneAndUpdate(
      { userId },
      { $set: { items } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ items: updated.items });
  } catch (err) {
    console.error('upsertAdminCart error:', err);
    res.status(500).json({ message: 'Error updating admin cart', error: err.message });
  }
};

const clearAdminCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    await AdminCart.deleteOne({ userId });
    res.status(200).json({ message: 'Admin cart cleared' });
  } catch (err) {
    console.error('clearAdminCart error:', err);
    res.status(500).json({ message: 'Error clearing admin cart', error: err.message });
  }
};

module.exports = { getAdminCart, upsertAdminCart, clearAdminCart };
