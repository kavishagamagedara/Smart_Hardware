const mongoose = require('mongoose');
const Notification = require('../Model/NotificationModel');

const accessibleConditions = (user) => {
	const conditions = [];
	if (!user) return conditions;
	const userId = user._id;
	if (userId) conditions.push({ recipient: userId });
	const role = (user.role || '').toLowerCase();
	if (role) {
		// Handle role variations for better matching
		const roleVariations = [role];
		if (role === 'finance manager') {
			roleVariations.push('finance_manager', 'financemanager');
		} else if (role === 'finance_manager') {
			roleVariations.push('finance manager', 'financemanager');
		}
		
		roleVariations.forEach(roleVar => {
			conditions.push({ recipient: null, recipientRole: roleVar });
		});
	}
	conditions.push({ recipient: null, recipientRole: 'all' });
	return conditions;
};

const listNotifications = async (req, res) => {
	try {
		if (!req.user?._id) return res.status(401).json({ message: 'Unauthorized' });

		const { limit = 50, status, type, types, scope } = req.query;
		const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

		console.log(`[NOTIFICATION DEBUG] User requesting notifications:`, {
			userId: req.user._id,
			role: req.user.role,
			scope,
			types
		});

		const orConditions = accessibleConditions(req.user);
		console.log(`[NOTIFICATION DEBUG] Access conditions:`, orConditions);
		
		if (!orConditions.length) return res.json({ data: [] });

		const andConditions = [{ $or: orConditions }];

		if (status === 'read' || status === 'unread') {
			andConditions.push({ status });
		}

		const typeSet = new Set();
		if (typeof type === 'string' && type.trim()) {
			typeSet.add(type.trim().toLowerCase());
		}
		if (typeof types === 'string' && types.trim()) {
			types
				.split(',')
				.map((value) => value.trim().toLowerCase())
				.filter(Boolean)
				.forEach((value) => typeSet.add(value));
		}

		if (typeSet.size === 1) {
			andConditions.push({ type: Array.from(typeSet)[0] });
		} else if (typeSet.size > 1) {
			andConditions.push({ type: { $in: Array.from(typeSet) } });
		}

		const scopeKey = typeof scope === 'string' ? scope.trim().toLowerCase() : '';
			if (scopeKey === 'finance') {
				andConditions.push({ type: { $regex: /^payment/i } });
			} else if (scopeKey === 'feedback') {
				andConditions.push({ type: { $regex: /^(review|refund)/i } });
			} else if (scopeKey === 'care') {
				// Customer care scope: include review and refund activity
				andConditions.push({ type: { $regex: /^(review|refund)/i } });
		}

		const queryFilter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
		
		console.log(`[NOTIFICATION DEBUG] Final query filter:`, JSON.stringify(queryFilter, null, 2));

		const items = await Notification.find(queryFilter)
			.sort({ createdAt: -1 })
			.limit(parsedLimit)
			.lean();

		console.log(`[NOTIFICATION DEBUG] Found ${items.length} notifications`);
		if (items.length > 0) {
			console.log(`[NOTIFICATION DEBUG] Sample notifications:`, items.slice(0, 3).map(n => ({
				id: n._id,
				type: n.type,
				recipientRole: n.recipientRole,
				title: n.title
			})));
		}

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
