// src/Components/Admin/AdminDashboard.js
import React, { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminReviews from "../Reviews_&_Feedback/AdminReviews";
import NotificationsPanel from "../Notifications/NotificationsPanel";
import FinanceConsole from "../Finance/FinanceConsole";
import AdminReviewRecycleBin from "../Reviews_&_Feedback/AdminReviewRecycleBin";
import SupplierAdminProductList from "../SupplierProduct/SupplierAdminProductList";
import SupplierDiscountAdminList from "../SupplierProduct/SupplierDiscountAdminList";
import { useAuth } from "../context/AuthContext";
import { AdminCartContext } from "../Order/Admin/AdminCartContext";
import AdminRefunds from "../Refund/AdminRefunds";
import SalesAnalytics from "./SalesAnalytics";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const API = `${API_ROOT}/api`;
const ORIGIN = API_ROOT;

// Fetch JSON data from an API endpoint
const fetchJSON = async (url, options = {}) => {
  const { headers: userHeaders, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(userHeaders || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        message = text;
      }
    } catch (error) {
      // ignore parsing issues and use default message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const matchesSearchTerm = (value, term) => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;

  const visit = (input) => {
    if (input == null) return false;
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return String(input).toLowerCase().includes(normalized);
    }
    if (Array.isArray(input)) {
      return input.some(visit);
    }
    if (typeof input === "object") {
      return Object.values(input).some(visit);
    }
    return false;
  };

  return visit(value);
};

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (amount) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return currencyFormatter.format(numeric);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 10);
};

const getTodayInputValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

const daysUntilDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

const resolveImageUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  try {
    return String(value);
  } catch (err) {
    return "";
  }
};

// Small SVG bar chart component (used in Inventory)
function SmallBarChart({ labels = [], values = [], height = 320, barWidth = 48, labelRotation = -45 }) {
  const max = Math.max(...values, 1);
  const gap = Math.max(8, Math.floor(barWidth / 3));
  const leftPadding = 48;
  const rightPadding = 48;

  // Reserve extra bottom padding based on rotation so labels don't get cropped
  const rotationAbs = Math.abs(Number(labelRotation) || 0);
  const bottomPadding = Math.max(56, Math.min(140, 20 + rotationAbs * 0.9));
  const baselineY = height - bottomPadding + 16; // y position for x-axis line
  const labelY = height - Math.max(12, bottomPadding / 3); // y position for label anchor

  const requiredWidth = leftPadding + labels.length * (barWidth + gap) + rightPadding + 20;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" height={height} style={{ minWidth: requiredWidth, overflow: 'visible' }}>
        {/* y-axis baseline */}
        <line x1={leftPadding - 8} y1={baselineY} x2={requiredWidth - rightPadding + 8} y2={baselineY} stroke="#e6e6e6" />
        {values.map((v, i) => {
          const x = leftPadding + i * (barWidth + gap);
          const h = Math.round(((height - bottomPadding - 40) * v) / max);
          const y = baselineY - 8 - h;
          const labelX = x + barWidth / 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={h} rx={6} fill="#0f766e" />
              <text x={labelX} y={y - 8} fontSize={13} fill="#042b2b" textAnchor="middle" fontWeight={600}>{v}</text>
              <text
                x={labelX}
                y={labelY}
                fontSize={13}
                fill="#374151"
                textAnchor="middle"
                transform={`rotate(${labelRotation}, ${labelX}, ${labelY})`}
                style={{ pointerEvents: 'none' }}
              >
                {labels[i] ?? ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SimpleLineChart({ labels = [], values = [], height = 280 }) {
  if (!Array.isArray(labels) || !Array.isArray(values) || labels.length !== values.length) {
    return null;
  }

  const maxValue = Math.max(...values, 1);
  const leftPadding = 56;
  const rightPadding = 32;
  const topPadding = 24;
  const bottomPadding = 64;
  const plotHeight = Math.max(1, height - topPadding - bottomPadding);
  const step = labels.length > 1 ? Math.max(56, 560 / Math.max(labels.length - 1, 1)) : 0;
  const plotWidth = labels.length > 1 ? step * (labels.length - 1) : 0;
  const minWidth = leftPadding + plotWidth + rightPadding;
  const baselineY = height - bottomPadding;

  const points = labels.map((label, index) => {
    const rawValue = Number(values[index] || 0);
    const clampedValue = rawValue < 0 ? 0 : rawValue;
    const normalized = maxValue === 0 ? 0 : clampedValue / maxValue;
    const x = leftPadding + index * step;
    const y = topPadding + (1 - normalized) * plotHeight;
    return { x, y, value: clampedValue, label };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length > 1
    ? [`M ${leftPadding} ${baselineY}`, ...points.map((p) => `L ${p.x} ${p.y}`), `L ${points[points.length - 1].x} ${baselineY}`, "Z"].join(" ")
    : "";

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" height={height} style={{ minWidth, overflow: "visible" }}>
        <line x1={leftPadding} y1={baselineY} x2={leftPadding + plotWidth} y2={baselineY} stroke="#d1d5db" />
        <line x1={leftPadding} y1={topPadding - 8} x2={leftPadding} y2={baselineY} stroke="#d1d5db" />

        {points.length > 1 && (
          <>
            <path d={areaPath} fill="rgba(37, 99, 235, 0.15)" />
            <polyline fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" points={polylinePoints} />
          </>
        )}

        {points.length === 1 && (
          <circle cx={points[0].x} cy={points[0].y} r={5} fill="#2563eb" />
        )}

        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={4.5} fill="#1d4ed8" stroke="#fff" strokeWidth={1.5} />
            <text x={point.x} y={point.y - 10} fontSize={12} fontWeight={600} fill="#1f2937" textAnchor="middle">
              {Math.round(point.value)}
            </text>
            <text
              x={point.x}
              y={baselineY + 24}
              fontSize={12}
              fill="#4b5563"
              textAnchor="middle"
              transform={`rotate(-35, ${point.x}, ${baselineY + 24})`}
            >
              {labels[index]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Privilege labels for display
const PRIV_LABELS = {
  manage_users: "Manage users & accounts",
  manage_roles: "Manage roles & privileges",
  manage_products: "Manage product catalog",
  manage_inventory: "Manage inventory configuration",
  manage_all_orders: "Manage all customer orders",
  manage_suppliers: "Manage supplier directory",
  system_config: "Configure system settings",
  view_reports: "View executive reports",
  view_analytics: "View analytics dashboards",
  export_data: "Export platform data",
  view_products: "View products",
  place_orders: "Place orders",
  view_own_orders: "View own orders",
  submit_feedback: "Submit feedback & reviews",
  inv_view_stock: "View stock balances",
  inv_update_stock: "Adjust stock levels",
  inv_reorder: "Create reorder requests",
  inv_receive_goods: "Receive goods",
  inv_reports: "Inventory reports",
  fin_view_online_payments: "View online payments",
  fin_view_supplier_payments: "View supplier payments",
  fin_view_declined_payments: "View declined slips",
  fin_manage_declined_payments: "Resolve / delete declined slips",
  fin_manage_salary: "Manage salary overrides",
  fin_view_finance_notifications: "View finance notifications",
  fin_view_notifications: "Legacy: finance notifications",
  fin_export_statements: "Export finance statements",
  fin_record_payments: "Legacy: record manual payments",
  fin_payroll: "Legacy: manage payroll & suppliers",
  fin_view_dashboard: "Legacy: view finance dashboard",
  fin_payments: "Legacy: review payments",
  fin_payouts: "Legacy: approve supplier payouts",
  fin_reconcile: "Legacy: reconcile transactions",
  fin_reports: "Legacy: financial reports",
  fin_statements: "Legacy: financial statements",
  cc_view_feedback: "View feedback",
  cc_respond_feedback: "Respond to feedback",
  cc_manage_returns: "Manage returns",
  moderate_feedback: "Moderate reviews",
  refund_view_requests: "View refund & return requests",
  refund_manage_requests: "Manage refunds & returns",
  sales_manage_orders: "Manage sales orders",
  sales_process_refunds: "Process sales refunds",
  sales_manage_discounts: "Manage sales promotions",
  sales_view_reports: "View sales reports",
  sales_dashboard: "Legacy: sales dashboard",
  sales_refund: "Legacy: sales refund tools",
  sales_promotions: "Legacy: sales promotions",
  sales_reports: "Legacy: sales reporting",
  supplier_portal: "Access supplier portal",
  supplier_manage_products: "Supplier: manage listings",
  supplier_receive_orders: "Supplier: receive orders",
  supplier_manage_inventory: "Supplier: manage inventory",
};

const USER_PRIVILEGES = ["view_products", "place_orders", "view_own_orders", "submit_feedback"];

const INVENTORY_PRIVILEGES = [
  "manage_inventory",
  "inv_view_stock",
  "inv_update_stock",
  "inv_reorder",
  "inv_receive_goods",
  "inv_reports",
];

// Note: Some "fin_" privileges are legacy and may not be in active use
const FINANCE_PRIVILEGES = [
  "fin_view_online_payments",
  "fin_view_supplier_payments",
  "fin_view_declined_payments",
  "fin_manage_declined_payments",
  "fin_manage_salary",
  "fin_view_finance_notifications",
  "fin_export_statements",
  "fin_record_payments",
  "fin_payroll",
  "fin_view_dashboard",
  "fin_payments",
  "fin_payouts",
  "fin_reconcile",
  "fin_reports",
  "fin_statements",
  "fin_view_notifications",
];

// Feedback & Reviews privileges
const FEEDBACK_PRIVILEGES = [
  "cc_view_feedback",
  "cc_respond_feedback",
  "cc_manage_returns",
  "moderate_feedback",
  "refund_view_requests",
  "refund_manage_requests",
];

// Sales & Promotions privileges
const SALES_PRIVILEGES = [
  "sales_manage_orders",
  "sales_process_refunds",
  "sales_manage_discounts",
  "sales_view_reports",
  "sales_dashboard",
  "sales_refund",
  "sales_promotions",
  "sales_reports",
  "supplier_portal",
  "supplier_manage_products",
  "supplier_receive_orders",
  "supplier_manage_inventory",
  "manage_suppliers",
];

// Admin privileges include all other privileges
const ADMIN_PRIVILEGES = Array.from(
  new Set([
    "manage_users",
    "manage_roles",
    "system_config",
    "manage_all_orders",
    "manage_products",
    "view_reports",
    "view_analytics",
    "export_data",
    ...USER_PRIVILEGES,
    ...INVENTORY_PRIVILEGES,
    ...FINANCE_PRIVILEGES,
    ...FEEDBACK_PRIVILEGES,
    ...SALES_PRIVILEGES,
  ])
);

// Convert privilege IDs to labeled items for UI
const toCategoryItems = (ids) => ids.map((id) => ({ id, label: PRIV_LABELS[id] || id }));

// Group privileges into categories for display
const PRIV_CATEGORIES = [
  { title: "Admin", items: toCategoryItems(ADMIN_PRIVILEGES) },
  { title: "User", items: toCategoryItems(USER_PRIVILEGES) }, 
  { title: "Inventory", items: toCategoryItems(INVENTORY_PRIVILEGES) },
  { title: "Finance", items: toCategoryItems(FINANCE_PRIVILEGES) },
  { title: "Feedback & Reviews", items: toCategoryItems(FEEDBACK_PRIVILEGES) },
  { title: "Sales", items: toCategoryItems(SALES_PRIVILEGES) },
];

const REORDER_STORAGE_KEY = "smart_hardware_reorder_queue";

const readStoredReorders = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        productId: item.productId,
        name: item.name || "",
        category: item.category || "",
        stockAmount: Number.isFinite(Number(item.stockAmount)) ? Number(item.stockAmount) : 0,
        reorderQty: Number.isFinite(Number(item.reorderQty)) ? Number(item.reorderQty) : 0,
        threshold: Number.isFinite(Number(item.threshold)) ? Number(item.threshold) : undefined,
        status: item.status === "ordered" ? "ordered" : "pending",
        notes: item.notes || "",
        createdAt: item.createdAt || new Date().toISOString(),
        requestedBy: item.requestedBy || "",
      }));
  } catch (error) {
    console.warn("Failed to parse reorder list from storage", error);
    return [];
  }
};

const persistReorders = (list) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REORDER_STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn("Failed to persist reorder list", error);
  }
};

const roleBadge = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "admin") return "badge badge-amber";
  if (normalized === "staff" || normalized.includes("manager")) return "badge badge-green";
  return "badge badge-gray";
};

const ATTENDANCE_STATUS_OPTIONS = [
  { value: "present", label: "Present", tone: "badge badge-green" },
  { value: "absent", label: "Absent", tone: "badge badge-red" },
  { value: "late", label: "Late", tone: "badge badge-amber" },
  { value: "leave", label: "On leave", tone: "badge badge-gray" },
];

const getAttendanceStatusMeta = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  const match = ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === normalized);
  return (
    match || {
      value: normalized || "unknown",
      label: normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Not set",
      tone: "badge badge-gray",
    }
  );
};

// Main Admin Dashboard component
export default function AdminDashboard() {
  const [feedbackTab, setFeedbackTab] = useState("reviews");
  const {
    user,
    token,
    theme,
    setTheme: setThemePreference,
    toggleTheme,
    updateProfile,
    changePassword,
    uploadAvatar,
    deleteAvatar,
    logout,
  } = useAuth();

  const minExpiryDate = useMemo(() => getTodayInputValue(), []);

  // Navigation
  const navigate = useNavigate();
  const { addToCart } = useContext(AdminCartContext);
  const { cartItems } = useContext(AdminCartContext) || { cartItems: [] };

  const userGrowthChartId = useId();

  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash) setTab(fromHash);
    const onHash = () => setTab(window.location.hash.replace("#", "") || "dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  
    // Clear transient message timer on unmount
    useEffect(() => {
      return () => {
        if (messageTimerRef.current) {
          clearTimeout(messageTimerRef.current);
          messageTimerRef.current = null;
        }
      };
    }, []);

  const setTabAndHash = (nextTab) => {
    setTab(nextTab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${nextTab}`);
    }
  };

  const [orders, setOrders] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [cancelledOrders, setCancelledOrders] = useState([]);
  const [adminCancelledOrders, setAdminCancelledOrders] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invChartMode, setInvChartMode] = useState('stock');
  const [inventoryChartCategory, setInventoryChartCategory] = useState('all');
  const [inventoryChartRange, setInventoryChartRange] = useState(30);
  const [inventoryChartProductId, setInventoryChartProductId] = useState('');
  const [financeView, setFinanceView] = useState("online");
  const [financeConsoleKey, setFinanceConsoleKey] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAdminOrders, setLoadingAdminOrders] = useState(false);
  const [loadingCancelledOrders, setLoadingCancelledOrders] = useState(false);
  const [loadingAdminCancelledOrders, setLoadingAdminCancelledOrders] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showAttendanceReportModal, setShowAttendanceReportModal] = useState(false);
  const [showFinanceReportModal, setShowFinanceReportModal] = useState(false);

  useEffect(() => {
    if (!msg) return;
    const timeout = setTimeout(() => {
      setMsg("");
    }, 4000);
    return () => clearTimeout(timeout);
  }, [msg]);
  const [attendanceReportLoading, setAttendanceReportLoading] = useState(false);
  const [attendanceReportErr, setAttendanceReportErr] = useState("");
  const [userReportLoading, setUserReportLoading] = useState(false);
  const [userReportErr, setUserReportErr] = useState("");
  const [userReportFilters, setUserReportFilters] = useState({ from: "", to: "" });

  // Memoized auth header for API requests
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  // Loading Users
  const loadUsers = useCallback(async ({ suppressError = false } = {}) => { 
    setLoadingUsers(true); 
    if (!suppressError) setErr("");
    try {
      if (!token) throw new Error("Authentication required");
      const data = await fetchJSON(`${API}/users`, { headers: authHeader });
      setUsers(Array.isArray(data) ? data : data?.users ?? []);
    } catch (e) {
      if (!suppressError) setErr(e.message);
      if (!suppressError) setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [authHeader, token]);

  // Loading Roles
  const loadRoles = useCallback(async ({ suppressError = false } = {}) => {
    setLoadingRoles(true);
    if (!suppressError) setErr("");
    try {
      if (!token) throw new Error("Authentication required");
      const data = await fetchJSON(`${API}/roles`, { headers: authHeader });
      setRoles(Array.isArray(data) ? data : data?.roles ?? []);
    } catch (e) {
      if (!suppressError) setErr(e.message);
      if (!suppressError) setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, [authHeader, token]);

  const loadProducts = useCallback(async ({ suppressError = false } = {}) => {
    setLoadingProducts(true);
    if (!suppressError) setErr("");
    try {
      const data = await fetchJSON(`${ORIGIN}/products`, { headers: authHeader });
      setProducts(Array.isArray(data) ? data : data?.products ?? []);
    } catch (e) {
      if (!suppressError) setErr(e.message);
      if (!suppressError) setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [authHeader]);

  const loadOrders = useCallback(async ({ suppressError = false } = {}) => {
    setLoadingOrders(true);
    if (!suppressError) setErr("");
    try {
      if (!token) throw new Error("Authentication required");
      const data = await fetchJSON(`${API}/orders`, { headers: authHeader });
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e) {
      if (!suppressError) setErr(e.message);
      if (!suppressError) setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [authHeader, token]);

  const loadAdminOrders = useCallback(async ({ suppressError = false } = {}) => {
    setLoadingAdminOrders(true);
    if (!suppressError) setErr("");
    try {
      if (!token) throw new Error("Authentication required");
      const data = await fetchJSON(`${API}/admin-orders`, { headers: authHeader });
      setAdminOrders(Array.isArray(data) ? data : data?.orders ?? []);
    } catch (e) {
      if (!suppressError) setErr(e.message);
      if (!suppressError) setAdminOrders([]);
    } finally {
      setLoadingAdminOrders(false);
    }
  }, [authHeader, token]);

  const loadCancelledOrders = useCallback(async ({ suppressError = false } = {}) => {
    setLoadingCancelledOrders(true);
    if (!suppressError) setErr("");
    try {
      if (!token) throw new Error("Authentication required");
      const data = await fetchJSON(`${API}/orders/cancelled`, { headers: authHeader });
      setCancelledOrders(Array.isArray(data?.cancelledOrders) ? data.cancelledOrders : []);
    } catch (e) {
      if (!suppressError) setErr(e.message);
      if (!suppressError) setCancelledOrders([]);
    } finally {
      setLoadingCancelledOrders(false);
    }
  }, [authHeader, token]);

  const loadAdminCancelledOrders = useCallback(
    async ({ suppressError = false } = {}) => {
      setLoadingAdminCancelledOrders(true);
      if (!suppressError) setErr("");
      try {
        if (!token) throw new Error("Authentication required");
        const data = await fetchJSON(`${API}/admin-cancelled-orders`, { headers: authHeader });
        const rawList = Array.isArray(data?.orders) ? data.orders : [];
        const sorted = [...rawList].sort(
          (a, b) =>
            toTimestamp(b?.cancelledAt || b?.updatedAt || b?.createdAt) -
            toTimestamp(a?.cancelledAt || a?.updatedAt || a?.createdAt)
        );
        setAdminCancelledOrders(sorted);
      } catch (e) {
        if (!suppressError) setErr(e.message);
        if (!suppressError) setAdminCancelledOrders([]);
      } finally {
        setLoadingAdminCancelledOrders(false);
      }
    },
    [authHeader, token]
  );

  useEffect(() => {
    if (!token && ["users", "roles", "order", "dashboard"].includes(tab)) {
      return;
    }

    if (tab === "users") loadUsers();
    if (tab === "roles") loadRoles();
    if (tab === "product") loadProducts();
    if (tab === "order") {
      loadOrders();
      loadAdminOrders();
      loadCancelledOrders();
      loadAdminCancelledOrders();
    }
    if (tab === "dashboard") {
      loadUsers({ suppressError: true });
      loadProducts({ suppressError: true });
      loadOrders({ suppressError: true });
      loadAdminOrders({ suppressError: true });
      loadCancelledOrders({ suppressError: true });
      loadAdminCancelledOrders({ suppressError: true });
      loadRoles({ suppressError: true });
    }
  }, [
    tab,
    token,
    loadUsers,
    loadRoles,
    loadProducts,
    loadOrders,
    loadAdminOrders,
    loadCancelledOrders,
    loadAdminCancelledOrders,
  ]);
  // ---------------- Profile ----------------
  const initials = (user?.name || "A")
    .trim()
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

    // Profile state
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    age: user?.age ?? "",
    address: user?.address || "",
  });
  // Profile loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [changingPwd, setChangingPwd] = useState(false);
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const avatarInputRef = useRef(null);

  // Sync profile state when user data changes
  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      age: user?.age ?? "",
      address: user?.address || "",
    });
  }, [user]);

  const resetProfileForm = () =>
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      age: user?.age ?? "",
      address: user?.address || "",
    });

  
  const triggerAvatarPicker = () => {
    setErr("");
    avatarInputRef.current?.click();
  };
  // Handle avatar file selection
  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setErr("Profile photos must be smaller than 2MB"); // Validate file size
      event.target.value = "";
      return;
    }
    setUploadingAvatar(true); // Uploading state
    setMsg("");
    setErr("");
    try {
      await uploadAvatar(file);
      setMsg("Profile photo updated");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    if (!user?.avatar) return;
    if (!window.confirm("Remove profile photo?")) return;
    setUploadingAvatar(true);
    setMsg("");
    setErr("");
    try {
      await deleteAvatar();
      setMsg("Profile photo removed");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save profile changes
  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    const trimmedName = profile.name.trim(); 
    const trimmedEmail = profile.email.trim();
  const parsedAge = profile.age === "" ? undefined : Number(profile.age);
  const trimmedAddress = typeof profile.address === "string" ? profile.address.trim() : "";

    if (!trimmedName) return setErr("Name is required"); // Validate name
  if (!trimmedEmail) return setErr("Email is required"); // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return setErr("Enter a valid email address"); // Validate email format
    if (parsedAge !== undefined && Number.isNaN(parsedAge)) return setErr("Age must be a number"); // Validate age
    if (parsedAge !== undefined && (parsedAge < 0 || parsedAge > 120)) 
      return setErr("Enter a valid age between 0 and 120");   // Validate age range               

    setSavingProfile(true);
    try {
      const updated = await updateProfile({
        name: trimmedName,
        email: trimmedEmail,
        age: parsedAge,
  address: trimmedAddress || undefined,
      });
      setProfile({
        name: updated.name || "",
        email: updated.email || "",
        age: updated.age ?? "",
        address: updated.address || "",
      });
      setMsg("Profile updated");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSavingProfile(false);
    }
  };

    // ---------------- Users: search (by name or role) ----------------
  const [q, setQ] = useState("");
  const [userSortBy, setUserSortBy] = useState("name"); // name, email, role, created
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  const userRoleOptions = useMemo(() => {
    const roleSet = new Set();
    users.forEach((u) => {
      const role = String(u?.role || "").trim().toLowerCase();
      if (role) roleSet.add(role);
    });
    return Array.from(roleSet).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];

    // Filter by role
    if (userRoleFilter !== "all") {
      list = list.filter((u) => String(u?.role || "").toLowerCase() === userRoleFilter);
    }

    // Filter by search term
    const t = q.trim().toLowerCase();
    if (t) {
      list = list.filter(
        (u) => (u.name || "").toLowerCase().includes(t) || (u.email || "").toLowerCase().includes(t) || (u.role || "").toLowerCase().includes(t)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (userSortBy === "name") return (a?.name || "").localeCompare(b?.name || "");
      if (userSortBy === "email") return (a?.email || "").localeCompare(b?.email || "");
      if (userSortBy === "role") return (a?.role || "").localeCompare(b?.role || "");
      if (userSortBy === "created") return toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt);
      return 0;
    });

    return list;
  }, [q, users, userSortBy, userRoleFilter]);

  const userGrowth = useMemo(() => {
    const totalUsers = Array.isArray(users) ? users.length : 0;
    const monthsToShow = 6;
    const now = new Date();
    const buckets = [];

    for (let index = monthsToShow - 1; index >= 0; index -= 1) {
      const marker = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      buckets.push({
        label: marker.toLocaleString(undefined, { month: "short" }),
        year: marker.getUTCFullYear(),
        month: marker.getUTCMonth(),
      });
    }

    const timestamps = (Array.isArray(users) ? users : [])
      .map((item) => toTimestamp(item?.createdAt))
      .filter((value) => value > 0)
      .sort((a, b) => a - b);

    let pointer = 0;
    let cumulative = 0;
    let previous = 0;

    const chartPoints = buckets.map((bucket) => {
      const bucketEnd = Date.UTC(bucket.year, bucket.month + 1, 1) - 1;
      while (pointer < timestamps.length && timestamps[pointer] <= bucketEnd) {
        cumulative += 1;
        pointer += 1;
      }
      const newCount = cumulative - previous;
      previous = cumulative;
      return {
        ...bucket,
        count: cumulative,
        newCount,
      };
    });

    const counts = chartPoints.map((point) => point.count);
    const max = counts.length > 0 ? Math.max(...counts, 0) : 0;
    const min = counts.length > 0 ? Math.min(...counts, 0) : 0;
    const range = Math.max(max - min, 1);
    const chartHeight = 80;
    const chartTop = 10;
    const bottom = chartTop + chartHeight;

    const svgPoints = chartPoints.map((point, index) => {
      const x = chartPoints.length === 1 ? 0 : (index / (chartPoints.length - 1)) * 100;
      const normalized = range === 0 ? 0.5 : (point.count - min) / range;
      const y = chartTop + (1 - normalized) * chartHeight;
      return { ...point, x, y };
    });

    let path = "";
    let area = "";
    if (svgPoints.length > 0) {
      path = svgPoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`)
        .join(" ");
      const first = svgPoints[0];
      const last = svgPoints[svgPoints.length - 1];
      area =
        `M ${first.x.toFixed(3)} ${bottom.toFixed(3)} ` +
        svgPoints.map((point) => `L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(" ") +
        ` L ${last.x.toFixed(3)} ${bottom.toFixed(3)} Z`;
    }

    const lastPoint = svgPoints[svgPoints.length - 1] || {
      label: buckets[buckets.length - 1]?.label || "",
      year: buckets[buckets.length - 1]?.year,
      count: totalUsers,
      newCount: totalUsers,
    };
    const prevPoint = svgPoints.length > 1 ? svgPoints[svgPoints.length - 2] : null;
    const prevTotal = prevPoint ? prevPoint.count : 0;
    const deltaTotal = lastPoint.count - prevTotal;
    const delta = lastPoint.newCount;
    let deltaPercent = 0;
    if (prevTotal > 0) {
      deltaPercent = (deltaTotal / prevTotal) * 100;
    } else if (lastPoint.count > 0) {
      deltaPercent = 100;
    }

    let peakPoint = null;
    svgPoints.forEach((point) => {
      if (!peakPoint || point.newCount > peakPoint.newCount) {
        peakPoint = point;
      }
    });
    if (peakPoint && peakPoint.newCount === 0) {
      peakPoint = null;
    }

    return {
      points: svgPoints,
      path,
      area,
      bottom,
      total: totalUsers,
      delta,
      deltaPercent,
      lastLabel: lastPoint.label,
      peakPoint,
      hasData: timestamps.length > 0,
    };
  }, [users]);

  const userGrowthGradientId = `${userGrowthChartId}-fill`;
  const userGrowthBaseline = Number.isFinite(userGrowth.bottom) ? userGrowth.bottom : 90;
  const userGrowthHasData = !loadingUsers && userGrowth.hasData;
  const userGrowthTotalDisplay = loadingUsers ? "…" : userGrowth.total.toLocaleString();
  const userGrowthDeltaDisplay = loadingUsers
    ? "…"
    : `${userGrowth.delta >= 0 ? "+" : ""}${userGrowth.delta.toLocaleString()}`;
  const userGrowthPercentDisplay = loadingUsers
    ? "…"
    : Number.isFinite(userGrowth.deltaPercent)
    ? `${userGrowth.deltaPercent >= 0 ? "+" : ""}${userGrowth.deltaPercent.toFixed(1)}%`
    : "0.0%";
  const userGrowthPeakLabel = userGrowthHasData && userGrowth.peakPoint
    ? `${userGrowth.peakPoint.label} ${userGrowth.peakPoint.year}`
    : "";
  const userGrowthPeakDeltaDisplay = userGrowthHasData && userGrowth.peakPoint
    ? userGrowth.peakPoint.newCount.toLocaleString()
    : null;

  // ---------------- Roles: search and sort ----------------
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [roleSortBy, setRoleSortBy] = useState("name"); // name, privileges

  const filteredRoles = useMemo(() => {
    let list = [...roles];

    // Filter by search term
    const term = roleSearchQuery.trim().toLowerCase();
    if (term) {
      list = list.filter((r) => {
        const name = (r?.name || "").toLowerCase();
        const desc = (r?.description || "").toLowerCase();
        const privs = (r?.privileges || []).join(" ").toLowerCase();
        return name.includes(term) || desc.includes(term) || privs.includes(term);
      });
    }

    // Sort
    list.sort((a, b) => {
      if (roleSortBy === "name") return (a?.name || "").localeCompare(b?.name || "");
      if (roleSortBy === "privileges") {
        const aCount = Array.isArray(a?.privileges) ? a.privileges.length : 0;
        const bCount = Array.isArray(b?.privileges) ? b.privileges.length : 0;
        return bCount - aCount; // Descending by privilege count
      }
      return 0;
    });

    return list;
  }, [roles, roleSearchQuery, roleSortBy]);


  // ---------------- Products: search (by name, category, brand) ----------------
  const [productQuery, setProductQuery] = useState("");
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    list.sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    const term = productQuery.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) => {
      const name = (item?.name || "").toLowerCase();
      const category = (item?.category || "").toLowerCase();
      const brand = (item?.brand || "").toLowerCase();
      return name.includes(term) || category.includes(term) || brand.includes(term);
    });
  }, [productQuery, products]);

  const [customerOrderQuery, setCustomerOrderQuery] = useState("");
  const filteredCustomerOrders = useMemo(() => {
    const list = Array.isArray(orders) ? [...orders] : [];
    list.sort(
      (a, b) => toTimestamp(b?.updatedAt || b?.createdAt) - toTimestamp(a?.updatedAt || a?.createdAt)
    );
    if (!customerOrderQuery.trim()) return list;
    return list.filter((order) => matchesSearchTerm(order, customerOrderQuery));
  }, [orders, customerOrderQuery]);

  const [adminOrderQuery, setAdminOrderQuery] = useState("");
  const filteredAdminOrders = useMemo(() => {
    const list = Array.isArray(adminOrders) ? [...adminOrders] : [];
    list.sort(
      (a, b) => toTimestamp(b?.updatedAt || b?.createdAt) - toTimestamp(a?.updatedAt || a?.createdAt)
    );
    if (!adminOrderQuery.trim()) return list;
    return list.filter((order) => matchesSearchTerm(order, adminOrderQuery));
  }, [adminOrders, adminOrderQuery]);

  const [cancelledOrderQuery, setCancelledOrderQuery] = useState("");
  const [adminCancelledOrderQuery, setAdminCancelledOrderQuery] = useState("");
  const filteredCancelledOrders = useMemo(() => {
    const list = Array.isArray(cancelledOrders) ? [...cancelledOrders] : [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = list.filter(
      (order) => toTimestamp(order?.cancelledAt || order?.updatedAt || order?.createdAt) >= thirtyDaysAgo
    );
    recent.sort(
      (a, b) =>
        toTimestamp(b?.cancelledAt || b?.updatedAt || b?.createdAt) -
        toTimestamp(a?.cancelledAt || a?.updatedAt || a?.createdAt)
    );
    if (!cancelledOrderQuery.trim()) return recent;
    return recent.filter((order) => matchesSearchTerm(order, cancelledOrderQuery));
  }, [cancelledOrders, cancelledOrderQuery]);
  const filteredAdminCancelledOrders = useMemo(() => {
    const list = Array.isArray(adminCancelledOrders) ? [...adminCancelledOrders] : [];
    if (!adminCancelledOrderQuery.trim()) return list;
    const term = adminCancelledOrderQuery.trim().toLowerCase();
    return list.filter((order) => {
      const values = [
        order?._id,
        order?.supplierId,
        order?.status,
        order?.paymentMethod,
        order?.notes,
        order?.contact,
        order?.cancelledByName,
      ];
      if (
        values.some((value) =>
          value && String(value).toLowerCase().includes(term)
        )
      ) {
        return true;
      }
      const items = Array.isArray(order?.items) ? order.items : [];
      return items.some((item) =>
        [item?.name, item?.productId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    });
  }, [adminCancelledOrders, adminCancelledOrderQuery]);

  const [inventorySearch, setInventorySearch] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState(10);
  const [stockDrafts, setStockDrafts] = useState({});
  const [expiryDrafts, setExpiryDrafts] = useState({});
  const [reorderDrafts, setReorderDrafts] = useState({});
  const [inventorySavingId, setInventorySavingId] = useState(null);
  const [reorderList, setReorderList] = useState(() => readStoredReorders());
  const [reorderNotes, setReorderNotes] = useState("");
  const [reorderFilter, setReorderFilter] = useState("all");
  const messageTimerRef = useRef(null);

  const [attendanceDate, setAttendanceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [attendanceNotes, setAttendanceNotes] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState({});
  const [attendanceMsg, setAttendanceMsg] = useState("");
  const [attendanceErr, setAttendanceErr] = useState("");
  const [attendanceRoleFilter, setAttendanceRoleFilter] = useState("all");

  useEffect(() => {
    persistReorders(reorderList);
  }, [reorderList]);

  useEffect(() => {
    if (!Array.isArray(products) || products.length === 0) return;
    setReorderList((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        if (!item?.productId) return item;
        const product = products.find((p) => p?._id === item.productId);
        if (!product) return item;
        const normalizedStock = Number.isFinite(Number(product.stockAmount))
          ? Number(product.stockAmount)
          : 0;
        const updated = {
          ...item,
          name: product.name || item.name,
          category: product.category || item.category,
          stockAmount: normalizedStock,
        };
        if (
          updated.name !== item.name ||
          updated.category !== item.category ||
          updated.stockAmount !== item.stockAmount
        ) {
          changed = true;
        }
        return updated;
      });
      return changed ? next : prev;
    });
  }, [products]);

  const lowStockLimit = useMemo(() => {
    const value = Number(reorderThreshold);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }, [reorderThreshold]);

  const filteredInventoryItems = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    list.sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    const term = inventorySearch.trim();
    if (!term) return list;
    return list.filter((item) => matchesSearchTerm(item, term));
  }, [products, inventorySearch]);

  const inventoryStats = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    let totalSkus = 0;
    let totalOnHand = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;
    list.forEach((product) => {
      totalSkus += 1;
      const stock = Number(product?.stockAmount ?? 0);
      const price = Number(product?.price ?? 0);
      if (!Number.isFinite(stock)) return;
      totalOnHand += stock;
      if (Number.isFinite(price)) {
        totalValue += price * stock;
      }
      if (stock <= 0 || !product?.inStock) {
        outOfStock += 1;
      } else if (stock <= lowStockLimit) {
        lowStock += 1;
      }
    });
    const pendingUnits = reorderList.reduce((sum, item) => {
      if (item.status === "pending") {
        const qty = Number(item.reorderQty ?? 0);
        return sum + (Number.isFinite(qty) ? qty : 0);
      }
      return sum;
    }, 0);
    return { totalSkus, totalOnHand, lowStock, outOfStock, totalValue, pendingUnits };
  }, [products, lowStockLimit, reorderList]);

  const lowStockItems = useMemo(() => {
    return filteredInventoryItems.filter((product) => {
      const stock = Number(product?.stockAmount ?? 0);
      return Number.isFinite(stock) && stock <= lowStockLimit;
    });
  }, [filteredInventoryItems, lowStockLimit]);

  const filteredReorderQueue = useMemo(() => {
    if (reorderFilter === "all") return reorderList;
    return reorderList.filter((item) => item.status === reorderFilter);
  }, [reorderList, reorderFilter]);

  const attendanceEligibleUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return list.filter((u) => {
      const role = String(u?.role || "").trim().toLowerCase();
      if (role === "admin") return false;
      if (role.includes("supplier")) return false;
      // Exclude regular users/customers (only show staff/employees)
      if (role === "user" || role === "customer") return false;
      return true;
    });
  }, [users]);

  const attendanceRoleOptions = useMemo(() => {
    const roles = new Set();
    attendanceEligibleUsers.forEach((u) => {
      const role = String(u?.role || "").trim().toLowerCase();
      if (role) roles.add(role);
    });
    return Array.from(roles).sort();
  }, [attendanceEligibleUsers]);

  const filteredAttendanceUsers = useMemo(() => {
    if (attendanceRoleFilter === "all") return attendanceEligibleUsers;
    const target = String(attendanceRoleFilter || "").trim().toLowerCase();
    return attendanceEligibleUsers.filter(
      (u) => String(u?.role || "").trim().toLowerCase() === target
    );
  }, [attendanceEligibleUsers, attendanceRoleFilter]);

  useEffect(() => {
    if (tab !== "attendance") return;
    const nextDrafts = {};
    const nextNotes = {};
    filteredAttendanceUsers.forEach((u) => {
      const record = attendanceRecords[u?._id];
      nextDrafts[u?._id] = record?.status || "present";
      nextNotes[u?._id] = record?.note || "";
    });
    setAttendanceDrafts(nextDrafts);
    setAttendanceNotes(nextNotes);
  }, [attendanceRecords, filteredAttendanceUsers, tab]);

  const attendanceSummary = useMemo(() => {
    const summary = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      total: 0,
    };
    Object.values(attendanceRecords || {}).forEach((record) => {
      if (!record || !record.status) return;
      summary.total += 1;
      const key = String(record.status).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(summary, key)) {
        summary[key] += 1;
      }
    });
    return summary;
  }, [attendanceRecords]);

  const productIndex = useMemo(() => {
    const lookup = {};
    (Array.isArray(products) ? products : []).forEach((product) => {
      const productId = product?._id || product?.id;
      if (productId) {
        lookup[productId] = product;
      }
    });
    return lookup;
  }, [products]);

  const inventoryCategoryOptions = useMemo(() => {
    const categories = new Set();
    (Array.isArray(products) ? products : []).forEach((product) => {
      const category = String(product?.category || "").trim();
      if (category) {
        categories.add(category);
      }
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const inventoryChartProductOptions = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const normalizeCategory = (value) => String(value || "").trim().toLowerCase();
    const target = normalizeCategory(inventoryChartCategory);

    return list
      .filter((product) => {
        if (inventoryChartCategory === "all") return true;
        return normalizeCategory(product?.category) === target;
      })
      .map((product) => {
        const value = normalizeId(product?._id || product?.id);
        return {
          value,
          label: product?.name || value || "Unnamed product",
        };
      })
      .filter((option) => Boolean(option.value))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products, inventoryChartCategory]);

  useEffect(() => {
    if (!inventoryChartProductOptions.length) {
      if (inventoryChartProductId) {
        setInventoryChartProductId('');
      }
      return;
    }
    const exists = inventoryChartProductOptions.some((option) => option.value === inventoryChartProductId);
    if (!exists) {
      setInventoryChartProductId(inventoryChartProductOptions[0].value);
    }
  }, [inventoryChartProductOptions, inventoryChartProductId]);

  const selectedInventoryChartProduct = useMemo(() => {
    if (inventoryChartProductId && productIndex[inventoryChartProductId]) {
      return productIndex[inventoryChartProductId];
    }
    const fallback = inventoryChartProductOptions[0]?.value;
    return fallback ? productIndex[fallback] : null;
  }, [inventoryChartProductId, inventoryChartProductOptions, productIndex]);

  const inventoryLineChart = useMemo(() => {
    const rangeDays = Math.max(1, Number(inventoryChartRange) || 30);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (rangeDays - 1));

    const dayKeys = [];
    for (let i = 0; i < rangeDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }

    const labels = dayKeys.map((key) => {
      const d = new Date(key);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });

    const defaultResult = {
      labels,
      values: new Array(dayKeys.length).fill(0),
      meta: { totalSold: 0, currentStock: 0, startStock: 0, rangeDays },
    };

    const product = selectedInventoryChartProduct;
    if (!product) {
      return defaultResult;
    }

    const productId = normalizeId(product?._id || product?.id);
    const productName = String(product?.name || "").trim().toLowerCase();
    const soldByDay = new Map(dayKeys.map((key) => [key, 0]));

    (Array.isArray(orders) ? orders : []).forEach((order) => {
      if (!order) return;
      const status = String(order?.status || "").trim().toLowerCase();
      if (status && !["confirmed", "delivered"].includes(status)) return;
      const eventDate = new Date(order?.updatedAt || order?.createdAt);
      const time = eventDate.getTime();
      if (!Number.isFinite(time)) return;
      eventDate.setHours(0, 0, 0, 0);
      if (eventDate < start) return;
      const key = eventDate.toISOString().slice(0, 10);
      if (!soldByDay.has(key)) return;

      const items = Array.isArray(order?.items) ? order.items : [];
      items.forEach((item) => {
        const itemId = normalizeId(item?.productId || item?._id || item?.product?._id || item?.sku || item?.id);
        let matches = Boolean(itemId && productId && itemId === productId);
        if (!matches) {
          const itemName = String(item?.productName || item?.name || item?.title || "").trim().toLowerCase();
          if (itemName && productName && itemName === productName) {
            matches = true;
          }
        }
        if (!matches) return;
        const qty = Number(item?.quantity ?? item?.qty ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) return;
        soldByDay.set(key, (soldByDay.get(key) || 0) + qty);
      });
    });

    const dailySold = dayKeys.map((key) => soldByDay.get(key) || 0);
    const totalSold = dailySold.reduce((sum, qty) => sum + qty, 0);
    const currentStock = Number(product?.stockAmount ?? 0) || 0;
    const startStock = Math.max(0, currentStock + totalSold);

    const values = [];
    let running = startStock;
    dailySold.forEach((qty) => {
      running = Math.max(0, running - qty);
      values.push(Number(running.toFixed(2)));
    });

    return {
      labels,
      values,
      meta: {
        totalSold,
        currentStock,
        startStock,
        rangeDays,
      },
    };
  }, [orders, selectedInventoryChartProduct, inventoryChartRange]);

  const reorderSummary = useMemo(() => {
    const summary = {
      pending: 0,
      ordered: 0,
      totalQty: 0,
      estimatedSpend: 0,
    };
    reorderList.forEach((item) => {
      if (!item) return;
      const qty = Number(item.reorderQty ?? 0);
      if (item.status === "ordered") summary.ordered += 1;
      else summary.pending += 1;
      if (Number.isFinite(qty)) {
        summary.totalQty += qty;
        const product = productIndex[item.productId];
        const price = Number(product?.price ?? 0);
        if (Number.isFinite(price)) {
          summary.estimatedSpend += price * qty;
        }
      }
    });
    return summary;
  }, [reorderList, productIndex]);

  const handleStockDraftChange = (productId, field, value) => {
    // Prevent negative values from being entered for numeric stock fields.
    // Allow empty string for user editing, otherwise coerce to non-negative numeric string.
    let nextValue = value;
    if (typeof nextValue === "string") {
      if (nextValue.trim() === "") {
        nextValue = "";
      } else {
        const parsed = Number(nextValue);
        if (Number.isFinite(parsed)) {
          // clamp to 0 or above and keep as string for input value
          nextValue = String(Math.max(0, parsed));
        }
        // if not a finite number, keep the raw string (lets user type intermediate values)
      }
    } else if (typeof nextValue === "number") {
      nextValue = String(Math.max(0, nextValue));
    }

    setStockDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: nextValue,
      },
    }));
  };

  const handleExpiryDraftChange = (productId, field, value) => {
    let nextValue = value;
    if (field === "reminder") {
      if (value === "" || value === null) {
        nextValue = "";
      } else {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
          return;
        }
        nextValue = String(Math.floor(numeric));
      }
    }

    setExpiryDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: nextValue,
      },
    }));
  };

  const handleToggleExpiryTracking = (productId, enabled) => {
    setExpiryDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        track: enabled,
        ...(enabled ? {} : { date: "", reminder: "" }),
      },
    }));
  };

  // Ensure the low-stock threshold cannot be set to a negative value.
  const handleReorderThresholdChange = (value) => {
    if (value === "" || value === null || typeof value === "undefined") {
      setReorderThreshold(0);
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setReorderThreshold(0);
      return;
    }
    // store as a number (integer)
    setReorderThreshold(Math.floor(parsed));
  };

  const buildProductUpdatePayload = (product, overrides = {}) => {
    if (!product) return null;
    const resolvedStockAmount =
      overrides.hasOwnProperty("stockAmount")
        ? overrides.stockAmount
        : product.stockAmount ?? 0;
    const resolvedInStock = overrides.hasOwnProperty("inStock")
      ? overrides.inStock
      : overrides.hasOwnProperty("stockAmount")
      ? Number(resolvedStockAmount) > 0
      : Boolean(product.inStock);

    const expireTrackingEnabled = overrides.hasOwnProperty("expireTrackingEnabled")
      ? overrides.expireTrackingEnabled
      : Boolean(product.expireTrackingEnabled);

    const payload = {
      name: product.name || "",
      price: product.price ?? 0,
      description: product.description || "",
      category: product.category || "",
      brand: product.brand || "",
      inStock: resolvedInStock,
      stockAmount: Number.isFinite(Number(resolvedStockAmount))
        ? Math.max(0, Math.floor(Number(resolvedStockAmount)))
        : 0,
      expireTrackingEnabled,
    };

    if (expireTrackingEnabled) {
      const expiryDateValue = overrides.hasOwnProperty("expiryDate")
        ? overrides.expiryDate
        : product.expiryDate || "";
      const reminderValue = overrides.hasOwnProperty("expiryReminderDays")
        ? overrides.expiryReminderDays
        : product.expiryReminderDays ?? "";

      payload.expiryDate = expiryDateValue || "";
      if (reminderValue === undefined || reminderValue === null || reminderValue === "") {
        payload.expiryReminderDays = "";
      } else {
        const numericReminder = Number(reminderValue);
        if (!Number.isFinite(numericReminder) || numericReminder < 0) {
          return null;
        }
        payload.expiryReminderDays = String(Math.max(0, Math.floor(numericReminder)));
      }
    } else {
      payload.expiryDate = "";
      payload.expiryReminderDays = "";
    }

    return payload;
  };

  const updateProductStock = async (productId, nextStock) => {
    const product = productIndex[productId];
    if (!product) {
      setErr("Product not found");
      return;
    }
    const numeric = Number(nextStock);
    if (!Number.isFinite(numeric) || numeric < 0) {
      setErr("Enter a valid stock amount");
      return;
    }
    const normalizedStock = Math.max(0, Math.floor(numeric));
    const payload = buildProductUpdatePayload(product, {
      inStock: normalizedStock > 0,
      stockAmount: normalizedStock,
    });

    setInventorySavingId(productId);
    setErr("");
    setMsg("");
    try {
      await fetchJSON(`${ORIGIN}/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(payload),
      });

      setProducts((prev) =>
        prev.map((item) =>
          item?._id === productId
            ? { ...item, stockAmount: normalizedStock, inStock: normalizedStock > 0 }
            : item
        )
      );

      setReorderList((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, stockAmount: normalizedStock } : item
        )
      );

      setStockDrafts((prev) => ({
        ...prev,
        [productId]: { set: "", reduce: "" },
      }));

      setMsg(`Stock updated for ${product.name || "product"}`);
    } catch (error) {
      setErr(error.message);
    } finally {
      setInventorySavingId(null);
    }
  };

  const handleApplyExactStock = (productId) => {
    const draft = stockDrafts[productId]?.set;
    if (draft === undefined || draft === "") {
      setErr("Enter a stock amount to apply");
      return;
    }
    updateProductStock(productId, draft);
  };

  const handleReduceStock = (productId) => {
    const product = productIndex[productId];
    if (!product) {
      setErr("Product not found");
      return;
    }
    const draft = stockDrafts[productId]?.reduce;
    if (!draft) {
      setErr("Enter a quantity to reduce");
      return;
    }
    const reduction = Number(draft);
    if (!Number.isFinite(reduction) || reduction <= 0) {
      setErr("Reduction must be greater than zero");
      return;
    }
    const currentStock = Number(product.stockAmount ?? 0);
    const nextStock = Math.max(0, currentStock - reduction);
    updateProductStock(productId, nextStock);
  };

  const handleSaveExpiry = async (productId) => {
    const product = productIndex[productId];
    if (!product) {
      setErr("Product not found");
      return;
    }

    const draft = expiryDrafts[productId] || {};
    const trackingDraft =
      typeof draft.track !== "undefined" ? draft.track : Boolean(product.expireTrackingEnabled);

    const currentDateInput = toDateInputValue(product.expiryDate);
    const dateValue = trackingDraft
      ? typeof draft.date !== "undefined"
        ? draft.date
        : currentDateInput
      : "";

    const reminderValue = trackingDraft
      ? typeof draft.reminder !== "undefined"
        ? draft.reminder
        : product.expiryReminderDays != null
        ? String(product.expiryReminderDays)
        : ""
      : "";

    if (trackingDraft && !dateValue) {
      setErr("Pick an expiry date before saving");
      return;
    }

    if (trackingDraft && dateValue && dateValue < minExpiryDate) {
      setErr("Expiry date cannot be earlier than today");
      return;
    }

    if (trackingDraft && reminderValue !== "") {
      const numericReminder = Number(reminderValue);
      if (!Number.isFinite(numericReminder) || numericReminder < 0) {
        setErr("Reminder days must be zero or greater");
        return;
      }
    }

    const overrides = trackingDraft
      ? {
          expireTrackingEnabled: true,
          expiryDate: dateValue,
          expiryReminderDays:
            reminderValue === "" ? "" : String(Math.max(0, Math.floor(Number(reminderValue)))),
          inStock: Boolean(product.inStock),
          stockAmount: Number(product.stockAmount ?? 0),
        }
      : {
          expireTrackingEnabled: false,
          expiryDate: "",
          expiryReminderDays: "",
          inStock: Boolean(product.inStock),
          stockAmount: Number(product.stockAmount ?? 0),
        };

    const payload = buildProductUpdatePayload(product, overrides);
    if (!payload) {
      setErr("Unable to prepare update payload");
      return;
    }

    setInventorySavingId(productId);
    setErr("");
    setMsg("");
    try {
      const result = await fetchJSON(`${ORIGIN}/products/${productId}`, {
        method: "PUT",
        headers: authHeader,
        body: JSON.stringify(payload),
      });
      const updatedProduct = result?.product || product;

      setProducts((prev) =>
        prev.map((item) => (item?._id === productId ? { ...item, ...updatedProduct } : item))
      );
      setExpiryDrafts((prev) => ({ ...prev, [productId]: {} }));
      setMsg(`Expiry settings updated for ${updatedProduct.name || "product"}`);
    } catch (error) {
      setErr(error.message);
    } finally {
      setInventorySavingId(null);
    }
  };

  const handleAddToReorder = (productId) => {
    const product = productIndex[productId];
    if (!product) {
      setErr("Product not found");
      return;
    }
    const draft = reorderDrafts[productId] || {};
    const qty = Number(draft.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("Enter a reorder quantity greater than zero");
      return;
    }
    const notes = (draft.notes || "").trim();
    const thresholdValue = Number(reorderThreshold);
    const entry = {
      productId,
      name: product.name || "",
      category: product.category || "",
      stockAmount: Number(product.stockAmount ?? 0),
      reorderQty: Math.max(1, Math.floor(qty)),
      threshold: Number.isFinite(thresholdValue) ? thresholdValue : undefined,
      status: "pending",
      notes,
      createdAt: new Date().toISOString(),
      requestedBy: user?.name || user?.email || "Admin",
    };

    setReorderList((prev) => {
      const current = Array.isArray(prev) ? [...prev] : [];
      const index = current.findIndex((item) => item.productId === productId);
      if (index >= 0) {
        current[index] = { ...current[index], ...entry };
      } else {
        current.push(entry);
      }
      return current;
    });

    setReorderDrafts((prev) => ({
      ...prev,
      [productId]: { qty: "", notes: "" },
    }));

    setErr("");
    // Show success message transiently for 2 seconds
    const showTransientMsg = (message, ms = 2000) => {
      // clear any existing timer
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }
      setMsg(message);
      messageTimerRef.current = setTimeout(() => {
        setMsg("");
        messageTimerRef.current = null;
      }, ms);
    };

    showTransientMsg(`Added ${product.name || "item"} to reorder list`, 2000);
  };

  const handleReorderStatusChange = (productId, status) => {
    setReorderList((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, status } : item
      )
    );
  };

  const handleRemoveReorderItem = (productId) => {
    setReorderList((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSendToSupplierCart = async (item) => {
    if (!item?.productId) return;

    const product = productIndex[item.productId] || (Array.isArray(products) ? products.find((p) => p?._id === item.productId) : null);
    const qty = Math.max(1, Number(item.reorderQty ?? 1));

    // 1) Prefer explicit mappings stored on the product
    const mappedSupplierId = product?.supplierId;
    const mappedSupplierProductId = product?.supplierProductId;

    try {
      if (mappedSupplierProductId) {
        // Fetch the exact supplier SKU for accurate price/image and a guaranteed supplierId
        const sp = await fetchJSON(`${ORIGIN}/supplier-products/${mappedSupplierProductId}`, { headers: authHeader });
        const spSupplierId = typeof sp?.supplierId === 'object' ? (sp.supplierId?._id || sp.supplierId?.id) : sp?.supplierId;
        if (sp && spSupplierId) {
          addToCart({
            productId: sp._id,
            name: sp.name || product?.name || item.name,
            price: Number(sp.price ?? product?.price ?? 0) || 0,
            quantity: qty,
            img: sp.imageUrl || product?.imageUrl,
            supplierId: spSupplierId,
            notes: item.notes,
          });
          setErr("");
          setMsg("Item added to supplier cart");
          return;
        }
      }

      if (mappedSupplierId) {
        // We at least know the supplier; use catalog price and image
        addToCart({
          productId: item.productId,
          name: product?.name || item.name,
          price: Number(product?.price ?? 0) || 0,
          quantity: qty,
          img: product?.imageUrl,
          supplierId: typeof mappedSupplierId === 'object' ? (mappedSupplierId?._id || mappedSupplierId?.id) : mappedSupplierId,
          notes: item.notes,
        });
        setErr("");
        setMsg("Item added to supplier cart");
        return;
      }

      // 2) Fallback: try to match supplier product by name if no mapping available
      const targetName = String(product?.name || item?.name || "").trim().toLowerCase();
      const supplierProducts = await fetchJSON(`${ORIGIN}/supplier-products`, { headers: authHeader });
      const list = Array.isArray(supplierProducts) ? supplierProducts : [];
      const exact = list.find((sp) => String(sp?.name || "").trim().toLowerCase() === targetName);
      const fuzzy = exact || list.find((sp) => String(sp?.name || "").trim().toLowerCase().includes(targetName));
      const supplierId = typeof fuzzy?.supplierId === 'object' ? (fuzzy?.supplierId?._id || fuzzy?.supplierId?.id) : fuzzy?.supplierId;

      if (!fuzzy || !supplierId) {
        setErr("Supplier reference missing for this product. Please select a supplier for this product in the admin form first.");
        return;
      }

      addToCart({
        productId: fuzzy._id,
        name: fuzzy.name || item.name,
        price: Number(fuzzy.price ?? product?.price ?? 0) || 0,
        quantity: qty,
        img: fuzzy.imageUrl,
        supplierId,
        notes: item.notes,
      });
      setErr("");
      setMsg("Item added to supplier cart");
    } catch (e) {
      setErr("Unable to prepare supplier cart item. Please try again.");
    }
  };

  const handleAutoQueueLowStock = () => {
    if (!lowStockItems.length) {
      setErr("No low-stock items to queue right now");
      return;
    }
    const timestamp = new Date().toISOString();
    setErr("");
    setMsg("");
    setReorderList((prev) => {
      const next = [...prev];
      const indexer = new Map(next.map((entry, idx) => [entry.productId, idx]));
      lowStockItems.forEach((product) => {
        if (!product?._id) return;
        const currentStock = Number(product.stockAmount ?? 0);
        const suggested = Math.max(1, lowStockLimit > currentStock ? lowStockLimit - currentStock : lowStockLimit || 1);
        const entry = {
          productId: product._id,
          name: product.name || "",
          category: product.category || "",
          stockAmount: currentStock,
          reorderQty: suggested,
          threshold: Number.isFinite(Number(reorderThreshold)) ? Number(reorderThreshold) : undefined,
          status: "pending",
          notes: "Auto generated from low stock threshold",
          createdAt: timestamp,
          requestedBy: user?.name || user?.email || "System",
        };
        if (indexer.has(product._id)) {
          next[indexer.get(product._id)] = {
            ...next[indexer.get(product._id)],
            ...entry,
          };
        } else {
          indexer.set(product._id, next.length);
          next.push(entry);
        }
      });
      return next;
    });
    setMsg("Low-stock items queued for reorder");
  };

  const triggerCsvDownload = (filename, header, rows) => {
    if (typeof window === "undefined") return false;
    if (!Array.isArray(rows) || rows.length === 0) {
      setErr("No data available to export");
      return false;
    }
    try {
      const csvLines = [header, ...rows].map((line) =>
        line
          .map((value) => {
            const cell = value == null ? "" : String(value);
            return `"${cell.replace(/"/g, '""')}"`;
          })
          .join(",")
      );
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("CSV export failed", error);
      setErr("Unable to generate CSV file");
      return false;
    }
  };

  const handleExportStockReport = () => {
    setErr("");
    const header = [
      "Product ID",
      "Name",
      "Category",
      "Brand",
      "In Stock",
      "Current Stock",
      "Unit Price",
      "Stock Value",
      "Updated",
    ];

    const rows = filteredInventoryItems.map((product) => {
      const stock = Number(product?.stockAmount ?? 0);
      const price = Number(product?.price ?? 0);
      const value = Number.isFinite(price) ? price * stock : "";
      return [
        product?._id || product?.id || "",
        product?.name || "",
        product?.category || "",
        product?.brand || "",
        product?.inStock ? "Yes" : "No",
        stock,
        price,
        value,
        product?.updatedAt || product?.createdAt || "",
      ];
    });

    if (triggerCsvDownload(`inventory-stock-${Date.now()}.csv`, header, rows)) {
      setMsg("Stock report downloaded");
    }
  };

  const handleExportStockReportPdf = () => {
    if (typeof window === "undefined") return;
    setErr("");

    if (!Array.isArray(filteredInventoryItems) || filteredInventoryItems.length === 0) {
      setErr("No data available to export");
      return;
    }

    const rowsHtml = filteredInventoryItems
      .map((product) => {
        const stock = Number(product?.stockAmount ?? 0);
        const price = Number(product?.price ?? 0);
        const value = Number.isFinite(price) ? price * stock : 0;
        return `
          <tr>
            <td>${product?._id || product?.id || ""}</td>
            <td>${(product?.name || "").replace(/</g, "&lt;")}</td>
            <td>${(product?.category || "").replace(/</g, "&lt;")}</td>
            <td>${(product?.brand || "").replace(/</g, "&lt;")}</td>
            <td>${product?.inStock ? "Yes" : "No"}</td>
            <td>${stock}</td>
            <td>${Number.isFinite(price) ? price.toFixed(2) : ""}</td>
            <td>${Number.isFinite(value) ? value.toFixed(2) : ""}</td>
            <!--<td>${product?.updatedAt || product?.createdAt || ""}</td>-->
          </tr>
        `;
      })
      .join("");

    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      setErr("Please allow pop-ups to generate the PDF report");
      return;
    }

    popup.document.write(`<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Inventory Stock Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 16px; font-size: 22px; }
            table { border-collapse: collapse; width: 100%; font-size: 13px; }
            th, td { border: 1px solid #cbd5f5; padding: 8px 10px; text-align: left; }
            th { background: #e0e7ff; }
            tfoot td { font-weight: bold; }
            .meta { margin-bottom: 12px; color: #475569; font-size: 13px; }
            @media print {
              body { padding: 0 12px; }
            }
          </style>
        </head>
        <body>
          <h1>Inventory Stock Report</h1>
          <div class="meta">Generated at: ${new Date().toLocaleString()} &middot; Total products: ${filteredInventoryItems.length}</div>
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>In Stock</th>
                <th>Current Stock</th>
                <th>Unit Price</th>
                <th>Stock Value</th>
                <th>Updated</th>
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

  const buildReorderReportData = () => {
    const note = (reorderNotes || "").trim();
    const columns = [
      "Product ID",
      "Name",
      "Category",
      "Current Stock",
      "Reorder Qty",
      "Status",
      "Unit Price",
      "Estimated Total",
      "Item Notes",
      "Report Notes",
      "Created At",
      "Requested By",
    ];

    const dataset = filteredReorderQueue.map((item) => {
      const product = productIndex[item.productId];
      const price = Number(product?.price ?? 0);
      const qty = Number(item.reorderQty ?? 0);
      const hasPrice = Number.isFinite(price);
      const hasQty = Number.isFinite(qty);
      const total = hasPrice && hasQty ? price * qty : null;
      return {
        productId: item.productId,
        name: item.name,
        category: item.category,
        stockAmount: item.stockAmount,
        reorderQty: hasQty ? qty : "",
        reorderQtyValue: hasQty ? qty : 0,
        status: item.status,
        unitPrice: hasPrice ? price : "",
        unitPriceValue: hasPrice ? price : 0,
        estimatedTotal: Number.isFinite(total) ? total : "",
        estimatedTotalValue: Number.isFinite(total) ? total : 0,
        itemNotes: item.notes || "",
        reportNotes: note,
        createdAt: item.createdAt,
        requestedBy: item.requestedBy || "",
      };
    });

    const rows = dataset.map((entry) => [
      entry.productId,
      entry.name,
      entry.category,
      entry.stockAmount,
      entry.reorderQty,
      entry.status,
      entry.unitPrice,
      entry.estimatedTotal,
      entry.itemNotes,
      entry.reportNotes,
      entry.createdAt,
      entry.requestedBy,
    ]);

    const totalQuantity = dataset.reduce((sum, entry) => sum + Number(entry.reorderQtyValue || 0), 0);
    const totalEstimated = dataset.reduce((sum, entry) => sum + Number(entry.estimatedTotalValue || 0), 0);

    return { columns, rows, dataset, note, totalQuantity, totalEstimated };
  };

  const handleExportReorderReport = () => {
    setErr("");
    const { columns, rows, dataset } = buildReorderReportData();
    if (!dataset.length) {
      setErr("No data available to export");
      return;
    }

    if (triggerCsvDownload(`reorder-report-${Date.now()}.csv`, columns, rows)) {
      setMsg("Reorder report downloaded");
    }
  };

  const handleExportReorderReportPdf = () => {
    setErr("");
    try {
      const { columns, dataset, note, totalQuantity, totalEstimated } = buildReorderReportData();
      if (!dataset.length) {
        setErr("No data available to export");
        return;
      }

      const doc = new jsPDF("landscape", "pt", "a4");
      const generatedAt = new Date();

      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text("Reorder Report", 40, 40);

      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      doc.text(`Generated: ${generatedAt.toLocaleString()}`, 40, 60);
      doc.text(`Items in queue: ${dataset.length}`, 40, 75);
      doc.text(`Total units requested: ${totalQuantity}`, 40, 90);
      doc.text(`Estimated spend: ${formatCurrency(totalEstimated)}`, 40, 105);
      doc.text(`Report notes: ${note || "None"}`, 40, 120, { maxWidth: 500 });

      const tableBody = dataset.map((entry) => [
        entry.productId,
        entry.name,
        entry.category,
        entry.stockAmount,
        entry.reorderQty === "" ? "" : entry.reorderQty,
        entry.status,
        entry.unitPrice === "" ? "" : formatCurrency(entry.unitPrice),
        entry.estimatedTotal === "" ? "" : formatCurrency(entry.estimatedTotal),
        entry.itemNotes,
        entry.reportNotes,
        entry.createdAt ? formatDateTime(entry.createdAt) : "—",
        entry.requestedBy,
      ]);

      autoTable(doc, {
        startY: 150,
        head: [columns],
        body: tableBody,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 40, right: 40 },
      });

      doc.save(`reorder-report-${Date.now()}.pdf`);
      setMsg("Reorder report PDF downloaded");
    } catch (error) {
      console.error("Failed to export reorder report PDF", error);
      setErr(error.message || "Failed to export reorder report PDF");
    }
  };

  const customerOrderStats = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const total = list.reduce((sum, order) => sum + Number(order?.totalAmount ?? 0), 0);
    const pending = list.filter(
      (order) => (order?.status || "").toLowerCase() === "pending"
    ).length;
    return { count: list.length, total, pending };
  }, [orders]);

  const supplierOrderStats = useMemo(() => {
    const list = Array.isArray(adminOrders) ? adminOrders : [];
    const total = list.reduce((sum, order) => sum + Number(order?.totalCost ?? 0), 0);
    const pending = list.filter(
      (order) => (order?.status || "").toLowerCase() === "pending"
    ).length;
    return { count: list.length, total, pending };
  }, [adminOrders]);

  const cancelledOrderStats = useMemo(() => {
    return { count: filteredCancelledOrders.length };
  }, [filteredCancelledOrders]);

  const adminCancelledOrderStats = useMemo(() => {
    const list = Array.isArray(adminCancelledOrders) ? adminCancelledOrders : [];
    const latestTs = list.reduce((latest, order) => {
      const ts = toTimestamp(order?.cancelledAt || order?.updatedAt || order?.createdAt);
      return ts > latest ? ts : latest;
    }, 0);
    return {
      count: list.length,
      latestCancelledAt: latestTs ? new Date(latestTs) : null,
    };
  }, [adminCancelledOrders]);

  const financeQuickLinks = useMemo(
    () => [
      {
        id: "online",
        title: "Online payments",
        description: "Stripe checkouts and card transactions completed by customers.",
        icon: "💳",
      },
      {
        id: "suppliers",
        title: "Supplier orders",
        description: "Supplier payout requests with uploaded payment slips.",
        icon: "🧾",
      },
      {
        id: "declined",
        title: "Declined slips",
        description: "Rejected supplier submissions awaiting follow-up.",
        icon: "⛔",
      },
      {
        id: "notifications",
        title: "Finance notifications",
        description: "Alerts for approvals, reminders, and payment status changes.",
        icon: "🔔",
      },
      {
        id: "attendance",
        title: "Attendance & payroll",
        description: "Attendance summary with live salary projections for staff.",
        icon: "🗂️",
      },
    ],
    []
  );

  const handleFinanceQuickOpen = useCallback((viewId) => {
    setFinanceView(viewId);
    setFinanceConsoleKey((prev) => prev + 1);
  }, []);

  const [activeOrderPanel, setActiveOrderPanel] = useState(null);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("Admin decision");
  const [updatingCustomerOrderId, setUpdatingCustomerOrderId] = useState(null);
  const [showEditSupplierOrderModal, setShowEditSupplierOrderModal] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [supplierOrderForm, setSupplierOrderForm] = useState({ status: "Pending", notes: "" });
  const [showDeleteSupplierOrderModal, setShowDeleteSupplierOrderModal] = useState(false);
  const [orderPendingDelete, setOrderPendingDelete] = useState(null);

  useEffect(() => {
    if (activeOrderPanel === "customers") {
      loadOrders();
    }
    if (activeOrderPanel === "suppliers") {
      loadAdminOrders();
    }
    if (activeOrderPanel === "cancelled") {
      loadCancelledOrders();
    }
    if (activeOrderPanel === "adminCancelled") {
      loadAdminCancelledOrders();
    }
  }, [activeOrderPanel, loadOrders, loadAdminOrders, loadCancelledOrders, loadAdminCancelledOrders]);

  const toggleOrderPanel = (panel) => {
    const next = activeOrderPanel === panel ? null : panel;
    if (next === panel) {
      if (panel === "customers") setCustomerOrderQuery("");
      if (panel === "suppliers") setAdminOrderQuery("");
      if (panel === "cancelled") setCancelledOrderQuery("");
      if (panel === "adminCancelled") setAdminCancelledOrderQuery("");
    }
    setActiveOrderPanel(next);
  };

  const handleCancelCustomerOrderClick = (order) => {
    setOrderToCancel(order);
    setCancelReason(order?.cancelReason || "Admin decision");
    setShowCancelOrderModal(true);
  };

  const closeCancelOrderModal = () => {
    setShowCancelOrderModal(false);
    setOrderToCancel(null);
    setCancelReason("Admin decision");
  };

  const submitCancelCustomerOrder = async (event) => {
    event.preventDefault();
    if (!orderToCancel) return;
    try {
      await fetchJSON(`${API}/orders/cancel/${orderToCancel._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ cancelReason: cancelReason?.trim() || "Admin decision" }),
      });
      setMsg("Order cancelled successfully");
      closeCancelOrderModal();
      await loadOrders({ suppressError: true });
      await loadCancelledOrders({ suppressError: true });
    } catch (error) {
      setErr(error.message);
    }
  };

  const handleUpdateCustomerOrderStatus = async (orderId, nextStatus) => {
    if (!orderId || !nextStatus) return;
    setErr("");
    setMsg("");
    setUpdatingCustomerOrderId(orderId);
    try {
      await fetchJSON(`${API}/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ status: nextStatus }),
      });
      setMsg(`Order marked as ${nextStatus}`);
      await loadOrders({ suppressError: true });
    } catch (error) {
      setErr(error.message);
    } finally {
      setUpdatingCustomerOrderId(null);
    }
  };

  const handleViewReceipt = (order, overrideUrl) => {
    const url = overrideUrl || order?.paymentInfo?.receiptUrl;
    if (!url || typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openEditSupplierOrderModal = (order) => {
    if (!order?._id) return;
    const statusLower = String(order?.status || "").toLowerCase();
    if (statusLower !== "pending") return;
    navigate(`/AdminUpdateOrder/${order._id}`);
  };

  const closeEditSupplierOrderModal = () => {
    setShowEditSupplierOrderModal(false);
    setOrderToEdit(null);
    setSupplierOrderForm({ status: "Pending", notes: "" });
  };

  const updateSupplierOrder = async (event) => {
    event.preventDefault();
    if (!orderToEdit) return;
    try {
      await fetchJSON(`${API}/admin-orders/${orderToEdit._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          status: supplierOrderForm.status,
          notes: supplierOrderForm.notes,
        }),
      });
      setMsg("Supplier order updated");
      closeEditSupplierOrderModal();
      await loadAdminOrders({ suppressError: true });
    } catch (error) {
      setErr(error.message);
    }
  };

  const openDeleteSupplierOrderModal = (order) => {
    setOrderPendingDelete(order);
    setShowDeleteSupplierOrderModal(true);
  };

  const closeDeleteSupplierOrderModal = () => {
    setShowDeleteSupplierOrderModal(false);
    setOrderPendingDelete(null);
  };

  const deleteSupplierOrder = async () => {
    if (!orderPendingDelete) return;
    try {
      await fetchJSON(`${API}/admin-orders/${orderPendingDelete._id}`, {
        method: "DELETE",
        headers: { ...authHeader },
      });
      setMsg("Supplier order removed");
      closeDeleteSupplierOrderModal();
      await loadAdminOrders({ suppressError: true });
    } catch (error) {
      setErr(error.message);
    }
  };

  const [showSupplierProducts, setShowSupplierProducts] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const emptyProductForm = useMemo(
    () => ({
      _id: "",
      name: "",
      price: "",
      description: "",
      category: "",
      brand: "",
      inStock: false,
      stockAmount: "",
      imageUrl: "",
    }),
    []
  );
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productImageFile, setProductImageFile] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productMode, setProductMode] = useState("create");
  const [productBusy, setProductBusy] = useState(false);

  
  const savePassword = async (e) => { // Change password
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!pwd.current) return setErr("Current password is required");
    if (!pwd.next || pwd.next.length < 6)
      return setErr("New password must be at least 6 characters");
    if (pwd.next !== pwd.confirm) return setErr("Passwords do not match");

    setChangingPwd(true);
    try {
      await changePassword(pwd.current, pwd.next);
      setMsg("Password changed");
      setPwd({ current: "", next: "", confirm: "" });
      setShowPwd({ current: false, next: false, confirm: false });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setChangingPwd(false);
    }
  };

  const loadAttendanceForDate = useCallback(
    async (dateValue) => {
      const targetDate = dateValue || attendanceDate;
      if (!token || !targetDate) return;
      setAttendanceLoading(true);
      setAttendanceErr("");
      try {
        const data = await fetchJSON(
          `${API}/attendance?date=${encodeURIComponent(targetDate)}`,
          { headers: { ...authHeader } }
        );
        const records = Array.isArray(data?.records) ? data.records : [];
        const next = {};
        records.forEach((record) => {
          const userId = record?.user?._id || record?.user;
          if (!userId) return;
          next[userId] = {
            status: record?.status || "present",
            note: record?.note || "",
            updatedAt: record?.updatedAt || record?.updated_at || null,
            recordedBy: record?.recordedBy || null,
          };
        });
        setAttendanceRecords(next);
      } catch (error) {
        setAttendanceErr(error.message || "Failed to load attendance");
        setAttendanceRecords({});
      } finally {
        setAttendanceLoading(false);
      }
    },
    [attendanceDate, authHeader, token]
  );

  useEffect(() => {
    if (tab !== "attendance") return;
    if (!token) return;
    loadUsers({ suppressError: true });
    loadAttendanceForDate(attendanceDate);
  }, [tab, token, attendanceDate, loadAttendanceForDate, loadUsers]);

  const handleAttendanceDateChange = (event) => {
    setAttendanceMsg("");
    setAttendanceErr("");
    setAttendanceReportErr("");
    setAttendanceDate(event.target.value);
  };

  const handleAttendanceStatusChange = (userId, nextStatus) => {
    setAttendanceMsg("");
    setAttendanceErr("");
    setAttendanceDrafts((prev) => ({ ...prev, [userId]: nextStatus }));
  };

  const handleAttendanceNoteChange = (userId, nextNote) => {
    setAttendanceMsg("");
    setAttendanceErr("");
    setAttendanceNotes((prev) => ({ ...prev, [userId]: nextNote }));
  };

  const handleExportAttendanceReport = useCallback(async () => {
    if (!token) return;
    setAttendanceMsg("");
    setAttendanceReportErr("");
    setAttendanceReportLoading(true);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (attendanceDate) {
        params.set("from", attendanceDate);
        params.set("to", attendanceDate);
      }
      const response = await fetch(`${API}/attendance/report?${params.toString()}`, {
        headers: { ...authHeader },
      });
      if (!response.ok) {
        const fallback = await response.text();
        throw new Error(fallback || "Failed to export attendance report");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = attendanceDate || new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `attendance-report-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setAttendanceMsg("Attendance report downloaded.");
    } catch (error) {
      setAttendanceReportErr(error.message || "Failed to export attendance report");
    } finally {
      setAttendanceReportLoading(false);
    }
  }, [attendanceDate, authHeader, token]);

  const saveAttendanceForUser = useCallback(
    async (userId) => {
      if (!userId || !token) return;
      const status = attendanceDrafts[userId] || "present";
      const note = attendanceNotes[userId] || "";
      setAttendanceSaving((prev) => ({ ...prev, [userId]: true }));
      setAttendanceErr("");
      setAttendanceMsg("");
      try {
        const response = await fetchJSON(`${API}/attendance`, {
          method: "POST",
          headers: { ...authHeader },
          body: JSON.stringify({
            userId,
            date: attendanceDate,
            status,
            note,
          }),
        });

        const record = response?.record || null;
        setAttendanceRecords((prev) => ({
          ...prev,
          [userId]: {
            status,
            note,
            updatedAt: record?.updatedAt || new Date().toISOString(),
            recordedBy: record?.recordedBy || null,
          },
        }));

        const employee = users.find((u) => u?._id === userId);
        const statusMeta = getAttendanceStatusMeta(status);
        setAttendanceMsg(
          `Marked ${employee?.name || "employee"} as ${statusMeta.label} for ${attendanceDate}.`
        );
      } catch (error) {
        setAttendanceErr(error.message || "Failed to save attendance");
      } finally {
        setAttendanceSaving((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [attendanceDate, attendanceDrafts, attendanceNotes, authHeader, token, users]
  );

  const handleAttendanceRefresh = () => {
    setAttendanceReportErr("");
    loadAttendanceForDate(attendanceDate);
  };

  const handleUserReportFilterChange = (event) => {
    const { name, value } = event.target;
    setUserReportErr("");
    setUserReportFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleExportUserReport = useCallback(async () => {
    if (!token) return;
    setUserReportErr("");
    setMsg("");
    setUserReportLoading(true);
    try {
      const params = new URLSearchParams({ format: "csv", activityLimit: "5" });
      if (userReportFilters.from) params.set("from", userReportFilters.from);
      if (userReportFilters.to) params.set("to", userReportFilters.to);
      const response = await fetch(`${API}/users/report?${params.toString()}`, {
        headers: { ...authHeader },
      });
      if (!response.ok) {
        const fallback = await response.text();
        throw new Error(fallback || "Failed to export user report");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      link.download = `user-report-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMsg("User report downloaded.");
    } catch (error) {
      setUserReportErr(error.message || "Failed to export user report");
    } finally {
      setUserReportLoading(false);
    }
  }, [authHeader, token, userReportFilters.from, userReportFilters.to]);

  // ---------------- Users: CRUD ----------------
  const emptyUser = useMemo(
    () => ({ _id: "", name: "", email: "", password: "", age: "", address: "", role: "user" }), // Empty user form
    []
  );
  // Form state
  const [userForm, setUserForm] = useState(emptyUser); // Current user form data
  const [userMode, setUserMode] = useState("create"); // create | edit
  const [userBusy, setUserBusy] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  // Open create or edit user modal
  const openCreateUser = () => {
    setUserForm(emptyUser);
    setUserMode("create");
    setShowUserForm(true);
    setMsg("");
    setErr("");
  };

  // Open edit user modal and populate form
  const openEditUser = (u) => {
    setUserForm({
      _id: u._id,
      name: u.name || "",
      email: u.email || "",
      password: "",
      age: u.age ?? "",
      address: u.address || "",
      role: u.role || "user",
    });
    setUserMode("edit");
    setShowUserForm(true);
    setMsg("");
    setErr("");
  };

  // Submit user create or update
  const submitUser = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!userForm.name || !userForm.email) return setErr("Name and email are required."); // Validate required fields
    try {
      setUserBusy(true);
      if (userMode === "create") {
        const payload = {
          ...userForm,
          role: userForm.role ? userForm.role.toLowerCase() : "user", // Default role to 'user'
          password: userForm.password || "changeme123", // Default password if not provided
        };
        const res = await fetch(`${API}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Create failed");
        setMsg("User created");
      } else {
        const payload = {
          name: userForm.name, 
          email: userForm.email, 
          age: userForm.age ? Number(userForm.age) : undefined,
          address: userForm.address || undefined, 
          role: userForm.role ? userForm.role.toLowerCase() : "user", // Default role to 'user'
        };
        const res = await fetch(`${API}/users/${userForm._id}`, {  
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Update failed");
        setMsg("User updated");
      }
      setShowUserForm(false);
      await loadUsers();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUserBusy(false);
    }
  };

  // Delete user
  const removeUser = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`${API}/users/${u._id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Delete failed");
      setMsg("User deleted");
      await loadUsers();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  // ---------------- Roles: CRUD ----------------
  const emptyRole = useMemo(() => ({ _id: "", name: "", description: "", privileges: [] }), []);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [roleMode, setRoleMode] = useState("create"); // create | edit
  const [roleBusy, setRoleBusy] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);

  // Track if any modal is open for body scroll lock
  const anyModalOpen = useMemo(
    () =>
      showCancelOrderModal ||
      showEditSupplierOrderModal ||
      showDeleteSupplierOrderModal ||
      showProductForm ||
      showUserForm ||
      showRoleForm,
    [
      showCancelOrderModal,
      showEditSupplierOrderModal,
      showDeleteSupplierOrderModal,
      showProductForm,
      showUserForm,
      showRoleForm,
    ]
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const { body, documentElement } = document;
    if (!body || !documentElement) {
      return undefined;
    }

    if (anyModalOpen) {
      body.classList.add("modal-open");
      documentElement.classList.add("modal-open");
    } else {
      body.classList.remove("modal-open");
      documentElement.classList.remove("modal-open");
    }

    return () => {
      body.classList.remove("modal-open");
      documentElement.classList.remove("modal-open");
    };
  }, [anyModalOpen]);

  // Open create or edit role modal
  const openCreateRole = () => {
    setRoleForm(emptyRole);
    setRoleMode("create");
    setShowRoleForm(true);
    setMsg("");
    setErr("");
  };

  // Open edit role modal and populate form
  const openEditRole = (r) => {
    setRoleForm({
      _id: r._id,
      name: r.name || "",
      description: r.description || "",
      privileges: Array.isArray(r.privileges) ? r.privileges : [],
    });
    setRoleMode("edit");
    setShowRoleForm(true);
    setMsg("");
    setErr("");
  };

  // Submit role create or update
  const submitRole = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!roleForm.name) return setErr("Role name is required."); // Validate required fields
    try {
      setRoleBusy(true); // Set busy state
      if (roleMode === "create") {
        const res = await fetch(`${API}/roles`, {
          method: "POST", // Create new role
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(roleForm),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Create role failed");
        setMsg("Role created");
      } else {
        // Update existing role
        const res = await fetch(`${API}/roles/${roleForm._id}`, { 
          method: "PUT", // Update role
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(roleForm),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Update role failed");
        setMsg("Role updated");
      }
      setShowRoleForm(false);
      await loadRoles();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setRoleBusy(false);
    }
  };

  // Delete role
  const removeRole = async (r) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    setErr("");
    setMsg("");
    try {
      // Delete role by ID
      const res = await fetch(`${API}/roles/${r._id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Delete role failed");
      setMsg("Role deleted");
      await loadRoles();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!product?._id) return;
    if (!window.confirm(`Delete product "${product.name || "this item"}"?`)) return;
    setErr("");
    setMsg("");
    setDeletingProductId(product._id);
    try {
      const res = await fetch(`${ORIGIN}/products/${product._id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete product");
      }
      setMsg("Product deleted");
      await loadProducts({ suppressError: true });
    } catch (error) {
      setErr(error.message);
    } finally {
      setDeletingProductId(null);
    }
  };

  const openCreateProduct = () => {
    setMsg("");
    setErr("");
    setShowProductForm(false);
    setProductMode("create");
    setProductForm(emptyProductForm);
    setProductImageFile(null);
    navigate("/add-product");
  };

  const openEditProduct = (product) => {
    if (!product?._id) {
      setErr("Unable to locate this product. Please refresh and try again.");
      return;
    }
    setMsg("");
    setErr("");
    setShowProductForm(false);
    setProductMode("edit");
    setProductForm(emptyProductForm);
    setProductImageFile(null);
    navigate(`/update-product/${product._id}`);
  };

  const closeProductForm = () => {
    if (productBusy) return;
    setShowProductForm(false);
    setProductMode("create");
    setProductForm(emptyProductForm);
    setProductImageFile(null);
  };

  const handleProductInputChange = (field, value) => {
    setProductForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = productForm.name.trim();
    const trimmedDescription = productForm.description.trim();
    const trimmedCategory = productForm.category.trim();
    const trimmedBrand = productForm.brand.trim();
    const priceValue = Number(productForm.price);
    const stockValue = Number(productForm.stockAmount || 0);
    const isCreate = productMode === "create";

    setMsg("");
    setErr("");

    if (!trimmedName) return setErr("Product name is required");
    if (!Number.isFinite(priceValue) || priceValue <= 0) return setErr("Enter a valid price");
    if (!trimmedDescription) return setErr("Description is required");
    if (!trimmedCategory) return setErr("Category is required");
    if (!trimmedBrand) return setErr("Brand is required");
    if (productForm.inStock && (!Number.isFinite(stockValue) || stockValue < 0)) {
      return setErr("Enter a valid stock amount");
    }
    if (isCreate && !productImageFile) {
      return setErr("Please select a product image");
    }

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("price", String(priceValue));
    formData.append("description", trimmedDescription);
    formData.append("category", trimmedCategory);
    formData.append("brand", trimmedBrand);
    formData.append("inStock", productForm.inStock ? "true" : "");
    formData.append("stockAmount", productForm.inStock ? String(stockValue || 0) : "0");
    if (productImageFile) {
      formData.append("image", productImageFile);
    }

    const endpoint = isCreate
      ? `${ORIGIN}/products`
      : `${ORIGIN}/products/${productForm._id}`;
    const method = isCreate ? "POST" : "PUT";

    setProductBusy(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: authHeader,
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || (isCreate ? "Failed to add product" : "Failed to update product"));
      }
      setMsg(isCreate ? "Product created" : "Product updated");
      setShowProductForm(false);
      setProductMode("create");
      setProductForm(emptyProductForm);
      setProductImageFile(null);
      await loadProducts({ suppressError: true });
    } catch (error) {
      setErr(error.message);
    } finally {
      setProductBusy(false);
    }
  };

  // ---------------- Sales / Finance ----------------

  // ---------------- Logout ----------------
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const activeTitle =
    tab === "dashboard"
      ? "Admin Dashboard"
      : tab === "profile"
      ? "Profile"
      : tab === "inventory"
      ? "Inventory"
      : tab === "users"
      ? "Users"
      : tab === "roles"
      ? "Roles & privileges"
      : tab === "attendance"
      ? "Attendance"
      : tab === "product"
      ? "Product Management"
      : tab === "order"
      ? "Order Management"
      : tab === "feedback"
      ? "Feedback & Reviews"
  : tab === "refunds"
  ? "Refunds & returns"
      : tab === "suppliers"
      ? "Suppliers"
      : tab === "sales"
      ? "Sales"
      : tab === "finance"
      ? "Finance"
      : "Settings";

  const inventoryChartProductValue = inventoryChartProductId || (inventoryChartProductOptions[0]?.value ?? "");
  const inventoryLineMeta =
    inventoryLineChart.meta || {
      totalSold: 0,
      currentStock: 0,
      startStock: 0,
      rangeDays: Math.max(1, Number(inventoryChartRange) || 30),
    };
  const inventoryLineRangeLabel = Math.max(1, Number(inventoryLineMeta?.rangeDays || inventoryChartRange || 30));

  // ---------------- Render ----------------
  return (
    <div className="dashboard-shell dashboard-shell--two-column admin-dashboard">
      {/* Sidebar */}
      <aside className="card dashboard-sidebar">
        <div className="sidebar-profile">
          {user?.avatar ? (
            <img alt="avatar" src={user.avatar} className="avatar avatar--md" />
          ) : (
            <div className="avatar avatar--md avatar--fallback">{initials}</div>
          )}
          <div className="sidebar-profile__meta">
            <div className="font-semibold">{user?.name || "Admin"}</div>
            <div className="text-xs text-muted">{user?.email}</div>
          </div>
        </div>

        <nav className="dashboard-nav stack-sm">
          <button
            type="button"
            onClick={() => setTabAndHash("dashboard")}
            className={`sidebar-link ${tab === "dashboard" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">📊</span>
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("profile")}
            className={`sidebar-link ${tab === "profile" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">👤</span>
            <span>Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("attendance")}
            className={`sidebar-link ${tab === "attendance" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">🗓️</span>
            <span>Attendance</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("users")}
            className={`sidebar-link ${tab === "users" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">👥</span>
            <span>User management</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("roles")}
            className={`sidebar-link ${tab === "roles" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">🛡️</span>
            <span>Roles &amp; privileges</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("product")}
            className={`sidebar-link ${tab === "product" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">📦</span>
            <span>Product management</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("inventory")}
            className={`sidebar-link ${tab === "inventory" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">📊</span>
            <span>Inventory</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("order")}
            className={`sidebar-link ${tab === "order" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">🧾</span>
            <span>Order management</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("feedback")}
            className={`sidebar-link ${tab === "feedback" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">💬</span>
            <span>Feedback &amp; reviews</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("refunds")}
            className={`sidebar-link ${tab === "refunds" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">↩️</span>
            <span>Refunds &amp; returns</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAndHash("notifications")}
            className={`sidebar-link ${tab === "notifications" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">🔔</span>
            <span>Notifications</span>
          </button>

          <div className="nav-divider" role="separator" />

          <section className="nav-section stack-xs">
            <span className="nav-section__label">Operations</span>
            <button
              type="button"
              onClick={() => setTabAndHash("suppliers")}
              className={`sidebar-link ${tab === "suppliers" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">🤝</span>
              <span>Suppliers</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAndHash("sales")}
              className={`sidebar-link ${tab === "sales" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">🛒</span>
              <span>Sales</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAndHash("finance")}
              className={`sidebar-link ${tab === "finance" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">💳</span>
              <span>Finance</span>
            </button>
          </section>
          <button
            type="button"
            onClick={() => setTabAndHash("settings")}
            className={`sidebar-link ${tab === "settings" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} type="button" className="btn btn-danger w-full">
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <section className="dashboard-main stack-lg">
        <header className="card dashboard-header">
          <div className="dashboard-header__title stack-xs">
            <span className="eyebrow">Control center</span>
            <h2 className="heading-lg">{activeTitle}</h2>
            <p className="muted-text text-sm">
              Monitor operations, approve requests, and keep your store running smoothly.
            </p>
          </div>
          <div className="dashboard-header__actions">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
                {theme === "dark" ? "Switch to light" : "Switch to dark"}
              </button>
              {/* Cart button that opens Admin supplier cart when user is admin */}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/AdminCart')}
                title="Open supplier cart"
                style={{ position: 'relative', padding: '8px 10px' }}
              >
                <span aria-hidden style={{ fontSize: 18 }}>🛒</span>
                {Array.isArray(cartItems) && cartItems.length > 0 && (
                  <span
                    className="badge"
                    style={{ position: 'absolute', top: 0, right: 0, transform: 'translate(40%, -40%)' }}
                  >
                    {cartItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {msg && <div className="status-banner status-banner--success">{msg}</div>}
        {err && <div className="status-banner status-banner--error">{err}</div>}

        {/* DASHBOARD quick tiles */}
        {tab === "dashboard" && (
          <>
            <section className="metrics-grid">
              {[
                {
                  label: "User Accounts",
                  value: loadingUsers ? "…" : users.length.toLocaleString(),
                  sub: loadingUsers ? "Syncing" : "Total registered",
                },
                {
                  label: "Products",
                  value: loadingProducts ? "…" : products.length.toLocaleString(),
                  sub: loadingProducts ? "Fetching" : "Active catalog",
                },
                {
                  label: "Orders",
                  value: loadingOrders ? "…" : orders.length.toLocaleString(),
                  sub: loadingOrders ? "Fetching" : "All time",
                },
                {
                  label: "Roles",
                  value: loadingRoles ? "…" : roles.length.toLocaleString(),
                  sub: loadingRoles ? "Syncing" : "Configured roles",
                },
              ].map((k, i) => (
                <div className="card metric-card" key={i}>
                  <div className="muted-heading">{k.label}</div>
                  <div className="metric-card__value">{k.value}</div>
                  <div className="muted-text">{k.sub}</div>
                </div>
              ))}
            </section>

            <section className="card growth-card" aria-labelledby="user-growth-heading">
              <div className="growth-card__header">
                <div>
                  <h3 id="user-growth-heading">User account growth</h3>
                  <p className="muted-text text-sm">
                    Cumulative sign-ups over the last six months.
                  </p>
                </div>
                <div className="growth-card__headline">
                  <span className="growth-card__headline-value">{userGrowthTotalDisplay}</span>
                  <span className="growth-card__headline-label">Total accounts</span>
                </div>
              </div>

              <div className="growth-card__chart">
                {loadingUsers ? (
                  <div className="growth-card__placeholder">Loading growth data…</div>
                ) : userGrowth.hasData ? (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Line chart showing cumulative user accounts for the last six months"
                  >
                    <defs>
                      <linearGradient id={userGrowthGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={
                        userGrowth.area ||
                        `M 0 ${userGrowthBaseline.toFixed(3)} L 100 ${userGrowthBaseline.toFixed(3)} L 100 ${userGrowthBaseline.toFixed(3)} Z`
                      }
                      fill={`url(#${userGrowthGradientId})`}
                    />
                    <path
                      d={
                        userGrowth.path ||
                        `M 0 ${userGrowthBaseline.toFixed(3)} L 100 ${userGrowthBaseline.toFixed(3)}`
                      }
                      className="growth-card__line"
                    />
                    {userGrowth.points.map((point) => (
                      <circle
                        key={`${point.year}-${point.label}`}
                        className="growth-card__dot"
                        cx={point.x}
                        cy={point.y}
                        r={1.6}
                      >
                        <title>
                          {`${point.label} ${point.year}: ${point.count.toLocaleString()} total (${point.newCount.toLocaleString()} new)`}
                        </title>
                      </circle>
                    ))}
                  </svg>
                ) : (
                  <div className="growth-card__placeholder">
                    User growth data will appear once new accounts start signing up.
                  </div>
                )}
              </div>

              {userGrowthHasData && (
                <div className="growth-card__axis" aria-hidden="true">
                  {userGrowth.points.map((point) => (
                    <span key={`${point.year}-${point.label}`}>{point.label}</span>
                  ))}
                </div>
              )}

              <footer className="growth-card__footer">
                {loadingUsers ? (
                  <span className="muted-text text-sm">Syncing user statistics…</span>
                ) : !userGrowth.hasData ? (
                  <span className="muted-text text-sm">
                    Once new users join, you&apos;ll see month-over-month growth insights here.
                  </span>
                ) : (
                  <>
                    <div className="growth-card__stat-block">
                      <span
                        className={`growth-card__badge ${
                          userGrowth.delta >= 0 ? "is-up" : "is-down"
                        }`}
                      >
                        {userGrowthDeltaDisplay}
                      </span>
                      <span className="growth-card__stat-label">New accounts this month</span>
                    </div>
                    <div className="growth-card__stat-block">
                      <span className="growth-card__trend">{userGrowthPercentDisplay}</span>
                      <span className="growth-card__stat-label">vs previous month</span>
                    </div>
                    {userGrowthPeakDeltaDisplay && (
                      <div className="growth-card__stat-block">
                        <span className="growth-card__peak">
                          Peak month: {userGrowthPeakLabel} ({userGrowthPeakDeltaDisplay} new)
                        </span>
                      </div>
                    )}
                  </>
                )}
              </footer>
            </section>
          </>
        )}

        {/* NOTIFICATIONS */}
        {tab === "notifications" && (
          <div className="stack-lg">
            <section className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
              <div className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Inventory notifications</h3>
                  <p className="muted-text text-sm">Low stock alerts generated from the current inventory.</p>
                </div>

                <div className="table-scroller">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current stock</th>
                        <th>Threshold</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(lowStockItems) && lowStockItems.length > 0 ? (
                        lowStockItems.map((p) => {
                          const stock = Number(p?.stockAmount ?? 0);
                          return (
                            <tr key={p?._id || p?.id}>
                              <td>
                                <div className="stack-2xs">
                                  <span className="font-semibold text-sm">{p?.name || 'Unnamed product'}</span>
                                  <span className="muted-text text-xs">{p?.category || '—'} • {p?.brand || '—'}</span>
                                </div>
                              </td>
                              <td>
                                <span className="font-semibold">{stock.toLocaleString()}</span>
                              </td>
                              <td>
                                <span className="muted-text">{lowStockLimit}</span>
                              </td>
                              <td>
                                <div className="flex items-center gap-2 justify-end">
                                  <input
                                    type="number"
                                    min="1"
                                    className="input input-sm"
                                    placeholder="Qty"
                                    value={reorderDrafts[p?._id]?.qty ?? ""}
                                    onChange={(event) =>
                                      setReorderDrafts((prev) => ({
                                        ...prev,
                                        [p?._id]: {
                                          ...((prev && prev[p?._id]) || {}),
                                          qty: event.target.value,
                                        },
                                      }))
                                    }
                                    style={{ maxWidth: 96 }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleAddToReorder(p?._id)}
                                  >
                                    Add to reorder
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="empty-cell">No low-stock notifications</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="stack-lg">
            <div className="card profile-hero">
              <div className="profile-hero__media stack-sm">
                <div className="profile-avatar-frame">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="profile-avatar-img" />
                  ) : (
                    <div className="avatar avatar--xl avatar--fallback">{initials}</div>
                  )}
                </div>
                <div className="action-grid">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={triggerAvatarPicker}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar
                      ? "Uploading…"
                      : user?.avatar
                      ? "Change photo"
                      : "Upload photo"}
                  </button>
                  {user?.avatar && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarFile}
                />
                <span className="muted-text text-xs">JPG or PNG up to 2MB.</span>
              </div>
              <div className="profile-hero__info stack-xs">
                <h3 className="heading-md mb-1">{user?.name || "Administrator"}</h3>
                <span className="muted-text">{user?.email}</span>
                <div className="profile-hero__badges">
                  <span className={roleBadge(user?.role || "admin")}>
                    {(user?.role || "admin").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="badge badge-gray">ID • {user?._id?.slice(-6) || "000000"}</span>
                </div>
              </div>
              <p className="profile-hero__copy muted-text">
                Keep your profile details accurate so teammates know how to reach you. Changes
                take effect immediately across the admin experience.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <form onSubmit={saveProfile} className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Account details</h3>
                  <p className="muted-text">Update your basic information and contact details.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="profile-name">
                      Full name
                    </label>
                    <input
                      id="profile-name"
                      className="input"
                      value={profile.name}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Alex Mason"
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="profile-email">
                      Email address
                    </label>
                    <input
                      id="profile-email"
                      className="input"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="profile-age">
                      Age
                    </label>
                    <input
                      id="profile-age"
                      className="input"
                      type="number"
                      min="0"
                      value={profile.age}
                      onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label" htmlFor="profile-address">
                      Address
                    </label>
                    <textarea
                      id="profile-address"
                      className="input"
                      rows={3}
                      value={profile.address}
                      onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Street, city, country"
                      autoComplete="street-address"
                    />
                  </div>
                </div>

                <div className="button-row">
                  <button className="btn btn-primary" disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={resetProfileForm}>
                    Reset
                  </button>
                </div>
              </form>

              <form onSubmit={savePassword} className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Change password</h3>
                  <p className="muted-text">Use a strong password that you don’t reuse elsewhere.</p>
                </div>

                <div className="stack-md">
                  <div>
                    <label className="label" htmlFor="pwd-current">
                      Current password
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="pwd-current"
                        className="input"
                        style={{ flex: 1 }}
                        type={showPwd.current ? "text" : "password"}
                        value={pwd.current}
                        onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, current: !s.current }))
                        }
                      >
                        {showPwd.current ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="pwd-new">
                      New password
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="pwd-new"
                        className="input"
                        style={{ flex: 1 }}
                        type={showPwd.next ? "text" : "password"}
                        value={pwd.next}
                        onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, next: !s.next }))
                        }
                      >
                        {showPwd.next ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="pwd-confirm">
                      Confirm new password
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="pwd-confirm"
                        className="input"
                        style={{ flex: 1 }}
                        type={showPwd.confirm ? "text" : "password"}
                        value={pwd.confirm}
                        onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, confirm: !s.confirm }))
                        }
                      >
                        {showPwd.confirm ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="button-row">
                  <button className="btn btn-primary" disabled={changingPwd}>
                    {changingPwd ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* ATTENDANCE */}
        {tab === "attendance" && (
          <section className="card stack-md">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">Attendance</h3>
                <p className="muted-text">
                  Select a date, filter by role, and mark each team member&apos;s attendance individually.
                </p>
              </div>
              <div className="action-grid">
                <label className="stack-xs" style={{ minWidth: "190px" }}>
                  <span className="label">Attendance date</span>
                  <input
                    type="date"
                    className="input"
                    value={attendanceDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={handleAttendanceDateChange}
                  />
                </label>
                <label className="stack-xs" style={{ minWidth: "180px" }}>
                  <span className="label">Filter by role</span>
                  <select
                    id="attendance-role"
                    className="input"
                    value={attendanceRoleFilter}
                    onChange={(e) => setAttendanceRoleFilter(e.target.value)}
                  >
                    <option value="all">All roles</option>
                    {attendanceRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role
                          .split(" ")
                          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                          .join(" ")}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAttendanceRefresh}
                  disabled={attendanceLoading}
                >
                  {attendanceLoading ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportAttendanceReport}
                  disabled={attendanceLoading || attendanceReportLoading}
                >
                  {attendanceReportLoading ? "Exporting…" : "Export report"}
                </button>
              </div>
            </div>

            {attendanceErr && (
              <div className="status-banner status-banner--error" role="alert">
                {attendanceErr}
              </div>
            )}
            {attendanceReportErr && (
              <div className="status-banner status-banner--error" role="alert">
                {attendanceReportErr}
              </div>
            )}
            {attendanceMsg && !attendanceErr && (
              <div className="status-banner status-banner--success" role="status">
                {attendanceMsg}
              </div>
            )}

            <div className="stack-xs">
              <span className="muted-text text-sm">Marked today</span>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-green">Present {attendanceSummary.present}</span>
                <span className="badge badge-red">Absent {attendanceSummary.absent}</span>
                <span className="badge badge-amber">Late {attendanceSummary.late}</span>
                <span className="badge badge-gray">Leave {attendanceSummary.leave}</span>
              </div>
            </div>

            <div className="table-scroller">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Role</th>
                    <th scope="col">Current status</th>
                    <th scope="col">Last updated</th>
                    <th scope="col">Mark as</th>
                    <th scope="col">Note</th>
                    <th scope="col" className="text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoading && filteredAttendanceUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        Loading attendance…
                      </td>
                    </tr>
                  ) : filteredAttendanceUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-cell">
                        {attendanceRoleFilter === "all"
                          ? "No employees available."
                          : "No employees for the selected role."}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendanceUsers.map((employee) => {
                      const userId = employee?._id;
                      const currentRecord = attendanceRecords[userId];
                      const currentMeta = getAttendanceStatusMeta(currentRecord?.status);
                      const selectedStatus = attendanceDrafts[userId] || "present";
                      const noteValue = attendanceNotes[userId] || "";
                      const saving = Boolean(attendanceSaving[userId]);
                      return (
                        <tr key={userId}>
                          <td>
                            <div className="stack-xs">
                              <span className="font-semibold">{employee?.name || "Unnamed"}</span>
                              <span className="muted-text text-sm">{employee?.email}</span>
                            </div>
                          </td>
                          <td>
                            <span className={roleBadge(employee?.role)}>{employee?.role || "user"}</span>
                          </td>
                          <td>
                            {currentRecord ? (
                              <div className="stack-xxs">
                                <span className={currentMeta.tone}>{currentMeta.label}</span>
                                {currentRecord?.recordedBy?.name && (
                                  <span className="muted-text text-xs">
                                    by {currentRecord.recordedBy.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="muted-text">Not marked</span>
                            )}
                          </td>
                          <td>{currentRecord?.updatedAt ? formatDateTime(currentRecord.updatedAt) : "—"}</td>
                          <td>
                            <select
                              className="input attendance-status-input"
                              value={selectedStatus}
                              onChange={(event) =>
                                handleAttendanceStatusChange(userId, event.target.value)
                              }
                            >
                              {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input attendance-note-input"
                              value={noteValue}
                              maxLength={120}
                              onChange={(event) =>
                                handleAttendanceNoteChange(userId, event.target.value)
                              }
                              placeholder="Optional note"
                            />
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => saveAttendanceForUser(userId)}
                              disabled={saving || attendanceLoading}
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}


        {/* USERS (with search) */}
        {tab === "users" && (
          <section className="card stack-md">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">User management</h3>
                <p className="muted-text">
                  Search, edit, and remove accounts across the entire platform.
                </p>
              </div>
              <div className="action-grid">
                <div className="field-with-icon">
                  <span className="field-icon" aria-hidden="true">
                    🔎
                  </span>
                  <input
                    className="input"
                    placeholder="Search by name, email, or role…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Search users"
                  />
                </div>
                <select
                  className="input"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                >
                  <option value="all">All roles</option>
                  {userRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value)}
                  aria-label="Sort by"
                >
                  <option value="name">Sort by name</option>
                  <option value="email">Sort by email</option>
                  <option value="role">Sort by role</option>
                  <option value="created">Sort by date created</option>
                </select>
                <div className="stack-xxs" style={{ minWidth: "220px" }}>
                  <span className="muted-text text-xs">Created between</span>
                  <div className="flex items-center gap-2">
                    <input
                      className="input input-sm"
                      type="date"
                      name="from"
                      value={userReportFilters.from}
                      max={userReportFilters.to || undefined}
                      onChange={handleUserReportFilterChange}
                    />
                    <span className="muted-text text-xs">to</span>
                    <input
                      className="input input-sm"
                      type="date"
                      name="to"
                      value={userReportFilters.to}
                      min={userReportFilters.from || undefined}
                      onChange={handleUserReportFilterChange}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportUserReport}
                  disabled={userReportLoading || loadingUsers}
                >
                  {userReportLoading ? "Exporting…" : "Export report"}
                </button>
                <button className="btn btn-primary btn--icon btn--compact" onClick={openCreateUser}>
                  <span className="btn__icon" aria-hidden="true">
                    +
                  </span>
                  <span>Create user</span>
                </button>
              </div>
            </div>

            {userReportErr && (
              <div className="status-banner status-banner--error" role="alert">
                {userReportErr}
              </div>
            )}

            <div className="table-scroller">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Age</th>
                    <th scope="col">Address</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        {q ? "No matching users." : "No users found."}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u._id}>
                        <td className="truncate">{u.name}</td>
                        <td className="text-wrap" title={u.email}>
                          {u.email}
                        </td>
                        <td>
                          <span className={roleBadge(u.role)}>{u.role || "user"}</span>
                        </td>
                        <td>{u.age ?? "-"}</td>
                        <td className="text-wrap" title={u.address || undefined}>
                          {u.address || "-"}
                        </td>
                        <td>
                          <div className="action-grid justify-end">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditUser(u)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => removeUser(u)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}


        {/* ROLES */}
        {tab === "roles" && (
          <section className="card stack-md">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">Roles &amp; privileges</h3>
                <p className="muted-text">
                  Define responsibilities and access levels for each team persona.
                </p>
              </div>
              <div className="action-grid">
                <div className="field-with-icon">
                  <span className="field-icon" aria-hidden="true">
                    🔎
                  </span>
                  <input
                    className="input"
                    placeholder="Search roles, descriptions, or privileges…"
                    value={roleSearchQuery}
                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                    aria-label="Search roles"
                  />
                </div>
                <select
                  className="input"
                  value={roleSortBy}
                  onChange={(e) => setRoleSortBy(e.target.value)}
                  aria-label="Sort roles by"
                >
                  <option value="name">Sort by name</option>
                  <option value="privileges">Sort by privilege count</option>
                </select>
                <button className="btn btn-primary" onClick={openCreateRole}>
                  <span>➕</span>
                  <span>Create role</span>
                </button>
              </div>
            </div>

            <div className="table-scroller">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Description</th>
                    <th scope="col">Privileges</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRoles ? (
                    <tr>
                      <td colSpan={4} className="empty-cell">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredRoles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-cell">
                        {roleSearchQuery ? "No matching roles." : "No roles yet. Create one."}
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <div className="stack-xs">
                            <span className="font-semibold text-base text-wrap">{r.name}</span>
                          </div>
                        </td>
                        <td className="text-wrap">{r.description || "-"}</td>
                        <td className="text-wrap text-sm">
                          {Array.isArray(r.privileges) && r.privileges.length
                            ? `${r.privileges.length} privilege${r.privileges.length === 1 ? "" : "s"}: ${r.privileges.join(", ")}`
                            : "No privileges"}
                        </td>
                        <td>
                          <div className="action-grid justify-end">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditRole(r)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => removeRole(r)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "feedback" && (
          <div className="space-y-4">
            <div className="card flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold">Feedback workspace</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Review customer feedback, manage deleted items, and stay on top of reply notifications.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackTab("reviews")}
                  className={`btn btn-sm ${feedbackTab === "reviews" ? "btn-primary" : "btn-secondary"}`}
                >
                  Reviews
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackTab("notifications")}
                  className={`btn btn-sm ${feedbackTab === "notifications" ? "btn-primary" : "btn-secondary"}`}
                >
                  Notifications
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackTab("recycle")}
                  className={`btn btn-sm ${feedbackTab === "recycle" ? "btn-primary" : "btn-secondary"}`}
                >
                  Recycle bin
                </button>
              </div>
            </div>

            {feedbackTab === "reviews" && (
              <div className="card card--flush">
                <AdminReviews />
              </div>
            )}

            {feedbackTab === "notifications" && (
              <div className="card">
                <NotificationsPanel 
                  scope="admin" 
                  types={[
                    "review-submitted",
                    "review-replied",
                    "review-restored",
                    "review-deleted"
                  ]} 
                />
              </div>
            )}

            {feedbackTab === "recycle" && (
              <div className="card">
                <AdminReviewRecycleBin />
              </div>
            )}
          </div>
        )}

        {tab === "refunds" && <AdminRefunds />}

        {/* PRODUCT MANAGEMENT */}
        {tab === "product" && (
          <div className="stack-lg">
            <div className="card stack-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="stack-xs">
                  <h3 className="heading-md">Product management</h3>
                  <p className="muted-text text-sm">
                    Review every store product, make quick edits, or remove outdated items directly from this dashboard.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => loadProducts()}
                    disabled={loadingProducts}
                  >
                    {loadingProducts ? "Refreshing…" : "Refresh"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate("/products")}
                  >
                    Open full catalog
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={openCreateProduct}
                  >
                    ➕ Add product
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowSupplierProducts((prev) => !prev)}
                  >
                    {showSupplierProducts ? "Hide supplier products" : "View supplier products"}
                  </button>
                </div>
              </div>
              <input
                type="search"
                className="input"
                placeholder="Search by name, brand, or category"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
              />
            </div>

            <div className="card table-scroller">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        Loading products…
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        {productQuery ? "No products match your search." : "No products available."}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const itemCount = product?.stockAmount ?? 0;
                      return (
                        <tr key={product._id || product.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              {product?.imageUrl && (
                                <img
                                  src={resolveImageUrl(product.imageUrl)}
                                  alt={product.name}
                                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "0.75rem" }}
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                              <div>
                                <div className="font-semibold text-wrap">{product?.name || "Unnamed"}</div>
                                <div className="muted-text text-xs">{product?._id}</div>
                              </div>
                            </div>
                          </td>
                          <td>{product?.category || "—"}</td>
                          <td>{product?.brand || "—"}</td>
                          <td>{formatCurrency(product?.price)}</td>
                          <td>
                            {product?.inStock
                              ? `${itemCount} in stock`
                              : <span className="badge badge-amber">Out of stock</span>}
                          </td>
                          <td>
                            <div className="action-grid justify-end">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEditProduct(product)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                disabled={deletingProductId === product._id}
                                onClick={() => handleDeleteProduct(product)}
                              >
                                {deletingProductId === product._id ? "Removing…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {showSupplierProducts && (
              <div className="card stack-md">
                <div className="stack-xs">
                  <h4 className="heading-md">Supplier product catalog</h4>
                  <p className="muted-text text-sm">
                    Browse inventory provided by partner suppliers. Use the buttons below to manage supplier listings.
                  </p>
                </div>
                <SupplierAdminProductList />
              </div>
            )}
          </div>
        )}

        {/* INVENTORY */}
        {tab === "inventory" && (
          <div className="stack-lg">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card stack-xs">
                <span className="muted-heading text-xs uppercase tracking-wide">Total SKUs</span>
                <span className="text-3xl font-semibold">
                  {loadingProducts ? "…" : inventoryStats.totalSkus.toLocaleString()}
                </span>
                <span className="muted-text text-sm">Unique catalog items</span>
              </div>
              <div className="card stack-xs">
                <span className="muted-heading text-xs uppercase tracking-wide">Units on hand</span>
                <span className="text-3xl font-semibold">
                  {loadingProducts ? "…" : inventoryStats.totalOnHand.toLocaleString()}
                </span>
                <span className="muted-text text-sm">Across all tracked stock</span>
              </div>
              <div className="card stack-xs">
                <span className="muted-heading text-xs uppercase tracking-wide">Stock value</span>
                <span className="text-3xl font-semibold">
                  {loadingProducts ? "…" : formatCurrency(inventoryStats.totalValue)}
                </span>
                <span className="muted-text text-sm">Based on listed selling prices</span>
              </div>
              <div className="card stack-xs">
                <span className="muted-heading text-xs uppercase tracking-wide">Reorder pipeline</span>
                <span className="text-3xl font-semibold">
                  {reorderSummary.totalQty.toLocaleString()}
                </span>
                <span className="muted-text text-sm">
                  {reorderSummary.pending} pending • {reorderSummary.ordered} ordered
                </span>
              </div>
            </section>

            <div className="card stack-md">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="stack-xs">
                  <h3 className="heading-md">Stock control</h3>
                  <p className="muted-text text-sm">
                    Update on-hand quantities, reduce damaged stock, and prepare items for supplier reorders.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="field-with-icon">
                    <span className="field-icon" aria-hidden="true">🔎</span>
                    <input
                      type="search"
                      className="input"
                      placeholder="Search products, categories, or brands"
                      value={inventorySearch}
                      onChange={(event) => setInventorySearch(event.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="label whitespace-nowrap" htmlFor="inventory-threshold">
                      Low stock threshold
                    </label>
                    <input
                      id="inventory-threshold"
                      type="number"
                      min="0"
                      className="input"
                      value={reorderThreshold}
                      onChange={(event) => handleReorderThresholdChange(event.target.value)}
                      style={{ maxWidth: 128 }}
                    />
                  </div>
                </div>
              </div>
              {/* Inventory chart*/}
              <div className="stack-lg" style={{ marginTop: 18 }}>
                <div
                  className="stack-md"
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid var(--surface-border)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="stack-xs">
                      <h4 className="heading-md">Inventory movement</h4>
                      <p className="muted-text text-sm">
                        Track the last {inventoryLineRangeLabel} days of stock levels for a selected product.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="stack-xxs" htmlFor="inventory-chart-category">
                        <span className="label text-xs uppercase tracking-wide">Category</span>
                        <select
                          id="inventory-chart-category"
                          className="input"
                          value={inventoryChartCategory}
                          onChange={(event) => {
                            setInventoryChartCategory(event.target.value);
                            setInventoryChartProductId("");
                          }}
                        >
                          <option value="all">All categories</option>
                          {inventoryCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="stack-xxs" htmlFor="inventory-chart-range">
                        <span className="label text-xs uppercase tracking-wide">History window</span>
                        <select
                          id="inventory-chart-range"
                          className="input"
                          value={String(inventoryChartRange)}
                          onChange={(event) => setInventoryChartRange(Number(event.target.value) || 30)}
                        >
                          <option value="7">Last 7 days</option>
                          <option value="14">Last 14 days</option>
                          <option value="30">Last 30 days</option>
                        </select>
                      </label>
                      <label className="stack-xxs" htmlFor="inventory-chart-product">
                        <span className="label text-xs uppercase tracking-wide">Product</span>
                        <select
                          id="inventory-chart-product"
                          className="input"
                          value={inventoryChartProductValue}
                          onChange={(event) => setInventoryChartProductId(event.target.value)}
                          disabled={inventoryChartProductOptions.length === 0}
                        >
                          {inventoryChartProductOptions.length === 0 ? (
                            <option value="">No products available</option>
                          ) : (
                            inventoryChartProductOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                    </div>
                  </div>

                  {selectedInventoryChartProduct ? (
                    <div className="stack-md">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                        <div>
                          <div className="muted-heading text-xs uppercase tracking-wide">Selected product</div>
                          <div className="text-lg font-semibold">
                            {selectedInventoryChartProduct?.name || "Unnamed product"}
                          </div>
                        </div>
                        <div className="muted-text text-sm">
                          Current stock: {Number(inventoryLineMeta.currentStock || 0).toLocaleString()}
                        </div>
                      </div>
                      <SimpleLineChart
                        labels={inventoryLineChart.labels}
                        values={inventoryLineChart.values}
                        height={320}
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 stack-xxs">
                          <span className="muted-heading text-xs uppercase tracking-wide">Opening stock</span>
                          <span className="text-xl font-semibold">
                            {Number(inventoryLineMeta.startStock || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 stack-xxs">
                          <span className="muted-heading text-xs uppercase tracking-wide">
                            Units sold (last {inventoryLineRangeLabel} days)
                          </span>
                          <span className="text-xl font-semibold">
                            {Number(inventoryLineMeta.totalSold || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 stack-xxs">
                          <span className="muted-heading text-xs uppercase tracking-wide">Stock on hand</span>
                          <span className="text-xl font-semibold">
                            {Number(inventoryLineMeta.currentStock || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-cell" role="status">
                      Pick a product to visualize its stock movement.
                    </div>
                  )}
                </div>

                <div className="stack-md">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="stack-xs">
                      <h4 className="heading-md">Top movers</h4>
                      <p className="muted-text text-sm">
                        Compare the ten highest {invChartMode === "stock" ? "stocked items on hand" : "selling products"}.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm ${invChartMode === "stock" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setInvChartMode("stock")}
                      >
                        Stock
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${invChartMode === "sold" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setInvChartMode("sold")}
                      >
                        Sold
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {(() => {
                      const items = (filteredInventoryItems || []).slice();
                      const top = items
                        .sort((a, b) => Number(b.stockAmount || 0) - Number(a.stockAmount || 0))
                        .slice(0, 10);
                      const labels = top.map((product) => product.name || String(product._id).slice(-6));
                      const values = top.map((product) => Number(product.stockAmount || 0));

                      if (invChartMode === "sold") {
                        const soldByName = new Map();
                        for (const order of orders || []) {
                          if (!order?.items || !Array.isArray(order.items)) continue;
                          for (const item of order.items) {
                            const label =
                              (item.name || item.productName || item.title || "").trim() ||
                              String(item.productId || item._id || "Unknown");
                            const qty = Number(item.quantity ?? item.qty ?? 0);
                            if (!Number.isFinite(qty) || qty <= 0) continue;
                            soldByName.set(label, (soldByName.get(label) || 0) + qty);
                          }
                        }

                        const soldArray = Array.from(soldByName.entries()).map(([name, qty]) => ({ name, qty }));
                        soldArray.sort((a, b) => b.qty - a.qty);
                        const topSold = soldArray.slice(0, 10);

                        const soldLabels = topSold.map((entry) => entry.name);
                        const soldValues = topSold.map((entry) => entry.qty);

                        return (
                          <SmallBarChart
                            labels={soldLabels}
                            values={soldValues}
                            height={420}
                            barWidth={72}
                            labelRotation={-55}
                          />
                        );
                      }

                      return (
                        <SmallBarChart
                          labels={labels}
                          values={values}
                          height={360}
                          barWidth={64}
                          labelRotation={-35}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportStockReport}
                    disabled={loadingProducts}
                  >
                    📄 Generate stock report
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportStockReportPdf}
                    disabled={loadingProducts}
                  >
                    🖨️ Export stock PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleAutoQueueLowStock}
                  >
                    ⚡ Queue low-stock items
                  </button>
                </div>
                <div className="muted-text text-xs">
                  {lowStockItems.length} item{lowStockItems.length === 1 ? "" : "s"} at or below the threshold of {lowStockLimit}.
                </div>
              </div>

              <div className="table-scroller">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>On hand</th>
                      <th>Stock actions</th>
                      <th>Reorder prep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingProducts ? (
                      <tr>
                        <td colSpan={4} className="empty-cell">Refreshing inventory…</td>
                      </tr>
                    ) : filteredInventoryItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="empty-cell">
                          {inventorySearch ? "No products match your search." : "No products available."}
                        </td>
                      </tr>
                    ) : (
                      filteredInventoryItems.map((product) => {
                        const drafts = stockDrafts[product._id] || {};
                        const reorderDraft = reorderDrafts[product._id] || {};
                        const savingThisProduct = inventorySavingId === product._id;
                        const stock = Number(product?.stockAmount ?? 0);
                        const price = Number(product?.price ?? 0);
                        const value = Number.isFinite(price) ? price * stock : null;
                        const expiryDraft = expiryDrafts[product._id] || {};
                        const trackingDraft =
                          typeof expiryDraft.track !== "undefined"
                            ? expiryDraft.track
                            : Boolean(product.expireTrackingEnabled);
                        const currentDateInput = toDateInputValue(product.expiryDate);
                        const expiryDateDraft = trackingDraft
                          ? typeof expiryDraft.date !== "undefined"
                            ? expiryDraft.date
                            : currentDateInput
                          : "";
                        const reminderSource =
                          product.expiryReminderDays != null && Number.isFinite(Number(product.expiryReminderDays))
                            ? String(product.expiryReminderDays)
                            : "";
                        const reminderDraft = trackingDraft
                          ? typeof expiryDraft.reminder !== "undefined"
                            ? expiryDraft.reminder
                            : reminderSource
                          : "";
                        const expiryDirty =
                          trackingDraft !== Boolean(product.expireTrackingEnabled) ||
                          (trackingDraft &&
                            (expiryDateDraft !== currentDateInput || reminderDraft !== reminderSource));
                        const daysToExpiry = product.expireTrackingEnabled && product.expiryDate
                          ? daysUntilDate(product.expiryDate)
                          : null;
                        const reminderDaysNumber = Number.isFinite(Number(product.expiryReminderDays))
                          ? Number(product.expiryReminderDays)
                          : 0;
                        return (
                          <tr key={product._id || product.id}>
                            <td>
                              <div className="stack-xs">
                                <div className="font-semibold text-sm text-wrap">{product?.name || "Unnamed product"}</div>
                                <div className="muted-text text-xs text-wrap">
                                  {(product?.category || "Uncategorised") + " • " + (product?.brand || "Brand N/A")}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="stack-2xs">
                                <span className="font-semibold">
                                  {stock.toLocaleString()} unit{stock === 1 ? "" : "s"}
                                </span>
                                <span className="muted-text text-xs">
                                  {product?.inStock ? "Available" : "Out of stock"}
                                </span>
                                {Number.isFinite(value) && (
                                  <span className="muted-text text-xs">{formatCurrency(value)}</span>
                                )}
                                {stock <= lowStockLimit && (
                                  <span className="badge badge-amber badge-sm">Low stock</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="stack-2xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    className="input input-sm"
                                    min="0"
                                    placeholder={String(stock)}
                                    value={drafts.set ?? ""}
                                    onChange={(event) =>
                                      handleStockDraftChange(product._id, "set", event.target.value)
                                    }
                                    style={{ maxWidth: 120 }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleApplyExactStock(product._id)}
                                    disabled={savingThisProduct}
                                  >
                                    {savingThisProduct ? "Saving…" : "Set stock"}
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    className="input input-sm"
                                    min="0"
                                    placeholder="Reduce by…"
                                    value={drafts.reduce ?? ""}
                                    onChange={(event) =>
                                      handleStockDraftChange(product._id, "reduce", event.target.value)
                                    }
                                    style={{ maxWidth: 120 }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleReduceStock(product._id)}
                                    disabled={savingThisProduct}
                                  >
                                    {savingThisProduct ? "Saving…" : "Reduce"}
                                  </button>
                                </div>
                                <div className="expiry-editor">
                                  <label className="expiry-editor__toggle">
                                    <input
                                      type="checkbox"
                                      checked={trackingDraft}
                                      onChange={(event) =>
                                        handleToggleExpiryTracking(product._id, event.target.checked)
                                      }
                                    />
                                    <span>Track expiry</span>
                                  </label>
                                  {trackingDraft && (
                                    <div className="expiry-editor__fields">
                                      <input
                                        type="date"
                                        className="input input-sm"
                                        value={expiryDateDraft}
                                        min={minExpiryDate}
                                        onChange={(event) =>
                                          handleExpiryDraftChange(product._id, "date", event.target.value)
                                        }
                                      />
                                      <input
                                        type="number"
                                        className="input input-sm"
                                        min="0"
                                        placeholder="Reminder days"
                                        value={reminderDraft}
                                        onChange={(event) =>
                                          handleExpiryDraftChange(product._id, "reminder", event.target.value)
                                        }
                                      />
                                    </div>
                                  )}
                                  <div className="expiry-editor__actions">
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleSaveExpiry(product._id)}
                                      disabled={savingThisProduct || !expiryDirty}
                                    >
                                      {savingThisProduct ? "Saving…" : "Save expiry"}
                                    </button>
                                  </div>
                                  {product.expireTrackingEnabled && product.expiryDate ? (
                                    <p
                                      className={`expiry-editor__status ${
                                        daysToExpiry !== null && daysToExpiry <= reminderDaysNumber
                                          ? "expiry-editor__status--alert"
                                          : ""
                                      }`}
                                    >
                                      Expires on {new Date(product.expiryDate).toLocaleDateString()} ·
                                      notify {reminderDaysNumber} day{reminderDaysNumber === 1 ? "" : "s"} prior
                                      {daysToExpiry !== null
                                        ? ` (${daysToExpiry <= 0 ? "expired" : `${daysToExpiry} day${
                                            daysToExpiry === 1 ? "" : "s"
                                          } remaining`})`
                                        : ""}
                                    </p>
                                  ) : (
                                    <p className="expiry-editor__status expiry-editor__status--muted">
                                      Expiration tracking disabled
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="stack-2xs">
                                <div className="flex flex-wrap gap-2">
                                  <input
                                    type="number"
                                    className="input input-sm"
                                    min="1"
                                    placeholder="Qty"
                                    value={reorderDraft.qty ?? ""}
                                    onChange={(event) =>
                                      setReorderDrafts((prev) => ({
                                        ...prev,
                                        [product._id]: {
                                          ...prev[product._id],
                                          qty: event.target.value,
                                        },
                                      }))
                                    }
                                    style={{ maxWidth: 96 }}
                                  />
                                  <input
                                    type="text"
                                    className="input input-sm"
                                    placeholder="Note"
                                    value={reorderDraft.notes ?? ""}
                                    onChange={(event) =>
                                      setReorderDrafts((prev) => ({
                                        ...prev,
                                        [product._id]: {
                                          ...prev[product._id],
                                          notes: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleAddToReorder(product._id)}
                                  >
                                    Add to reorder
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card stack-md">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="stack-xs">
                  <h3 className="heading-md">Reorder workspace</h3>
                  <p className="muted-text text-sm">
                    Consolidate inventory shortages and generate purchase requests for suppliers.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="input"
                    value={reorderFilter}
                    onChange={(event) => setReorderFilter(event.target.value)}
                  >
                    <option value="all">All items</option>
                    <option value="pending">Pending</option>
                    <option value="ordered">Marked ordered</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportReorderReport}
                    disabled={filteredReorderQueue.length === 0}
                  >
                    📄 Export CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleExportReorderReportPdf}
                    disabled={filteredReorderQueue.length === 0}
                  >
                    🖨️ Export PDF
                  </button>
                </div>
              </div>

              <div className="stack-sm">
                <label className="label" htmlFor="reorder-report-note">Report notes</label>
                <textarea
                  id="reorder-report-note"
                  className="input"
                  rows={2}
                  placeholder="Add context that should appear on the exported reorder report"
                  value={reorderNotes}
                  onChange={(event) => setReorderNotes(event.target.value)}
                />
                <div className="muted-text text-xs">
                  Estimated spend: {formatCurrency(reorderSummary.estimatedSpend)}
                </div>
              </div>

              <div className="table-scroller">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Requested</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReorderQueue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-cell">
                          {reorderList.length === 0
                            ? "No reorder items yet. Add products from the stock control table."
                            : "No items match the selected filter."}
                        </td>
                      </tr>
                    ) : (
                      filteredReorderQueue.map((item) => {
                        const product = productIndex[item.productId];
                        const price = Number(product?.price ?? 0);
                        const qty = Number(item.reorderQty ?? 0);
                        const total = Number.isFinite(price) && Number.isFinite(qty) ? price * qty : null;
                        return (
                          <tr key={item.productId}>
                            <td>
                              <div className="stack-2xs">
                                <span className="font-semibold text-sm text-wrap">{item.name}</span>
                                <span className="muted-text text-xs text-wrap">
                                  {item.category || "—"} • Threshold {item.threshold ?? lowStockLimit}
                                </span>
                                <span className="muted-text text-xs">
                                  On hand: {Number(item.stockAmount ?? 0).toLocaleString()} unit{Number(item.stockAmount ?? 0) === 1 ? "" : "s"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="stack-2xs">
                                <span className="font-semibold">{qty.toLocaleString()} unit{qty === 1 ? "" : "s"}</span>
                                {Number.isFinite(price) && (
                                  <span className="muted-text text-xs">
                                    {formatCurrency(price)} • {total != null ? formatCurrency(total) : "—"}
                                  </span>
                                )}
                                <span className="muted-text text-xs">{formatDateTime(item.createdAt)}</span>
                              </div>
                            </td>
                            <td>
                              <select
                                className="input input-sm"
                                value={item.status}
                                onChange={(event) => handleReorderStatusChange(item.productId, event.target.value)}
                              >
                                <option value="pending">Pending</option>
                                <option value="ordered">Ordered</option>
                              </select>
                            </td>
                            <td>
                              <div className="stack-2xs">
                                <span className="muted-text text-sm">{item.notes || "—"}</span>
                                <span className="muted-text text-xs">Requested by {item.requestedBy || "Unknown"}</span>
                              </div>
                            </td>
                            <td>
                              <div className="action-grid justify-end">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleSendToSupplierCart(item)}
                                >
                                  Send to supplier cart
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleRemoveReorderItem(item.productId)}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "order" && (
          <div className="stack-xl">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div
                className="card stack-md order-summary-card"
                style={{
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  color: "#fff",
                  boxShadow: "0 20px 45px rgba(79, 70, 229, 0.28)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="stack-xs">
                    <span className="text-xs uppercase tracking-wide opacity-80">Customer orders</span>
                    <span className="text-4xl font-black leading-tight">{customerOrderStats.count}</span>
                    <span className="text-sm opacity-80">Orders captured in the latest sync</span>
                  </div>
                  <span aria-hidden className="text-4xl">📦</span>
                </div>
                {customerOrderStats.pending > 0 && (
                  <span className="badge" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
                    {customerOrderStats.pending} pending fulfilment
                  </span>
                )}
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  Revenue impact {formatCurrency(customerOrderStats.total)}
                </div>
                <button
                  type="button"
                  className="btn btn-sm order-summary-card__action"
                  style={{ backgroundColor: "#fff", color: "#1f2937", fontWeight: 600, alignSelf: "flex-start" }}
                  onClick={() => toggleOrderPanel("customers")}
                >
                  {activeOrderPanel === "customers" ? "Hide customer orders" : "Manage customer orders"}
                </button>
              </div>

              <div
                className="card stack-md order-summary-card"
                style={{
                  background: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
                  color: "#0f172a",
                  boxShadow: "0 20px 45px rgba(14,165,233,0.25)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="stack-xs">
                    <span
                      className="text-xs uppercase tracking-wide"
                      style={{ color: "rgba(15,23,42,0.7)" }}
                    >
                      Supplier purchases
                    </span>
                    <span className="text-4xl font-black leading-tight">{supplierOrderStats.count}</span>
                    <span className="text-sm" style={{ color: "rgba(15,23,42,0.7)" }}>
                      Raised purchase orders ready for action
                    </span>
                  </div>
                  <span aria-hidden className="text-4xl">🤝</span>
                </div>
                {supplierOrderStats.pending > 0 && (
                  <span className="badge" style={{ backgroundColor: "rgba(15,23,42,0.08)", color: "#0f172a" }}>
                    {supplierOrderStats.pending} awaiting supplier
                  </span>
                )}
                <div className="text-sm" style={{ color: "rgba(15,23,42,0.7)" }}>
                  Spend committed {formatCurrency(supplierOrderStats.total)}
                </div>
                <button
                  type="button"
                  className="btn btn-sm order-summary-card__action"
                  style={{ backgroundColor: "#0f172a", color: "#fff", fontWeight: 600, alignSelf: "flex-start" }}
                  onClick={() => toggleOrderPanel("suppliers")}
                >
                  {activeOrderPanel === "suppliers" ? "Hide supplier orders" : "Manage supplier orders"}
                </button>
              </div>

              <div
                className="card stack-md order-summary-card"
                style={{
                  background: "linear-gradient(135deg, #f97316, #facc15)",
                  color: "#7c2d12",
                  boxShadow: "0 20px 45px rgba(249,115,22,0.25)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="stack-xs">
                    <span
                      className="text-xs uppercase tracking-wide"
                      style={{ color: "rgba(124,45,18,0.8)" }}
                    >
                      Cancellations (30 days)
                    </span>
                    <span className="text-4xl font-black leading-tight">{cancelledOrderStats.count}</span>
                    <span className="text-sm" style={{ color: "rgba(124,45,18,0.7)" }}>
                      Automatically pruned after 30 days
                    </span>
                  </div>
                  <span aria-hidden className="text-4xl">⚠️</span>
                </div>
                <div className="text-sm" style={{ color: "rgba(124,45,18,0.75)" }}>
                  Review reasons to reduce repeat issues
                </div>
                <button
                  type="button"
                  className="btn btn-sm order-summary-card__action"
                  style={{ backgroundColor: "#7c2d12", color: "#fff", fontWeight: 600, alignSelf: "flex-start" }}
                  onClick={() => toggleOrderPanel("cancelled")}
                >
                  {activeOrderPanel === "cancelled" ? "Hide cancellations" : "Review cancellations"}
                </button>
              </div>

              <div
                className="card stack-md order-summary-card"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                  color: "#fff",
                  boxShadow: "0 20px 45px rgba(147, 51, 234, 0.28)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="stack-xs">
                    <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Admin cancellations
                    </span>
                    <span className="text-4xl font-black leading-tight">{adminCancelledOrderStats.count}</span>
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                      All admin-archived supplier orders
                    </span>
                  </div>
                  <span aria-hidden className="text-4xl">🗂️</span>
                </div>
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {adminCancelledOrderStats.latestCancelledAt
                    ? `Latest archived ${formatDateTime(adminCancelledOrderStats.latestCancelledAt)}`
                    : "No admin cancellations recorded yet."}
                </div>
                <button
                  type="button"
                  className="btn btn-sm order-summary-card__action"
                  style={{ backgroundColor: "rgba(15,23,42,0.15)", color: "#fff", fontWeight: 600, alignSelf: "flex-start" }}
                  onClick={() => toggleOrderPanel("adminCancelled")}
                >
                  {activeOrderPanel === "adminCancelled"
                    ? "Hide admin cancellations"
                    : "Review admin cancellations"}
                </button>
              </div>
            </section>
          </div>
        )}


  {tab === "order" && activeOrderPanel === "customers" && (
          <div className="card stack-md order-panel">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">Customer orders</h3>
                <p className="muted-text text-sm">
                  {loadingOrders ? "Refreshing data…" : `${filteredCustomerOrders.length} order(s) in view`}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => loadOrders()}
                  disabled={loadingOrders}
                >
                  {loadingOrders ? "Loading…" : "Reload"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveOrderPanel(null)}
                >
                  Hide
                </button>
              </div>
            </div>

            <div className="stack-md">
              <div className="modal-toolbar">
                <input
                  className="input input-sm"
                  placeholder="Search by contact, status, item, payment…"
                  value={customerOrderQuery}
                  onChange={(event) => setCustomerOrderQuery(event.target.value)}
                />
                {customerOrderQuery && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCustomerOrderQuery("")}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="table-scroller modal-table-wrapper">
                <table className="data-table data-table--wide modal-table">
                  <thead>
                    <tr className="text-left">
                      <th>Order</th>
                      <th>Contact</th>
                      <th>Payment</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={8} className="empty-cell">Loading orders…</td>
                      </tr>
                    ) : filteredCustomerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-cell">No customer orders match your filters.</td>
                      </tr>
                    ) : (
                      filteredCustomerOrders.map((order) => {
                        const items = Array.isArray(order?.items) ? order.items : [];
                        const statusText = order?.status || "Pending";
                        const statusLower = statusText.toLowerCase();
                        const statusClass =
                          statusLower === "pending"
                            ? "badge badge-amber"
                            : statusLower.includes("cancel")
                            ? "badge badge-gray"
                            : "badge badge-green";
                        const rowKey =
                          order?._id || order?.id || `${order?.contact || "order"}-${order?.createdAt || ""}`;
                        const cancellable = !statusLower.includes("cancel");
                        const canCancelOrder = statusLower === "pending";
                        const canConfirmOrder = statusLower === "pending";
                        const canMarkDelivered = statusLower === "confirmed";
                        const isUpdatingStatus = updatingCustomerOrderId === order?._id;
                        const paymentStatus = String(order?.paymentInfo?.paymentStatus || "").toLowerCase();
                        const receiptUrl = order?.paymentInfo?.receiptUrl;
                        const slipUrl = order?.paymentInfo?.slipUrl;
                        const hasReceipt = paymentStatus === "paid" && Boolean(receiptUrl);
                        const hasSlip = !hasReceipt && Boolean(slipUrl);
                        return (
                          <tr key={rowKey}>
                            <td>
                              <div className="stack-xs">
                                <span className="font-medium break-words">{order?._id || "—"}</span>
                                <span className="muted-text text-xs">Placed {formatDateTime(order?.createdAt)}</span>
                              </div>
                            </td>
                            <td>{order?.contact || "—"}</td>
                            <td>{order?.paymentMethod || "—"}</td>
                            <td>
                              {items.length === 0 ? (
                                <span className="muted-text text-sm">No line items</span>
                              ) : (
                                <div className="stack-xs">
                                  {items.map((item, index) => (
                                    <div key={`${rowKey}-item-${index}`}>
                                      {item?.productName || item?.name} × {item?.quantity} ({formatCurrency(item?.price)})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>{formatCurrency(order?.totalAmount)}</td>
                            <td>
                              <span className={statusClass}>{statusText}</span>
                            </td>
                            <td>{formatDateTime(order?.updatedAt || order?.createdAt)}</td>
                            <td className="text-right">
                              <div className="action-grid justify-end">
                                {hasReceipt && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleViewReceipt(order)}
                                  >
                                    View receipt
                                  </button>
                                )}
                                {hasSlip && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleViewReceipt(order, slipUrl)}
                                  >
                                    View slip
                                  </button>
                                )}
                                {canConfirmOrder && (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleUpdateCustomerOrderStatus(order._id, "Confirmed")}
                                    disabled={isUpdatingStatus}
                                  >
                                    {isUpdatingStatus ? "Updating…" : "Mark confirmed"}
                                  </button>
                                )}
                                {canMarkDelivered && (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleUpdateCustomerOrderStatus(order._id, "Delivered")}
                                    disabled={isUpdatingStatus}
                                  >
                                    {isUpdatingStatus ? "Updating…" : "Mark delivered"}
                                  </button>
                                )}
                                {cancellable && canCancelOrder ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleCancelCustomerOrderClick(order)}
                                    disabled={loadingOrders}
                                  >
                                    Cancel order
                                  </button>
                                ) : null}
                                {!canCancelOrder && cancellable && (
                                  <span className="muted-text text-xs">Order locked</span>
                                )}
                                {!cancellable && (
                                  <span className="muted-text text-xs">Already cancelled</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

  {tab === "order" && activeOrderPanel === "suppliers" && (
          <div className="card stack-md order-panel">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">Orders placed with suppliers</h3>
                <p className="muted-text text-sm">
                  {loadingAdminOrders
                    ? "Refreshing data…"
                    : `${filteredAdminOrders.length} supplier order(s) loaded`}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => loadAdminOrders()}
                  disabled={loadingAdminOrders}
                >
                  {loadingAdminOrders ? "Loading…" : "Reload"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveOrderPanel(null)}
                >
                  Hide
                </button>
              </div>
            </div>

            <div className="stack-md">
              <div className="modal-toolbar">
                <input
                  className="input input-sm"
                  placeholder="Search supplier, status, notes…"
                  value={adminOrderQuery}
                  onChange={(event) => setAdminOrderQuery(event.target.value)}
                />
                {adminOrderQuery && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAdminOrderQuery("")}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="table-scroller modal-table-wrapper">
                <table className="data-table data-table--wide modal-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Supplier</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Updated</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdminOrders ? (
                      <tr>
                        <td colSpan={8} className="empty-cell">Loading supplier orders…</td>
                      </tr>
                    ) : filteredAdminOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-cell">No supplier orders match your filters.</td>
                      </tr>
                    ) : (
                      filteredAdminOrders.map((order) => {
                        const items = Array.isArray(order?.items) ? order.items : [];
                        const statusText = order?.status || "Pending";
                        const statusLower = statusText.toLowerCase();
                        const isPending = statusLower === "pending";
                        const statusClass =
                          statusLower === "pending"
                            ? "badge badge-amber"
                            : statusLower === "ordered" || statusLower === "confirmed"
                            ? "badge badge-green"
                            : "badge badge-gray";
                        const supplierName = (() => {
                          if (items.length > 0) {
                            const supplier = items[0]?.supplierId;
                            if (typeof supplier === "string") return supplier;
                            if (supplier?.name) return supplier.name;
                            if (supplier?.email) return supplier.email;
                          }
                          return order?.contact || "—";
                        })();
                        const rowKey =
                          order?._id || order?.id || `${supplierName || "supplier"}-${order?.createdAt || ""}`;
                        return (
                          <tr key={rowKey}>
                            <td>
                              <div className="stack-xs">
                                <span className="font-medium break-words">{order?._id || "—"}</span>
                                {order?.notes && <span className="muted-text text-xs">{order.notes}</span>}
                              </div>
                            </td>
                            <td>{supplierName}</td>
                            <td>
                              {items.length === 0 ? (
                                <span className="muted-text text-sm">No line items</span>
                              ) : (
                                <div className="stack-xs">
                                  {items.map((item, index) => (
                                    <div key={`${rowKey}-supplier-item-${index}`}>
                                      {item?.name} × {item?.quantity} ({formatCurrency(item?.price)})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>{formatCurrency(order?.totalCost)}</td>
                            <td>
                              <span className={statusClass}>{statusText}</span>
                            </td>
                            <td>{order?.paymentMethod || "—"}</td>
                            <td>{formatDateTime(order?.updatedAt || order?.createdAt)}</td>
                            <td className="text-right">
                              <div className="action-grid justify-end">
                                {isPending && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openEditSupplierOrderModal(order)}
                                  >
                                    Update
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => openDeleteSupplierOrderModal(order)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

  {tab === "order" && activeOrderPanel === "cancelled" && (
          <div className="card stack-md order-panel">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">Cancelled orders (last 30 days)</h3>
                <p className="muted-text text-sm">
                  {loadingCancelledOrders
                    ? "Refreshing data…"
                    : `${filteredCancelledOrders.length} recent cancellation(s)`}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => loadCancelledOrders()}
                  disabled={loadingCancelledOrders}
                >
                  {loadingCancelledOrders ? "Loading…" : "Reload"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveOrderPanel(null)}
                >
                  Hide
                </button>
              </div>
            </div>

            <div className="stack-md">
              <div className="modal-toolbar">
                <input
                  className="input input-sm"
                  placeholder="Search contact, reason, payment…"
                  value={cancelledOrderQuery}
                  onChange={(event) => setCancelledOrderQuery(event.target.value)}
                />
                {cancelledOrderQuery && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCancelledOrderQuery("")}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="table-scroller modal-table-wrapper">
                <table className="data-table data-table--wide modal-table">
                  <thead>
                    <tr>
                      <th>Cancelled order</th>
                      <th>Contact</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Reason</th>
                      <th>Cancelled</th>
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCancelledOrders ? (
                      <tr>
                        <td colSpan={7} className="empty-cell">Loading cancelled orders…</td>
                      </tr>
                    ) : filteredCancelledOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-cell">
                          No cancellations recorded in the last 30 days.
                        </td>
                      </tr>
                    ) : (
                      filteredCancelledOrders.map((order) => {
                        const items = Array.isArray(order?.items) ? order.items : [];
                        const rowKey =
                          order?._id || order?.id || order?.originalOrderId || `${order?.contact || "cancelled"}-${order?.cancelledAt || ""}`;
                        return (
                          <tr key={rowKey}>
                            <td>
                              <div className="stack-xs">
                                <span className="font-medium break-words">{order?._id || order?.originalOrderId || "—"}</span>
                                {order?.originalOrderId && (
                                  <span className="muted-text text-xs">Original #{order.originalOrderId}</span>
                                )}
                              </div>
                            </td>
                            <td>{order?.contact || "—"}</td>
                            <td>{order?.paymentMethod || "—"}</td>
                            <td>{formatCurrency(order?.totalAmount)}</td>
                            <td>{order?.cancelReason || "Not specified"}</td>
                            <td>{formatDateTime(order?.cancelledAt)}</td>
                            <td>
                              {items.length === 0 ? (
                                <span className="muted-text text-sm">No line items</span>
                              ) : (
                                <div className="stack-xs">
                                  {items.map((item, index) => (
                                    <div key={`${rowKey}-cancelled-item-${index}`}>
                                      {item?.productName || item?.name} × {item?.quantity} ({formatCurrency(item?.price)})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

  {tab === "order" && activeOrderPanel === "adminCancelled" && (
          <div className="card stack-md order-panel">
            <div className="card-heading">
              <div className="stack-xs">
                <h3 className="heading-md">Admin archived supplier orders</h3>
                <p className="muted-text text-sm">
                  {loadingAdminCancelledOrders
                    ? "Refreshing data…"
                    : `${filteredAdminCancelledOrders.length} archived order(s) across admins`}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => loadAdminCancelledOrders()}
                  disabled={loadingAdminCancelledOrders}
                >
                  {loadingAdminCancelledOrders ? "Loading…" : "Reload"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveOrderPanel(null)}
                >
                  Hide
                </button>
              </div>
            </div>

            <div className="stack-md">
              <div className="modal-toolbar">
                <input
                  className="input input-sm"
                  placeholder="Search supplier, status, notes, admin…"
                  value={adminCancelledOrderQuery}
                  onChange={(event) => setAdminCancelledOrderQuery(event.target.value)}
                />
                {adminCancelledOrderQuery && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAdminCancelledOrderQuery("")}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="table-scroller modal-table-wrapper">
                <table className="data-table data-table--wide modal-table">
                  <thead>
                    <tr>
                      <th>Archived order</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Notes</th>
                      <th>Cancelled</th>
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdminCancelledOrders ? (
                      <tr>
                        <td colSpan={7} className="empty-cell">Loading admin cancellations…</td>
                      </tr>
                    ) : filteredAdminCancelledOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-cell">
                          No archived supplier orders yet. Archive an order to see it here.
                        </td>
                      </tr>
                    ) : (
                      filteredAdminCancelledOrders.map((order, index) => {
                        const items = Array.isArray(order?.items) ? order.items : [];
                        const rowKey =
                          order?._id || order?.originalOrderId || `${order?.supplierId || "order"}-${index}`;
                        let cancelledLabel = "Unknown";
                        if (order?.cancelledByName) {
                          cancelledLabel = order.cancelledByName;
                        } else if (order?.cancelledBy && typeof order.cancelledBy === "object") {
                          cancelledLabel =
                            order.cancelledBy?.name ||
                            order.cancelledBy?.fullName ||
                            order.cancelledBy?.email ||
                            order.cancelledBy?._id ||
                            order.cancelledBy?.id ||
                            "Unknown";
                        } else if (order?.cancelledBy) {
                          cancelledLabel = String(order.cancelledBy);
                        }
                        return (
                          <tr key={rowKey}>
                            <td>
                              <div className="stack-xs">
                                <span className="font-medium break-words">{order?._id || order?.originalOrderId || "—"}</span>
                                {order?.originalOrderId && (
                                  <span className="muted-text text-xs">Original #{order.originalOrderId}</span>
                                )}
                              </div>
                            </td>
                            <td>{order?.supplierId || "—"}</td>
                            <td>{order?.status || "—"}</td>
                            <td>{formatCurrency(order?.totalCost)}</td>
                            <td>{order?.notes || <span className="muted-text text-sm">No notes</span>}</td>
                            <td>
                              <div className="stack-xs">
                                <span>{cancelledLabel}</span>
                                <span className="muted-text text-xs">{formatDateTime(order?.cancelledAt)}</span>
                              </div>
                            </td>
                            <td>
                              {items.length === 0 ? (
                                <span className="muted-text text-sm">No line items</span>
                              ) : (
                                <div className="stack-xs">
                                  {items.map((item, itemIndex) => (
                                    <div key={`${rowKey}-admin-cancelled-item-${itemIndex}`}>
                                      {`${item?.name || item?.productId || "Unnamed item"} × ${item?.quantity} (${formatCurrency(
                                        item?.lineTotal ?? item?.price
                                      )})`}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showCancelOrderModal && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={closeCancelOrderModal}
          >
            <form
              className="card modal-card stack-md"
              onSubmit={submitCancelCustomerOrder}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close cancel order modal"
                onClick={closeCancelOrderModal}
              >
                ×
              </button>

              <div className="card-heading">
                <h3 className="heading-md">Cancel customer order</h3>
              </div>
              <div className="modal-body">
                <div className="stack-sm">
                  <p className="muted-text text-sm">
                    You are about to cancel order <strong>{orderToCancel?._id}</strong>. The customer will no longer see it in their active list.
                  </p>
                  <label className="label" htmlFor="cancel-reason">Cancellation reason</label>
                  <textarea
                    id="cancel-reason"
                    className="input"
                    rows={3}
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeCancelOrderModal}>
                  Keep order
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showEditSupplierOrderModal && orderToEdit && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={closeEditSupplierOrderModal}
          >
            <form
              className="card modal-card stack-md"
              onSubmit={updateSupplierOrder}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close supplier order update modal"
                onClick={closeEditSupplierOrderModal}
              >
                ×
              </button>

              <div className="card-heading">
                <h3 className="heading-md">Update supplier order</h3>
              </div>

              <div className="modal-body">
                <div className="stack-sm">
                  <div className="stack-xs">
                    <span className="muted-text text-xs uppercase tracking-wide">Order id</span>
                    <span className="font-medium break-words">{orderToEdit?._id}</span>
                  </div>
                  <div className="stack-xs">
                    <span className="muted-text text-xs uppercase tracking-wide">Supplier</span>
                    <span>{(() => {
                      const firstItem = orderToEdit?.items?.[0];
                      const supplier = firstItem?.supplierId;
                      if (!supplier) return "—";
                      if (typeof supplier === "string") return supplier;
                      return supplier?.name || supplier?.email || "—";
                    })()}</span>
                  </div>
                  <div className="stack-xs">
                    <span className="muted-text text-xs uppercase tracking-wide">Items</span>
                    <div className="stack-xs">
                      {(orderToEdit?.items || []).map((item, index) => (
                        <div key={`edit-item-${index}`}>
                          {item?.name} × {item?.quantity} ({formatCurrency(item?.price)})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="supplier-order-status">Status</label>
                    <select
                      id="supplier-order-status"
                      className="input"
                      value={supplierOrderForm.status}
                      onChange={(event) =>
                        setSupplierOrderForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                    >
                      <option value="Pending">Pending</option>
                      <option value="Ordered">Ordered</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="supplier-order-notes">Notes</label>
                    <textarea
                      id="supplier-order-notes"
                      className="input"
                      rows={3}
                      value={supplierOrderForm.notes}
                      onChange={(event) =>
                        setSupplierOrderForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Optional notes for your team or supplier"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeEditSupplierOrderModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-secondary">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        )}

        {showDeleteSupplierOrderModal && orderPendingDelete && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={closeDeleteSupplierOrderModal}
          >
            <div
              className="card modal-card stack-md"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close delete supplier order modal"
                onClick={closeDeleteSupplierOrderModal}
              >
                ×
              </button>

              <div className="card-heading">
                <h3 className="heading-md">Delete supplier order</h3>
              </div>
              <div className="modal-body">
                <p className="muted-text text-sm">
                  This will permanently remove order <strong>{orderPendingDelete?._id}</strong> from the supplier purchase queue. Continue?
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeDeleteSupplierOrderModal}>
                  Keep order
                </button>
                <button type="button" className="btn btn-danger" onClick={deleteSupplierOrder}>
                  Delete order
                </button>
              </div>
            </div>
          </div>
        )}


        {/* FINANCE */}
        {tab === "finance" && (
          <div className="stack-lg">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {financeQuickLinks.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="card stack-xs text-left"
                  onClick={() => handleFinanceQuickOpen(card.id)}
                  style={{
                    border: "1px solid rgba(15,118,110,0.12)",
                    boxShadow: "0 14px 24px rgba(15,118,110,0.08)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 28 }}>{card.icon}</span>
                  <div className="stack-xs">
                    <h3 className="heading-sm">{card.title}</h3>
                    <p className="muted-text text-sm">{card.description}</p>
                  </div>
                  <span className="muted-text text-xs" style={{ marginTop: "auto" }}>
                    Click to open inside the finance console
                  </span>
                </button>
              ))}
            </section>

            <FinanceConsole
              key={`finance-console-${financeConsoleKey}`}
              initialView={financeView}
            />
          </div>
        )}

        {/* SUPPLIERS */}
        {tab === "suppliers" && (
          <div className="stack-lg">
            <div className="card">
              <SupplierAdminProductList />
            </div>
            <SupplierDiscountAdminList />
          </div>
        )}

        {/* SALES quick view */}
        {tab === "sales" && (
          <div>
            <SalesAnalytics weeks={10} months={5} />
          </div>
        )}
      </section>

      {/* PRODUCT MODAL */}
      {showProductForm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={closeProductForm}
        >
          <form
            onSubmit={handleProductSubmit}
            className="card modal-card modal-card--wide stack-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label={productMode === "create" ? "Close add product modal" : "Close edit product modal"}
              onClick={closeProductForm}
            >
              ×
            </button>

            <div className="card-heading">
              <h3 className="heading-md">{productMode === "create" ? "Add product" : "Edit product"}</h3>
            </div>
            <div className="modal-body">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="product-name">Name</label>
                  <input
                    id="product-name"
                    className="input"
                    value={productForm.name}
                    onChange={(e) => handleProductInputChange("name", e.target.value)}
                    placeholder="e.g. Heavy duty drill"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="product-price">Price (Rs.)</label>
                  <input
                    id="product-price"
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => handleProductInputChange("price", e.target.value)}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label" htmlFor="product-description">Description</label>
                  <textarea
                    id="product-description"
                    className="input"
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => handleProductInputChange("description", e.target.value)}
                    placeholder="Short summary of the product"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="product-category">Category</label>
                  <input
                    id="product-category"
                    className="input"
                    value={productForm.category}
                    onChange={(e) => handleProductInputChange("category", e.target.value)}
                    placeholder="e.g. Power tools"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="product-brand">Brand</label>
                  <input
                    id="product-brand"
                    className="input"
                    value={productForm.brand}
                    onChange={(e) => handleProductInputChange("brand", e.target.value)}
                    placeholder="e.g. Bosch"
                    required
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="product-instock"
                    type="checkbox"
                    checked={productForm.inStock}
                    onChange={(event) =>
                      handleProductInputChange("inStock", event.target.checked)
                    }
                  />
                  <label className="label" htmlFor="product-instock">
                    In stock
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="label" htmlFor="product-image">Product image</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="product-image"
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProductImageFile(e.target.files?.[0] || null)}
                    />
                    <p className="muted-text text-xs">Upload JPG or PNG up to 2MB.</p>
                  </div>
                  {productMode === "edit" && productForm.imageUrl && !productImageFile && (
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveImageUrl(productForm.imageUrl)}
                        alt={productForm.name}
                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "0.75rem" }}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      <span className="muted-text text-sm">Current image</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeProductForm} disabled={productBusy}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={productBusy}>
                {productBusy ? (productMode === "create" ? "Adding…" : "Saving…") : productMode === "create" ? "Add product" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER MODAL */}
      {showUserForm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowUserForm(false)}
        >
          <form
            onSubmit={submitUser}
            className="card modal-card stack-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label={userMode === "create" ? "Close create user modal" : "Close edit user modal"}
              onClick={() => setShowUserForm(false)}
            >
              ×
            </button>

            <div className="card-heading">
              <h3 className="heading-md">{userMode === "create" ? "Create user" : "Edit user"}</h3>
            </div>
            <div className="modal-body">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  />
                </div>

                {userMode === "create" && (
                  <div className="md:col-span-2">
                    <label className="label">Password</label>
                    <input
                      className="input"
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="Default: changeme123"
                    />
                  </div>
                )}

                <div>
                  <label className="label">Age</label>
                  <input
                    className="input"
                    type="number"
                    value={userForm.age}
                    onChange={(e) => setUserForm({ ...userForm, age: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input
                    className="input"
                    value={userForm.address}
                    onChange={(e) => setUserForm({ ...userForm, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Role</label>
                  <select
                    className="input"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  >
                    {(roles.length ? roles.map((r) => r.name) : ["admin", "customer care manager", "staff", "user"]).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowUserForm(false)}
                disabled={userBusy}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={userBusy}>
                {userBusy ? "Saving..." : userMode === "create" ? "Create user" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ROLE MODAL */}
      {showRoleForm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowRoleForm(false)}
        >
          <form
            onSubmit={submitRole}
            className="card modal-card modal-card--wide stack-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label={roleMode === "create" ? "Close create role modal" : "Close edit role modal"}
              onClick={() => setShowRoleForm(false)}
            >
              ×
            </button>

            <div className="card-heading">
              <h3 className="heading-md">{roleMode === "create" ? "Create role" : "Edit role"}</h3>
            </div>

            <div className="modal-body">
              <div className="stack-md">
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="label">Role name</label>
                    <input
                      className="input"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      placeholder="e.g. admin, store_manager, inventory_manager"
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input
                      className="input"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {PRIV_CATEGORIES.map((cat) => (
                    <div key={cat.title} className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                      <div className="font-bold mb-2">{cat.title}</div>
                      <div className="grid md:grid-cols-2 gap-2">
                        {cat.items.map((p) => (
                          <label key={p.id} className="flex gap-2 items-center">
                            <input
                              type="checkbox"
                              checked={roleForm.privileges?.includes(p.id) || false}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setRoleForm((f) => {
                                  const s = new Set(f.privileges || []);
                                  on ? s.add(p.id) : s.delete(p.id);
                                  return { ...f, privileges: [...s] };
                                });
                              }}
                            />
                            <span>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowRoleForm(false)}
                disabled={roleBusy}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={roleBusy}>
                {roleBusy ? "Saving..." : roleMode === "create" ? "Create role" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
  
}
