// src/components/Dashboard/CustomerDashboard.js
import React, { useMemo, useState, useEffect, useRef, useContext, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MyReviews from "../Reviews_&_Feedback/MyReviewsNew";
import { CartContext } from "../Order/Customer/CartContext";
import Cart from "../Order/Customer/Cart";
import CustomerOrders from "../Order/Customer/CustomerOrders";
import CancelledOrders from "../Order/Customer/CancelledOrders";
import { loadStripe } from "@stripe/stripe-js";
import { formatLKR } from "../../utils/currency";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

const CUSTOMER_ALLOWED_TABS = new Set(["dashboard", "profile", "orders", "myfeedback", "settings"]);
const CUSTOMER_ALLOWED_ORDER_VIEWS = new Set(["overview", "cart", "checkout", "history", "cancelled"]);

const deriveTabFromLocation = (location) => {
  if (!location) return "dashboard";
  const params = new URLSearchParams(location.search || "");
  const tabParam = (params.get("tab") || "").toLowerCase();
  if (CUSTOMER_ALLOWED_TABS.has(tabParam)) {
    return tabParam;
  }

  const viewParam = (params.get("view") || "").toLowerCase();
  if (CUSTOMER_ALLOWED_ORDER_VIEWS.has(viewParam)) {
    return "orders";
  }

  const hash = (location.hash || "").toLowerCase();
  if (hash === "#profile") return "profile";
  if (hash === "#orders") return "orders";
  if (hash === "#settings") return "settings";
  if (hash === "#myfeedback") return "myfeedback";
  if (["#cart", "#checkout", "#history", "#cancelled"].includes(hash)) return "orders";
  return "dashboard";
};

const deriveOrdersViewFromLocation = (location) => {
  if (!location) return "overview";
  const params = new URLSearchParams(location.search || "");
  const viewParam = (params.get("view") || "").toLowerCase();
  if (CUSTOMER_ALLOWED_ORDER_VIEWS.has(viewParam)) {
    return viewParam;
  }

  const hash = (location.hash || "").toLowerCase();
  if (hash === "#cart") return "cart";
  if (hash === "#checkout") return "checkout";
  if (hash === "#history") return "history";
  if (hash === "#cancelled") return "cancelled";
  return "overview";
};

export default function CustomerDashboard() {
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
  deleteAccount,
    logout,
  } = useAuth();
  const { cartItems, removeMultipleFromCart } = useContext(CartContext);
  const navigate = useNavigate();
  const location = useLocation();

  const initials = useMemo(() => {
    return (user?.name || "U")
      .trim()
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);

  const [tab, setTab] = useState(() => deriveTabFromLocation(location));

  /* ---- Profile ---- */
  const [ordersView, setOrdersView] = useState(() => deriveOrdersViewFromLocation(location));
  const [ordersData, setOrdersData] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [cancelledData, setCancelledData] = useState([]);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledError, setCancelledError] = useState("");
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [checkoutContact, setCheckoutContact] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState("Pay Online");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [ordersMsg, setOrdersMsg] = useState("");
  const [ordersErr, setOrdersErr] = useState("");

  const goToOrdersView = useCallback((view) => {
    setTab("orders");
    setOrdersView(view);
  }, []);

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    age: user?.age ?? "",
    address: user?.address || "",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    const nextTab = deriveTabFromLocation(location);
    setTab((prev) => (prev === nextTab ? prev : nextTab));

    const nextOrdersView = deriveOrdersViewFromLocation(location);
    setOrdersView((prev) => (prev === nextOrdersView ? prev : nextOrdersView));
  }, [location]);

  const canDeleteAccount = useMemo(
    () => String(user?.role || "").toLowerCase() === "user",
    [user?.role]
  );

  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      age: user?.age ?? "",
      address: user?.address || "",
    });
  }, [user]);

  const loadOrdersData = useCallback(async () => {
    if (!token) {
      setOrdersData([]);
      setOrdersError("Not authenticated");
      return [];
    }
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await fetch(`${API}/api/orders`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load orders");
      const list = Array.isArray(data.orders) ? data.orders : [];
      setOrdersData(list);
      return list;
    } catch (ex) {
      setOrdersError(ex.message || "Failed to load orders");
      setOrdersData([]);
      return [];
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  const loadCancelledData = useCallback(async () => {
    if (!token) {
      setCancelledData([]);
      setCancelledError("Not authenticated");
      return [];
    }
    setCancelledLoading(true);
    setCancelledError("");
    try {
      const res = await fetch(`${API}/api/orders/cancelled`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load cancelled orders");
      const list = Array.isArray(data.cancelledOrders) ? data.cancelledOrders : [];
      setCancelledData(list);
      return list;
    } catch (ex) {
      setCancelledError(ex.message || "Failed to load cancelled orders");
      setCancelledData([]);
      return [];
    } finally {
      setCancelledLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOrdersData();
    loadCancelledData();
  }, [loadOrdersData, loadCancelledData]);

  useEffect(() => {
    if (tab !== "orders") return;
    if (ordersView === "history") {
      loadOrdersData();
    } else if (ordersView === "cancelled") {
      loadCancelledData();
    }
  }, [tab, ordersView, loadOrdersData, loadCancelledData]);

  useEffect(() => {
    if (tab === "orders" && ordersView === "checkout" && checkoutItems.length === 0) {
      setOrdersView("cart");
    }
  }, [tab, ordersView, checkoutItems.length]);

  const resetProfileForm = () => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      age: user?.age ?? "",
      address: user?.address || "",
    });
  };

  const triggerAvatarPicker = () => {
    if (uploadingAvatar) return;
    setProfileMsg("");
    setProfileErr("");
    avatarInputRef.current?.click();
  };

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const checkoutTotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [checkoutItems]
  );

  const ordersSummary = useMemo(() => {
    if (!Array.isArray(ordersData) || ordersData.length === 0) {
      return { total: 0, pending: 0, delivered: 0, value: 0 };
    }
    const pending = ordersData.filter((o) => String(o.status || "").toLowerCase().includes("pending")).length;
    const delivered = ordersData.filter((o) => String(o.status || "").toLowerCase().includes("delivered")).length;
    const value = ordersData.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    return {
      total: ordersData.length,
      pending,
      delivered,
      value,
    };
  }, [ordersData]);

  const hasCheckoutItems = checkoutItems.length > 0;

  const ordersViewOptions = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: "🧭" },
      { id: "cart", label: `Cart (${cartItems.length})`, icon: "🛒" },
      { id: "checkout", label: "Checkout", icon: "💳", disabled: !hasCheckoutItems },
      { id: "history", label: "History", icon: "📦" },
      { id: "cancelled", label: "Cancelled", icon: "🗑️" },
    ],
    [cartItems.length, hasCheckoutItems]
  );

  const handleOrdersDataChange = useCallback(
    (next) => {
      setOrdersData((prev) => {
        const updated = typeof next === "function" ? next(prev) : next;
        return Array.isArray(updated) ? updated : prev;
      });
      if (typeof next === "function") {
        loadCancelledData();
      }
    },
    [loadCancelledData]
  );

  const handleCancelledDataChange = useCallback((next) => {
    setCancelledData((prev) => {
      const updated = typeof next === "function" ? next(prev) : next;
      return Array.isArray(updated) ? updated : prev;
    });
  }, []);

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileErr("Please choose an image file");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileErr("Profile photos must be smaller than 2MB");
      event.target.value = "";
      return;
    }
    setUploadingAvatar(true);
    setProfileMsg("");
    setProfileErr("");
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

  const handleRemoveAvatar = async () => {
    if (!user?.avatar || uploadingAvatar) return;
    if (!window.confirm("Remove your profile photo?")) return;
    setUploadingAvatar(true);
    setProfileMsg("");
    setProfileErr("");
    try {
      await deleteAvatar();
      setProfileMsg("Profile photo removed");
    } catch (ex) {
      setProfileErr(ex.message || "Failed to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (!canDeleteAccount) return;
    const confirmed = window.confirm(
      "Delete your SmartHardware account? This action is permanent and cannot be undone."
    );
    if (!confirmed) return;

    setProfileMsg("");
    setProfileErr("");
    try {
      setIsDeletingAccount(true);
      const response = await deleteAccount();
      window.alert(response?.message || "Your account has been deleted.");
      navigate("/", { replace: true });
    } catch (error) {
      setProfileErr(error.message || "Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleCheckoutStart = (items) => {
    setCheckoutItems(items);
    setCheckoutContact("");
    setCheckoutPaymentMethod("Pay Online");
    setOrdersErr("");
    setOrdersMsg("");
    setPlacingOrder(false);
    goToOrdersView("checkout");
  };

  const handleCancelCheckout = () => {
    setCheckoutItems([]);
    setCheckoutContact("");
    setCheckoutPaymentMethod("Pay Online");
    setOrdersErr("");
    setOrdersMsg("");
    setPlacingOrder(false);
    goToOrdersView("cart");
  };

  const handlePlaceOrder = async () => {
    setOrdersMsg("");
    setOrdersErr("");

    if (!checkoutContact || !/^\d{7,15}$/.test(checkoutContact)) {
      setOrdersErr("Please enter a valid contact number (digits only)");
      return;
    }

    if (checkoutItems.length === 0) {
      setOrdersErr("Select at least one item to place an order");
      return;
    }

    try {
      setPlacingOrder(true);
      if (!token) throw new Error("You must login first");

      const items = checkoutItems.map((item) => ({
        productId: item.productId || item._id,
        productName: item.name || item.productName,
        quantity: item.quantity,
        price: item.price,
      }));

      const orderRes = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contact: checkoutContact,
          paymentMethod: checkoutPaymentMethod,
          items,
        }),
      });

      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) throw new Error(orderData.message || "Failed to place order");

      const orderId = orderData?.order?._id;
      if (checkoutPaymentMethod === "Pay Online") {
        const paymentRes = await fetch(
          `${API}/api/payments/stripe/create-checkout-session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              amount: Math.round(
                checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
              ),
              currency: "lkr",
              orderId,
            }),
          }
        );

        const paymentJson = await paymentRes.json().catch(() => ({}));
        if (!paymentRes.ok || !paymentJson.id) {
          throw new Error(paymentJson.error || "Failed to initialise payment");
        }

        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error("Stripe is not configured");
        }
        await stripe.redirectToCheckout({ sessionId: paymentJson.id });
      } else {
  removeMultipleFromCart(items.map((i) => i.productId));
  setOrdersMsg("Order placed successfully!");
  setCheckoutItems([]);
  setCheckoutContact("");
  setCheckoutPaymentMethod("Pay Online");
  goToOrdersView("history");
  await loadOrdersData();
  await loadCancelledData();
      }
    } catch (ex) {
      setOrdersErr(ex.message || "Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    try {
      const trimmedName = (profile.name || "").trim();
      const trimmedAddress = typeof profile.address === "string" ? profile.address.trim() : "";

      if (!trimmedName) return setProfileErr("Name is required");

      const ageValue = profile.age === "" || profile.age === null ? null : Number(profile.age);
      if (profile.age !== "" && profile.age !== null && Number.isNaN(ageValue)) {
        return setProfileErr("Age must be a valid number");
      }

      const updated = await updateProfile({
        name: trimmedName,
        age: ageValue,
        address: trimmedAddress,
      });

      setProfile((prev) => ({
        ...prev,
        name: updated.name || trimmedName,
        age:
          updated.age === undefined || updated.age === null
            ? ageValue === null
              ? ""
              : ageValue
            : updated.age,
        address: updated.address || trimmedAddress,
      }));
      setProfileMsg("Profile updated");
    } catch (ex) {
      setProfileErr(ex.message || "Failed to update profile");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    if (!pwd.next || pwd.next.length < 6) return setProfileErr("New password must be at least 6 characters");
    if (pwd.next !== pwd.confirm) return setProfileErr("Passwords do not match");
    try {
  await changePassword(pwd.current, pwd.next);
      setProfileMsg("Password changed");
      setPwd({ current: "", next: "", confirm: "" });
  setShowPwd({ current: false, next: false, confirm: false });
    } catch (ex) {
      setProfileErr(ex.message || "Failed to change password");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const ordersViewTitles = {
    overview: "My orders",
    cart: "Cart & checkout",
    checkout: "Checkout",
    history: "Order history",
    cancelled: "Cancelled orders",
  };

  const activeTitle =
    tab === "dashboard"
      ? "Customer dashboard"
      : tab === "profile"
      ? "Profile"
      : tab === "orders"
      ? ordersViewTitles[ordersView] || "My orders"
      : tab === "myfeedback"
      ? "My feedback"
      : tab === "settings"
      ? "Settings"
      : "Customer dashboard";

  const renderOrdersView = () => {
    switch (ordersView) {
      case "cart":
        return (
          <div className="stack-md">
            <Cart embedded onCheckout={handleCheckoutStart} />
            <p className="muted-text">
              Select the products you want to buy and click “Proceed to Checkout” to lock in the order.
            </p>
          </div>
        );
      case "checkout":
        if (!checkoutItems.length) {
          return (
            <div className="stack-sm">
              <div className="orders-empty-state">
                Select at least one product from your cart to start checkout.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm align-self-start"
                onClick={() => goToOrdersView("cart")}
                disabled={placingOrder}
              >
                Back to cart
              </button>
            </div>
          );
        }
        return (
          <div className="stack-lg">
            <div className="orders-checkout-list">
              {checkoutItems.map((item) => {
                const id = item.productId || item._id;
                const name = item.name || item.productName;
                return (
                  <div key={id} className="orders-checkout-item">
                    <div>
                      <div className="orders-checkout-item__title">{name}</div>
                      <div className="orders-checkout-item__meta">
                        Qty {item.quantity} × {formatLKR(item.price)}
                      </div>
                    </div>
                    <div className="orders-checkout-item__title">
                      {formatLKR(item.quantity * item.price)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="stack-sm">
              <label className="label" htmlFor="checkout-contact">
                Contact number
              </label>
              <input
                id="checkout-contact"
                className="input"
                value={checkoutContact}
                onChange={(e) => setCheckoutContact(e.target.value)}
                placeholder="e.g. 0712345678"
                inputMode="tel"
              />
            </div>

            <div className="stack-sm">
              <label className="label" htmlFor="checkout-payment">
                Payment method
              </label>
              <select
                id="checkout-payment"
                className="input"
                value={checkoutPaymentMethod}
                onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
              >
                <option value="Pay Online">Pay online (Stripe)</option>
                <option value="Cash on Delivery">Cash on delivery</option>
              </select>
            </div>

            <div className="orders-checkout-total">
              <span>Total due:</span>
              <span>{formatLKR(checkoutTotal)}</span>
            </div>

            <div className="action-grid justify-end">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancelCheckout}
                disabled={placingOrder}
              >
                Back to cart
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePlaceOrder}
                disabled={placingOrder}
              >
                {placingOrder
                  ? "Processing…"
                  : checkoutPaymentMethod === "Pay Online"
                  ? "Pay securely"
                  : "Place order"}
              </button>
            </div>
          </div>
        );
      case "history":
        if (ordersLoading) {
          return <p className="muted-text">Loading your orders…</p>;
        }
        if (ordersError) {
          return (
            <div className="stack-sm">
              <div className="status-banner status-banner--error">{ordersError}</div>
              <button
                type="button"
                className="btn btn-secondary btn-sm align-self-start"
                onClick={loadOrdersData}
              >
                Retry
              </button>
            </div>
          );
        }
        return (
          <CustomerOrders
            embedded
            initialOrders={ordersData}
            onOrdersChange={handleOrdersDataChange}
            allowReceipts
          />
        );
      case "cancelled":
        if (cancelledLoading) {
          return <p className="muted-text">Loading cancelled orders…</p>;
        }
        if (cancelledError) {
          return (
            <div className="stack-sm">
              <div className="status-banner status-banner--error">{cancelledError}</div>
              <button
                type="button"
                className="btn btn-secondary btn-sm align-self-start"
                onClick={loadCancelledData}
              >
                Retry
              </button>
            </div>
          );
        }
        return (
          <CancelledOrders
            embedded
            initialOrders={cancelledData}
            onOrdersChange={handleCancelledDataChange}
          />
        );
      case "overview":
      default: {
        const recentOrders = ordersData.slice(0, 3);
        return (
          <div className="stack-lg">
            <div className="orders-overview-grid">
              <div className="orders-overview-card">
                <span className="muted-heading">Cart items</span>
                <span className="orders-overview-value">{cartItems.length}</span>
                <span className="muted-text">Worth {formatLKR(cartSubtotal)}</span>
              </div>
              <div className="orders-overview-card">
                <span className="muted-heading">Pending orders</span>
                <span className="orders-overview-value">{ordersSummary.pending}</span>
                <span className="muted-text">Awaiting fulfilment</span>
              </div>
              <div className="orders-overview-card">
                <span className="muted-heading">Delivered</span>
                <span className="orders-overview-value">{ordersSummary.delivered}</span>
                <span className="muted-text">Completed orders</span>
              </div>
              <div className="orders-overview-card">
                <span className="muted-heading">Cancelled</span>
                <span className="orders-overview-value">{cancelledData.length}</span>
                <span className="muted-text">In your archive</span>
              </div>
            </div>

            {ordersError && !ordersLoading && (
              <div className="status-banner status-banner--error">{ordersError}</div>
            )}
            {cancelledError && !cancelledLoading && (
              <div className="status-banner status-banner--error">{cancelledError}</div>
            )}

            <div className="stack-sm">
              <h4 className="heading-sm">Latest updates</h4>
              {ordersLoading ? (
                <p className="muted-text">Loading your latest orders…</p>
              ) : recentOrders.length ? (
                <>
                  <ul className="orders-overview-list">
                    {recentOrders.map((order) => {
                      const suffix = String(order?._id || "").slice(-6) || "…";
                      const placedOn = order?.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "Date unavailable";
                      const status = String(order?.status || "Pending");
                      const total = formatLKR(order?.totalAmount);
                      return (
                        <li key={order?._id || placedOn} className="orders-overview-list__item">
                          <div>
                            <div className="orders-overview-item__title">#{suffix}</div>
                            <div className="orders-overview-list__meta">{placedOn}</div>
                          </div>
                          <div className="orders-overview-list__meta">
                            {status} · {total}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="action-grid">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm align-self-start"
                      onClick={() => goToOrdersView("history")}
                    >
                      See all orders
                    </button>
                  </div>
                </>
              ) : (
                <div className="orders-empty-state">
                  No orders yet. Start by adding items to your cart and checking out.
                </div>
              )}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="dashboard-shell dashboard-shell--two-column customer-dashboard">
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
            onClick={() => setTab("dashboard")}
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
          <button
            type="button"
            onClick={() => goToOrdersView("overview")}
            className={`sidebar-link ${
              tab === "orders" && (ordersView === "overview" || ordersView === "history") ? "is-active" : ""
            }`}
          >
            <span className="sidebar-link__icon">🧾</span>
            <span>My orders</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("myfeedback")}
            className={`sidebar-link ${tab === "myfeedback" ? "is-active" : ""}`}
          >
            <span className="sidebar-link__icon">💬</span>
            <span>My reviews</span>
          </button>
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
          <div className="stack-xs">
            <span className="eyebrow">Welcome back</span>
            <h2 className="heading-lg">{activeTitle}</h2>
          </div>
          <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </header>

        {/* Dashboard quick links */}
        {tab === "dashboard" && (
          <div className="card stack-md">
            <div className="stack-xs">
              <h3 className="heading-md">Quick links</h3>
              <p className="muted-text">
                Jump straight to the pages you use most to keep your account up to date.
              </p>
            </div>
            <div className="orders-grid">
              <article className="card stack-sm">
                <div className="stack-xs">
                  <span className="badge badge-green">Orders</span>
                  <h4 className="heading-sm">Track your orders</h4>
                  <p className="muted-text">Review progress, download receipts, and place new orders.</p>
                </div>
                <div className="action-grid">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => goToOrdersView("overview")}
                  >
                    Go to orders
                  </button>
                </div>
              </article>

              <article className="card stack-sm">
                <div className="stack-xs">
                  <span className="badge badge-amber">Cart</span>
                  <h4 className="heading-sm">Review your cart</h4>
                  <p className="muted-text">Check item quantities and proceed to secure checkout when ready.</p>
                </div>
                <div className="action-grid">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => goToOrdersView("cart")}
                  >
                    Open cart
                  </button>
                </div>
              </article>

              <article className="card stack-sm">
                <div className="stack-xs">
                  <span className="badge badge-gray">Profile</span>
                  <h4 className="heading-sm">Update your details</h4>
                  <p className="muted-text">Change your contact information, avatar, or password whenever needed.</p>
                </div>
                <div className="action-grid">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setTab("profile")}
                  >
                    Manage profile
                  </button>
                </div>
              </article>

              <article className="card stack-sm">
                <div className="stack-xs">
                  <span className="badge badge-green">Feedback</span>
                  <h4 className="heading-sm">Share product feedback</h4>
                  <p className="muted-text">View or update your product reviews to help other customers.</p>
                </div>
                <div className="action-grid">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setTab("myfeedback")}
                  >
                    My reviews
                  </button>
                </div>
              </article>
            </div>
          </div>
        )}

        {/* Orders hub */}
        {tab === "orders" && (
          <div className="stack-lg">
            <div className="card stack-md">
              <div className="stack-xs">
                <h3 className="heading-md">Order hub</h3>
                <p className="muted-text">
                  Track purchases, pay for pending carts, and leave product feedback in one place.
                </p>
              </div>
              <div className="orders-grid">
                <article className="card stack-sm">
                  <div className="stack-xs">
                    <span className="badge badge-amber">Active cart</span>
                    <h4 className="heading-sm">Your cart ({cartItems.length})</h4>
                    <p className="muted-text">Review selected items and head to checkout when you&apos;re ready.</p>
                  </div>
                  <div className="action-grid">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => goToOrdersView("cart")}
                    >
                      Go to cart
                    </button>
                  </div>
                </article>

                <article className="card stack-sm">
                  <div className="stack-xs">
                    <span className="badge badge-green">History</span>
                    <h4 className="heading-sm">Orders placed</h4>
                    <p className="muted-text">See payment status, track fulfilment, and add reviews.</p>
                  </div>
                  <div className="action-grid">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => goToOrdersView("history")}
                    >
                      View orders
                    </button>
                  </div>
                </article>

                <article className="card stack-sm">
                  <div className="stack-xs">
                    <span className="badge badge-gray">Archive</span>
                    <h4 className="heading-sm">Cancelled orders</h4>
                    <p className="muted-text">Anything you or an admin cancelled lives here for reference.</p>
                  </div>
                  <div className="action-grid">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => goToOrdersView("cancelled")}
                    >
                      View cancellations
                    </button>
                  </div>
                </article>
              </div>
            </div>

            <div className="card stack-md">
              <div className="orders-view-toggle">
                {ordersViewOptions.map((option) => {
                  const isActive = ordersView === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`orders-view-toggle__btn ${isActive ? "is-active" : ""}`}
                      onClick={() => {
                        if (!option.disabled) {
                          goToOrdersView(option.id);
                        }
                      }}
                      disabled={option.disabled}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {(ordersMsg || ordersErr) && (
                <div
                  className={`status-banner ${
                    ordersErr ? "status-banner--error" : "status-banner--success"
                  }`}
                >
                  {ordersErr || ordersMsg}
                </div>
              )}

              {renderOrdersView()}
            </div>
          </div>
        )}

        {/* Feedback (My Reviews) */}
        {tab === "myfeedback" && (
          <div className="card stack-md">
            <h3 className="heading-md">My reviews</h3>
            <MyReviews embedded />
          </div>
        )}


        {/* Profile & password */}
        {tab === "profile" && (
          <div className="stack-lg">
            {(profileMsg || profileErr) && (
              <div
                className={`status-banner ${
                  profileErr ? "status-banner--error" : "status-banner--success"
                }`}
              >
                {profileErr || profileMsg}
              </div>
            )}

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
                <h3 className="heading-md">{user?.name || "Your profile"}</h3>
                <span className="muted-text">{user?.email}</span>
                <div className="profile-hero__badges">
                  <span className="badge badge-gray">Customer</span>
                  <span className="badge badge-amber">ID • {user?._id?.slice(-6) || "000000"}</span>
                </div>
              </div>
              <p className="profile-hero__copy muted-text">
                Personalize your space so orders, reviews, and notifications feel tailored to you.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <form onSubmit={saveProfile} className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Profile details</h3>
                  <p className="muted-text">
                    Update how we address you for deliveries and follow-ups.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="customer-name">
                      Display name
                    </label>
                    <input
                      id="customer-name"
                      className="input"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="e.g. Jamie Smith"
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="customer-email">
                      Email
                    </label>
                    <input
                      id="customer-email"
                      className="input"
                      value={profile.email}
                      disabled
                      readOnly
                      aria-readonly="true"
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="customer-age">
                      Age
                    </label>
                    <input
                      id="customer-age"
                      className="input"
                      type="number"
                      min="0"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label" htmlFor="customer-address">
                      Address
                    </label>
                    <textarea
                      id="customer-address"
                      className="input"
                      rows={3}
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      placeholder="Where should we deliver?"
                      autoComplete="street-address"
                    />
                  </div>
                </div>

                <div className="action-grid justify-end">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      resetProfileForm();
                      setProfileErr("");
                      setProfileMsg("");
                    }}
                  >
                    Reset
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save changes
                  </button>
                </div>
              </form>

              <form onSubmit={savePassword} className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Password</h3>
                  <p className="muted-text">
                    Choose a strong password you haven&apos;t used elsewhere.
                  </p>
                </div>

                <div className="stack-sm">
                  <label className="label" htmlFor="customer-password-current">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      id="customer-password-current"
                      className="input pr-10"
                      type={showPwd.current ? "text" : "password"}
                      value={pwd.current}
                      onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lg"
                      onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
                    >
                      {showPwd.current ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="stack-sm">
                  <label className="label" htmlFor="customer-password-new">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="customer-password-new"
                      className="input pr-10"
                      type={showPwd.next ? "text" : "password"}
                      value={pwd.next}
                      onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lg"
                      onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
                    >
                      {showPwd.next ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="stack-sm">
                  <label className="label" htmlFor="customer-password-confirm">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="customer-password-confirm"
                      className="input pr-10"
                      type={showPwd.confirm ? "text" : "password"}
                      value={pwd.confirm}
                      onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lg"
                      onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
                    >
                      {showPwd.confirm ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="action-grid justify-end">
                  <button type="submit" className="btn btn-secondary">
                    Update password
                  </button>
                </div>
              </form>
            </div>

            {canDeleteAccount ? (
              <div className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Delete account</h3>
                  <p className="muted-text">
                    Permanently remove your SmartHardware account, including order history and saved
                    preferences. This action cannot be undone.
                  </p>
                </div>
                <div className="action-grid justify-end">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleAccountDeletion}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Deleting…" : "Delete my account"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Need to close your account?</h3>
                  <p className="muted-text">
                    Please contact an administrator or customer care manager to help you delete this account.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="card stack-md">
            <div className="stack-sm">
              <label className="label">Theme</label>
              <select value={theme} onChange={(e) => setThemePreference(e.target.value)} className="input">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
