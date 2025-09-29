const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const ctrl = require('../Controlers/ReviewControllers'); // <- match filename EXACTLY
const User = require('../Model/UserModel');
const { permsForRole } = require('../middleware/auth');

// Require auth for mutations; attach (optional) auth for reads
async function hydrateUserContext(id) {
  const userDoc = await User.findById(id).select('name role permissions');
  if (!userDoc) return null;

  const role = String(userDoc.role || 'user').toLowerCase();
  const directPerms = Array.isArray(userDoc.permissions) ? userDoc.permissions : [];
  const rolePerms = await permsForRole(role);
  const combinedPerms = Array.from(
    new Set([
      ...directPerms.map((p) => String(p || '').toLowerCase()),
      ...(Array.isArray(rolePerms) ? rolePerms.map((p) => String(p || '').toLowerCase()) : [])
    ])
  );

  return {
    user: {
      _id: userDoc._id,
      role,
      name: userDoc.name || 'User'
    },
    permissions: combinedPerms
  };
}

async function requireAuth(req, res, next) {
  try {
    const id = req.header('x-user-id');
    if (!id) return res.status(401).json({ message: 'Unauthorized: missing x-user-id' });
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid x-user-id: must be a 24 character hex string' });
    }

    const context = await hydrateUserContext(id);
    if (!context) return res.status(401).json({ message: 'Unauthorized: user not found' });

    req.user = context.user;
    req.userPerms = context.permissions;
    if (!req.headers['x-user-name'] && context.user.name) {
      req.headers['x-user-name'] = context.user.name;
    }

    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function attachAuth(req, _res, next) {
  try {
    const id = req.header('x-user-id');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return next();

    const context = await hydrateUserContext(id);
    if (context) {
      req.user = context.user;
      req.userPerms = context.permissions;
      if (!req.headers['x-user-name'] && context.user.name) {
        req.headers['x-user-name'] = context.user.name;
      }
    }
    next();
  } catch (err) {
    console.error('attachAuth error:', err);
    next();
  }
}

// READ
router.get('/', attachAuth, ctrl.getReviews);
router.get('/product/:productId', attachAuth, ctrl.getProductReviews);
router.get('/product/:productId/can-review', requireAuth, ctrl.canUserReviewProduct);
router.get('/recycle-bin', requireAuth, ctrl.listDeletedReviews);
router.get('/:id', attachAuth, ctrl.getReviewById);

// WRITE
router.post('/', requireAuth, ctrl.upload.array('images', 5), ctrl.createReview); // Allow up to 5 images
router.patch('/:id', requireAuth, ctrl.upload.array('images', 5), ctrl.updateReview);
router.delete('/:id', requireAuth, ctrl.deleteReview);
router.post('/:id/restore', requireAuth, ctrl.restoreReview);
router.delete('/:id/purge', requireAuth, ctrl.purgeReview);

// ADMIN
router.post('/:id/replies', requireAuth, ctrl.upload.array('images', 3), ctrl.replyToReview);
router.post('/:id/visibility', requireAuth, ctrl.setVisibility);
router.post('/:id/pin', requireAuth, ctrl.pinReview);
router.patch('/:id/replies/:replyId', requireAuth, ctrl.upload.array('images', 3), ctrl.updateReply);
router.delete('/:id/replies/:replyId', requireAuth, ctrl.deleteReply);

module.exports = router;
