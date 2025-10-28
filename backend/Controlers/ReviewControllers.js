const mongoose = require('mongoose');
const Review = require('../Model/ReviewModel');
const Counter = require('../Model/Counter');
const Product = require('../Model/ProductModel');
const { updateProductRating } = require('./ProductController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Notification = require('../Model/NotificationModel');
const User = require('../Model/UserModel');
const Order = require('../Model/orderModel'); 


// Configure multer for review image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/reviews/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'review-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const vstr = (x) => (x ?? '').toString().trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildActorName = (req, fallback = 'System') =>
  vstr(req?.header?.('x-user-name')) || vstr(req?.user?.name) || fallback;

const notifyAdmins = async ({ title, message, type = 'general', relatedReview, metadata, createdBy }) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (!admins.length) {
      await Notification.create({
        recipient: null,
        recipientRole: 'admin',
        title,
        message,
        type,
        relatedReview,
        metadata,
        createdBy
      });
      return;
    }

    const docs = admins.map((admin) => ({
      recipient: admin._id,
      recipientRole: 'admin',
      title,
      message,
      type,
      relatedReview,
      metadata,
      createdBy
    }));

    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.warn('notifyAdmins error:', err?.message || err);
  }
};

const notifyCareManagers = async ({ title, message, type = 'general', relatedReview, metadata, createdBy }) => {
  try {
    const careManagers = await User.find({ 
      $or: [
        { role: 'customer care manager' },
        { role: { $regex: /care/i } }
      ]
    }).select('_id');
    
    if (!careManagers.length) {
      await Notification.create({
        recipient: null,
        recipientRole: 'customer care manager',
        title,
        message,
        type,
        relatedReview,
        metadata,
        createdBy
      });
      return;
    }

    const docs = careManagers.map((manager) => ({
      recipient: manager._id,
      recipientRole: 'customer care manager',
      title,
      message,
      type,
      relatedReview,
      metadata,
      createdBy
    }));

    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.warn('notifyCareManagers error:', err?.message || err);
  }
};

const notifyUser = async (userId, payload = {}) => {
  if (!userId) return;
  try {
    await Notification.create({
      recipient: userId,
      recipientRole: 'user',
      ...payload
    });
  } catch (err) {
    console.warn('notifyUser error:', err?.message || err);
  }
};

const removeFiles = (paths = []) => {
  paths
    .filter(Boolean)
    .forEach((img) => {
      const relativePath = img.startsWith('/') ? img.slice(1) : img;
      const fullPath = path.join(process.cwd(), relativePath);
      fs.unlink(fullPath, (error) => {
        if (error && error.code !== 'ENOENT') {
          console.warn('Failed to remove file:', fullPath, error.message);
        }
      });
    });
};

const hasPermission = (req, perms = []) => {
  if (!req || !Array.isArray(req.userPerms) || req.userPerms.length === 0) return false;
  const userPerms = req.userPerms.map((perm) => String(perm || '').toLowerCase());
  return perms.some((perm) => userPerms.includes(String(perm || '').toLowerCase()));
};

const hasModerationRights = (req) => {
  if (req?.user?.role === 'admin') return true;
  
  // Check if user is a care manager
  const userRole = String(req?.user?.role || '').toLowerCase();
  if (userRole === 'customer care manager' || userRole.includes('care')) return true;
  
  const moderationPerms = ['moderate_feedback', 'cc_view_feedback', 'cc_respond_feedback', 'cc_manage_returns'];
  return hasPermission(req, moderationPerms);
};

function canEditOrDelete(review, req) {
  if (!req?.user) return false;
  const requester = req.user;
  const isOwner = review.user?.toString() === requester._id?.toString();
  if (isOwner) return true;
  if (requester.role === 'admin') return true;
  return hasModerationRights(req);
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

    if (targetType === 'Product') {
      let productObjectId = null;
      if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
        productObjectId = targetId;
      } else if (targetKey && mongoose.Types.ObjectId.isValid(targetKey)) {
        productObjectId = targetKey;
      }

      if (!productObjectId) {
        return res.status(403).json({ message: 'Unable to verify product ownership for this review.' });
      }

      const hasOrder = await Order.exists({ userId, 'items.productId': productObjectId });
      if (!hasOrder) {
        return res.status(403).json({ message: 'You can only review products you have ordered.' });
      }
    }

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

    // Handle uploaded images
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(`/uploads/reviews/${file.filename}`);
      });
    }

    const update = {
      $set: { rating, title, comment, targetName, images },
      $setOnInsert: setOnInsert
    };

    const existed = await Review.findOne(filter).lean();
    const doc = await Review.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      runValidators: true
    });

    // Update product rating if this is a product review
    if (targetType === 'Product' && (targetKey || doc.targetKey)) {
      await updateProductRating(targetKey || doc.targetKey);
    }

    if (!existed) {
      await notifyAdmins({
        title: 'New customer feedback received',
        message: `${userName} rated ${targetName} ${rating}/5`,
        type: 'review-submitted',
        relatedReview: doc._id,
        metadata: {
          targetName,
          rating,
          reviewNo: doc.reviewNo,
          targetId: targetId || targetKey
        },
        createdBy: userId
      });

      await notifyCareManagers({
        title: 'New customer feedback received',
        message: `${userName} rated ${targetName} ${rating}/5 - Please review and respond if needed`,
        type: 'review-submitted',
        relatedReview: doc._id,
        metadata: {
          targetName,
          rating,
          reviewNo: doc.reviewNo,
          targetId: targetId || targetKey
        },
        createdBy: userId
      });
    }

    res.status(existed ? 200 : 201).json(doc);
  } catch (err) {
    console.error('createReview error:', err);
    res.status(500).json({ message: 'Server error', detail: err?.message || String(err) });
  }
};

// ---------- GET PRODUCT REVIEWS ----------
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // First get the product to validate it exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const filter = {
      targetType: 'Product',
      $or: [
        { targetId: productId },
        { targetKey: productId } // In case using string IDs
      ],
      status: 'public'
    };

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(filter)
    ]);

    // Calculate average rating
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    res.json({
      product: {
        _id: product._id,
        name: product.name,
        averageRating: avgRating,
        totalReviews: total
      },
      reviews: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    console.error('getProductReviews error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- CHECK IF USER CAN REVIEW PRODUCT ----------
const canUserReviewProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log("🔍 Checking canUserReviewProduct (no order check):", {
      userId,
      productId,
    });

    // ✅ Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existingReview = await Review.findOne({
      user: userId,
      targetType: "Product",
      $or: [{ targetId: productId }, { targetKey: productId }],
      status: { $ne: "deleted" },
    });

    let hasOrder = false;
    const productObjectId = mongoose.Types.ObjectId.isValid(productId) ? productId : null;
    if (productObjectId) {
      hasOrder = await Order.exists({ userId, "items.productId": productObjectId });
    }

    console.log(
      "✍ Existing review?",
      existingReview ? existingReview._id : "NONE"
    );

    res.json({
      canReview: Boolean(hasOrder) && !existingReview,
      hasOrder,
      hasReviewed: !!existingReview,
      existingReview: existingReview || null,
      product: {
        _id: product._id,
        name: product.name,
      },
    });
  } catch (err) {
    console.error("❌ canUserReviewProduct error:", err);
    res.status(500).json({
      message: "Server error",
      detail: err?.message || String(err),
    });
  }
};


const getReviews = async (req, res) => {
  try {
    const {
      targetType,
      targetId,
      targetKey,
      status,
      user,
      sort,
      page = 1,
      limit = 10,
      mine,
      q,
      pinned
    } = req.query;

  const requester = req.user || null;
  const isAdmin = requester?.role === 'admin';
  const canModerate = hasModerationRights(req);

    const filter = {};
    if (targetType) filter.targetType = targetType;
    if (targetId)   filter.targetId   = targetId;
    if (targetKey)  filter.targetKey  = targetKey;
    if (mine && requester?._id) filter.user = requester._id;
    else if (user) filter.user = user;

    if (isAdmin || canModerate) {
      if (status != null) {
        const statusValue = Array.isArray(status) ? status.join(',') : String(status);
        if (statusValue === 'all') {
          filter.status = { $ne: 'deleted' };
        } else if (statusValue.includes(',')) {
          const parts = statusValue.split(',').map((item) => item.trim()).filter(Boolean);
          if (parts.length) filter.status = { $in: parts };
        } else {
          filter.status = statusValue;
        }
      } else {
        filter.status = { $ne: 'deleted' };
      }
    } else {
      filter.status = 'public';
    }

    if (pinned === 'true') filter.isPinned = true;
    else if (pinned === 'false') filter.isPinned = false;

    const queryText = vstr(q);
    if (queryText) {
      const idMatch = queryText.match(/^id\s*:\s*(.+)$/i);
      if (idMatch) {
        const key = idMatch[1].trim();
        const exactKey = new RegExp(`^${escapeRegex(key)}$`, 'i');
        const ors = [{ targetKey: exactKey }];
        if (/^[0-9a-fA-F]{24}$/.test(key)) {
          ors.push({ targetId: key });
          ors.push({ _id: key });
        }
        if (!Number.isNaN(Number(key))) ors.push({ reviewNo: Number(key) });
        filter.$or = ors;
      } else {
        const re = new RegExp(escapeRegex(queryText), 'i');
        const ors = [
          { targetName: re },
          { targetKey:  re },
          { userName:   re },
          { title:      re },
          { comment:    re }
        ];
        const numericQuery = Number(queryText);
        if (!Number.isNaN(numericQuery)) ors.push({ reviewNo: numericQuery });
        if (/^[0-9a-fA-F]{24}$/.test(queryText.trim())) ors.push({ _id: queryText.trim() });
        filter.$or = ors;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortSpec = typeof sort === 'string' && sort.trim()
      ? sort.trim()
      : { isPinned: -1, pinnedAt: -1, createdAt: -1 };
    const [items, total] = await Promise.all([
      Review.find(filter).sort(sortSpec).skip(skip).limit(Number(limit)),
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

const getReviewReport = async (req, res) => {
  try {
    const requester = req.user || {};
    const isAdmin = requester?.role === 'admin';
    const canModerate = hasModerationRights(req);

    if (!isAdmin && !canModerate) {
      return res.status(403).json({ message: 'Feedback reporting requires admin or moderation privileges' });
    }

    const {
      from,
      to,
      status = 'all',
      targetType,
      limit
    } = req.query || {};

    const parseDate = (value, endOfDay = false) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      if (!Number.isFinite(date.getTime())) return null;
      if (!endOfDay) {
        date.setHours(0, 0, 0, 0);
      } else {
        date.setHours(23, 59, 59, 999);
      }
      return date;
    };

    const startDate = parseDate(from, false);
    const endDate = parseDate(to, true);

    if (from && !startDate) {
      return res.status(400).json({ message: 'Invalid "from" date. Use ISO format (YYYY-MM-DD).' });
    }

    if (to && !endDate) {
      return res.status(400).json({ message: 'Invalid "to" date. Use ISO format (YYYY-MM-DD).' });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ message: '"from" date must be before "to" date.' });
    }

    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lte = endDate;
    }

    if (targetType) {
      match.targetType = targetType;
    }

    const toStatusArray = (input) => {
      if (input == null) return [];
      if (Array.isArray(input)) return input.map((item) => String(item || '').trim()).filter(Boolean);
      return String(input || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const statusArray = toStatusArray(status);
    if (!statusArray.length || statusArray.includes('all')) {
      match.status = { $ne: 'deleted' };
    } else if (statusArray.length === 1) {
      match.status = statusArray[0];
    } else {
      match.status = { $in: statusArray };
    }

    const listLimitRaw = Math.max(Number(limit) || 0, 0);
    const listLimit = listLimitRaw > 0 ? Math.min(listLimitRaw, 2000) : 200;

    const pipeline = [];
    if (Object.keys(match).length) {
      pipeline.push({ $match: match });
    }

    pipeline.push({
      $facet: {
        metrics: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              avgRating: { $avg: '$rating' },
              minRating: { $min: '$rating' },
              maxRating: { $max: '$rating' },
              firstReviewAt: { $min: '$createdAt' },
              lastReviewAt: { $max: '$createdAt' },
              publicCount: { $sum: { $cond: [{ $eq: ['$status', 'public'] }, 1, 0] } },
              hiddenCount: { $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] } },
              deletedCount: { $sum: { $cond: [{ $eq: ['$status', 'deleted'] }, 1, 0] } },
              rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
              rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
              rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
              rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
              rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
            }
          }
        ],
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ],
        byRating: [
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 }
            }
          }
        ],
        topTargets: [
          {
            $group: {
              _id: {
                targetType: '$targetType',
                targetId: '$targetId',
                targetKey: '$targetKey',
                targetName: '$targetName'
              },
              count: { $sum: 1 },
              avgRating: { $avg: '$rating' }
            }
          },
          { $sort: { count: -1, avgRating: -1 } },
          { $limit: 5 }
        ]
      }
    });

    const [facetResult] = await Review.aggregate(pipeline);
    const { metrics = [], byStatus = [], byRating = [], topTargets = [] } = facetResult || {};
    const metric = metrics[0] || {};
    const totalMatched = metric.total || 0;

    const ratingDistribution = {
      1: metric.rating1 || 0,
      2: metric.rating2 || 0,
      3: metric.rating3 || 0,
      4: metric.rating4 || 0,
      5: metric.rating5 || 0
    };

    byRating.forEach((entry) => {
      const key = Number(entry?._id);
      if (Number.isFinite(key) && key >= 1 && key <= 5) {
        ratingDistribution[key] = entry.count;
      }
    });

    const statusBreakdown = {
      public: metric.publicCount || 0,
      hidden: metric.hiddenCount || 0,
      deleted: metric.deletedCount || 0
    };

    byStatus.forEach((entry) => {
      const key = String(entry?._id || '').trim();
      if (!key) return;
      statusBreakdown[key] = entry.count;
    });

    const topTargetsFormatted = (topTargets || []).map((entry) => {
      const id = entry?._id || {};
      return {
        targetType: id.targetType || null,
        targetId: id.targetId ? id.targetId.toString() : null,
        targetKey: id.targetKey || null,
        targetName: id.targetName || null,
        count: entry?.count || 0,
        averageRating: entry?.avgRating != null ? Number(entry.avgRating.toFixed(2)) : null
      };
    });

    const docs = await Review.find(match)
      .sort({ createdAt: -1 })
      .limit(listLimit)
      .lean();

    const data = (docs || []).map((doc) => ({
      id: doc?._id?.toString?.() || doc?._id,
      reviewNo: doc?.reviewNo ?? null,
      targetType: doc?.targetType || null,
      targetId: doc?.targetId ? doc.targetId.toString() : null,
      targetKey: doc?.targetKey || null,
      targetName: doc?.targetName || null,
      rating: doc?.rating ?? null,
      status: doc?.status || null,
      userId: doc?.user ? doc.user.toString() : null,
      userName: doc?.userName || null,
      title: doc?.title || '',
      comment: doc?.comment || '',
      replyCount: doc?.replyCount || 0,
      isPinned: Boolean(doc?.isPinned),
      createdAt: doc?.createdAt || null,
      updatedAt: doc?.updatedAt || null
    }));

    res.json({
      generatedAt: new Date().toISOString(),
      range: {
        from: startDate ? startDate.toISOString() : null,
        to: endDate ? endDate.toISOString() : null
      },
      filters: {
        status: statusArray.length ? statusArray : ['all'],
        targetType: targetType || null,
        limit: listLimit
      },
      totalMatched,
      averageRating: metric.avgRating != null ? Number(metric.avgRating.toFixed(2)) : null,
      minRating: metric.minRating ?? null,
      maxRating: metric.maxRating ?? null,
      firstReviewAt: metric.firstReviewAt || null,
      lastReviewAt: metric.lastReviewAt || null,
      statusBreakdown,
      ratingDistribution,
      topTargets: topTargetsFormatted,
      data,
      dataCount: data.length
    });
  } catch (err) {
    console.error('getReviewReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- GET ONE ----------
const getReviewById = async (req, res) => {
  try {
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const isAdmin = req.user?.role === 'admin';
    const canModerate = hasModerationRights(req);
    const isOwner = doc.user?.toString() === req.user?._id?.toString();
    if (!isAdmin && !canModerate && !isOwner && doc.status !== 'public') {
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

    if (!canEditOrDelete(doc, req)) return res.status(403).json({ message: 'Forbidden' });

    const allowedForOwner = ['rating', 'title', 'comment', 'targetName'];
    const allowedForAdmin = ['status'];
    const canModerate = hasModerationRights(req);

    const payload = { ...(req.body || {}) };
    const retainImagesRaw = payload.retainImages;
    delete payload.retainImages;

    const next = {};
    for (const [k, v] of Object.entries(payload)) {
      if (allowedForOwner.includes(k) || (canModerate && allowedForAdmin.includes(k))) {
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

  if (next.rating != null) next.rating = Number(next.rating);

    Object.assign(doc, next);

    let retainImages;
    if (retainImagesRaw == null) {
      retainImages = Array.isArray(doc.images) ? doc.images.slice() : [];
    } else if (Array.isArray(retainImagesRaw)) {
      retainImages = retainImagesRaw;
    } else {
      try {
        const parsed = JSON.parse(retainImagesRaw);
        retainImages = Array.isArray(parsed) ? parsed : [];
      } catch {
        retainImages = [];
      }
    }

    const currentImages = Array.isArray(doc.images) ? doc.images.slice() : [];
    retainImages = retainImages
      .map((item) => (item || '').toString())
      .filter((item) => currentImages.includes(item));

    const newImages = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        newImages.push(`/uploads/reviews/${file.filename}`);
      });
    }

    const imagesToRemove = currentImages.filter((img) => !retainImages.includes(img));
    imagesToRemove.forEach((img) => {
      const relativePath = img.startsWith('/') ? img.slice(1) : img;
      const fullPath = path.join(process.cwd(), relativePath);
      fs.unlink(fullPath, (error) => {
        if (error && error.code !== 'ENOENT') {
          console.warn('Failed to remove old review image:', fullPath, error.message);
        }
      });
    });

    doc.images = [...retainImages, ...newImages];

    await doc.save();
    
    // Update product rating if this is a product review
    if (doc.targetType === 'Product' && doc.targetKey) {
      await updateProductRating(doc.targetKey);
    }
    
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

  if (!canEditOrDelete(doc, req)) return res.status(403).json({ message: 'Forbidden' });

    const previousStatus = doc.status === 'deleted' ? doc.statusBeforeDeletion || 'public' : doc.status;
    const actorName = buildActorName(req, 'System');

    doc.statusBeforeDeletion = previousStatus || 'public';
    doc.status = 'deleted';
    doc.deletedAt = new Date();
    doc.deletedBy = req.user?._id;
    doc.deletedByName = actorName;
  doc.deletedByRole = (req.user?.role || '').toLowerCase();
    doc.isPinned = false;
    doc.pinnedAt = null;
    doc.pinnedBy = undefined;
    await doc.save();
    
    // Update product rating if this is a product review
    if (doc.targetType === 'Product' && doc.targetKey) {
      await updateProductRating(doc.targetKey);
    }

  const isOwner = doc.user?.toString() === req.user?._id?.toString();
    if (!isOwner) {
      notifyUser(doc.user, {
        title: 'Your review was removed',
        message: `${actorName || 'An admin'} moved your review on ${doc.targetName || 'a product'} to the recycle bin.`,
        type: 'review-deleted',
        relatedReview: doc._id,
        metadata: {
          targetName: doc.targetName,
          reviewNo: doc.reviewNo
        },
        createdBy: req.user?._id
      });
    }
    
    res.json({ message: 'Deleted', id: doc._id });
  } catch (err) {
    console.error('deleteReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const listDeletedReviews = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ message: 'Unauthorized' });
    const isAdmin = req.user?.role === 'admin';
    const canModerate = hasModerationRights(req);

    const { page = 1, limit = 10, q } = req.query;
    const filter = { status: 'deleted' };
    if (!isAdmin && !canModerate) filter.user = req.user._id;

    const queryText = vstr(q);
    if (queryText) {
      const re = new RegExp(escapeRegex(queryText), 'i');
      filter.$or = [
        { targetName: re },
        { userName: re },
        { title: re },
        { comment: re }
      ];
      if (/^[0-9a-fA-F]{24}$/.test(queryText.trim())) {
        filter.$or.push({ _id: queryText.trim() });
      }
      const numericQuery = Number(queryText);
      if (!Number.isNaN(numericQuery)) filter.$or.push({ reviewNo: numericQuery });
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const parsedPage = Math.max(Number(page) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [items, total] = await Promise.all([
      Review.find(filter).sort({ deletedAt: -1, createdAt: -1 }).skip(skip).limit(parsedLimit),
      Review.countDocuments(filter)
    ]);

    res.json({
      data: items,
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages: Math.ceil(total / parsedLimit)
    });
  } catch (err) {
    console.error('listDeletedReviews error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const restoreReview = async (req, res) => {
  try {
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'deleted') return res.status(400).json({ message: 'Review is not deleted' });

    if (!canEditOrDelete(doc, req)) return res.status(403).json({ message: 'Forbidden' });

    const isOwner = doc.user?.toString() === req.user?._id?.toString();
    const previousStatus = doc.statusBeforeDeletion || 'public';
    doc.status = previousStatus;
    doc.deletedAt = null;
    doc.deletedBy = undefined;
    doc.deletedByName = undefined;
    doc.deletedByRole = undefined;
    doc.statusBeforeDeletion = previousStatus;

    await doc.save();

    if (doc.targetType === 'Product' && doc.targetKey) {
      await updateProductRating(doc.targetKey);
    }

    if (!isOwner) {
      notifyUser(doc.user, {
        title: 'Your review was restored',
        message: `${buildActorName(req, 'An admin')} restored your review on ${doc.targetName || 'a product'}.`,
        type: 'review-restored',
        relatedReview: doc._id,
        metadata: {
          targetName: doc.targetName,
          rating: doc.rating
        },
        createdBy: req.user?._id
      });
    }

    res.json(doc);
  } catch (err) {
    console.error('restoreReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const purgeReview = async (req, res) => {
  try {
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'deleted') return res.status(400).json({ message: 'Review must be in recycle bin' });

    if (!canEditOrDelete(doc, req)) return res.status(403).json({ message: 'Forbidden' });

    const isOwner = doc.user?.toString() === req.user?._id?.toString();
    removeFiles(doc.images || []);
    const replyImages = (doc.replies || []).flatMap((r) => r.images || []);
    removeFiles(replyImages);

    await doc.deleteOne();

    if (doc.targetType === 'Product' && doc.targetKey) {
      await updateProductRating(doc.targetKey);
    }

    if (!isOwner) {
      notifyUser(doc.user, {
        title: 'Your review was permanently removed',
        message: `${buildActorName(req, 'An admin')} permanently removed your review on ${doc.targetName || 'a product'}.`,
        type: 'review-deleted',
        relatedReview: req.params.id,
        metadata: {
          targetName: doc.targetName
        },
        createdBy: req.user?._id
      });
    }

    res.json({ message: 'Purged', id: req.params.id });
  } catch (err) {
    console.error('purgeReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- ADMIN or CARE MANAGER: reply ----------
const replyToReview = async (req, res) => {
  try {
    // Allow admin, customer care manager, or users with cc_respond_feedback privilege
    const isAdmin = req.user?.role === 'admin';
    const isCareManager = String(req.user?.role || '').toLowerCase() === 'customer care manager' || String(req.user?.role || '').toLowerCase().includes('care');
    const hasCarePerm = Array.isArray(req.userPerms) && req.userPerms.map(p => String(p).toLowerCase()).includes('cc_respond_feedback');
    if (!isAdmin && !isCareManager && !hasCarePerm) {
      return res.status(403).json({ message: 'Admin or Customer Care Manager only' });
    }

    const message = vstr(req.body?.message);
    if (!message) return res.status(400).json({ message: 'Reply message required' });

    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    // Handle uploaded images for admin/care reply
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(`/uploads/reviews/${file.filename}`);
      });
    }

    const adminName = req.user.name || 'Admin';
    const actorName = buildActorName(req, adminName);
    
    doc.replies.push({ 
      admin: req.user._id, 
      adminName,
      message,
      images
    });
    doc.replyCount = doc.replies.length;
    await doc.save();

    const isOwner = doc.user?.toString() === req.user?._id?.toString();
    if (!isOwner) {
      const latestReply = doc.replies[doc.replies.length - 1];
      notifyUser(doc.user, {
        title: 'You have a new reply',
        message: `${actorName} replied to your review on ${doc.targetName || 'a product'}.`,
        type: 'review-replied',
        relatedReview: doc._id,
        metadata: {
          targetName: doc.targetName,
          reviewNo: doc.reviewNo,
          replyId: latestReply?._id,
          replyMessagePreview: message.slice(0, 140)
        },
        createdBy: req.user?._id
      });
    }

    res.json(doc);
  } catch (err) {
    console.error('replyToReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateReply = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const message = vstr(req.body?.message);
    if (!message) return res.status(400).json({ message: 'Reply message required' });

    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const reply = doc.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });

    if (reply.admin?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ message: 'You can only edit your own replies' });
    }

    let retainImages;
    if (req.body?.retainImages == null) {
      retainImages = reply.images || [];
    } else if (Array.isArray(req.body.retainImages)) {
      retainImages = req.body.retainImages;
    } else {
      try {
        retainImages = JSON.parse(req.body.retainImages);
      } catch {
        retainImages = [];
      }
    }

    if (!Array.isArray(retainImages)) retainImages = [];
    retainImages = retainImages
      .filter(Boolean)
      .map((item) => item.toString())
      .filter((item) => (reply.images || []).includes(item));

    const newImages = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        newImages.push(`/uploads/reviews/${file.filename}`);
      });
    }

    if (retainImages.length + newImages.length > 3) {
      return res.status(400).json({ message: 'You can attach up to 3 images per reply' });
    }

    const previousImages = reply.images || [];
    const imagesToRemove = previousImages.filter((img) => !retainImages.includes(img));
    imagesToRemove.forEach((img) => {
      const relativePath = img.startsWith('/') ? img.slice(1) : img;
      const fullPath = path.join(process.cwd(), relativePath);
      fs.unlink(fullPath, (error) => {
        if (error && error.code !== 'ENOENT') {
          console.warn('Failed to remove old reply image:', fullPath, error.message);
        }
      });
    });

    reply.message = message;
    reply.images = [...retainImages, ...newImages];
    reply.adminName = req.user.name || reply.adminName || 'Admin';
    reply.editedAt = new Date();

    doc.markModified('replies');
    await doc.save();

    res.json({ review: doc, reply });
  } catch (err) {
    console.error('updateReply error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- ADMIN or CARE MANAGER: visibility ----------
const setVisibility = async (req, res) => {
  try {
    // Allow admin, customer care manager, or users with moderation rights
    const isAdmin = req.user?.role === 'admin';
    const isCareManager = String(req.user?.role || '').toLowerCase() === 'customer care manager' || String(req.user?.role || '').toLowerCase().includes('care');
    const hasCarePerm = hasModerationRights(req);
    
    if (!isAdmin && !isCareManager && !hasCarePerm) {
      return res.status(403).json({ message: 'Admin or Customer Care Manager only' });
    }

    const action = vstr(req.body?.action); // "hide" | "unhide"
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (action === 'hide') {
      doc.status = 'hidden';
      doc.isPinned = false;
      doc.pinnedAt = null;
      doc.pinnedBy = undefined;
    } else if (action === 'unhide') {
      doc.status = 'public';
    }
    else return res.status(400).json({ message: 'Invalid action' });

    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('setVisibility error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- ADMIN: delete reply ----------
const deleteReply = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const reply = doc.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });

    if (reply.admin?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ message: 'You can only delete your own replies' });
    }

    reply.deleteOne();
    doc.replyCount = doc.replies.length;
    await doc.save();

    res.json({ message: 'Reply removed', id: req.params.replyId });
  } catch (err) {
    console.error('deleteReply error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- ADMIN or CARE MANAGER: pin / unpin ----------
const pinReview = async (req, res) => {
  try {
    // Allow admin, customer care manager, or users with moderation rights
    const isAdmin = req.user?.role === 'admin';
    const isCareManager = String(req.user?.role || '').toLowerCase() === 'customer care manager' || String(req.user?.role || '').toLowerCase().includes('care');
    const hasCarePerm = hasModerationRights(req);
    
    if (!isAdmin && !isCareManager && !hasCarePerm) {
      return res.status(403).json({ message: 'Admin or Customer Care Manager only' });
    }

    const action = vstr(req.body?.action) || 'pin';
    const doc = await Review.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (doc.status === 'deleted') return res.status(400).json({ message: 'Cannot pin deleted review' });

    if (action === 'pin' || action === 'toggle') {
      const shouldPin = action === 'pin' ? true : !doc.isPinned;
      if (shouldPin) {
        doc.isPinned = true;
        doc.pinnedAt = new Date();
        doc.pinnedBy = req.user._id;
      } else {
        doc.isPinned = false;
        doc.pinnedAt = null;
        doc.pinnedBy = undefined;
      }
    } else if (action === 'unpin') {
      doc.isPinned = false;
      doc.pinnedAt = null;
      doc.pinnedBy = undefined;
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error('pinReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createReview,
  getReviews,
  getReviewById,
  updateReview,
  deleteReview,
  listDeletedReviews,
  restoreReview,
  purgeReview,
  replyToReview,
  updateReply,
  setVisibility,
  deleteReply,
  pinReview,
  getProductReviews,
  canUserReviewProduct,
  getReviewReport,
  upload
};
