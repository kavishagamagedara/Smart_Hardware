const mongoose = require('mongoose');

const AdminReplySchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    images: [{ type: String }], // Admin can also add images in replies
    editedAt: { type: Date }
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: true } }
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
    images:  [{ type: String }], // Array of image URLs

    // moderation
  status: { type: String, enum: ['public', 'hidden', 'deleted'], default: 'public', index: true },
  statusBeforeDeletion: { type: String, enum: ['public', 'hidden'], default: 'public' },
  deletedAt: { type: Date, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  deletedByName: { type: String, trim: true, maxlength: 120 },
  deletedByRole: { type: String, trim: true, maxlength: 60 },
  isPinned: { type: Boolean, default: false, index: true },
  pinnedAt: { type: Date, index: true },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // admin replies
    replies:    [AdminReplySchema],
    replyCount: { type: Number, default: 0 },

    // number sequence
    reviewNo: { type: Number, index: true }
  },
  { timestamps: true }
);

ReviewSchema.index({ isPinned: -1, pinnedAt: -1, createdAt: -1 });

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
