// src/Components/Dashboard/Dashboard.js
import React, { useMemo, useState, useEffect, useRef, useCallback, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminReviews from "../Reviews_&_Feedback/AdminReviews";
import NotificationsPanel from "../Notifications/NotificationsPanel";
import AdminReviewRecycleBin from "../Reviews_&_Feedback/AdminReviewRecycleBin";
import MyReviews from "../Reviews_&_Feedback/MyReviewsNew";
import AdminRefunds from "../Refund/AdminRefunds";
import { AdminCartContext } from "../Order/Admin/AdminCartContext";
import { formatLKR, formatLKRCompact } from "../../utils/currency";
import CustomerDashboard from "./CustomerDashboard";
import CustomerOrders from "../Order/Customer/CustomerOrders";
import Cart from "../Order/Customer/Cart";
import { CartContext } from "../Order/Customer/CartContext";
import FinanceConsole from "../Finance/FinanceConsole";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const API_ROOT = String(API).replace(/\/$/, "");
// Use /api specifically for endpoints that are definitely under /api
const APIv2 = `${API_ROOT}/api`;
const ORIGIN = API_ROOT;

// Define sets of privileges for finance roles
const FINANCE_PRIVILEGE_SETS = {
  viewOnline: ["fin_view_online_payments", "fin_view_dashboard", "fin_payments"],
  viewSupplier: ["fin_view_supplier_payments", "fin_record_payments", "fin_payouts"],
  viewDeclined: [
    "fin_view_declined_payments",
    "fin_manage_declined_payments",
    "fin_payroll",
    "fin_reconcile",
  ],
  manageDeclined: ["fin_manage_declined_payments", "fin_payroll", "fin_reconcile"],
  viewNotifications: [
    "fin_view_finance_notifications",
    "fin_view_notifications",
    "fin_export_statements",
    "fin_statements",
    "fin_reports",
  ],
  exportStatements: ["fin_export_statements", "fin_statements", "fin_reports"],
  manageSalary: ["fin_manage_salary"],
};

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

// Utility to check if a value matches a search term (case-insensitive, deep)
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

const REORDER_STORAGE_KEY = "smart_hardware_reorder_queue";
// Read reorders from localStorage
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

// Main Dashboard component
function DashboardPrivileged({ initialTab }) {
  // add updateProfile/changePassword so Profile actually works
  const {
    user,
    theme,
    setTheme: setThemePreference,
    toggleTheme,
    token,
    updateProfile,
    changePassword,
    uploadAvatar,
    deleteAvatar,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarInputRef = useRef(null);
  const { addToCart } = useContext(AdminCartContext);
  const { cartState } = useContext(CartContext);
  const minExpiryDate = useMemo(() => getTodayInputValue(), []);

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const initials = useMemo(() => {
    return (user?.name || "U")
      .trim()
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);

  /** ---------- Role & permission gates (robust, whitespace-safe) ---------- */
  const roleNorm = String(user?.role || "").trim().toLowerCase(); // normalize role name
  const permissionSet = useMemo(() => {
    const list = Array.isArray(user?.permissions) ? user.permissions : [];
    const normalized = list.map((p) => String(p || "").trim().toLowerCase()).filter(Boolean);
    return new Set(normalized);
  }, [user?.permissions]);
  const has = useCallback((p) => permissionSet.has(String(p).toLowerCase()), [permissionSet]);
  const hasAny = useCallback((arr) => arr.some((p) => has(p)), [has]);

  // Admin menus appear when any of these are true (unchanged)
  const isAdmin =
    roleNorm === "admin" || has("admin") || has("manage_users") || has("manage_roles");

    // Finance capabilities (granular)
  const financeCaps = useMemo(() => {
    const includes = (keys) => keys.some((key) => permissionSet.has(String(key).toLowerCase()));
    const canViewOnline = isAdmin || includes(FINANCE_PRIVILEGE_SETS.viewOnline);
    const canViewSupplier = isAdmin || includes(FINANCE_PRIVILEGE_SETS.viewSupplier);
    const canViewDeclined = isAdmin || includes(FINANCE_PRIVILEGE_SETS.viewDeclined);
    const canDeleteDeclined = isAdmin || includes(FINANCE_PRIVILEGE_SETS.manageDeclined);
    const canViewNotifications = isAdmin || includes(FINANCE_PRIVILEGE_SETS.viewNotifications);
    const canExportStatements = isAdmin || includes(FINANCE_PRIVILEGE_SETS.exportStatements);
    const canManageSalary = isAdmin || includes(FINANCE_PRIVILEGE_SETS.manageSalary);
    const canAccessConsole =
      isAdmin ||
      canViewOnline ||
      canViewSupplier ||
      canViewDeclined ||
      canViewNotifications ||
      canManageSalary;

    return {
      canAccessConsole,
      canViewOnline,
      canViewSupplier,
      canViewDeclined,
      canDeleteDeclined,
      canViewNotifications,
      canExportStatements,
      canManageSalary,
    };
  }, [isAdmin, permissionSet]);

  const hasFinancePrivileges = Object.values(financeCaps).some(Boolean);

  // Be tolerant to common naming variants
  const canSales =
    isAdmin ||
    roleNorm === "sales_manager" ||
    roleNorm.includes("sales") ||
    hasAny([
      "sales_manage_orders",
      "sales_process_refunds",
      "sales_view_reports",
      "sales_manage_discounts",
      "sales_dashboard",
      "sales_refund",
      "sales_promotions",
      "sales_reports",
    ]);

  const canFinance =
    isAdmin ||
    roleNorm === "finance_manager" ||
    roleNorm === "financial_manager" ||
    roleNorm.includes("finance") ||
    hasFinancePrivileges;

  const canInventory =
    isAdmin ||
    roleNorm === "inventory_manager" ||
    roleNorm.includes("inventory") ||
    hasAny(["inv_view_stock", "inv_update_stock", "inv_receive_goods", "inv_reports", "inv_reorder"]);

  const canCare =
    isAdmin ||
    roleNorm === "customer_care_manager" ||
    roleNorm === "customer_care" ||
    roleNorm === "feedback_manager" ||
    roleNorm === "feedback manager" ||
    roleNorm.includes("customer care") ||
    roleNorm.includes("customer_care") ||
    roleNorm.includes("feedback") ||
    roleNorm.includes("support") ||
    roleNorm.endsWith("care") ||
    hasAny([
      "cc_view_feedback",
      "cc_respond_feedback",
      "cc_manage_returns",
      "moderate_feedback",
      "refund_view_requests",
      "refund_manage_requests",
    ]);

  const canRefunds =
    isAdmin ||
    roleNorm.includes("customer care") ||
    roleNorm.includes("customer_care") ||
    roleNorm.includes("support") ||
    hasAny(["refund_view_requests", "refund_manage_requests", "cc_manage_returns"]);

  const isSupplier =
    roleNorm === "supplier" ||
    roleNorm.includes("supplier") ||
    hasAny([
      "supplier_portal",
      "supplier_manage_products",
      "supplier_receive_orders",
      "supplier_manage_inventory",
    ]);

  // a “plain” user is not admin and not any manager
  const isPlainUser = !isAdmin && !canSales && !canFinance && !canInventory && !canCare && !isSupplier;

  const queryTab = useMemo(() => {
    if (!location?.search) return null;
    try {
      const params = new URLSearchParams(location.search);
      const value = params.get("tab");
      return value ? value.trim().toLowerCase() : null;
    } catch (error) {
      console.warn("Failed to parse dashboard tab from query", error);
      return null;
    }
  }, [location?.search]);

  const [tab, setTab] = useState(() => initialTab || queryTab || "dashboard");
  const [careView, setCareView] = useState("reviews");

  useEffect(() => {
    if (!initialTab) return;
    setTab((current) => (current === initialTab ? current : initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (!queryTab) return;
    setTab((current) => (current === queryTab ? current : queryTab));
  }, [queryTab]);

  useEffect(() => {
    if (tab !== "supplying" || isSupplier) return;
    setTab("dashboard");
  }, [tab, isSupplier]);

  // ------- Sales (manager) -------
  const [salesStats, setSalesStats] = useState({ totalOrders: 0, refunded: 0, recent: [] });
  const [salesOrders, setSalesOrders] = useState([]);
  useEffect(() => {
    if (!canSales) return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const s = await fetch(`${API}/sales/dashboard`, { headers });
        const o = await fetch(`${API}/sales/orders`, { headers });
        setSalesStats(s.ok ? await s.json() : { totalOrders: 128, refunded: 3, recent: [] });
        setSalesOrders(o.ok ? await o.json() : []);
      } catch {
        setSalesStats({ totalOrders: 128, refunded: 3, recent: [] });
        setSalesOrders([]);
      }
    })();
  }, [canSales, token]);

  // ------- Finance (manager) -------
  // ------- Inventory (manager) -------
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [inventoryMsg, setInventoryMsg] = useState("");
  const [inventoryErr, setInventoryErr] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState(10);
  const [stockDrafts, setStockDrafts] = useState({});
  const [expiryDrafts, setExpiryDrafts] = useState({});
  const [reorderDrafts, setReorderDrafts] = useState({});
  const [inventorySavingId, setInventorySavingId] = useState(null);
  const [reorderList, setReorderList] = useState(() => readStoredReorders());
  const [reorderNotes, setReorderNotes] = useState("");
  const [reorderFilter, setReorderFilter] = useState("pending");

  const [orderSectionsOpen, setOrderSectionsOpen] = useState({
    cart: true,
    history: true,
    cancelled: false,
  });

  const toggleOrderSection = useCallback((key) => {
    setOrderSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const clearInventoryAlerts = useCallback(() => {
    setInventoryMsg("");
    setInventoryErr("");
  }, []);

  const showInventoryMessage = useCallback((message) => {
    setInventoryErr("");
    setInventoryMsg(message);
  }, []);

  const showInventoryError = useCallback((message) => {
    setInventoryMsg("");
    setInventoryErr(message);
  }, []);

  const loadInventoryProducts = useCallback(
    async ({ suppressError = false } = {}) => {
      if (!canInventory) return;
      setLoadingProducts(true);
      if (!suppressError) setInventoryErr("");
      try {
        const data = await fetchJSON(`${ORIGIN}/products`, { headers: authHeader });
        setProducts(Array.isArray(data) ? data : data?.products ?? []);
      } catch (error) {
        if (!suppressError) {
          showInventoryError(error.message);
          setProducts([]);
        }
      } finally {
        setLoadingProducts(false);
      }
    },
    [authHeader, canInventory, showInventoryError]
  );

  useEffect(() => {
    if (!canInventory) return;
    loadInventoryProducts({ suppressError: true });
  }, [canInventory, loadInventoryProducts]);

  const [ordersSnapshot, setOrdersSnapshot] = useState([]);
  const [cancelledOrders, setCancelledOrders] = useState([]);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledError, setCancelledError] = useState("");

  const handleOrdersChange = useCallback((next) => {
    setOrdersSnapshot((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return Array.isArray(resolved) ? resolved : [];
    });
  }, []);
  useEffect(() => {
    if (!isPlainUser) return;
    let active = true;
    const headers = { ...authHeader };

    const loadCancelled = async () => {
      setCancelledLoading(true);
      setCancelledError("");
      try {
        const response = await fetch(`${APIv2}/orders/cancelled`, { headers });
        if (!active) return;
        if (response.status === 404) {
          setCancelledOrders([]);
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload?.message || `Failed to load cancelled orders (${response.status})`
          );
        }
        const records = Array.isArray(payload?.cancelledOrders) ? payload.cancelledOrders : [];
        setCancelledOrders(records);
      } catch (error) {
        console.warn("Failed to load cancelled orders", error);
        if (!active) return;
        setCancelledError(error.message || "Failed to load cancelled orders");
        setCancelledOrders([]);
      } finally {
        if (active) setCancelledLoading(false);
      }
    };

    loadCancelled();

    return () => {
      active = false;
    };
  }, [isPlainUser, authHeader]);

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
        const product = products.find((candidate) => candidate?._id === item.productId);
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

  const orderSummary = useMemo(() => {
    const list = Array.isArray(ordersSnapshot) ? ordersSnapshot : [];
    let paid = 0;
    let pending = 0;
    let awaiting = 0;
    let totalSpent = 0;
    let lastPlaced = null;

    list.forEach((order) => {
      const amount = Number(order?.totalAmount ?? 0);
      if (Number.isFinite(amount)) {
        totalSpent += amount;
      }

      const paymentStatus = String(order?.paymentInfo?.paymentStatus || "").toLowerCase();
      if (paymentStatus === "paid") paid += 1;
      else if (paymentStatus === "requires_action") awaiting += 1;
      else pending += 1;

      const createdTime = order?.createdAt ? Date.parse(order.createdAt) : NaN;
      if (Number.isFinite(createdTime)) {
        lastPlaced = lastPlaced == null ? createdTime : Math.max(lastPlaced, createdTime);
      }
    });

    return { total: list.length, paid, pending, awaiting, totalSpent, lastPlaced };
  }, [ordersSnapshot]);

  const cancelledSummary = useMemo(() => {
    const list = Array.isArray(cancelledOrders) ? cancelledOrders : [];
    let totalAmount = 0;
    let lastCancelled = null;

    list.forEach((entry) => {
      const amount = Number(entry?.totalAmount ?? 0);
      if (Number.isFinite(amount)) {
        totalAmount += amount;
      }

      const cancelledAt = entry?.cancelledAt ? Date.parse(entry.cancelledAt) : NaN;
      if (Number.isFinite(cancelledAt)) {
        lastCancelled =
          lastCancelled == null ? cancelledAt : Math.max(lastCancelled, cancelledAt);
      }
    });

    return { total: list.length, totalAmount, lastCancelled };
  }, [cancelledOrders]);

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

  const productIndex = useMemo(() => {
    const lookup = {};
    products.forEach((product) => {
      if (product?._id) {
        lookup[product._id] = product;
      }
    });
    return lookup;
  }, [products]);

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
    // Prevent negative numbers for stock inputs. Allow empty string while editing.
    let nextValue = value;
    if (typeof nextValue === "string") {
      if (nextValue.trim() === "") {
        nextValue = "";
      } else {
        const parsed = Number(nextValue);
        if (Number.isFinite(parsed)) {
          nextValue = String(Math.max(0, parsed));
        }
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
      showInventoryError("Product not found");
      return;
    }
    const numeric = Number(nextStock);
    if (!Number.isFinite(numeric) || numeric < 0) {
      showInventoryError("Enter a valid stock amount");
      return;
    }
    const normalizedStock = Math.max(0, Math.floor(numeric));
    const payload = buildProductUpdatePayload(product, {
      inStock: normalizedStock > 0,
      stockAmount: normalizedStock,
    });

    setInventorySavingId(productId);
    clearInventoryAlerts();
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

      showInventoryMessage(`Stock updated for ${product.name || "product"}`);
    } catch (error) {
      showInventoryError(error.message);
    } finally {
      setInventorySavingId(null);
    }
  };

  const handleApplyExactStock = (productId) => {
    const draft = stockDrafts[productId]?.set;
    if (draft === undefined || draft === "") {
      showInventoryError("Enter a stock amount to apply");
      return;
    }
    updateProductStock(productId, draft);
  };

  const handleReduceStock = (productId) => {
    const product = productIndex[productId];
    if (!product) {
      showInventoryError("Product not found");
      return;
    }
    const draft = stockDrafts[productId]?.reduce;
    if (!draft) {
      showInventoryError("Enter a quantity to reduce");
      return;
    }
    const reduction = Number(draft);
    if (!Number.isFinite(reduction) || reduction <= 0) {
      showInventoryError("Reduction must be greater than zero");
      return;
    }
    const currentStock = Number(product.stockAmount ?? 0);
    const nextStock = Math.max(0, currentStock - reduction);
    updateProductStock(productId, nextStock);
  };

  const handleSaveExpiry = async (productId) => {
    const product = productIndex[productId];
    if (!product) {
      showInventoryError("Product not found");
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
      showInventoryError("Pick an expiry date before saving");
      return;
    }

    if (trackingDraft && dateValue && dateValue < minExpiryDate) {
      showInventoryError("Expiry date cannot be earlier than today");
      return;
    }

    if (trackingDraft && reminderValue !== "") {
      const numericReminder = Number(reminderValue);
      if (!Number.isFinite(numericReminder) || numericReminder < 0) {
        showInventoryError("Reminder days must be zero or greater");
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
      showInventoryError("Unable to prepare update payload");
      return;
    }

    setInventorySavingId(productId);
    clearInventoryAlerts();
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
      showInventoryMessage(`Expiry settings updated for ${updatedProduct.name || "product"}`);
    } catch (error) {
      showInventoryError(error.message);
    } finally {
      setInventorySavingId(null);
    }
  };

  const handleAddToReorder = (productId) => {
    const product = productIndex[productId];
    if (!product) {
      showInventoryError("Product not found");
      return;
    }
    const draft = reorderDrafts[productId] || {};
    const qty = Number(draft.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      showInventoryError("Enter a reorder quantity greater than zero");
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
      requestedBy: user?.name || user?.email || "Inventory",
    };

    setReorderList((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...entry };
        return next;
      }
      return [...prev, entry];
    });

    setReorderDrafts((prev) => ({
      ...prev,
      [productId]: { qty: "", notes: "" },
    }));

    clearInventoryAlerts();
    showInventoryMessage(`Added ${product.name || "item"} to reorder list`);
  };

  const handleReorderStatusChange = (productId, status) => {
    setReorderList((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, status } : item))
    );
  };

  const handleRemoveReorderItem = (productId) => {
    setReorderList((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSendToSupplierCart = (item) => {
    if (!item?.productId) return;
    addToCart({
      productId: item.productId,
      name: item.name,
      quantity: Math.max(1, Number(item.reorderQty ?? 1)),
      notes: item.notes,
    });
    showInventoryMessage("Item added to supplier cart");
  };

  const handleAutoQueueLowStock = () => {
    if (!lowStockItems.length) {
      showInventoryError("No low-stock items to queue right now");
      return;
    }
    const timestamp = new Date().toISOString();
    clearInventoryAlerts();
    setReorderList((prev) => {
      const next = [...prev];
      const indexer = new Map(next.map((entry, idx) => [entry.productId, idx]));
      lowStockItems.forEach((product) => {
        if (!product?._id) return;
        const currentStock = Number(product.stockAmount ?? 0);
        const suggested = Math.max(
          1,
          lowStockLimit > currentStock ? lowStockLimit - currentStock : lowStockLimit || 1
        );
        const entry = {
          productId: product._id,
          name: product.name || "",
          category: product.category || "",
          stockAmount: currentStock,
          reorderQty: suggested,
          threshold: Number.isFinite(Number(reorderThreshold))
            ? Number(reorderThreshold)
            : undefined,
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
    showInventoryMessage("Low-stock items queued for reorder");
  };

  const triggerCsvDownload = (filename, header, rows) => {
    if (typeof window === "undefined") return false;
    if (!Array.isArray(rows) || rows.length === 0) {
      showInventoryError("No data available to export");
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
      showInventoryError("Unable to generate CSV file");
      return false;
    }
  };

  const handleExportStockReport = () => {
    clearInventoryAlerts();
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
      showInventoryMessage("Stock report downloaded");
    }
  };

  const handleExportReorderReport = () => {
    clearInventoryAlerts();
    const note = (reorderNotes || "").trim();
    const header = [
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

    const rows = filteredReorderQueue.map((item) => {
      const product = productIndex[item.productId];
      const price = Number(product?.price ?? 0);
      const qty = Number(item.reorderQty ?? 0);
      const total = Number.isFinite(price) && Number.isFinite(qty) ? price * qty : "";
      return [
        item.productId,
        item.name,
        item.category,
        item.stockAmount,
        qty,
        item.status,
        price,
        total,
        item.notes,
        note,
        item.createdAt,
        item.requestedBy,
      ];
    });

    if (triggerCsvDownload(`reorder-report-${Date.now()}.csv`, header, rows)) {
      showInventoryMessage("Reorder report downloaded");
    }
  };

  // ------- Care (manager) -------
  const [careList, setCareList] = useState([]);
  useEffect(() => {
    if (!canCare) return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/care/feedbacks`, { headers });
        setCareList(r.ok ? await r.json() : []);
      } catch {
        setCareList([]);
      }
    })();
  }, [canCare, token]);

  const carePending = useMemo(() => careList.filter((f) => !f.reply).length, [careList]);

  // -------- Supplier workspace data --------
  // eslint-disable-next-line no-unused-vars
  const [suppliers, setSuppliers] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [suppliersErr, setSuppliersErr] = useState("");

  useEffect(() => {
    if (!(isSupplier && tab === "supplying")) return;
    setLoadingSuppliers(true);
    setSuppliersErr("");
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        // Suppliers are mounted under /api on the server; use APIv2 here.
        const r = await fetch(`${APIv2}/suppliers`, { headers });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to load suppliers");
        setSuppliers(await r.json());
      } catch (e) {
        setSuppliers([]);
        setSuppliersErr(e.message || "Failed to load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    })();
  }, [isSupplier, tab, token]);

  // -------- Profile form (works for all users) --------
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    age: user?.age ?? "",
    address: user?.address || "",
  });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  
  // Save profile updates
  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    const trimmedName = (profile.name || "").trim();  // Name is required
    const trimmedEmail = (profile.email || "").trim(); // Email is required
    const trimmedAddress = typeof profile.address === "string" ? profile.address.trim() : ""; // Address is optional
    const parsedAge = profile.age === "" ? undefined : Number(profile.age); // Age is optional, must be a number if provided

    // Validate fields
    if (!trimmedName) return setProfileErr("Name is required");      
    if (!trimmedEmail) return setProfileErr("Email is required"); 
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {   // Basic email format check
      return setProfileErr("Enter a valid email address");  
    }
    if (parsedAge !== undefined && Number.isNaN(parsedAge)) {
      return setProfileErr("Age must be a number");
    }

    // All validations passed, proceed to save
    setSavingProfile(true); 
    try {
      const updated = await updateProfile({
        name: trimmedName,
        email: trimmedEmail,
        age: parsedAge,
        address: trimmedAddress || undefined,
      });
      setProfile({ // reset form with saved values
        name: updated.name || "",
        email: updated.email || trimmedEmail,
        age: updated.age ?? "",
        address: updated.address || "",
      });
      setProfileMsg("Profile updated");
    } catch (ex) {
      setProfileErr(ex.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password
  const savePassword = async (e) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    if (!pwd.current) return setProfileErr("Current password is required"); // Current password is required
    if (!pwd.next || pwd.next.length < 6) {
      return setProfileErr("New password must be at least 6 characters");
    }
    if (pwd.next !== pwd.confirm) return setProfileErr("Passwords do not match");

    // All validations passed, proceed to change password
    setChangingPwd(true);
    try {
      await changePassword(pwd.current, pwd.next);
      setProfileMsg("Password changed"); // reset form
      setPwd({ current: "", next: "", confirm: "" }); 
      setShowPwd({ current: false, next: false, confirm: false }); // hide passwords
    } catch (ex) {
      setProfileErr(ex.message || "Failed to change password");
    } finally {
      setChangingPwd(false);
    }
  };

  const triggerAvatarPicker = () => {
    setProfileErr("");
    avatarInputRef.current?.click?.();
  };

  // Handle avatar file selection and upload
  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {  // Max 2MB
      setProfileErr("Profile photos must be smaller than 2MB"); 
      event.target.value = "";
      return;
    }
    setUploadingAvatar(true); // show loading state
    setProfileErr("");
    setProfileMsg("");
    try {
      await uploadAvatar(file);
      setProfileMsg("Profile photo updated");
    } catch (ex) {
      setProfileErr(ex.message || "Failed to upload photo");
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
    setProfileErr("");
    setProfileMsg("");
    try {
      await deleteAvatar();
      setProfileMsg("Profile photo removed");
    } catch (ex) {
      setProfileErr(ex.message || "Failed to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Logout
  const handleLogout = () => {
  logout();
  navigate("/login", { replace: true });
  };

  // Determine active tab title
  const activeTitle =
    tab === "dashboard"
      ? "Dashboard overview"
      : tab === "profile"
      ? "Profile"
      : tab === "sales"
      ? "Sales manager"
      : tab === "finance"
      ? "Finance manager"
      : tab === "inventory"
      ? "Inventory manager"
      : tab === "care"
      ? "Feedback & care"
  : tab === "refunds"
  ? "Refunds & returns"
      : tab === "orders"
      ? "My orders"
      : tab === "myfeedback"
      ? "My feedback"
      : tab === "supplying"
  ? "Supplier workspace"
      : "Settings";

  // User initials for avatar fallback
  const roleLabel = (user?.role || "user").replace(/\b\w/g, (c) => c.toUpperCase());
  const userIdSuffix = user?._id ? user._id.slice(-6) : "000000";

  return (
    <div className="admin-dashboard">
      <div className="dashboard-shell dashboard-shell--two-column multi-dashboard">
        {/* Sidebar */}
        <aside className="card dashboard-sidebar">
        <div className="sidebar-profile">
          {user?.avatar ? (
            <img alt="avatar" src={user.avatar} className="avatar avatar--md" />
          ) : (
            <div className="avatar avatar--md avatar--fallback">{initials}</div>
          )}
          <div className="sidebar-profile__meta">
            <div className="font-semibold">{user?.name || "User"}</div>
            <div className="text-xs text-muted">{user?.email}</div>
          </div>
        </div>

          <nav className="dashboard-nav stack-sm">
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                navigate("/AdminDashboard");
              } else {
                setTab("dashboard");
              }
            }}
            className={`sidebar-link ${tab === "dashboard" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">📊</span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("profile")}
            className={`sidebar-link ${tab === "profile" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">👤</span>
            <span>Profile</span>
          </button>

          {isAdmin && (
            <div className="nav-section stack-xs">
              <span className="nav-section__label">Admin tools</span>
              <button
                type="button"
                onClick={() => navigate("/AdminDashboard#users")}
                className="sidebar-link"
              >
                <span className="sidebar-link__icon">👥</span>
                <span>User management</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/AdminDashboard#roles")}
                className="sidebar-link"
              >
                <span className="sidebar-link__icon">🛡️</span>
                <span>Roles &amp; privileges</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/AdminDashboard#product")}
                className="sidebar-link"
              >
                <span className="sidebar-link__icon">📦</span>
                <span>Product management</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/AdminDashboard#inventory")}
                className="sidebar-link"
              >
                <span className="sidebar-link__icon">📊</span>
                <span>Inventory workspace</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/AdminDashboard#feedback")}
                className="sidebar-link"
              >
                <span className="sidebar-link__icon">💬</span>
                <span>Feedback workspace</span>
              </button>
            </div>
          )}

          {(canSales || canFinance || canInventory || canCare) && <div className="nav-divider" role="separator" />}

          {canSales && (
            <button
              type="button"
              onClick={() => setTab("sales")}
              className={`sidebar-link ${tab === "sales" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">🛒</span>
              <span>Sales manager</span>
            </button>
          )}
          {canFinance && (
            <button
              type="button"
              onClick={() => setTab("finance")}
              className={`sidebar-link ${tab === "finance" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">💳</span>
              <span>Finance manager</span>
            </button>
          )}
          {canInventory && (
            <button
              type="button"
              onClick={() => setTab("inventory")}
              className={`sidebar-link ${tab === "inventory" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">📦</span>
              <span>Inventory manager</span>
            </button>
          )}
          {canCare && (
            <button
              type="button"
              onClick={() => setTab("care")}
              className={`sidebar-link ${tab === "care" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">💬</span>
              <span>Feedback &amp; care</span>
            </button>
          )}
          {canRefunds && (
            <button
              type="button"
              onClick={() => setTab("refunds")}
              className={`sidebar-link ${tab === "refunds" ? "is-active" : ""}`}
            >
              <span className="sidebar-link__icon">↩️</span>
              <span>Refunds &amp; returns</span>
            </button>
          )}

          {isPlainUser && (
            <div className="nav-section stack-xs">
              <span className="nav-section__label">My area</span>
              <button
                type="button"
                onClick={() => setTab("orders")}
                className={`sidebar-link ${tab === "orders" ? "is-active" : ""}`}
              >
                <span className="sidebar-link__icon">🧾</span>
                <span>My orders</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("myfeedback")}
                className={`sidebar-link ${tab === "myfeedback" ? "is-active" : ""}`}
              >
                <span className="sidebar-link__icon">📝</span>
                <span>My feedback</span>
              </button>
            </div>
          )}

          {isSupplier && (
            <div className="nav-section stack-xs">
              <span className="nav-section__label">Supplier workspace</span>
              <button
                type="button"
                onClick={() => setTab("supplying")}
                className={`sidebar-link ${tab === "supplying" ? "is-active" : ""}`}
              >
                <span className="sidebar-link__icon">🤝</span>
                <span>Supplying</span>
              </button>
            </div>
          )}

          <div className="nav-divider" role="separator" />

          <button
            type="button"
            onClick={() => setTab("settings")}
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
            <div className="dashboard-header__title">
              <span className="eyebrow">Unified operations</span>
              <h2 className="heading-lg">{activeTitle}</h2>
              <p className="muted-text">Quick access to everything you’re cleared to see.</p>
            </div>
            <div className="dashboard-header__actions">
              <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </header>

        {/* Dashboard metrics */}
        {tab === "dashboard" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="text-slate-500">Open Orders</div>
              <div className="text-3xl font-black">37</div>
              <div className="text-sm text-slate-500">+5 today</div>
            </div>
            <div className="card">
              <div className="text-slate-500">Low Stock</div>
              <div className="text-3xl font-black">12</div>
              <div className="text-sm text-slate-500">Need re-order</div>
            </div>
            <div className="card">
              <div className="text-slate-500">Monthly Revenue</div>
              <div className="text-3xl font-black">{formatLKR(24380)}</div>
              <div className="text-sm text-slate-500">+3.1% MoM</div>
            </div>
            <div className="card">
              <div className="text-slate-500">Suppliers</div>
              <div className="text-3xl font-black">18</div>
              <div className="text-sm text-slate-500">3 pending quotes</div>
            </div>
          </div>
        )}

        {/* Profile (real form) */}
        {tab === "profile" && (
          <div className="stack-lg">
            {profileMsg && <div className="status-banner status-banner--success">{profileMsg}</div>}
            {profileErr && <div className="status-banner status-banner--error">{profileErr}</div>}

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
                <h3 className="heading-md mb-1">{user?.name || "Your profile"}</h3>
                <span className="muted-text">{user?.email}</span>
                <div className="profile-hero__badges">
                  <span className={roleBadge(user?.role)}>{roleLabel}</span>
                  <span className="badge badge-gray">ID • {userIdSuffix}</span>
                </div>
              </div>
              <p className="profile-hero__copy muted-text">
                Keep your personal details accurate so teammates and suppliers know how to reach you.
                Updates sync instantly across every dashboard.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <form onSubmit={saveProfile} className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Account details</h3>
                  <p className="muted-text">Review or adjust your contact information.</p>
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
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetProfileForm}
                    disabled={savingProfile}
                  >
                    Reset
                  </button>
                </div>
              </form>

              <form onSubmit={savePassword} className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Change password</h3>
                  <p className="muted-text">Use a strong password you don’t reuse elsewhere.</p>
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
                        onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
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
                        onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
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
                        onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
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

        {/* Sales (manager) */}
        {tab === "sales" && canSales && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="card">
                <div className="text-slate-500">Total orders</div>
                <div className="text-3xl font-black">{salesStats.totalOrders}</div>
              </div>
              <div className="card">
                <div className="text-slate-500">Refunded</div>
                <div className="text-3xl font-black">{salesStats.refunded}</div>
              </div>
              <div className="card">
                <div className="text-slate-500">Recent orders</div>
                <div className="text-3xl font-black">{salesStats.recent?.length ?? 0}</div>
              </div>
            </section>

            <div className="card overflow-x-auto">
              <table className="min-w-[720px] w-full">
                <thead>
                  <tr className="text-left">
                    <th>#</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">No data yet</td>
                    </tr>
                  ) : (
                    salesOrders.map((o) => (
                      <tr key={o._id} className="border-t border-white/10">
                        <td>{o.number}</td>
                        <td>{o.customerName}</td>
                        <td>{o.status}</td>
                        <td>{formatLKR(o.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Finance (manager) */}
        {tab === "finance" && canFinance && (
          <div className="stack-lg">
            {!hasFinancePrivileges && (
              <div className="status-banner status-banner--warning">
                You have access to the Finance workspace but no active finance privileges assigned. Ask an
                administrator to grant the capabilities you need.
              </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  key: "online",
                  title: "Online payments",
                  description: "Customer checkout records from Stripe and card flows.",
                  granted: financeCaps.canViewOnline,
                  locked: "Requires \u201cView online payments\u201d privilege.",
                },
                {
                  key: "suppliers",
                  title: "Supplier payments",
                  description: "Manual payouts uploaded with payment slips.",
                  granted: financeCaps.canViewSupplier,
                  locked: "Requires \u201cView supplier payments\u201d privilege.",
                },
                {
                  key: "declined",
                  title: "Declined slips",
                  description: "Rejected supplier submissions pending review.",
                  granted: financeCaps.canViewDeclined,
                  locked: "Requires \u201cView declined payments\u201d privilege.",
                },
                {
                  key: "notifications",
                  title: "Finance alerts",
                  description: "Latest payment exceptions and approval reminders.",
                  granted: financeCaps.canViewNotifications,
                  locked: "Requires \u201cView finance notifications\u201d privilege.",
                },
              ].map((card) => (
                <div key={card.key} className="card stack-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-slate-500 text-sm uppercase tracking-wide">{card.title}</div>
                      <div className="text-sm text-slate-400 mt-1">{card.description}</div>
                    </div>
                    <span className={`badge ${card.granted ? "badge-green" : "badge-gray"}`}>
                      {card.granted ? "Granted" : "Restricted"}
                    </span>
                  </div>
                  {!card.granted && (
                    <p className="text-xs text-amber-300 mt-2">{card.locked}</p>
                  )}
                </div>
              ))}
            </section>
            <FinanceConsole capabilities={financeCaps} />
          </div>
        )}

        {/* Inventory (manager) */}
        {tab === "inventory" && canInventory && (
          <div className="stack-lg">
            {inventoryMsg && (
              <div className="status-banner status-banner--success">{inventoryMsg}</div>
            )}
            {inventoryErr && (
              <div className="status-banner status-banner--error">{inventoryErr}</div>
            )}

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
                  {loadingProducts ? "…" : formatLKR(inventoryStats.totalValue)}
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
                    className="btn btn-outline btn-sm"
                    onClick={handleAutoQueueLowStock}
                  >
                    ⚡ Queue low-stock items
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadInventoryProducts({ suppressError: true })}
                  >
                    ⟳ Refresh
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
                                  <span className="muted-text text-xs">{formatLKR(value)}</span>
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
                    📄 Create reorder report
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
                  Estimated spend: {formatLKR(reorderSummary.estimatedSpend)}
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
                                    {formatLKR(price)} • {total != null ? formatLKR(total) : "—"}
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

        {/* Care (manager) */}
        {tab === "care" && canCare && (
          <div className="stack-lg">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="card">
                <div className="text-slate-500">Feedback items</div>
                <div className="text-3xl font-black">{careList.length}</div>
                <div className="text-sm text-slate-500">Total tracked this week</div>
              </div>
              <div className="card">
                <div className="text-slate-500">Awaiting replies</div>
                <div className="text-3xl font-black">{carePending}</div>
                <div className="text-sm text-slate-500">Need your response</div>
              </div>
              <div className="card">
                <div className="text-slate-500">Resolved</div>
                <div className="text-3xl font-black">{careList.length - carePending}</div>
                <div className="text-sm text-slate-500">Already replied</div>
              </div>
            </section>

            <div className="card dashboard-care-toolbar">
              <div className="stack-xs">
                <span className="eyebrow">Customer delight</span>
                <h3 className="heading-md">Feedback workspace</h3>
              </div>
              <div className="pill-toggle">
                <button
                  type="button"
                  className={`btn btn-sm ${careView === "reviews" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCareView("reviews")}
                >
                  Reviews
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${careView === "notifications" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCareView("notifications")}
                >
                  Notifications
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${careView === "recycle" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCareView("recycle")}
                >
                  Recycle bin
                </button>
              </div>
            </div>

            {careView === "reviews" && <AdminReviews />}

            {careView === "notifications" && (
              <div className="card">
                <NotificationsPanel feed="care" />
              </div>
            )}

            {careView === "recycle" && (
              <div className="card">
                <AdminReviewRecycleBin />
              </div>
            )}
          </div>
        )}

        {tab === "refunds" && canRefunds && <AdminRefunds />}

        {/* Plain user: My Orders */}
        {tab === "orders" && isPlainUser && (
          <div className="stack-lg">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card">
                <div className="text-slate-500">Orders placed</div>
                <div className="text-3xl font-black">{orderSummary.total}</div>
                <div className="text-sm text-slate-500">
                  {orderSummary.total
                    ? `Last placed ${formatDateTime(orderSummary.lastPlaced)}`
                    : "No orders yet"}
                </div>
              </div>
              <div className="card">
                <div className="text-slate-500">Paid orders</div>
                <div className="text-3xl font-black">{orderSummary.paid}</div>
                <div className="text-sm text-slate-500">
                  Total spent {formatLKRCompact(orderSummary.totalSpent || 0)}
                </div>
              </div>
              <div className="card">
                <div className="text-slate-500">Awaiting payment</div>
                <div className="text-3xl font-black">{orderSummary.awaiting}</div>
                <div className="text-sm text-slate-500">
                  {orderSummary.pending} pending confirmation
                </div>
              </div>
              <div className="card">
                <div className="text-slate-500">Cancelled</div>
                <div className="text-3xl font-black">{cancelledSummary.total}</div>
                <div className="text-sm text-slate-500">
                  Refunded {formatLKRCompact(cancelledSummary.totalAmount || 0)}
                </div>
              </div>
            </section>

                <div className="card">
                  <header className="card-header">
                    <div>
                      <h3 className="heading-sm">My cart</h3>
                      <p className="muted-text">
                        Manage items you&apos;ve added. Checkout is just a click away.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => toggleOrderSection("cart")}
                    >
                      {orderSectionsOpen.cart ? "Collapse" : "Expand"}
                    </button>
                  </header>
                  {orderSectionsOpen.cart && (
                    <div className="mt-4">
                      <Cart embedded />
                      <div className="muted-text text-sm text-right">
                        {cartState.totalItems} item(s) · {formatLKR(cartState.subtotal)} total
                      </div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <header className="card-header">
                    <div>
                      <h3 className="heading-sm">Order history</h3>
                      <p className="muted-text">
                        Download e-receipts, track fulfilment, and leave product reviews.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => toggleOrderSection("history")}
                    >
                      {orderSectionsOpen.history ? "Collapse" : "Expand"}
                    </button>
                  </header>
                  {orderSectionsOpen.history && (
                    <div className="mt-4">
                      <CustomerOrders
                        embedded
                        allowReceipts
                        onOrdersChange={handleOrdersChange}
                      />
                    </div>
                  )}
                </div>

                <div className="card overflow-x-auto">
                  <header className="card-header">
                    <div>
                      <h3 className="heading-sm">Cancelled orders</h3>
                      <p className="muted-text">
                        Orders moved to history appear here with their reason.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => toggleOrderSection("cancelled")}
                    >
                      {orderSectionsOpen.cancelled ? "Collapse" : "Expand"}
                    </button>
                  </header>
                  {orderSectionsOpen.cancelled && (
                    <div className="mt-4">
                      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="eyebrow">History</span>
                          <h4 className="heading-sm">Cancelled orders</h4>
                          <p className="muted-text">
                            Orders moved to history appear here with their reason.
                          </p>
                        </div>
                        {cancelledSummary.totalAmount > 0 && (
                          <div className="text-sm text-slate-500">
                            Refunded {formatLKRCompact(cancelledSummary.totalAmount)} overall
                          </div>
                        )}
                      </div>

                      {cancelledLoading ? (
                        <div className="py-6 text-center text-slate-500">Loading cancelled orders…</div>
                      ) : cancelledError ? (
                        <div className="py-6 text-center text-red-500">{cancelledError}</div>
                      ) : cancelledOrders.length === 0 ? (
                        <div className="py-6 text-center text-slate-500">
                          No cancelled orders recorded yet.
                        </div>
                      ) : (
                        <table className="min-w-[720px] w-full">
                          <thead>
                            <tr className="text-left">
                              <th>Cancelled on</th>
                              <th>Order</th>
                              <th>Items</th>
                              <th>Total</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cancelledOrders.map((entry, idx) => {
                              const key = entry?._id || entry?.originalOrderId || idx;
                              const suffix = String(entry?.originalOrderId || entry?._id || "")
                                .slice(-6)
                                .padStart(6, "0");
                              const items = Array.isArray(entry?.items) ? entry.items : [];
                              return (
                                <tr key={key} className="border-t border-white/5 align-top">
                                  <td className="py-3">
                                    <div>{formatDateTime(entry?.cancelledAt)}</div>
                                    <div className="text-xs text-slate-500">{entry?.contact || "—"}</div>
                                  </td>
                                  <td className="py-3">
                                    <div className="font-medium">Order #{suffix}</div>
                                    <div className="text-xs text-slate-500">
                                      {entry?.paymentMethod || "Payment method unknown"}
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    {items.length ? (
                                      <ul className="space-y-1 text-sm text-slate-500">
                                        {items.map((item, itemIndex) => (
                                          <li key={`${key}-item-${itemIndex}`}>
                                            {item?.productName || "Item"} × {item?.quantity ?? 0}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="text-sm text-slate-500">No items recorded</span>
                                    )}
                                  </td>
                                  <td className="py-3">{formatLKR(entry?.totalAmount || 0)}</td>
                                  <td className="py-3 max-w-xs">
                                    <span className="text-sm text-slate-500">
                                      {entry?.cancelReason || "Not specified"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
            </div>
          </div>
        )}


        {/* Plain user: My Feedback */}
  {tab === "myfeedback" && isPlainUser && <MyReviews embedded />}

  {/* Supplier: Supplying */}
{tab === "supplying" && isSupplier && (
  <div className="card flex flex-col gap-4 p-6">
    <h3 className="text-lg font-bold mb-2">Supplying</h3>
    <div className="flex gap-4">
      <button
        className="btn btn-primary px-4 py-2"
        onClick={() => navigate("/add-supplier-product")}
      >
        ➕ Add Product
      </button>

      <button
        className="btn btn-secondary px-4 py-2"
        onClick={() => navigate("/supplier-products")}
      >
        📦 View Products
      </button>
    </div>
  </div>
)}


        {/* Settings */}
        {tab === "settings" && (
          <div className="card">
            <label className="label">Theme</label>
            <select value={theme} onChange={(e) => setThemePreference(e.target.value)} className="input max-w-xs">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
        </section>
      </div>
    </div>
  );
}

export default function Dashboard(props) {
  const { user } = useAuth();
  const roleNorm = String(user?.role || "").trim().toLowerCase();
  const isDefaultUser = roleNorm === "user" || roleNorm === "customer";

  if (isDefaultUser) {
    return <CustomerDashboard />;
  }

  return <DashboardPrivileged {...props} />;
}
