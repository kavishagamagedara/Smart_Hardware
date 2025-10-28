const Order = require('../Model/orderModel');
const Payment = require('../Model/paymentModel');
const mongoose = require('mongoose');

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg',
  'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

const normalize = (value) => String(value || '').trim().toLowerCase();

const shouldIncludeStripe = (filter) => !filter || filter === 'all' || filter === 'online';
const shouldIncludePayLater = (filter) => filter === 'all' || filter === 'pay_later';

function normalizeStripeAmount(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency || '').toLowerCase()) ? value : value / 100;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDayWeekday = new Date(year, month, 1).getDay();
  const weekOfMonth = Math.ceil((d.getDate() + firstDayWeekday) / 7);
  return `${year}-${String(month + 1).padStart(2, '0')}-W${weekOfMonth}`;
}

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function generateLastWeekKeyPairs(n) {
  const out = [];
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    out.unshift({ key: getWeekKey(cursor), referenceDate: new Date(cursor) });
    cursor = new Date(cursor.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return out;
}

function generateLastMonthKeyPairs(n) {
  const out = [];
  let cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    out.unshift({ key: getMonthKey(cursor), referenceDate: new Date(cursor) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }
  return out;
}

function parsePendingItems(payment) {
  if (!payment || !payment.metadata || !payment.metadata.pendingOrder) return [];
  try {
    const pending = typeof payment.metadata.pendingOrder === 'string'
      ? JSON.parse(payment.metadata.pendingOrder)
      : payment.metadata.pendingOrder;
    return Array.isArray(pending?.items) ? pending.items : [];
  } catch (err) {
    return [];
  }
}

function extractOrderItems(payment, linkedOrder) {
  if (linkedOrder && Array.isArray(linkedOrder.items) && linkedOrder.items.length) {
    return linkedOrder.items;
  }
  return parsePendingItems(payment);
}

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  try {
    return String(value);
  } catch (err) {
    return null;
  }
};

function computeSalesMetrics({ payment, linkedOrder, productFilterId }) {
  const hasProductFilter = Boolean(productFilterId);
  const items = extractOrderItems(payment, linkedOrder);

  if (hasProductFilter) {
    const target = normalizeId(productFilterId);
    let amount = 0;
    let units = 0;
    for (const item of items) {
      const pid = normalizeId(item?.productId || item?._id || item?.product?._id);
      if (!pid || pid !== target) continue;
      const price = Number(item?.price ?? item?.unitPrice ?? 0) || 0;
      const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
      amount += price * qty;
      units += qty;
    }
    return { amount, units };
  }

  let amount = 0;
  let units = 0;

  if (linkedOrder) {
    amount = Number(linkedOrder.totalAmount || 0) || 0;
    if (Array.isArray(linkedOrder.items)) {
      units = linkedOrder.items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
    }
  }

  if (amount <= 0 && items.length) {
    amount = items.reduce((sum, item) => {
      const price = Number(item?.price ?? item?.unitPrice ?? 0) || 0;
      const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
      return sum + price * qty;
    }, 0);
  }

  if (units <= 0 && items.length) {
    units = items.reduce((sum, item) => sum + (Number(item?.quantity ?? item?.qty ?? 0) || 0), 0);
  }

  if (amount <= 0) {
    amount = normalizeStripeAmount(payment?.amount ?? payment?.total ?? payment?.price, payment?.currency);
  }

  if (units <= 0 && amount > 0) {
    units = 1;
  }

  return { amount, units };
}

const roundCurrency = (value) => {
  const num = Number(value) || 0;
  return Math.round(num * 100) / 100;
};

function buildPaymentMap(payments) {
  const scoreStatus = (status = '') => {
    const normalized = String(status).toLowerCase();
    if (normalized === 'paid') return 3;
    if (normalized === 'requires_action') return 2;
    if (normalized === 'pending') return 1;
    return 0;
  };

  const map = new Map();
  for (const payment of payments) {
    const key = payment.orderId ? payment.orderId.toString() : null;
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, payment);
      continue;
    }

    const nextScore = scoreStatus(payment.paymentStatus);
    const currentScore = scoreStatus(existing.paymentStatus);
    if (
      nextScore > currentScore ||
      (nextScore === currentScore && new Date(payment.updatedAt || payment.createdAt || 0) > new Date(existing.updatedAt || existing.createdAt || 0))
    ) {
      map.set(key, payment);
    }
  }

  return map;
}

function computeOrderMetrics(order, payment, productFilterId) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const hasProductFilter = Boolean(productFilterId);
  const targetId = hasProductFilter ? normalizeId(productFilterId) : null;

  const sumForItems = (predicate = () => true) => {
    let amount = 0;
    let units = 0;
    for (const item of items) {
      if (!predicate(item)) continue;
      const price = Number(item?.price ?? item?.unitPrice ?? 0) || 0;
      const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
      amount += price * qty;
      units += qty;
    }
    return { amount, units };
  };

  let amount = Number(order?.totalAmount ?? 0) || 0;
  let units = items.reduce((sum, item) => sum + (Number(item?.quantity ?? item?.qty ?? 0) || 0), 0);

  if (hasProductFilter) {
    const { amount: filteredAmount, units: filteredUnits } = sumForItems((item) => {
      const pid = normalizeId(item?.productId || item?._id || item?.product?._id);
      return pid && pid === targetId;
    });
    amount = filteredAmount;
    units = filteredUnits;
  } else {
    if (amount <= 0) {
      const totals = sumForItems();
      amount = totals.amount;
      if (units <= 0) units = totals.units;
    }
  }

  if (amount <= 0) {
    amount = normalizeStripeAmount(payment?.amount ?? payment?.total ?? payment?.price, payment?.currency);
  }

  if (units <= 0 && amount > 0) {
    units = 1;
  }

  return { amount, units };
}

const weeklyReport = async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks, 10) || 10;
    const productIdRaw = req.query.productId;
    const productFilterId = productIdRaw && mongoose.Types.ObjectId.isValid(productIdRaw)
      ? new mongoose.Types.ObjectId(productIdRaw)
      : null;

    const paymentFilter = normalize(req.query.filter);
    const includeStripe = shouldIncludeStripe(paymentFilter);
    const includePayLater = shouldIncludePayLater(paymentFilter);

  const weekPairs = generateLastWeekKeyPairs(weeks);
    if (!weekPairs.length) {
      return res.json({ success: true, weeks: [] });
    }

    const earliestWeekStart = startOfWeekMonday(new Date(weekPairs[0].referenceDate));
    const weekKeySet = new Set(weekPairs.map((pair) => pair.key));

    const orderFilter = {
      status: 'Confirmed',
      $or: [
        { createdAt: { $gte: earliestWeekStart } },
        { updatedAt: { $gte: earliestWeekStart } },
      ],
    };

    const orders = await Order.find(orderFilter).lean();

    if (!orders.length) {
      const empty = weekPairs.map(({ referenceDate }) => ({
        weekStart: startOfWeekMonday(new Date(referenceDate)),
        totalSales: 0,
        unitsSold: 0,
      }));
      return res.json({ success: true, weeks: empty });
    }

    const orderIds = orders.map((order) => order._id.toString());

    let paymentMap = new Map();
    if (includeStripe) {
      const stripeFilter = {
        orderId: { $in: orderIds },
        paymentStatus: 'paid',
        method: 'stripe',
        $or: [{ supplierId: { $exists: false } }, { supplierId: null }],
      };

      const payments = await Payment.find(stripeFilter).sort({ updatedAt: -1 }).lean();
      paymentMap = buildPaymentMap(payments);
    }

    const resultMap = new Map();

    for (const order of orders) {
      const payment = paymentMap.get(order._id.toString());
      const methodFromOrder = normalize(order.paymentMethod || order.paymentInfo?.method);
      let processedStripe = false;

      if (includeStripe && payment) {
        const method = normalize(payment.method);
        const status = normalize(payment.paymentStatus);
        const supplierLinked = Boolean(payment.supplierId);
        if (method === 'stripe' && status === 'paid' && !supplierLinked) {
          const { amount, units } = computeOrderMetrics(order, payment, productFilterId);
          if (amount > 0 && units > 0) {
            const eventDateRaw = payment.updatedAt || payment.createdAt || order.updatedAt || order.createdAt;
            if (eventDateRaw) {
              const eventDate = new Date(eventDateRaw);
              if (!Number.isNaN(eventDate.getTime()) && eventDate >= earliestWeekStart) {
                const bucketKey = getWeekKey(eventDate);
                if (weekKeySet.has(bucketKey)) {
                  const bucket = resultMap.get(bucketKey) || { totalSales: 0, unitsSold: 0 };
                  bucket.totalSales += amount;
                  bucket.unitsSold += units;
                  resultMap.set(bucketKey, bucket);
                  processedStripe = true;
                }
              }
            }
          }
        }
      }

      if (processedStripe) continue;

      if (includePayLater && methodFromOrder === 'pay later') {
        const { amount, units } = computeOrderMetrics(order, null, productFilterId);
        if (amount <= 0 || units <= 0) continue;
        const eventDateRaw = order.updatedAt || order.createdAt;
        if (!eventDateRaw) continue;
        const eventDate = new Date(eventDateRaw);
        if (Number.isNaN(eventDate.getTime()) || eventDate < earliestWeekStart) continue;
        const bucketKey = getWeekKey(eventDate);
        if (!weekKeySet.has(bucketKey)) continue;
        const bucket = resultMap.get(bucketKey) || { totalSales: 0, unitsSold: 0 };
        bucket.totalSales += amount;
        bucket.unitsSold += units;
        resultMap.set(bucketKey, bucket);
      }
    }

    const output = weekPairs.map(({ key, referenceDate }) => {
      const data = resultMap.get(key) || { totalSales: 0, unitsSold: 0 };
      return {
        weekStart: startOfWeekMonday(new Date(referenceDate)),
        totalSales: roundCurrency(data.totalSales),
        unitsSold: Number(data.unitsSold || 0),
      };
    });

    res.json({ success: true, weeks: output });
  } catch (err) {
    console.error('weeklyReport error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const monthlyReport = async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 5;
    const productIdRaw = req.query.productId;
    const productFilterId = productIdRaw && mongoose.Types.ObjectId.isValid(productIdRaw)
      ? new mongoose.Types.ObjectId(productIdRaw)
      : null;

    const paymentFilter = normalize(req.query.filter);
    const includeStripe = shouldIncludeStripe(paymentFilter);
    const includePayLater = shouldIncludePayLater(paymentFilter);

  const monthPairs = generateLastMonthKeyPairs(months);
    if (!monthPairs.length) {
      return res.json({ success: true, months: [] });
    }

    const earliestMonthStart = new Date(monthPairs[0].referenceDate);
    earliestMonthStart.setHours(0, 0, 0, 0);
    const monthKeySet = new Set(monthPairs.map((pair) => pair.key));

    const orderFilter = {
      status: 'Confirmed',
      $or: [
        { createdAt: { $gte: earliestMonthStart } },
        { updatedAt: { $gte: earliestMonthStart } },
      ],
    };

    const orders = await Order.find(orderFilter).lean();

    if (!orders.length) {
      const empty = monthPairs.map(({ referenceDate }) => ({
        monthStart: new Date(referenceDate),
        totalSales: 0,
        unitsSold: 0,
      }));
      return res.json({ success: true, months: empty });
    }

    const orderIds = orders.map((order) => order._id.toString());

    let paymentMap = new Map();
    if (includeStripe) {
      const stripeFilter = {
        orderId: { $in: orderIds },
        paymentStatus: 'paid',
        method: 'stripe',
        $or: [{ supplierId: { $exists: false } }, { supplierId: null }],
      };

      const payments = await Payment.find(stripeFilter).sort({ updatedAt: -1 }).lean();
      paymentMap = buildPaymentMap(payments);
    }

    const resultMap = new Map();

    for (const order of orders) {
      const payment = paymentMap.get(order._id.toString());
      const methodFromOrder = normalize(order.paymentMethod || order.paymentInfo?.method);
      let processedStripe = false;

      if (includeStripe && payment) {
        const method = normalize(payment.method);
        const status = normalize(payment.paymentStatus);
        const supplierLinked = Boolean(payment.supplierId);
        if (method === 'stripe' && status === 'paid' && !supplierLinked) {
          const { amount, units } = computeOrderMetrics(order, payment, productFilterId);
          if (amount > 0 && units > 0) {
            const eventDateRaw = payment.updatedAt || payment.createdAt || order.updatedAt || order.createdAt;
            if (eventDateRaw) {
              const eventDate = new Date(eventDateRaw);
              if (!Number.isNaN(eventDate.getTime()) && eventDate >= earliestMonthStart) {
                const bucketKey = getMonthKey(eventDate);
                if (monthKeySet.has(bucketKey)) {
                  const bucket = resultMap.get(bucketKey) || { totalSales: 0, unitsSold: 0 };
                  bucket.totalSales += amount;
                  bucket.unitsSold += units;
                  resultMap.set(bucketKey, bucket);
                  processedStripe = true;
                }
              }
            }
          }
        }
      }

      if (processedStripe) continue;

      if (includePayLater && methodFromOrder === 'pay later') {
        const { amount, units } = computeOrderMetrics(order, null, productFilterId);
        if (amount <= 0 || units <= 0) continue;
        const eventDateRaw = order.updatedAt || order.createdAt;
        if (!eventDateRaw) continue;
        const eventDate = new Date(eventDateRaw);
        if (Number.isNaN(eventDate.getTime()) || eventDate < earliestMonthStart) continue;
        const bucketKey = getMonthKey(eventDate);
        if (!monthKeySet.has(bucketKey)) continue;
        const bucket = resultMap.get(bucketKey) || { totalSales: 0, unitsSold: 0 };
        bucket.totalSales += amount;
        bucket.unitsSold += units;
        resultMap.set(bucketKey, bucket);
      }
    }

    const output = monthPairs.map(({ key, referenceDate }) => {
      const data = resultMap.get(key) || { totalSales: 0, unitsSold: 0 };
      return {
        monthStart: new Date(referenceDate),
        totalSales: roundCurrency(data.totalSales),
        unitsSold: Number(data.unitsSold || 0),
      };
    });

    res.json({ success: true, months: output });
  } catch (err) {
    console.error('monthlyReport error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reports/realtime
// Returns a quick snapshot of recent customer-paid payments and simple totals
const realtimeReport = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const Payment = require('../Model/paymentModel');
    const Order = require('../Model/orderModel');

    // Only customer payments: exclude supplier payments (where supplierId is present)
    const payments = await Payment.find({
      paymentStatus: 'paid',
      method: 'stripe',
      $and: [
        { $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }] },
        { $or: [{ supplierId: { $exists: false } }, { supplierId: null }] }
      ]
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    // Collect orderIds to fetch items for unitsSold counting
    const orderIds = payments.filter(p => p.orderId).map(p => p.orderId);
    const orders = orderIds.length ? await Order.find({ _id: { $in: orderIds } }).lean() : [];
    const orderMap = new Map(orders.map(o => [String(o._id), o]));

    let totalSales = 0;
    let unitsSold = 0;

    const recent = [];
    for (const p of payments) {
      const entry = {
        id: p._id,
        paymentId: p.paymentId,
        orderId: p.orderId || null,
        amount: p.amount || 0,
        currency: p.currency || 'lkr',
        method: p.method,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };

      const normalizedAmount = normalizeStripeAmount(p.amount, p.currency);

      totalSales += normalizedAmount;

      // count units: prefer linked order items, otherwise try pendingOrder metadata
      let qty = 0;
      if (entry.orderId && orderMap.has(String(entry.orderId))) {
        const ord = orderMap.get(String(entry.orderId));
        const items = Array.isArray(ord.items) ? ord.items : [];
        qty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      } else if (p.metadata && p.metadata.pendingOrder) {
        try {
          const pend = typeof p.metadata.pendingOrder === 'string' ? JSON.parse(p.metadata.pendingOrder) : p.metadata.pendingOrder;
          if (pend && Array.isArray(pend.items)) {
            qty = pend.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      unitsSold += qty;
  entry.units = qty;
  entry.normalizedAmount = normalizedAmount;
  entry.amount = normalizedAmount;
  entry.rawAmount = p.amount || 0;
      recent.push(entry);
    }

    return res.json({ success: true, since: since.toISOString(), days, totalSales, unitsSold, recent });
  } catch (err) {
    console.error('realtimeReport error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  weeklyReport,
  monthlyReport,
  realtimeReport,
};
