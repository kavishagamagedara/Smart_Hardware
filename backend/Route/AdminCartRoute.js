const express = require('express');
const router = express.Router();
const { getAdminCart, upsertAdminCart, clearAdminCart } = require('../Controlers/AdminCartController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, getAdminCart);
router.put('/', requireAuth, upsertAdminCart);
router.delete('/', requireAuth, clearAdminCart);

module.exports = router;
