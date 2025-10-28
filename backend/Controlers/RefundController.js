const mongoose = require("mongoose");
const RefundRequest = require("../Model/RefundModel");
const Order = require("../Model/orderModel");
const Notification = require("../Model/NotificationModel");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const normalize = (value = "") => String(value || "").trim();

const hasPermission = (req, permissions = []) => {
	if (!req?.user) return false;
	if (String(req.user.role || "").toLowerCase() === "admin") return true;
	const permSet = new Set((req.userPerms || []).map((perm) => String(perm || "").toLowerCase()));
	return permissions.some((perm) => permSet.has(String(perm || "").toLowerCase()));
};

const staffRoles = ["admin", "customer care manager", "customer care", "support"];

const buildMetadata = (refund) => ({
	refundId: refund?._id,
	orderId: refund?.order,
	productId: refund?.item?.productId,
	productName: refund?.item?.productName,
	status: refund?.status,
});

async function notifyStaff({ title, message, type = "refund-update", metadata, createdBy }) {
	try {
		const docs = staffRoles.map((role) => ({
			recipient: null,
			recipientRole: role,
			title,
			message,
			type,
			metadata,
			createdBy: createdBy || null,
		}));

		await Notification.insertMany(docs, { ordered: false });
	} catch (err) {
		console.warn("notifyStaff error:", err?.message || err);
	}
}

async function notifyUser(userId, { title, message, type = "refund-update", metadata, createdBy }) {
	if (!userId) return;
	try {
		await Notification.create({
			recipient: userId,
			recipientRole: "user",
			title,
			message,
			type,
			metadata,
			createdBy: createdBy || null,
		});
	} catch (err) {
		console.warn("notifyUser error:", err?.message || err);
	}
}

const populateRefund = (query) =>
	query
		.populate("user", "name email role")
		.populate("order", "status totalAmount createdAt")
		.populate("messages.author", "name role email")
		.populate("history.actor", "name role email");

const sanitizeRefund = (doc) => {
	if (!doc) return null;
	const json = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
	return json;
};

const ensurePermission = (req, res, perms) => {
	if (hasPermission(req, perms)) return true;
	res.status(403).json({ message: "Forbidden" });
	return false;
};

const createRefundRequest = async (req, res) => {
	try {
		const userId = req.user?._id;
		if (!userId) return res.status(401).json({ message: "Unauthorized" });

		const orderId = normalize(req.body.orderId);
		const productId = normalize(req.body.productId);
		const reason = normalize(req.body.reason);
		const message = normalize(req.body.message);

		if (!isValidObjectId(orderId) || !isValidObjectId(productId)) {
			return res.status(400).json({ message: "Invalid order or product reference" });
		}
		if (!reason) {
			return res.status(400).json({ message: "Refund reason is required" });
		}

		const order = await Order.findOne({ _id: orderId, userId }).lean();
		if (!order) {
			return res.status(404).json({ message: "Order not found" });
		}

		const item = (order.items || []).find(
			(entry) => entry?.productId?.toString() === productId
		);
		if (!item) {
			return res.status(404).json({ message: "Order item not found" });
		}

		const activeRefund = await RefundRequest.findOne({
			user: userId,
			order: orderId,
			"item.productId": productId,
			status: { $in: ["pending", "processing"] },
		}).lean();

		if (activeRefund) {
			return res.status(409).json({
				message: "A refund request for this item is already being processed",
			});
		}

		const messages = [];
		if (message) {
			messages.push({ authorType: "user", author: userId, message });
		}

		const history = [
			{
				status: "pending",
				note: `Refund requested: ${reason}`,
				actor: userId,
			},
		];

		const payload = {
			user: userId,
			order: orderId,
			item: {
				productId: item.productId,
				productName: item.productName,
				quantity: item.quantity,
				price: item.price,
			},
			reason,
			message,
			messages,
			history,
			metadata: {
				orderStatus: order.status,
				totalAmount: order.totalAmount,
			},
		};

		const doc = await new RefundRequest(payload).save();

		let refund;
		try {
			refund = sanitizeRefund(
				await populateRefund(RefundRequest.findById(doc._id)).exec()
			);
		} catch (populateErr) {
			console.warn("populate refund error:", populateErr?.message || populateErr);
			refund = sanitizeRefund(doc);
		}

		await notifyStaff({
			title: "New refund request",
			message: `${req.user?.name || "Customer"} requested a refund for ${item.productName}`,
			type: "refund-request",
			metadata: buildMetadata(refund),
			createdBy: userId,
		});

		return res.status(201).json(refund);
	} catch (err) {
		console.error("createRefundRequest error:", err);
		res.status(500).json({ message: "Failed to create refund request" });
	}
};

const listMyRefunds = async (req, res) => {
	try {
		const userId = req.user?._id;
		if (!userId) return res.status(401).json({ message: "Unauthorized" });

		const refunds = await populateRefund(
			RefundRequest.find({ user: userId }).sort({ createdAt: -1 })
		).lean();

		res.json({ data: refunds });
	} catch (err) {
		console.error("listMyRefunds error:", err);
		res.status(500).json({ message: "Failed to load refund requests" });
	}
};

const listRefunds = async (req, res) => {
	if (!ensurePermission(req, res, ["refund_view_requests", "refund_manage_requests", "cc_manage_returns", "moderate_feedback"])) {
		return;
	}

	try {
		const { status, search } = req.query;
		const filter = {};
		if (status && typeof status === "string") {
			const normalizedStatus = status.trim().toLowerCase();
			if (["pending", "processing", "accepted", "declined"].includes(normalizedStatus)) {
				filter.status = normalizedStatus;
			}
		}

		if (search && typeof search === "string") {
			const term = search.trim();
			if (term) {
				filter.$or = [
					{ reason: { $regex: term, $options: "i" } },
					{ "item.productName": { $regex: term, $options: "i" } },
					{ message: { $regex: term, $options: "i" } },
				];
			}
		}

		const refunds = await populateRefund(
			RefundRequest.find(filter).sort({ createdAt: -1 })
		).lean();

		res.json({ data: refunds });
	} catch (err) {
		console.error("listRefunds error:", err);
		res.status(500).json({ message: "Failed to load refund requests" });
	}
};

const getRefundById = async (req, res) => {
	try {
		const { id } = req.params;
		if (!isValidObjectId(id)) {
			return res.status(400).json({ message: "Invalid refund id" });
		}

		const refund = await populateRefund(RefundRequest.findById(id)).lean();
		if (!refund) return res.status(404).json({ message: "Refund request not found" });

		const isOwner = refund.user?._id?.toString() === req.user?._id?.toString();
		if (!isOwner && !hasPermission(req, ["refund_view_requests", "refund_manage_requests", "cc_manage_returns", "moderate_feedback"])) {
			return res.status(403).json({ message: "Forbidden" });
		}

		res.json(refund);
	} catch (err) {
		console.error("getRefundById error:", err);
		res.status(500).json({ message: "Failed to load refund request" });
	}
};

const replyToRefund = async (req, res) => {
	try {
		const { id } = req.params;
		if (!isValidObjectId(id)) {
			return res.status(400).json({ message: "Invalid refund id" });
		}

		const { message, status, note } = req.body || {};
		const trimmedMessage = normalize(message);
		const trimmedNote = normalize(note);

		const refundDoc = await RefundRequest.findById(id);
		if (!refundDoc) return res.status(404).json({ message: "Refund request not found" });

		const isOwner = refundDoc.user?.toString() === req.user?._id?.toString();
		const canManage = hasPermission(req, ["refund_manage_requests", "cc_manage_returns", "moderate_feedback"]);

		if (!isOwner && !canManage) {
			return res.status(403).json({ message: "Forbidden" });
		}

		let statusChanged = false;
		let statusValue = null;

		if (status) {
			const normalizedStatus = String(status).trim().toLowerCase();
			const allowed = ["pending", "processing", "accepted", "declined"];
			if (!allowed.includes(normalizedStatus)) {
				return res.status(400).json({ message: "Invalid status value" });
			}
			if (!canManage) {
				return res.status(403).json({ message: "Only staff can change refund status" });
			}
			refundDoc.status = normalizedStatus;
			statusValue = normalizedStatus;
			statusChanged = true;

			refundDoc.history.push({
				status: normalizedStatus,
				note: trimmedNote || trimmedMessage || "Status updated",
				actor: req.user._id,
			});

			if (["accepted", "declined"].includes(normalizedStatus)) {
				refundDoc.decision = {
					decidedBy: req.user._id,
					decidedAt: new Date(),
					note: trimmedNote || trimmedMessage || "",
				};
			} else if (normalizedStatus === "pending") {
				refundDoc.decision = undefined;
			}
		}

		if (trimmedMessage) {
			refundDoc.messages.push({
				authorType: isOwner ? "user" : "staff",
				author: req.user._id,
				message: trimmedMessage,
			});

			if (isOwner) {
				await notifyStaff({
					title: "Customer replied to refund request",
					message: trimmedMessage,
					type: "refund-update",
					metadata: buildMetadata(refundDoc),
					createdBy: req.user._id,
				});
			}
		}

		await refundDoc.save();
		const refund = sanitizeRefund(
			await populateRefund(RefundRequest.findById(refundDoc._id)).exec()
		);

		if (!isOwner) {
			if (trimmedMessage) {
				await notifyUser(refund.user?._id, {
					title: "Refund request update",
					message: trimmedMessage,
					type: "refund-reply",
					metadata: buildMetadata(refund),
					createdBy: req.user._id,
				});
			}

			if (statusChanged) {
				await notifyUser(refund.user?._id, {
					title: statusValue === "accepted" ? "Refund approved" : statusValue === "declined" ? "Refund declined" : "Refund status updated",
					message:
						statusValue === "accepted"
							? "Your refund request has been accepted."
							: statusValue === "declined"
							? "Your refund request has been declined."
							: "Your refund request status has been updated.",
					type: "refund-status",
					metadata: buildMetadata(refund),
					createdBy: req.user._id,
				});
			}
		}

		res.json(refund);
	} catch (err) {
		console.error("replyToRefund error:", err);
		res.status(500).json({ message: "Failed to update refund request" });
	}
};

module.exports = {
	createRefundRequest,
	listMyRefunds,
	listRefunds,
	getRefundById,
	replyToRefund,
};
