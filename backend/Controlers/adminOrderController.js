const mongoose = require("mongoose");
const AdminOrder = require("../Model/adminOrderModel");   // ✅ FIXED import
const AdminCancelledOrder = require("../Model/adminCancelledOrderModel");
const Payment = require("../Model/paymentModel");
const Notification = require("../Model/NotificationModel");
const SupplierDiscount = require("../Model/SupplierDiscountModel");

const uniqueObjectIds = (items = []) => {
  const seen = new Set();
  return items.reduce((list, item) => {
    const supplierId = item?.supplierId;
    if (!supplierId) return list;
    const key = String(supplierId);
    if (seen.has(key)) return list;
    seen.add(key);
    list.push(supplierId);
    return list;
  }, []);
};

// safe getter for io (mirror pattern used in paymentController)
function getIo(req) {
  try {
    if (req && req.app && req.app.locals && req.app.locals.io) return req.app.locals.io;
  } catch (e) {}
  try {
    const app = require('../app');
    if (app && app.locals && app.locals.io) return app.locals.io;
  } catch (e) {}
  return null;
}

const emitSupplierOrderNotifications = async (orderDoc) => {
  try {
    const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc;
    const suppliers = uniqueObjectIds(order?.items);
    if (!suppliers.length) return;

    const payloads = suppliers.map((supplierId) => {
      const supplierItems = (order.items || []).filter(
        (item) => String(item?.supplierId) === String(supplierId)
      );
      const itemNames = supplierItems.map((item) => item?.name).filter(Boolean).join(", ");
      return {
        recipient: supplierId,
        title: "New purchase order received",
        message: `Admin placed order ${order._id} containing ${supplierItems.length} item(s). ${itemNames ? `Items: ${itemNames}.` : ""}`.trim(),
        type: "order-supplier",
        metadata: {
          orderId: order._id,
          totalCost: order.totalCost,
          paymentMethod: order.paymentMethod,
        },
      };
    });

    await Notification.insertMany(payloads);
  } catch (err) {
    console.error("Failed to notify suppliers about order", err);
  }
};

const emitAdminNotificationForResponse = async ({ order, supplierId, action }) => {
  try {
    const notificationType =
      action === "accept" ? "payment-supplier-approved" : "payment-supplier-declined";

    const dedupeKey = `supplier-response:${order._id}:${supplierId}:${action}`;
    // Use consistent role names that match user.role in the database
    const roles = ["admin", "finance manager", "finance_manager"];

    console.log(`[NOTIFICATION DEBUG] Creating ${action} notification for order ${order._id} to roles:`, roles);

    for (const role of roles) {
      const exists = await Notification.exists({
        recipientRole: role,
        "metadata.dedupeKey": dedupeKey,
      });
      if (exists) {
        console.log(`[NOTIFICATION DEBUG] Notification already exists for role: ${role}`);
        continue;
      }

      const notification = await Notification.create({
        recipientRole: role,
        title: action === "accept" ? "Supplier accepted payment" : "Supplier declined payment",
        message: `Supplier ${supplierId} ${action === "accept" ? "accepted" : "declined"} payment for order ${order._id}.`,
        type: notificationType,
        metadata: {
          orderId: order._id,
          supplierId,
          action,
          dedupeKey,
        },
      });
      
      console.log(`[NOTIFICATION DEBUG] Created notification for role: ${role}`, {
        id: notification._id,
        type: notificationType,
        title: notification.title
      });
    }
  } catch (err) {
    console.error("Failed to notify admins about supplier response", err);
  }
};

const toObjectIdOrNull = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (value && typeof value === "object" && value._id) {
    return toObjectIdOrNull(value._id);
  }
  const str = typeof value === "string" ? value : value?.toString?.();
  if (str && mongoose.Types.ObjectId.isValid(str)) {
    return new mongoose.Types.ObjectId(str);
  }
  return null;
};

const normalizeAdminOrderForArchive = (orderDoc, statusLabel, actor = null) => {
  const source = orderDoc?.toObject ? orderDoc.toObject() : orderDoc;
  const rawItems = Array.isArray(source?.items) ? source.items : [];

  const supplierKeySet = new Set();
  const supplierObjectIds = [];

  const normalizedItems = rawItems.map((rawItem) => {
    const item = rawItem?.toObject ? rawItem.toObject() : rawItem;
    const supplierObjectId = toObjectIdOrNull(item?.supplierId);
    const supplierKey = supplierObjectId
      ? supplierObjectId.toString()
      : typeof item?.supplierId === "string"
      ? item.supplierId
      : null;

    if (supplierKey && !supplierKeySet.has(supplierKey)) {
      supplierKeySet.add(supplierKey);
      if (supplierObjectId) {
        supplierObjectIds.push(supplierObjectId);
      }
    }

    return {
      productId: toObjectIdOrNull(item?.productId),
      name: item?.name || "Unnamed item",
      quantity: Number(item?.quantity || 0),
      price: Number(item?.price || 0),
      lineSubtotal: Number(item?.lineSubtotal || 0),
      discountPercent: Number(item?.discountPercent || 0),
      discountValue: Number(item?.discountValue || 0),
      lineTotal: Number(item?.lineTotal || 0),
      supplierId: supplierObjectId,
      supplierStatus: item?.supplierStatus || "Pending",
    };
  });

  const supplierSummary =
    supplierKeySet.size === 1
      ? Array.from(supplierKeySet)[0]
      : supplierKeySet.size > 1
      ? `${supplierKeySet.size} suppliers`
      : "N/A";

  const actorId = actor?._id || actor?.id || actor;
  const actorObjectId = toObjectIdOrNull(actorId);
  const actorName = actor?.name || actor?.fullName || actor?.email || null;

  return {
    originalOrderId: source?._id,
    supplierId: supplierSummary,
    supplierIds: supplierObjectIds,
    contact: source?.contact || "N/A",
    paymentMethod: source?.paymentMethod || "Cash Payment",
    items: normalizedItems,
    totalCost: Number.isFinite(Number(source?.totalCost)) ? Number(source.totalCost) : 0,
    status: statusLabel,
    notes: source?.notes || null,
    cancelledAt: new Date(),
    cancelledBy: actorObjectId,
    cancelledByName: actorName,
  };
};

exports.addAdminOrder = async (req, res) => {
  try {
    let { items, totalCost, paymentMethod, contact, notes } = req.body;

    // 🛠 Fix: Parse items if sent as a JSON string (FormData case)
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch (err) {
        console.error("❌ Failed to parse items:", err);
        return res.status(400).json({ message: "Invalid items format" });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    // ✅ Validate supplierId in each item
    for (const item of items) {
      if (!item.supplierId) {
        console.error("❌ Missing supplierId in item:", item);
        return res.status(400).json({ message: "Missing supplierId in some item(s)" });
      }
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      supplierStatus:
        item?.supplierStatus && ["Pending", "Accepted", "Declined"].includes(item.supplierStatus)
          ? item.supplierStatus
          : "Pending",
    }));

    const productIds = normalizedItems
      .map((item) => item?.productId)
      .filter((id) => id);

    let discountLookup = new Map();
    if (productIds.length) {
      const discounts = await SupplierDiscount.find({ productId: { $in: productIds } }).lean();
      discountLookup = discounts.reduce((map, discount) => {
        const key = String(discount.productId);
        const stored = map.get(key) || [];
        stored.push({
          id: discount._id,
          minQuantity: Number(discount.minQuantity || 0),
          percent: Number(
            typeof discount.discountPercent !== "undefined"
              ? discount.discountPercent
              : discount.discountAmount || 0
          ),
        });
        stored.sort((a, b) => {
          const percentDiff = (b.percent || 0) - (a.percent || 0);
          if (percentDiff !== 0) return percentDiff;
          return (b.minQuantity || 0) - (a.minQuantity || 0);
        });
        map.set(key, stored);
        return map;
      }, discountLookup);
    }

    const itemsWithDiscounts = normalizedItems.map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.price || 0);
      const lineSubtotal = Number((unitPrice * quantity).toFixed(2));
      const offers = discountLookup.get(String(item.productId)) || [];
      let appliedOffer = null;
      for (const offer of offers) {
        if (quantity >= offer.minQuantity) {
          appliedOffer = offer;
          break;
        }
      }
      const discountPercent = appliedOffer ? Number(appliedOffer.percent || 0) : 0;
      const discountValue = Number(((lineSubtotal * discountPercent) / 100).toFixed(2));
      const lineTotal = Number(Math.max(0, lineSubtotal - discountValue).toFixed(2));

      return {
        ...item,
        lineSubtotal,
        discountPercent,
        discountValue,
        lineTotal,
        appliedDiscountId: appliedOffer ? appliedOffer.id : null,
      };
    });

    const discountTotal = itemsWithDiscounts.reduce((sum, item) => sum + Number(item.discountValue || 0), 0);
    const netTotal = itemsWithDiscounts.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const normalizedTotal = Number(netTotal.toFixed(2));
    totalCost = normalizedTotal;

    // ✅ Handle slip upload (only for Bank Transfer)
    let slipPath = null;
    if (paymentMethod === "Bank Transfer" && req.file) {
      slipPath = `/uploads/slips/${req.file.filename}`;
    }

    const newOrder = new AdminOrder({
      items: itemsWithDiscounts,
      totalCost: normalizedTotal,
      discountTotal: Number(discountTotal.toFixed(2)),
      paymentMethod,
      contact,
      notes,
      slip: slipPath, // ✅ save slip if exists
      status: "Pending",
    });

    await newOrder.save();
    await emitSupplierOrderNotifications(newOrder);

    
  let mirroredPayment = null;
    if (paymentMethod === "Bank Transfer" && slipPath && req.file) {
      try {
        const primarySupplierId = items[0]?.supplierId;
        if (primarySupplierId) {
          mirroredPayment = await Payment.create({
            paymentName:
              items.length === 1
                ? `Supplier slip • ${items[0].name}`
                : `Supplier slip • ${items.length} items`,
            orderId: newOrder._id,
            userId: primarySupplierId,
            supplierId: primarySupplierId,
            paymentStatus: "pending",
            method: "slip",
            amount: totalCost,
            currency: "lkr",
            description: notes || undefined,
            slipUrl: `${req.protocol}://${req.get("host")}${slipPath}`,
            slipPath: req.file.path,
            slipOriginalName: req.file.originalname,
            slipMimeType: req.file.mimetype,
            slipSize: req.file.size,
            slipUploadedAt: new Date(),
          });
        } else {
          console.warn("Skipping mirrored payment creation: missing supplierId");
        }
      } catch (paymentErr) {
        console.error("Failed to create mirrored supplier payment record:", paymentErr);
      }
    }

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
      payment: mirroredPayment,
    });
  } catch (err) {
    console.error("Add Admin Order Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



// ✅ Get all admin orders (admin view)
exports.getAllAdminOrders = async (_req, res) => {
  try {
    const orders = await AdminOrder.find().populate("items.supplierId", "name email role");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Error fetching admin orders", error: err.message });
  }
};

// ✅ Get single admin order
exports.getAdminOrderById = async (req, res) => {
  try {
    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error("Get Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update an admin order
exports.updateAdminOrder = async (req, res) => {
  try {
    const updatedOrder = await AdminOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order updated", order: updatedOrder });
  } catch (err) {
    console.error("Update Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete an admin order
exports.deleteAdminOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

  const archivePayload = normalizeAdminOrderForArchive(order, "Deleted", req.user || null);
    const cancelledOrder = await AdminCancelledOrder.create(archivePayload);
    await order.deleteOne();

    res.json({ message: "Order deleted successfully", cancelledOrder });
  } catch (err) {
    console.error("Delete Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Cancel an admin order
exports.cancelAdminOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

  const archivePayload = normalizeAdminOrderForArchive(order, "Cancelled", req.user || null);
    const cancelledOrder = await AdminCancelledOrder.create(archivePayload);
    await order.deleteOne();

    res.json({ message: "Order cancelled successfully", cancelledOrder });
  } catch (err) {
    console.error("Cancel Admin Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Supplier-specific orders
// ✅ Supplier-specific orders
exports.getOrdersForSupplier = async (req, res) => {
  try {
    const supplierId = req.user._id; // logged-in supplier
    const orders = await AdminOrder.find({ "items.supplierId": supplierId });

    // Only return this supplier's items + their subtotal
    const filtered = orders.map((order) => {
      const supplierItems = order.items.filter(
        (item) => item.supplierId.toString() === supplierId.toString()
      );

      // calculate subtotal for this supplier
      const supplierTotal = supplierItems.reduce((sum, item) => {
        const lineNet = Number(item?.lineTotal);
        if (Number.isFinite(lineNet) && lineNet >= 0) {
          return sum + lineNet;
        }
        return sum + (Number(item?.price || 0) * Number(item?.quantity || 0));
      }, 0);

      return {
        ...order.toObject(),
        items: supplierItems,
        totalCost: supplierTotal, // ✅ replace with supplier’s own total
      };
    });

    res.json(filtered);
  } catch (err) {
    console.error("Get Supplier Orders Error:", err);
    res.status(500).json({ message: "Error fetching supplier orders", error: err.message });
  }
};


exports.confirmOrder = async (req, res) => {
  try {
    const order = await AdminOrder.findByIdAndUpdate(
      req.params.id,
      { status: "Confirmed" },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    try {
      const io = getIo(req);
      if (io) {
        // Admin orders use a separate channel so customer sales charts are not polluted
        io.emit('sales:admin:confirmed', {
          orderId: String(order._id),
          amount: order.totalCost,
          currency: order.currency || 'lkr',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Failed to emit socket event on admin confirmOrder', e);
    }
    res.json({ message: "Order confirmed", order });
  } catch (err) {
    console.error("Confirm Order Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.respondToSupplierOrder = async (req, res) => {
  try {
    const supplierId = req.user?._id;
    if (!supplierId) return res.status(401).json({ message: "Unauthorized" });

    const role = String(req.user?.role || "").trim().toLowerCase();
    if (role !== "supplier") {
      return res.status(403).json({ message: "Only suppliers can perform this action" });
    }

    const actionValue = String(req.body?.action || "").trim().toLowerCase();
    if (!["accept", "decline"].includes(actionValue)) {
      return res.status(400).json({ message: "Action must be 'accept' or 'decline'" });
    }

    const order = await AdminOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const ownsItems = order.items.some(
      (item) => String(item?.supplierId) === String(supplierId)
    );
    if (!ownsItems) {
      return res.status(403).json({ message: "You are not assigned to this order" });
    }

    order.items = order.items.map((item) => {
      if (String(item?.supplierId) !== String(supplierId)) return item;
      item.supplierStatus = actionValue === "accept" ? "Accepted" : "Declined";
      return item;
    });

    if (actionValue === "accept") {
      const allAccepted = order.items.every((item) => item.supplierStatus === "Accepted");
      const anyDeclined = order.items.some((item) => item.supplierStatus === "Declined");
      order.status = anyDeclined ? "Declined" : allAccepted ? "Ordered" : "Pending";
    } else {
      order.status = "Declined";
    }

    await order.save();
    
    // Update corresponding payment record status if it exists
    try {
      console.log(`[PAYMENT UPDATE DEBUG] Looking for payments with orderId: ${order._id}, supplierId: ${supplierId}`);
      
      // First, let's see what payments exist for this order
      const existingPayments = await Payment.find({
        orderId: order._id,
        supplierId: supplierId,
        method: "slip"
      });
      
      console.log(`[PAYMENT UPDATE DEBUG] Found ${existingPayments.length} existing payments:`, 
        existingPayments.map(p => ({ id: p._id, status: p.paymentStatus, method: p.method })));
      
      const paymentUpdate = await Payment.updateMany(
        { 
          orderId: order._id,
          supplierId: supplierId,
          method: "slip"
        },
        { 
          paymentStatus: actionValue === "accept" ? "paid" : "failed",
          updatedAt: new Date()
        }
      );
      
      console.log(`[PAYMENT UPDATE] Updated ${paymentUpdate.modifiedCount} payment record(s) for order ${order._id} to status: ${actionValue === "accept" ? "paid" : "failed"}`);
      
      // Verify the update worked
      const updatedPayments = await Payment.find({
        orderId: order._id,
        supplierId: supplierId,
        method: "slip"
      });
      
      console.log(`[PAYMENT UPDATE VERIFY] After update, payments now have status:`, 
        updatedPayments.map(p => ({ id: p._id, status: p.paymentStatus })));
      // If supplier accepted, and we set payment(s) to paid, emit a sales:confirmed event
      try {
        const io = getIo(req);
        if (io && actionValue === 'accept') {
          // emit on admin channel to avoid mixing with customer sales
          io.emit('sales:admin:confirmed', {
            orderId: String(order._id),
            amount: order.totalCost,
            currency: order.currency || 'lkr',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Failed to emit socket event after supplier accept', e);
      }
        
    } catch (paymentErr) {
      console.error("Failed to update payment status:", paymentErr);
    }
    
    await emitAdminNotificationForResponse({ order, supplierId, action: actionValue });

    res.json({
      message: actionValue === "accept" ? "Order accepted" : "Order declined",
      order,
    });
  } catch (err) {
    console.error("Respond Supplier Order Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

