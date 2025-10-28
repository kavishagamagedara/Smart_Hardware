import React, { useEffect, useMemo, useState } from "react";
import { io as ioClient } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const API = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "") + "/api";

const normalize = (value) => String(value || "").trim().toLowerCase();

const isStripeCustomerSale = (order) => {
  if (!order) return false;
  const status = normalize(order.status);
  if (status !== "confirmed") return false;
  const info = order.paymentInfo || {};
  const method = normalize(info.method);
  const paymentStatus = normalize(info.paymentStatus);
  const supplierLinked = Boolean(info.supplierId);
  return method === "stripe" && paymentStatus === "paid" && !supplierLinked;
};

const isPayLaterConfirmedSale = (order) => {
  if (!order) return false;
  const status = normalize(order.status);
  if (status !== "confirmed") return false;
  const method = normalize(order.paymentMethod || order.paymentInfo?.method);
  return method === "pay later";
};

const shouldIncludeOrder = (order) => isStripeCustomerSale(order) || isPayLaterConfirmedSale(order);

const getOrderEventDate = (order, isStripeEligible) => {
  if (!order) return null;
  if (isStripeEligible) {
    const info = order.paymentInfo || {};
    return info.updatedAt || info.createdAt || order.updatedAt || order.createdAt || null;
  }
  return order.updatedAt || order.createdAt || null;
};

const getOrderAmount = (order) => {
  if (!order) return 0;
  const info = order.paymentInfo || {};
  return Number(order.totalAmount ?? order.total ?? info.amount ?? 0) || 0;
};

const formatCurrency = (v) => {
  const n = Number(v) || 0;
  try {
    return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(n);
  } catch {
    return `LKR ${n.toFixed(2)}`;
  }
};

// Helpers to compute keys
// Week key groups by year-month-weekOfMonth: e.g. 2025-06-W2
const getWeekKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11
  // first day of month weekday (0-6)
  const firstDayWeekday = new Date(year, month, 1).getDay();
  // week of month: ceil((date + firstDayWeekday) / 7)
  const weekOfMonth = Math.ceil((d.getDate() + firstDayWeekday) / 7);
  return `${year}-${String(month + 1).padStart(2, "0")}-W${weekOfMonth}`;
};

const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const formatWeekLabel = (weekKey) => {
  // weekKey is YYYY-MM-Wn
  try {
    const parts = String(weekKey).split("-W");
    const ym = parts[0];
    const w = parts[1];
    const [year, month] = ym.split("-");
    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `W${w} ${monthName}`; // e.g. "W2 Jun"
  } catch {
    return weekKey;
  }
};

// Generate last `n` week keys in the same format used by getWeekKey
const generateLastWeekKeys = (n) => {
  const out = [];
  // Start from today
  let cur = new Date();
  // Normalize to start of current day
  cur.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    // compute key for cur
    const key = getWeekKey(cur);
    out.push(key);
    // move back 7 days
    cur = new Date(cur.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  // we generated newest->oldest; reverse for oldest->newest
  return out.reverse();
};

// Generate last `n` month keys in YYYY-MM (oldest -> newest)
const generateLastMonthKeys = (n) => {
  const out = [];
  let cur = new Date();
  cur.setDate(1); // go to first day of current month
  cur.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    out.push(key);
    // move back one month
    cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  }
  return out.reverse();
};

const formatDateInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISO = new Date(date.getTime() - tzOffset).toISOString();
  return localISO.split("T")[0];
};

const normalizeIdValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  try {
    return String(value);
  } catch {
    return "";
  }
};

const PIE_COLORS = {
  online: "#4f46e5",
  pay_later: "#f97316",
};

function SimplePieChart({ data = [], size = 180, total = 0 }) {
  const valid = data.filter((item) => Number(item.value) > 0);
  if (!valid.length || !(total > 0)) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: 14,
        }}
      >
        No data
      </div>
    );
  }

  let cumulativePercent = 0;
  const segments = valid.map((item) => {
    const value = Number(item.value) || 0;
    const percent = (value / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...item, percent, startPercent, endPercent: cumulativePercent };
  });

  const gradient = `conic-gradient(${segments
    .map((seg) => `${seg.color} ${seg.startPercent}% ${seg.endPercent}%`)
    .join(", ")})`;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: gradient,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "18%",
          borderRadius: "50%",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: "#1e293b",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 16 }}>{formatCurrency(total)}</span>
        <span style={{ fontSize: 12, color: "#64748b" }}>Total</span>
      </div>
    </div>
  );
}

// Simple SVG bar chart (no external deps)
function SimpleBarChart({ labels = [], values = [], height = 160 }) {
  const max = Math.max(...values, 1);
  const width = Math.max(320, labels.length * 40);
  const barWidth = Math.max(10, Math.floor(width / Math.max(1, labels.length)) - 8);
  // calculate precise required width based on bar positions
  const gap = 12;
  const leftPadding = 24;
  const rightPadding = 48; // extra space to avoid clipping labels
  const requiredWidth = leftPadding + labels.length * (barWidth + gap) + rightPadding;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <svg
        width="100%"
        height={height}
        style={{ display: "block", minWidth: requiredWidth }}
        preserveAspectRatio="xMinYMin meet"
      >
        {/* background grid lines (optional) */}
        {values.map((v, i) => {
          const x = leftPadding + i * (barWidth + gap);
          const barHeight = Math.round(((height - 40) * v) / max);
          const y = height - 24 - barHeight;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill="#4f46e5" rx={4} />
              <text x={x + barWidth / 2} y={y - 6} fontSize={11} fill="#0f172a" textAnchor="middle">
                {v ? v.toFixed(2) : ""}
              </text>
              <text x={x + barWidth / 2} y={height - 6} fontSize={11} fill="#64748b" textAnchor="middle">
                {labels[i] ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SalesAnalytics({ weeks = 8, months = 12 }) {
  const { token, user } = useAuth();
  const [range, setRange] = useState("weekly");
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [selectedProfitProduct, setSelectedProfitProduct] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productRange, setProductRange] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const todayInputValue = useMemo(() => formatDateInputValue(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(() => formatDateInputValue(new Date()));
  const [dateErr, setDateErr] = useState("");
  const filterLabel = useMemo(() => {
    switch (filter) {
      case 'online':
        return 'Online payments';
      case 'pay_later':
        return 'Pay at shop';
      default:
        return 'All payments';
    }
  }, [filter]);

  const supplierCostIndex = useMemo(() => {
    const bySupplierProductId = new Map();
    const byName = new Map();

    for (const sp of supplierProducts) {
      const spId = normalizeIdValue(sp?._id || sp?.id);
      const price = Number(sp?.price || 0) || 0;
      if (spId) bySupplierProductId.set(spId, price);
      const nameKey = String(sp?.name || "").trim().toLowerCase();
      if (nameKey) byName.set(nameKey, price);
    }

    const byProductId = new Map();

    for (const product of products) {
      const productId = normalizeIdValue(product?._id || product?.productId || product?.id);
      if (!productId) continue;

      let supplierPrice = 0;
      const rawSupplierProduct = product?.supplierProductId;
      const supplierProductId = normalizeIdValue(rawSupplierProduct);
      if (supplierProductId && bySupplierProductId.has(supplierProductId)) {
        supplierPrice = bySupplierProductId.get(supplierProductId) || 0;
      } else if (rawSupplierProduct && typeof rawSupplierProduct === 'object' && Number.isFinite(Number(rawSupplierProduct.price))) {
        supplierPrice = Number(rawSupplierProduct.price) || 0;
      } else {
        const nameKey = String(product?.name || "").trim().toLowerCase();
        if (nameKey && byName.has(nameKey)) {
          supplierPrice = byName.get(nameKey) || 0;
        }
      }

      byProductId.set(productId, supplierPrice);
    }

    return { byProductId, byName };
  }, [products, supplierProducts]);

  const paymentBreakdown = useMemo(() => {
    let onlineTotal = 0;
    let payLaterTotal = 0;

    for (const order of orders) {
      const amount = getOrderAmount(order);
      if (!(amount > 0)) continue;
      if (isStripeCustomerSale(order)) {
        onlineTotal += amount;
        continue;
      }
      if (isPayLaterConfirmedSale(order)) {
        payLaterTotal += amount;
      }
    }

    const entries = [
      {
        key: 'online',
        label: 'Online payments',
        value: Number(onlineTotal.toFixed(2)),
        color: PIE_COLORS.online,
      },
      {
        key: 'pay_later',
        label: 'Pay at shop',
        value: Number(payLaterTotal.toFixed(2)),
        color: PIE_COLORS.pay_later,
      },
    ];

    const totalAmount = entries.reduce((sum, entry) => sum + entry.value, 0);
    const entriesWithPercent = entries.map((entry) => {
      const percent = totalAmount > 0 ? (entry.value / totalAmount) * 100 : 0;
      const precision = percent >= 10 ? 1 : 2;
      return {
        ...entry,
        percent: Number(percent.toFixed(precision)),
      };
    });

    return {
      entries: entriesWithPercent,
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }, [orders]);

  const hasPieData = paymentBreakdown.totalAmount > 0;

  const profitSummary = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

    const totals = { daily: 0, weekly: 0, monthly: 0, total: 0 };
    const perProduct = new Map();
    const missingCostNames = new Set();

    const lookupSupplierPrice = (productId, productName) => {
      const { byProductId, byName } = supplierCostIndex || {};
      if (productId && byProductId && byProductId.has(productId)) {
        return { price: Number(byProductId.get(productId) || 0), found: true };
      }
      const nameKey = String(productName || "").trim().toLowerCase();
      if (nameKey && byName && byName.has(nameKey)) {
        return { price: Number(byName.get(nameKey) || 0), found: true };
      }
      return { price: 0, found: false };
    };

    const addToWindow = (bucket, profit, eventDate) => {
      if (!Number.isFinite(profit) || profit === 0) return;
      bucket.total += profit;
      if (eventDate >= startOfMonth) bucket.monthly += profit;
      if (eventDate >= startOfWeek) bucket.weekly += profit;
      if (eventDate >= startOfToday) bucket.daily += profit;
    };

    const ensureProductEntry = (productKey, label) => {
      const safeLabel = label || productKey || `Product ${perProduct.size + 1}`;
      const safeKey = String(productKey || safeLabel).trim() || safeLabel;
      if (!perProduct.has(safeKey)) {
        perProduct.set(safeKey, {
          key: safeKey,
          label: safeLabel,
          totals: { daily: 0, weekly: 0, monthly: 0, total: 0 },
        });
      }
      return perProduct.get(safeKey);
    };

    for (const order of orders) {
      const stripeEligible = isStripeCustomerSale(order);
      const payLaterEligible = isPayLaterConfirmedSale(order);
      if (!stripeEligible && !payLaterEligible) continue;
      if (filter === 'online' && !stripeEligible) continue;
      if (filter === 'pay_later' && !payLaterEligible) continue;

      const eventDateRaw = getOrderEventDate(order, stripeEligible);
      if (!eventDateRaw) continue;
      const eventDate = new Date(eventDateRaw);
      if (Number.isNaN(eventDate.getTime())) continue;

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const quantity = Number(item.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        const sellingPrice = Number(item.price || 0) || 0;
        const productKey = normalizeIdValue(item.productId || item._id || item.product?._id || item.sku || item.id);
        const { price: supplierPrice, found } = lookupSupplierPrice(productKey, item.productName || item.name || item.title);
        if (!found) {
          const missingLabel = String(item.productName || item.name || productKey || 'Unknown product');
          missingCostNames.add(missingLabel);
        }
        const unitProfit = sellingPrice - supplierPrice;
        if (!Number.isFinite(unitProfit)) continue;
        const profit = unitProfit * quantity;
        if (!Number.isFinite(profit) || profit === 0) continue;
        addToWindow(totals, profit, eventDate);
        const label = item.productName || item.name || item.title || productKey || 'Unknown product';
        const entry = ensureProductEntry(productKey, label);
        addToWindow(entry.totals, profit, eventDate);
      }
    }

    const asCurrencyNumber = (value) => Number((Number(value) || 0).toFixed(2));

    const formatTotals = (rawTotals) => ({
      daily: asCurrencyNumber(rawTotals.daily),
      weekly: asCurrencyNumber(rawTotals.weekly),
      monthly: asCurrencyNumber(rawTotals.monthly),
      total: asCurrencyNumber(rawTotals.total),
    });

    const perProductList = Array.from(perProduct.values()).map((entry) => ({
      ...entry,
      totals: formatTotals(entry.totals),
    }));

    perProductList.sort((a, b) => b.totals.total - a.totals.total);

    const perProductMap = new Map(perProductList.map((entry) => [entry.key, entry]));

    return {
      totals: formatTotals(totals),
      perProduct: {
        list: perProductList,
        map: perProductMap,
      },
      windows: {
        startOfToday,
        startOfWeek,
        startOfMonth,
      },
      diagnostics: {
        missingCost: Array.from(missingCostNames),
      },
    };
  }, [orders, filter, supplierCostIndex]);

  const profitProductSelector = useMemo(() => {
    const labelMap = new Map();
    labelMap.set('all', 'All products');

    for (const product of products) {
      const key = normalizeIdValue(product?._id || product?.productId || product?.id);
      if (!key) continue;
      const label = product?.name || product?.productName || product?.title || key;
      labelMap.set(key, label);
    }

    for (const entry of profitSummary.perProduct.list) {
      labelMap.set(entry.key, entry.label);
    }

    const options = [{ value: 'all', label: 'All products' }];
    const rest = Array.from(labelMap.entries())
      .filter(([value]) => value !== 'all')
      .map(([value, label]) => ({ value, label }));
    rest.sort((a, b) => a.label.localeCompare(b.label));
    options.push(...rest);

    return { options, labelMap };
  }, [products, profitSummary.perProduct.list]);

  useEffect(() => {
    if (profitProductSelector.labelMap.has(selectedProfitProduct)) return;
    setSelectedProfitProduct('all');
  }, [selectedProfitProduct, profitProductSelector.labelMap]);

  const profitProductOptions = profitProductSelector.options;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const origin = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(`${API}/orders`, {
          headers: authHeaders,
        });
        if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.orders) ? data.orders : data?.orders ?? [];
        const filtered = items.filter((order) => shouldIncludeOrder(order));
        setOrders(filtered);
        // fetch products (non-API path uses ORIGIN/products in other components)
        try {
          const pRes = await fetch(`${origin}/products`, { headers: authHeaders });
          if (pRes.ok) {
            const pData = await pRes.json().catch(() => null);
            const list = Array.isArray(pData?.products) ? pData.products : Array.isArray(pData) ? pData : [];
            setProducts(list);
            if (!selectedProduct && list.length) {
              setSelectedProduct(list[0]._id || list[0].productId || list[0].id || "");
            }
          }
        } catch {
          // ignore product fetch errors
        }

        try {
          const spRes = await fetch(`${origin}/supplier-products`, { headers: authHeaders });
          if (spRes.ok) {
            const spData = await spRes.json().catch(() => null);
            const list = Array.isArray(spData?.supplierProducts) ? spData.supplierProducts : Array.isArray(spData) ? spData : [];
            setSupplierProducts(list);
          } else if (spRes.status === 401 || spRes.status === 403) {
            setSupplierProducts([]);
          }
        } catch {
          // ignore supplier product fetch errors
        }
      } catch (e) {
        setErr(e.message || String(e));
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  // Socket.IO: listen for real-time sales confirmations and append to orders list
  useEffect(() => {
    const origin = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
    const socketUrl = origin.replace(/^http/, 'ws');
    let socket;
    try {
      socket = ioClient(origin, { transports: ['websocket'] });
      socket.on('connect', () => console.log('[sales-analytics] socket connected', socket.id));
      socket.on('sales:confirmed', (payload) => {
        try {
          const method = normalize(payload.method || payload.paymentMethod);
          const status = normalize(payload.status || payload.paymentStatus || 'confirmed');
          const supplierLinked = Boolean(payload.supplierId);
          const isStripe = method === 'stripe' && status === 'paid' && !supplierLinked;
          const isPayLater = method === 'pay later' && status === 'confirmed';
          if (!isStripe && !isPayLater) return;
          const faux = {
            _id: payload.orderId || `order_${Date.now()}`,
            status: 'Confirmed',
            paymentMethod: payload.paymentMethod || payload.method || (isStripe ? 'stripe' : 'Pay Later'),
            createdAt: payload.timestamp || new Date().toISOString(),
            totalAmount: payload.amount || 0,
            items: payload.items || [],
            paymentInfo: {
              method,
              paymentStatus: status,
              supplierId: supplierLinked ? payload.supplierId : null,
              amount: payload.amount || 0,
              currency: payload.currency || 'lkr',
            },
          };
          if (!shouldIncludeOrder(faux)) return;
          setOrders((prev) => {
            // avoid duplicates
            if (prev.some((o) => String(o._id) === String(faux._id))) return prev;
            return [faux, ...prev];
          });
        } catch (e) {
          console.warn('Error handling sales:confirmed payload', e);
        }
      });
    } catch (e) {
      console.warn('Failed to connect socket for SalesAnalytics', e);
    }

      // If current user is an admin/finance role, also listen to admin-specific channel
      try {
        const role = String(user?.role || '').toLowerCase();
        if (role === 'admin' || role === 'finance manager' || role === 'finance_manager') {
          socket.on('sales:admin:confirmed', (payload) => {
            try {
              const method = normalize(payload.method || payload.paymentMethod);
              const status = normalize(payload.status || payload.paymentStatus || 'confirmed');
              const supplierLinked = Boolean(payload.supplierId);
              const isStripe = method === 'stripe' && status === 'paid' && !supplierLinked;
              const isPayLater = method === 'pay later' && status === 'confirmed';
              if (!isStripe && !isPayLater) return;
              const faux = {
                _id: payload.orderId || `admin_order_${Date.now()}`,
                status: 'Confirmed',
                paymentMethod: payload.paymentMethod || payload.method || (isStripe ? 'stripe' : 'Pay Later'),
                createdAt: payload.timestamp || new Date().toISOString(),
                totalAmount: payload.amount || 0,
                items: payload.items || [],
                paymentInfo: {
                  method,
                  paymentStatus: status,
                  supplierId: supplierLinked ? payload.supplierId : null,
                  amount: payload.amount || 0,
                  currency: payload.currency || 'lkr',
                },
              };
              if (!shouldIncludeOrder(faux)) return;
              setOrders((prev) => {
                if (prev.some((o) => String(o._id) === String(faux._id))) return prev;
                return [faux, ...prev];
              });
            } catch (err) {
              console.warn('Error handling sales:admin:confirmed payload', err);
            }
          });
        }
      } catch (e) {}

    return () => {
      try {
        if (socket) socket.disconnect();
      } catch (e) {}
    };
  }, [token, user]);

  const aggregated = useMemo(() => {
    const map = new Map();

    for (const order of orders) {
      const stripeEligible = isStripeCustomerSale(order);
      const payLaterEligible = isPayLaterConfirmedSale(order);
      if (!stripeEligible && !payLaterEligible) continue;
      if (filter === 'online' && !stripeEligible) continue;
      if (filter === 'pay_later' && !payLaterEligible) continue;

      const eventDate = getOrderEventDate(order, stripeEligible);
      if (!eventDate) continue;
      const key = range === 'weekly' ? getWeekKey(eventDate) : getMonthKey(eventDate);

      const items = Array.isArray(order.items) ? order.items : [];
      const unitsFromItems = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
      const orderAmountRaw = getOrderAmount(order);

      const entry = map.get(key) || { amount: 0, units: 0 };
      entry.amount += orderAmountRaw;
      entry.units += unitsFromItems;
      map.set(key, entry);
    }

    const keys = range === 'weekly' ? generateLastWeekKeys(weeks) : generateLastMonthKeys(months);
    const dataset = keys.map((key) => {
      const entry = map.get(key) || { amount: 0, units: 0 };
      return {
        key,
        label: range === 'weekly' ? formatWeekLabel(key) : key,
        totalSales: Number(Number(entry.amount || 0).toFixed(2)),
        unitsSold: Number(entry.units || 0),
      };
    });

    const labels = dataset.map((row) => row.label);
    const values = dataset.map((row) => row.totalSales);

    const datasetWithFilter = dataset.map((row) => ({ ...row, filter, filterLabel }));

    return { labels, values, dataset: datasetWithFilter };
  }, [orders, range, weeks, months, filter, filterLabel]);

  const handleDateChange = (event) => {
    const value = event.target.value;
    if (!value) {
      setDateErr('Select a date to view sales by product.');
      setSelectedDate('');
      return;
    }
    if (value > todayInputValue) {
      setDateErr('Date cannot be in the future.');
      setSelectedDate(todayInputValue);
      return;
    }
    setDateErr('');
    setSelectedDate(value);
  };

  const dailyProductData = useMemo(() => {
    if (!selectedDate) {
      return { labels: [], values: [], dataset: [] };
    }

    const map = new Map();

    for (const order of orders) {
      const stripeEligible = isStripeCustomerSale(order);
      const payLaterEligible = isPayLaterConfirmedSale(order);
      if (!stripeEligible && !payLaterEligible) continue;
      if (filter === 'online' && !stripeEligible) continue;
      if (filter === 'pay_later' && !payLaterEligible) continue;

      const eventDateRaw = getOrderEventDate(order, stripeEligible);
      if (!eventDateRaw) continue;
      const eventDate = new Date(eventDateRaw);
      if (Number.isNaN(eventDate.getTime())) continue;
      if (formatDateInputValue(eventDate) !== selectedDate) continue;

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const quantity = Number(item.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        const keyRaw = item.productId || item._id || item.product?._id || item.sku || item.id || item.name;
        if (!keyRaw) continue;
        const entryKey = String(keyRaw);
        const displayName = item.productName || item.name || item.title || entryKey;
        const price = Number(item.price ?? item.total ?? 0) || 0;
        const total = price * quantity;

        const entry = map.get(entryKey) || { name: displayName, totalSales: 0, unitsSold: 0 };
        entry.name = displayName;
        if (Number.isFinite(total) && total > 0) {
          entry.totalSales += total;
        }
        entry.unitsSold += quantity;
        map.set(entryKey, entry);
      }
    }

    const dataset = Array.from(map.values()).map((entry) => ({
      label: entry.name,
      totalSales: Number(Number(entry.totalSales || 0).toFixed(2)),
      unitsSold: Number(entry.unitsSold || 0),
    }));

    const labels = dataset.map((row) => row.label);
    const values = dataset.map((row) => row.totalSales);

    return { labels, values, dataset };
  }, [orders, selectedDate, filter]);

  const hasDailySales = dailyProductData.dataset.some((row) => row.totalSales > 0);

  const downloadCSV = () => {
    if (!aggregated.dataset.length) return;
    const header = ['period', 'totalSales', 'unitsSold', 'filter'];
    const rows = aggregated.dataset.map((row) => [
      row.label,
      Number(row.totalSales || 0).toFixed(2),
      String(row.unitsSold || 0),
      row.filterLabel || filterLabel,
    ]);

    const csvRows = [header, ...rows];

    const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `sales-report-${range}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!aggregated.dataset.length) return;
    const heading = range === 'weekly' ? 'Weekly' : 'Monthly';
    const rowsHtml = aggregated.dataset
      .map((row) => `
        <tr>
          <td>${row.label}</td>
          <td>${formatCurrency(row.totalSales)}</td>
          <td>${row.unitsSold || 0}</td>
          <td>${row.filterLabel || filterLabel}</td>
        </tr>
      `)
      .join('');

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      alert('Please allow pop-ups to generate the PDF report.');
      return;
    }

    popup.document.write(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Sales Report ${heading}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 16px; font-size: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #cbd5f5; padding: 8px 12px; text-align: left; }
            th { background: #e0e7ff; }
            tfoot td { font-weight: bold; }
            .meta { margin-bottom: 16px; color: #475569; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>Sales Report (${heading})</h1>
          <div class="meta">Generated at: ${new Date().toLocaleString()} &middot; Range: ${heading.toLowerCase()} &middot; Filter: ${filterLabel}</div>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Total Sales</th>
                <th>Units Sold</th>
                <th>Filter</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.focus();
              setTimeout(function () {
                window.print();
                window.close();
              }, 150);
            };
          <\/script>
        </body>
      </html>`);
    popup.document.close();
  };

  const downloadProfitCSV = () => {
    const fallbackTotals = profitSummary.totals || { daily: 0, weekly: 0, monthly: 0, total: 0 };
    const entries = [
      { label: 'All products', totals: fallbackTotals },
      ...profitSummary.perProduct.list.map((entry) => ({ label: entry.label, totals: entry.totals })),
    ];

    const header = ['product', 'totalProfit', 'monthlyProfit', 'weeklyProfit', 'dailyProfit', 'filter'];
    const rows = entries.map((entry) => [
      entry.label,
      Number(entry.totals.total || 0).toFixed(2),
      Number(entry.totals.monthly || 0).toFixed(2),
      Number(entry.totals.weekly || 0).toFixed(2),
      Number(entry.totals.daily || 0).toFixed(2),
      filterLabel,
    ]);

    const csvRows = [header, ...rows];
    const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `profit-report-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadProfitPDF = () => {
    const fallbackTotals = profitSummary.totals || { daily: 0, weekly: 0, monthly: 0, total: 0 };
    const entries = [
      { key: 'all', label: 'All products', totals: fallbackTotals },
      ...profitSummary.perProduct.list,
    ];

    const rowsHtml = entries
      .map((entry) => `
        <tr>
          <td>${entry.label}</td>
          <td>${formatCurrency(entry.totals.total)}</td>
          <td>${formatCurrency(entry.totals.monthly)}</td>
          <td>${formatCurrency(entry.totals.weekly)}</td>
          <td>${formatCurrency(entry.totals.daily)}</td>
          <td>${filterLabel}</td>
        </tr>
      `)
      .join('');

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      alert('Please allow pop-ups to generate the profit report.');
      return;
    }

    popup.document.write(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Profit Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 16px; font-size: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #cbd5f5; padding: 8px 12px; text-align: left; }
            th { background: #e0e7ff; }
            .meta { margin-bottom: 16px; color: #475569; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>Profit Report</h1>
          <div class="meta">Generated at: ${new Date().toLocaleString()} &middot; Filter: ${filterLabel}</div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Total Profit</th>
                <th>Monthly Profit</th>
                <th>Weekly Profit</th>
                <th>Daily Profit</th>
                <th>Filter</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.focus();
              setTimeout(function () {
                window.print();
                window.close();
              }, 150);
            };
          <\/script>
        </body>
      </html>`);
    popup.document.close();
  };

  const labels = aggregated.labels.length ? aggregated.labels : [];
  const values = aggregated.values.length ? aggregated.values : [];
  const dailyLabels = dailyProductData.labels.length ? dailyProductData.labels : [];
  const dailyValues = dailyProductData.values.length ? dailyProductData.values : [];
  const hasDailyDataset = dailyProductData.dataset.length > 0;
  const selectedDateLabel = selectedDate ? new Date(selectedDate).toLocaleDateString() : "";
  const zeroProfitTotals = { daily: 0, weekly: 0, monthly: 0, total: 0 };
  const profitWindows = profitSummary.windows;
  const profitWarnings = profitSummary.diagnostics.missingCost;
  const selectedProfitEntry = selectedProfitProduct === 'all' ? null : profitSummary.perProduct.map.get(selectedProfitProduct);
  const displayTotals = selectedProfitEntry ? selectedProfitEntry.totals : profitSummary.totals || zeroProfitTotals;
  const selectedProfitLabel = profitProductSelector.labelMap.get(selectedProfitProduct) || (selectedProfitEntry ? selectedProfitEntry.label : 'All products');
  const displayLabel = selectedProfitLabel;
  const profitCards = [
    {
      key: 'daily',
      label: 'Daily profit',
      value: displayTotals.daily,
      caption: `${displayLabel} · Today (${profitWindows.startOfToday.toLocaleDateString()})`,
    },
    {
      key: 'weekly',
      label: 'Weekly profit',
      value: displayTotals.weekly,
      caption: `${displayLabel} · Since ${profitWindows.startOfWeek.toLocaleDateString()}`,
    },
    {
      key: 'monthly',
      label: 'Monthly profit',
      value: displayTotals.monthly,
      caption: `${displayLabel} · Since ${profitWindows.startOfMonth.toLocaleDateString()}`,
    },
    {
      key: 'total',
      label: 'Total profit',
      value: displayTotals.total,
      caption: `${displayLabel} · All time (filtered)`,
    },
  ];
  return (
    <div className="card">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 className="heading-sm" style={{ marginBottom: 4 }}>Sales mix</h3>
            <div className="text-xs text-slate-500">Top performing sales by payment method</div>
          </div>
        </div>
        {hasPieData ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', marginTop: 12 }}>
            <SimplePieChart data={paymentBreakdown.entries} total={paymentBreakdown.totalAmount} size={220} />
            <div style={{ minWidth: 220 }}>
              {paymentBreakdown.entries.map((entry) => (
                <div key={entry.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: entry.color }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{entry.label}</div>
                      <div className="text-xs text-slate-500">{entry.percent}% of sales</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(entry.value)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-slate-500" style={{ marginTop: 12 }}>No sales recorded yet.</div>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 className="heading-sm" style={{ marginBottom: 4 }}>Profile calculator</h3>
            <div className="text-xs text-slate-500">Profit = (selling price - supplier price) × units sold</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input"
              value={selectedProfitProduct}
              onChange={(event) => setSelectedProfitProduct(event.target.value)}
              style={{ minWidth: 200 }}
            >
              {profitProductOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              onClick={downloadProfitCSV}
              title="Download profit breakdown as CSV"
            >
              Profit CSV
            </button>
            <button
              className="btn btn-secondary"
              onClick={downloadProfitPDF}
              title="Download profit breakdown as PDF"
            >
              Profit PDF
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          {profitCards.map((card) => (
            <div
              key={card.key}
              style={{
                flex: '1 1 180px',
                minWidth: 180,
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <div className="text-xs text-slate-500">{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{formatCurrency(card.value)}</div>
              <div className="text-xs text-slate-500" style={{ marginTop: 4 }}>{card.caption}</div>
            </div>
          ))}
        </div>
        {profitWarnings.length ? (
          <div className="text-xs" style={{ color: '#b45309', marginTop: 8 }}>
            Supplier cost missing for {profitWarnings.length} product(s). Profit assumes zero cost for: {profitWarnings.slice(0, 3).join(', ')}{profitWarnings.length > 3 ? '…' : ''}
          </div>
        ) : null}
      </div>
      <div className="card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="heading-sm">Sales analytics</h3>
        <div style={{ display: "flex", gap: 8, alignItems: 'center' }}>
          <button className={`btn ${range === "weekly" ? "btn-primary" : ""}`} onClick={() => setRange("weekly")}>Weekly</button>
          <button className={`btn ${range === "monthly" ? "btn-primary" : ""}`} onClick={() => setRange("monthly")}>Monthly</button>
          <select
            className="input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="all">All payments</option>
            <option value="online">Online payments</option>
            <option value="pay_later">Pay at shop</option>
          </select>
          <button
            className="btn btn-secondary"
            onClick={downloadCSV}
            title="Download the visible report as CSV"
          >
            Download CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={downloadPDF}
            title="Download the visible report as PDF"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div style={{ minHeight: 180, paddingTop: 8 }}>
        {loading ? (
          <div className="text-slate-500">Loading analytics…</div>
        ) : err ? (
          <div className="text-red-500">{err}</div>
        ) : values.every((v) => v === 0) ? (
          <div className="text-slate-500">No sales data yet</div>
        ) : (
          <>
            <SimpleBarChart labels={labels} values={values} height={180} />
            <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {labels.map((lab, i) => (
                <div key={lab || i} style={{ minWidth: 120 }}>
                  <div className="text-xs text-slate-500">{lab}</div>
                  <div className="font-semibold">{formatCurrency(values[i] || 0)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* PRODUCT-WISE ANALYTICS */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label className="label mb-0">Product</label>
            <select className="input" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              {products.length === 0 ? <option value="">(no products)</option> : products.map((p) => (
                <option key={p._id || p.productId || p.id} value={p._id || p.productId || p.id}>{p.name || p.productName || p.title || String(p._id || p.productId || p.id)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn ${productRange === "weekly" ? "btn-primary" : ""}`} onClick={() => setProductRange("weekly")}>Weekly</button>
            <button className={`btn ${productRange === "monthly" ? "btn-primary" : ""}`} onClick={() => setProductRange("monthly")}>Monthly</button>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          {(!selectedProduct || products.length === 0) ? (
            <div className="text-slate-500">Select a product to view sales</div>
          ) : (
            (() => {
              // compute product-level aggregation here
              const map = new Map();
              for (const o of orders) {
                const stripeEligible = isStripeCustomerSale(o);
                const payLaterEligible = isPayLaterConfirmedSale(o);
                if (!stripeEligible && !payLaterEligible) continue;
                if (filter === 'online' && !stripeEligible) continue;
                if (filter === 'pay_later' && !payLaterEligible) continue;
                const items = Array.isArray(o.items) ? o.items : [];
                const amount = items.reduce((sum, it) => {
                  const pid = it.productId || it._id || it.product?._id;
                  if (!pid) return sum;
                  if (String(pid) === String(selectedProduct)) {
                    const itemAmount = Number(it.price || it.total || 0) * Number(it.quantity || 1);
                    return sum + (Number(itemAmount) || 0);
                  }
                  return sum;
                }, 0);
                if (amount <= 0) continue;
                const eventDate = getOrderEventDate(o, stripeEligible);
                if (!eventDate) continue;
                const key = productRange === "weekly" ? getWeekKey(eventDate) : getMonthKey(eventDate);
                map.set(key, (map.get(key) || 0) + amount);
              }

              let keys = [];
              if (productRange === "weekly") keys = generateLastWeekKeys(weeks);
              else keys = generateLastMonthKeys(months);

              const pLabels = keys.map((k) => (productRange === "weekly" ? formatWeekLabel(k) : k));
              const pValues = keys.map((k) => map.get(k) || 0);

              if (pValues.every((v) => v === 0)) {
                return <div className="text-slate-500">No product sales data yet</div>;
              }

              return (
                <>
                  <SimpleBarChart labels={pLabels} values={pValues} height={160} />
                  <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {pLabels.map((lab, i) => (
                      <div key={lab || i} style={{ minWidth: 120 }}>
                        <div className="text-xs text-slate-500">{lab}</div>
                        <div className="font-semibold">{formatCurrency(pValues[i] || 0)}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* DAILY PRODUCT SALES */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <h4 className="heading-sm" style={{ margin: 0 }}>Product sales by date</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
            <label className="label mb-0" htmlFor="sales-date-picker">Select date</label>
            <input
              id="sales-date-picker"
              className="input"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              max={todayInputValue}
            />
            {dateErr ? (
              <span className="text-red-500" style={{ fontSize: 12 }}>{dateErr}</span>
            ) : null}
          </div>
        </div>

        {!selectedDate ? (
          <div className="text-slate-500" style={{ marginTop: 8 }}>Pick a date to view sales.</div>
        ) : !hasDailyDataset || !hasDailySales ? (
          <div className="text-slate-500" style={{ marginTop: 8 }}>
            No sales recorded for {selectedDateLabel || selectedDate}.
          </div>
        ) : (
          <>
            <SimpleBarChart labels={dailyLabels} values={dailyValues} height={180} />
            <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {dailyProductData.dataset.map((row, idx) => (
                <div key={row.label || idx} style={{ minWidth: 160 }}>
                  <div className="text-xs text-slate-500">{row.label || `Product ${idx + 1}`}</div>
                  <div className="font-semibold">{formatCurrency(row.totalSales || 0)}</div>
                  <div className="text-xs text-slate-500">Units: {row.unitsSold || 0}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
