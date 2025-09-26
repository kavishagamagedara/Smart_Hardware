const mongoose = require('mongoose');
const Review = require('../Model/ReviewModel');
const Counter = require('../Model/Counter');

const vstr = (x) => (x ?? '').toString().trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canEditOrDelete(review, requester) {
  if (!requester) return false;
  const isOwner = review.user?.toString() === requester._id?.toString();
  const isAdmin = requester.role === 'admin';
  return isOwner || isAdmin;
}

// ---------- CREATE (upsert per user+target) ----------
const createReview = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = vstr(req.header('x-user-name')) || 'Guest';

    let {
      targetType = 'Product',
      targetId,
      targetKey,
      targetName,
      rating,
      title,
      comment
    } = req.body || {};

    rating     = Number(rating);
    title      = vstr(title);
    comment    = vstr(comment);
    targetKey  = vstr(targetKey);
    targetName = vstr(targetName);

    const errors = [];
    if (!['Product', 'Hardware', 'Vendor', 'Ticket'].includes(targetType)) errors.push('Invalid targetType');
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) errors.push('rating must be 1..5');
    if (title.length > 200) errors.push('title too long (max 200)');
    if (comment.length < 5) errors.push('comment must be at least 5 characters');
    if (comment.length > 3000) errors.push('comment too long (max 3000)');
    if (!targetId && !targetKey) errors.push('targetKey is required (or pass targetId)');
    if (!targetName) errors.push('targetName is required');
    if (targetId && !mongoose.Types.ObjectId.isValid(targetId)) errors.push('Invalid targetId');
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const filter = targetId
      ? { user: userId, targetType, targetId,  status: { $ne: 'deleted' } }
      : { user: userId, targetType, targetKey, status: { $ne: 'deleted' } };

    let reviewNo;
    try {
      reviewNo = await Counter.next('reviewNo');
    } catch {
      reviewNo = Math.floor(Date.now() / 1000);
    }

    const setOnInsert = {
      user: userId,
      userName,
      targetType,
      status: 'public',
      targetId:  targetId  || undefined,
      targetKey: targetKey || undefined,
      reviewNo
    };

    const update = {
      $set: { rating, title, comment, targetName },
      $setOnInsert: setOnInsert
    };

    const existed = await Review.findOne(filter).lean();
    const doc = await Review.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      runValidators: true
    });

    res.status(existed ? 200 : 201).json(doc);
  } catch (err) {
    console.error('createReview error:', err);
    res.status(500).json({ message: 'Server error', detail: err?.message || String(err) });
  }
};

// ---------- LIST (supports ?q= ... including "ID:PRD-0002") ----------
const getReviews = async (req, res) => {
  try {
    const {
      targetType, targetId, targetKey, status, user,
      sort = '-createdAt', page = 1, limit = 10, mine, q
    } = req.query;

    const requester = req.user || null;
    const isAdmin = requester?.role === 'admin';

    const filter = {};
    if (targetType) filter.targetType = targetType;
    if (targetId)   filter.targetId   = targetId;
    if (targetKey)  filter.targetKey  = targetKey;
    if (mine && requester?._id) filter.user = requester._id;
    else if (user) filter.user = user;

    if (isAdmin) { if (status) filter.status = status; }
    else { filter.status = 'public'; }

    const queryText = vstr(q);
    if (queryText) {
      const idMatch = queryText.match(/^id\s*:\s*(.+)$/i);
      if (idMatch) {
        const key = idMatch[1].trim();
        const exactKey = new RegExp(`^${escapeRegex(key)}$`, 'i');
        const ors = [{ targetKey: exactKey }];
        if (/^[0-9a-fA-F]{24}$/.test(key)) ors.push({ targetId: key });
        filter.$or = ors;
      } else {
        const re = new RegExp(escapeRegex(queryText), 'i');
        filter.$or = [
          { targetName: re },
          { targetKey:  re },
          { title:      re },
          { comment:    re }
        ];
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Review.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Review.countDocuments(filter)
    ]);

    res.json({
      data: items,
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    console.error('getReviews error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- GET ONE ----------
const getReviewById = async (req, res) => {
  try {
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const isAdmin = req.user?.role === 'admin';
    const isOwner = doc.user?.toString() === req.user?._id?.toString();
    if (!isAdmin && !isOwner && doc.status !== 'public') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(doc);
  } catch (err) {
    console.error('getReviewById error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- UPDATE ----------
const updateReview = async (req, res) => {
  try {
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (!canEditOrDelete(doc, req.user)) return res.status(403).json({ message: 'Forbidden' });

    const allowedForOwner = ['rating', 'title', 'comment'];
    const allowedForAdmin = ['status'];

    const next = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allowedForOwner.includes(k) || (req.user?.role === 'admin' && allowedForAdmin.includes(k))) {
        next[k] = typeof v === 'string' ? v.trim() : v;
      }
    }

    const errors = [];
    if (next.rating != null) {
      const r = Number(next.rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) errors.push('rating must be 1..5');
    }
    if (next.title && next.title.length > 200) errors.push('title too long (max 200)');
    if (next.comment && (next.comment.length < 5 || next.comment.length > 3000)) {
      errors.push('comment must be 5..3000 chars');
    }
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    Object.assign(doc, next);
    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('updateReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- DELETE (soft) ----------
const deleteReview = async (req, res) => {
  try {
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (!canEditOrDelete(doc, req.user)) return res.status(403).json({ message: 'Forbidden' });

    doc.status = 'deleted';
    await doc.save();
    res.json({ message: 'Deleted', id: doc._id });
  } catch (err) {
    console.error('deleteReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- ADMIN: reply ----------
const replyToReview = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const message = vstr(req.body?.message);
    if (!message) return res.status(400).json({ message: 'Reply message required' });

    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    doc.replies.push({ admin: req.user._id, message });
    doc.replyCount = doc.replies.length;
    await doc.save();

    res.json(doc);
  } catch (err) {
    console.error('replyToReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- ADMIN: visibility ----------
const setVisibility = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const action = vstr(req.body?.action); // "hide" | "unhide"
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (action === 'hide') doc.status = 'hidden';
    else if (action === 'unhide') doc.status = 'public';
    else return res.status(400).json({ message: 'Invalid action' });

    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('setVisibility error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createReview,
  getReviews,
  getReviewById,
  updateReview,
  deleteReview,
  replyToReview,
  setVisibility
};
