const mongoose = require('mongoose');

const AdminReplySchema = new mongoose.Schema(
  {
    admin:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 }
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const ReviewSchema = new mongoose.Schema(
  {
    // target info
    targetType: { type: String, enum: ['Product', 'Hardware', 'Vendor', 'Ticket'], required: true, index: true },
    targetId:   { type: mongoose.Schema.Types.ObjectId, index: true },
    targetKey:  { type: String, trim: true, index: true },
    targetName: { type: String, trim: true, maxlength: 300 },

    // author
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, trim: true, maxlength: 120 },

    // content
    rating:  { type: Number, min: 1, max: 5, required: true },
    title:   { type: String, trim: true, maxlength: 200 },
    comment: { type: String, trim: true, maxlength: 3000 },

    // moderation
    status: { type: String, enum: ['public', 'hidden', 'deleted'], default: 'public', index: true },

    // admin replies
    replies:    [AdminReplySchema],
    replyCount: { type: Number, default: 0 },

    // number sequence
    reviewNo: { type: Number, index: true }
  },
  { timestamps: true }
);

// Unique constraint for key-based targets (ignores 'deleted')
ReviewSchema.index(
  { targetType: 1, targetKey: 1, user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'deleted' }, targetKey: { $exists: true, $ne: null } } }
);

// Unique constraint for id-based targets (ignores 'deleted')
ReviewSchema.index(
  { targetType: 1, targetId: 1, user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'deleted' }, targetId: { $exists: true, $ne: null } } }
);

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
