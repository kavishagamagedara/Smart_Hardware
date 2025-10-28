import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SupplierProductList from "../SupplierProduct/SupplierProductList";
import SupplierDiscounts from "../SupplierProduct/SupplierDiscounts";
import NotificationsPanel from "../Notifications/NotificationsPanel";
import ReceivedOrders from "../Order/Supplier/ReceivedOrders";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const DashboardCard = ({ title, value, description, accent }) => (
  <div className="card stack-xs" style={accent ? { borderTop: `4px solid ${accent}` } : undefined}>
    <span className="muted-heading text-xs uppercase tracking-wide">{title}</span>
    <span className="text-3xl font-semibold">{value}</span>
    {description && <span className="text-sm text-slate-500 dark:text-slate-400">{description}</span>}
  </div>
);

export default function SupplierDashboard() {
  const {
    user,
    theme,
    toggleTheme,
    token,
    updateProfile,
    changePassword,
    uploadAvatar,
    deleteAvatar,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const initials = useMemo(() => {
    return (user?.name || "S")
      .trim()
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);

  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState({ products: 0, pendingOrders: 0, acceptedOrders: 0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    address: user?.address || "",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErr, setPwdErr] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    setProfile({
      name: user?.name || "",
      email: user?.email || "",
      address: user?.address || "",
    });
  }, [user]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    try {
      const headers = { Authorization: token ? `Bearer ${token}` : "" };
      const [productsRes, ordersRes] = await Promise.all([
        fetch(`${API_ROOT}/supplier-products`, { headers }),
        fetch(`${API_ROOT}/api/admin-orders/supplier`, { headers }),
      ]);

      const readPayload = async (res) => {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) return res.json();
        const text = await res.text();
        return text ? { message: text } : null;
      };

      const productsPayload = await readPayload(productsRes);
      const ordersPayload = await readPayload(ordersRes);

      if (!productsRes.ok) {
        throw new Error(
          (productsPayload && typeof productsPayload === "object" && productsPayload.message) ||
            (typeof productsPayload === "string" && productsPayload) ||
            "Failed to load supplier products"
        );
      }
      if (!ordersRes.ok) {
        throw new Error(
          (ordersPayload && typeof ordersPayload === "object" && ordersPayload.message) ||
            (typeof ordersPayload === "string" && ordersPayload) ||
            "Failed to load supplier orders"
        );
      }

      const productsJson = Array.isArray(productsPayload)
        ? productsPayload
        : productsPayload?.supplierProducts ?? [];
      const ordersJson = Array.isArray(ordersPayload) ? ordersPayload : [];

      const pendingOrders = ordersJson.filter((order) => {
        const status = String(order.items?.[0]?.supplierStatus || order.status || "").toLowerCase();
        return status === "pending";
      }).length;
      const acceptedOrders = ordersJson.filter((order) => {
        const status = String(order.items?.[0]?.supplierStatus || order.status || "").toLowerCase();
        return status === "accepted";
      }).length;

      setStats({
        products: Array.isArray(productsJson) ? productsJson.length : 0,
        pendingOrders,
        acceptedOrders,
      });
    } catch (err) {
      console.error("Failed to load supplier metrics", err);
      setStats({ products: 0, pendingOrders: 0, acceptedOrders: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const activeHeading =
    tab === "dashboard"
      ? "Supplier overview"
      : tab === "profile"
      ? "Profile details"
      : tab === "discounts"
      ? "Discount programs"
      : tab === "supplying"
      ? "Supplying workspace"
      : "Settings";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const triggerAvatarPicker = () => {
    if (uploadingAvatar) return;
    avatarInputRef.current?.click();
  };

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
    setProfileErr("");
    setProfileMsg("");
    try {
      await uploadAvatar(file);
      setProfileMsg("Profile photo updated");
    } catch (err) {
      setProfileErr(err.message || "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.avatar || uploadingAvatar) return;
    if (!window.confirm("Remove your profile photo?")) return;
    setUploadingAvatar(true);
    setProfileErr("");
    setProfileMsg("");
    try {
      await deleteAvatar();
      setProfileMsg("Profile photo removed");
    } catch (err) {
      setProfileErr(err.message || "Failed to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileErr("");
    setProfileMsg("");
    const trimmedName = (profile.name || "").trim();
    if (!trimmedName) return setProfileErr("Name is required");

    try {
      setSavingProfile(true);
      await updateProfile({
        name: trimmedName,
        address: profile.address?.trim?.() || "",
      });
      setProfileMsg("Profile updated");
    } catch (err) {
      setProfileErr(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPwdErr("");
    setPwdMsg("");
    if (!pwd.current || !pwd.next) {
      return setPwdErr("Enter your current and new password");
    }
    if (pwd.next !== pwd.confirm) {
      return setPwdErr("New passwords do not match");
    }
    try {
      setChangingPwd(true);
      await changePassword(pwd.current, pwd.next);
      setPwdMsg("Password updated");
      setPwd({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwdErr(err.message || "Failed to update password");
    } finally {
      setChangingPwd(false);
    }
  };

  const handleOrdersLoaded = useCallback(
    (loaded) => {
      if (!Array.isArray(loaded)) return;
      const pendingOrders = loaded.filter((order) => {
        const status = String(order.items?.[0]?.supplierStatus || order.status || "").toLowerCase();
        return status === "pending";
      }).length;
      const acceptedOrders = loaded.filter((order) => {
        const status = String(order.items?.[0]?.supplierStatus || order.status || "").toLowerCase();
        return status === "accepted";
      }).length;
      setStats((prev) => ({ ...prev, pendingOrders, acceptedOrders }));
    },
    []
  );

  return (
    <div className="admin-dashboard">
      <div className="dashboard-shell dashboard-shell--two-column multi-dashboard">
        <aside className="card dashboard-sidebar">
          <div className="sidebar-profile">
            {user?.avatar ? (
              <img alt="avatar" src={user.avatar} className="avatar avatar--md" />
            ) : (
              <div className="avatar avatar--md avatar--fallback">{initials}</div>
            )}
            <div className="sidebar-profile__meta">
              <div className="font-semibold">{user?.name || "Supplier"}</div>
              <div className="text-xs text-muted">{user?.email}</div>
            </div>
          </div>

          <nav className="dashboard-nav stack-sm">
            <button
              type="button"
              className={`sidebar-link ${tab === "dashboard" ? "is-active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              <span className="sidebar-link__icon">📊</span>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`sidebar-link ${tab === "profile" ? "is-active" : ""}`}
              onClick={() => setTab("profile")}
            >
              <span className="sidebar-link__icon">👤</span>
              <span>Profile details</span>
            </button>
            <button
              type="button"
              className={`sidebar-link ${tab === "supplying" ? "is-active" : ""}`}
              onClick={() => setTab("supplying")}
            >
              <span className="sidebar-link__icon">🤝</span>
              <span>Supplying</span>
            </button>
            <button
              type="button"
              className={`sidebar-link ${tab === "discounts" ? "is-active" : ""}`}
              onClick={() => setTab("discounts")}
            >
              <span className="sidebar-link__icon">💸</span>
              <span>Discounts</span>
            </button>
            <button
              type="button"
              className={`sidebar-link ${tab === "settings" ? "is-active" : ""}`}
              onClick={() => setTab("settings")}
            >
              <span className="sidebar-link__icon">⚙️</span>
              <span>Settings</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button type="button" className="btn btn-danger w-full" onClick={handleLogout}>
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <section className="dashboard-main stack-lg">
          <header className="card dashboard-header">
            <div className="dashboard-header__title">
              <span className="eyebrow">Supplier workspace</span>
              <h2 className="heading-lg">{activeHeading}</h2>
              <p className="muted-text">Manage your catalogue, respond to orders, and keep details up to date.</p>
            </div>
            <div className="dashboard-header__actions">
              <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </header>

          {tab === "dashboard" && (
            <div className="stack-lg">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <DashboardCard
                  title="Published products"
                  value={loadingStats ? "…" : stats.products}
                  description="Listed in the supplier catalogue"
                  accent="#6366f1"
                />
                <DashboardCard
                  title="Pending orders"
                  value={loadingStats ? "…" : stats.pendingOrders}
                  description="Awaiting your response"
                  accent="#f97316"
                />
                <DashboardCard
                  title="Accepted orders"
                  value={loadingStats ? "…" : stats.acceptedOrders}
                  description="Marked as accepted in the last sync"
                  accent="#22c55e"
                />
              </section>

              <div className="card">
                <NotificationsPanel types={["order-supplier", "order-supplier-accept", "order-supplier-decline", "payment-supplier"]} />
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="stack-lg">
              {(profileErr || profileMsg) && (
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
                      {uploadingAvatar ? "Uploading…" : user?.avatar ? "Change photo" : "Upload photo"}
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
                  <h3 className="heading-md">{user?.name || "Supplier profile"}</h3>
                  <span className="muted-text">{user?.email}</span>
                  <div className="profile-hero__badges">
                    <span className="badge badge-green">Supplier</span>
                    <span className="badge badge-gray">ID • {user?._id?.slice(-6) || "000000"}</span>
                  </div>
                </div>
                <p className="profile-hero__copy muted-text">
                  Keep your business details up to date so the Smart Hardware team can connect with you quickly
                  about catalogue changes and purchase orders.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <form className="card stack-md" onSubmit={saveProfile}>
                  <div className="stack-xs">
                    <h3 className="heading-md">Business details</h3>
                    <p className="muted-text text-sm">
                      Update your primary contact information for store administrators.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="label">Contact name</label>
                      <input
                        className="input"
                        value={profile.name}
                        onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Acme Supplies"
                        autoComplete="name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Email</label>
                      <input className="input" value={profile.email} disabled readOnly aria-readonly="true" />
                      <p className="muted-text text-xs">Email is managed by the administrator.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Business address</label>
                      <textarea
                        className="input"
                        rows={3}
                        value={profile.address}
                        onChange={(event) => setProfile((prev) => ({ ...prev, address: event.target.value }))}
                        placeholder="123 Industrial Park"
                        autoComplete="street-address"
                      />
                    </div>
                  </div>

                  <div className="action-grid justify-end">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setProfile({
                          name: user?.name || "",
                          email: user?.email || "",
                          address: user?.address || "",
                        });
                        setProfileErr("");
                        setProfileMsg("");
                      }}
                      disabled={savingProfile}
                    >
                      Reset
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                      {savingProfile ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>

                <form className="card stack-md" onSubmit={handlePasswordChange}>
                  <div className="stack-xs">
                    <h3 className="heading-md">Password</h3>
                    <p className="muted-text text-sm">Choose a strong, unique password to protect your account.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-1">
                    <div>
                      <label className="label">Current password</label>
                      <input
                        className="input"
                        type="password"
                        value={pwd.current}
                        onChange={(event) => setPwd((prev) => ({ ...prev, current: event.target.value }))}
                        autoComplete="current-password"
                      />
                    </div>
                    <div>
                      <label className="label">New password</label>
                      <input
                        className="input"
                        type="password"
                        value={pwd.next}
                        onChange={(event) => setPwd((prev) => ({ ...prev, next: event.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="label">Confirm new password</label>
                      <input
                        className="input"
                        type="password"
                        value={pwd.confirm}
                        onChange={(event) => setPwd((prev) => ({ ...prev, confirm: event.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {pwdErr && <div className="alert alert-danger">{pwdErr}</div>}
                  {pwdMsg && <div className="alert alert-success">{pwdMsg}</div>}

                  <div className="action-grid justify-end">
                    <button type="submit" className="btn btn-primary" disabled={changingPwd}>
                      {changingPwd ? "Updating…" : "Update password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === "supplying" && (
            <div className="stack-lg">
              <div className="card stack-md">
                <div className="stack-xs">
                  <h3 className="heading-md">Catalogue</h3>
                  <p className="muted-text text-sm">
                    Manage the products you provide to Smart Hardware customers.
                  </p>
                </div>
                <SupplierProductList />
              </div>

              <div className="card stack-md">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="stack-xs">
                    <h3 className="heading-md">Orders from admin</h3>
                    <p className="muted-text text-sm">
                      Accept or decline purchase orders placed by the store team.
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={loadStats}>
                    Reload orders
                  </button>
                </div>
                <ReceivedOrders onOrdersLoaded={handleOrdersLoaded} />
              </div>
            </div>
          )}

          {tab === "discounts" && <SupplierDiscounts />}

          {tab === "settings" && (
            <div className="card stack-md">
              <h3 className="heading-md">Display preferences</h3>
              <p className="muted-text text-sm">
                Switch between dark and light mode any time.
              </p>
              <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
                {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
