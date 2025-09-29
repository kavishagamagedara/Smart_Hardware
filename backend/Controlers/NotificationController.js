const mongoose = require('mongoose');
const Notification = require('../Model/NotificationModel');

const accessibleConditions = (user) => {
	const conditions = [];
	if (!user) return conditions;
	const userId = user._id;
	if (userId) conditions.push({ recipient: userId });
	const role = (user.role || '').toLowerCase();
	if (role) {
		conditions.push({ recipient: null, recipientRole: role });
	}
	conditions.push({ recipient: null, recipientRole: 'all' });
	return conditions;
};

const listNotifications = async (req, res) => {
	try {
		if (!req.user?._id) return res.status(401).json({ message: 'Unauthorized' });

		const { limit = 50, status } = req.query;
		const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

		const orConditions = accessibleConditions(req.user);
		if (!orConditions.length) return res.json({ data: [] });

		const filter = { $or: orConditions };
		if (status === 'read' || status === 'unread') {
			filter.status = status;
		}

		const items = await Notification.find(filter)
			.sort({ createdAt: -1 })
			.limit(parsedLimit)
			.lean();

		res.json({ data: items });
	} catch (err) {
		console.error('listNotifications error:', err);
		res.status(500).json({ message: 'Server error' });
	}
};

const markNotificationRead = async (req, res) => {
	try {
		if (!req.user?._id) return res.status(401).json({ message: 'Unauthorized' });
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid notification id' });

		const filter = { _id: id, $or: accessibleConditions(req.user) };
		const update = { status: 'read', readAt: new Date() };
		const doc = await Notification.findOneAndUpdate(filter, update, { new: true });
		if (!doc) return res.status(404).json({ message: 'Notification not found' });
		res.json(doc);
	} catch (err) {
		console.error('markNotificationRead error:', err);
		res.status(500).json({ message: 'Server error' });
	}
};

const markAllNotificationsRead = async (req, res) => {
	try {
		if (!req.user?._id) return res.status(401).json({ message: 'Unauthorized' });
		const filter = { status: 'unread', $or: accessibleConditions(req.user) };
		if (!filter.$or.length) return res.json({ updated: 0 });

		const { modifiedCount } = await Notification.updateMany(filter, { status: 'read', readAt: new Date() });
		res.json({ updated: modifiedCount || 0 });
	} catch (err) {
		console.error('markAllNotificationsRead error:', err);
		res.status(500).json({ message: 'Server error' });
	}
};

const removeNotification = async (req, res) => {
	try {
		if (!req.user?._id) return res.status(401).json({ message: 'Unauthorized' });
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid notification id' });

		const filter = { _id: id, $or: accessibleConditions(req.user) };
		const deleted = await Notification.findOneAndDelete(filter);
		if (!deleted) return res.status(404).json({ message: 'Notification not found' });
		res.json({ message: 'Notification removed', id });
	} catch (err) {
		console.error('removeNotification error:', err);
		res.status(500).json({ message: 'Server error' });
	}
};

module.exports = {
	listNotifications,
	markNotificationRead,
	markAllNotificationsRead,
	removeNotification
};
