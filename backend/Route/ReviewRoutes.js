const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const ctrl = require('../Controlers/ReviewControllers');

// Require auth for mutations; attach (optional) auth for reads
function requireAuth(req, res, next) {
  const id = req.header('x-user-id');
  const role = req.header('x-user-role') || 'user';
  if (!id) return res.status(401).json({ message: 'Unauthorized: missing x-user-id' });
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ message: 'Invalid x-user-id: must be 24 hex characters' });
  }
  req.user = { _id: new mongoose.Types.ObjectId(id), role };
  if (!req.header('x-user-name')) req.headers['x-user-name'] = 'Guest';
  next();
}

function attachAuth(req, _res, next) {
  const id = req.header('x-user-id');
  const role = req.header('x-user-role') || 'user';
  if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
    req.user = { _id: new mongoose.Types.ObjectId(id), role };
  }
  next();
}

// READ
router.get('/', attachAuth, ctrl.getReviews);
router.get('/:id', attachAuth, ctrl.getReviewById);

// WRITE
router.post('/', requireAuth, ctrl.createReview);
router.patch('/:id', requireAuth, ctrl.updateReview);
router.delete('/:id', requireAuth, ctrl.deleteReview);

// ADMIN
router.post('/:id/replies', requireAuth, ctrl.replyToReview);
router.post('/:id/visibility', requireAuth, ctrl.setVisibility);

module.exports = router;
