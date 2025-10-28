const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getCart, upsertCart, clearCart } = require('../Controlers/CartController');

router.get('/', requireAuth, getCart);
router.put('/', requireAuth, upsertCart);
router.delete('/', requireAuth, clearCart);

module.exports = router;
