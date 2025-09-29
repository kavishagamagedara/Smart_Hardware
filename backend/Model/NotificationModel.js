const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
	{
		recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		recipientRole: { type: String, trim: true, lowercase: true, index: true },
		title: { type: String, required: true, trim: true, maxlength: 200 },
		message: { type: String, required: true, trim: true, maxlength: 1000 },
		type: { type: String, trim: true, default: 'general', maxlength: 120 },
		status: { type: String, enum: ['unread', 'read'], default: 'unread', index: true },
		metadata: { type: mongoose.Schema.Types.Mixed },
		relatedReview: { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		readAt: { type: Date }
	},
	{ timestamps: true }
);

NotificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ recipientRole: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
