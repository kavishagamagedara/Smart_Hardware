// src/Components/Dashboard/Dashboard.js
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
// Use /api specifically for endpoints that are definitely under /api
const APIv2 = `${String(API).replace(/\/$/, "")}/api`;

export default function Dashboard() {
  // add updateProfile/changePassword so Profile actually works
  const { user, theme, setTheme, token, updateProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();

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
  const roleNorm = String(user?.role || "").trim().toLowerCase();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const has = (p) => perms.includes(p);
  const hasAny = (arr) => arr.some((p) => has(p));

  // Admin menus appear when any of these are true (unchanged)
  const isAdmin =
    roleNorm === "admin" || has("admin") || has("manage_users") || has("manage_roles");

  // Be tolerant to common naming variants
  const canSales =
    roleNorm === "sales_manager" ||
    roleNorm.includes("sales") ||
    hasAny([
      "sales_manage_orders",
      "sales_process_refunds",
      "sales_view_reports",
      "sales_manage_discounts",
    ]);

  const canFinance =
    roleNorm === "finance_manager" ||
    roleNorm === "financial_manager" ||
    roleNorm.includes("finance") ||
    hasAny(["fin_view_dashboard", "fin_record_payments", "fin_payroll", "fin_statements"]);

  const canInventory =
    roleNorm === "inventory_manager" ||
    roleNorm.includes("inventory") ||
    hasAny(["inv_view_stock", "inv_update_stock", "inv_receive_goods", "inv_reports", "inv_reorder"]);

  const canCare =
    roleNorm === "customer_care_manager" ||
    roleNorm === "customer_care" ||
    roleNorm.includes("customer care") ||
    roleNorm.includes("customer_care") ||
    roleNorm.includes("support") ||
    roleNorm.endsWith("care") ||
    hasAny(["cc_view_feedback", "cc_respond_feedback", "cc_manage_returns"]);

  // a “plain” user is not admin and not any manager
  const isPlainUser = !isAdmin && !canSales && !canFinance && !canInventory && !canCare;

  const [tab, setTab] = useState("dashboard");

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
  const [finStats, setFinStats] = useState({ totalReceived: 0, recent: [] });
  useEffect(() => {
    if (!canFinance) return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/finance/dashboard`, { headers });
        setFinStats(r.ok ? await r.json() : { totalReceived: 0, recent: [] });
      } catch {
        setFinStats({ totalReceived: 0, recent: [] });
      }
    })();
  }, [canFinance, token]);

  // ------- Inventory (manager) -------
  const [invItems, setInvItems] = useState([]);
  useEffect(() => {
    if (!canInventory) return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/inventory/items`, { headers });
        setInvItems(r.ok ? await r.json() : []);
      } catch {
        setInvItems([]);
      }
    })();
  }, [canInventory, token]);

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

  // ------- Plain user data: orders + my feedback -------
  const [userOrders, setUserOrders] = useState([]);
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  useEffect(() => {
    if (!isPlainUser) return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const o = await fetch(`${API}/orders/my`, { headers });
        setUserOrders(o.ok ? await o.json() : []);
      } catch {
        setUserOrders([]);
      }
    })();
    (async () => {
      try {
        const f = await fetch(`${API}/feedback/my`, { headers });
        setMyFeedbacks(f.ok ? await f.json() : []);
      } catch {
        setMyFeedbacks([]);
      }
    })();
  }, [isPlainUser, token]);

  // -------- NEW: Supplying (plain user only) --------
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [suppliersErr, setSuppliersErr] = useState("");

  useEffect(() => {
    if (!(isPlainUser && tab === "supplying")) return;
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
  }, [isPlainUser, tab, token]);

  // -------- Profile form (works for all users) --------
  const [profile, setProfile] = useState({
    name: user?.name || "",
    age: user?.age ?? "",
    address: user?.address || "",
  });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    try {
      const updated = await updateProfile({
        name: profile.name,
        age: profile.age ? Number(profile.age) : undefined,
        address: profile.address || undefined,
      });
      setProfile({
        name: updated.name || "",
        age: updated.age ?? "",
        address: updated.address || "",
      });
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

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 mx-auto max-w-7xl px-4 py-6">
      {/* Sidebar */}
      <aside className="card p-4 h-max md:sticky md:top-24">
        <div className="flex items-center gap-3 mb-4">
          {user?.avatar ? (
            <img alt="avatar" src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center font-black">
              {initials}
            </div>
          )}
          <div>
            <div className="font-extrabold">{user?.name || "User"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
          </div>
        </div>

        <nav className="space-y-2">
          <button
            onClick={() => setTab("dashboard")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "dashboard" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>📊</span>
            <span className="font-semibold">Dashboard</span>
          </button>

          <button
            onClick={() => setTab("profile")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "profile" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>👤</span>
            <span className="font-semibold">Profile</span>
          </button>

          {/* Admin links */}
          {isAdmin && (
            <>
              <button
                onClick={() => navigate("/admin#users")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <span>👥</span>
                <span className="font-semibold">User Management</span>
              </button>
              <button
                onClick={() => navigate("/admin#roles")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <span>🛡️</span>
                <span className="font-semibold">Roles & Privileges</span>
              </button>
              <button
                onClick={() => navigate("/admin#product")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <span>📦</span>
                <span className="font-semibold">Product Management</span>
              </button>
              <button
                onClick={() => navigate("/admin#feedback")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <span>💬</span>
                <span className="font-semibold">Feedback & Reviews</span>
              </button>
            </>
          )}

          {/* Manager menus */}
          {canSales && (
            <button
              onClick={() => setTab("sales")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                tab === "sales" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
            >
              <span>🛒</span>
              <span className="font-semibold">Sales Manager</span>
            </button>
          )}
          {canFinance && (
            <button
              onClick={() => setTab("finance")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                tab === "finance" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
            >
              <span>💳</span>
              <span className="font-semibold">Finance Manager</span>
            </button>
          )}
          {canInventory && (
            <button
              onClick={() => setTab("inventory")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                tab === "inventory" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
            >
              <span>📦</span>
              <span className="font-semibold">Inventory Manager</span>
            </button>
          )}
          {canCare && (
            <button
              onClick={() => setTab("care")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                tab === "care" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
            >
              <span>💬</span>
              <span className="font-semibold">Feedback & Reviews</span>
            </button>
          )}

          {/* Plain user-only menus */}
          {isPlainUser && (
            <>
              <button
                onClick={() => setTab("orders")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                  tab === "orders" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
                }`}
              >
                <span>🧾</span>
                <span className="font-semibold">My Orders</span>
              </button>

              <button
                onClick={() => setTab("myfeedback")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                  tab === "myfeedback" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
                }`}
              >
                <span>📝</span>
                <span className="font-semibold">My Feedback</span>
              </button>

              {/* NEW: Supplying (only for plain users) */}
              <button
                onClick={() => setTab("supplying")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
                  tab === "supplying" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
                }`}
              >
                <span>🤝</span>
                <span className="font-semibold">Supplying</span>
              </button>
            </>
          )}

          <button
            onClick={() => setTab("settings")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "settings" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>⚙️</span>
            <span className="font-semibold">Settings</span>
          </button>
        </nav>
        <hr className="my-4" /><div className="mt-4">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
       >
        <span>🚪</span>
        <span className="font-semibold">Logout</span>
        </button>
        </div>
      </aside>

      {/* Main */}
      <section className="space-y-4">
        <header className="card">
          <h2 className="text-xl font-black">
            {tab === "dashboard"
              ? "Dashboard"
              : tab === "profile"
              ? "Profile"
              : tab === "sales"
              ? "Sales Manager"
              : tab === "finance"
              ? "Finance Manager"
              : tab === "inventory"
              ? "Inventory Manager"
              : tab === "care"
              ? "Feedback & Reviews"
              : tab === "orders"
              ? "My Orders"
              : tab === "myfeedback"
              ? "My Feedback"
              : tab === "supplying"
              ? "Supplying"
              : "Settings"}
          </h2>
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
              <div className="text-3xl font-black">$24,380</div>
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
          <div className="card space-y-5">
            {(profileMsg || profileErr) && (
              <div
                className={`rounded-xl px-3 py-2 ${
                  profileErr
                    ? "border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200"
                    : "border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                {profileErr || profileMsg}
              </div>
            )}

            <div className="flex flex-wrap gap-6 items-center">
              {user?.avatar ? (
                <img alt="avatar" src={user.avatar} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-600 text-white grid place-items-center text-2xl font-black">
                  {initials}
                </div>
              )}
            </div>

            <form onSubmit={saveProfile} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={user?.email || ""} disabled />
              </div>
              <div>
                <label className="label">Age</label>
                <input
                  className="input"
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Address</label>
                <input
                  className="input"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <button className="btn btn-primary px-4 py-2">Save profile</button>
              </div>
            </form>

            <h3 className="text-xl font-black">Change password</h3>
            <form onSubmit={savePassword} className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">Current password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd.current ? "text" : "password"}
                    value={pwd.current}
                    onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-lg"
                    onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
                  >
                    {showPwd.current ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd.next ? "text" : "password"}
                    value={pwd.next}
                    onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-lg"
                    onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
                  >
                    {showPwd.next ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd.confirm ? "text" : "password"}
                    value={pwd.confirm}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-lg"
                    onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
                  >
                    {showPwd.confirm ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div className="md:col-span-3">
                <button className="btn btn-primary px-4 py-2">Change password</button>
              </div>
            </form>
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
                        <td>${o.total?.toFixed?.(2) ?? o.total}</td>
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
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card">
              <div className="text-slate-500">Total received</div>
              <div className="text-3xl font-black">
                ${finStats.totalReceived?.toFixed?.(2) ?? finStats.totalReceived}
              </div>
            </div>
            <div className="card">
              <div className="text-slate-500">Recent payments</div>
              <ul className="mt-2 space-y-1 text-sm">
                {(finStats.recent || []).map((p) => (
                  <li key={p._id} className="flex justify-between border-b border-white/10 py-1">
                    <span>{p.method}</span>
                    <span>${p.amount}</span>
                  </li>
                ))}
                {(!finStats.recent || finStats.recent.length === 0) && (
                  <li className="py-2 text-slate-500">No data yet</li>
                )}
              </ul>
            </div>
          </section>
        )}

        {/* Inventory (manager) */}
        {tab === "inventory" && canInventory && (
          <div className="card overflow-x-auto">
            <table className="min-w-[720px] w-full">
              <thead>
                <tr className="text-left">
                  <th>SKU</th>
                  <th>Name</th>
                  <th>On hand</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {invItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">No items</td>
                  </tr>
                ) : (
                  invItems.map((it) => (
                    <tr key={it._id} className="border-t border-white/10">
                      <td>{it.sku}</td>
                      <td>{it.name}</td>
                      <td>{it.onHand}</td>
                      <td>{it.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Care (manager) */}
        {tab === "care" && canCare && (
          <div className="card overflow-x-auto">
            <table className="min-w-[800px] w-full">
              <thead>
                <tr className="text-left">
                  <th>User</th>
                  <th>Product</th>
                  <th>Message</th>
                  <th>Reply</th>
                </tr>
              </thead>
              <tbody>
                {careList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">No feedback yet</td>
                  </tr>
                ) : (
                  careList.map((f) => (
                    <tr key={f._id} className="border-t border-white/10">
                      <td>{f.userEmail}</td>
                      <td>{f.productName}</td>
                      <td className="max-w-[280px] truncate">{f.message}</td>
                      <td className="max-w-[280px] truncate">{f.reply || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Plain user: My Orders */}
        {tab === "orders" && isPlainUser && (
  <div>
    {/* ✅ Buttons above table */}
    <div className="mb-4 flex gap-3">
      <button
        onClick={() => navigate("/ReceivedOrders")}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Received Orders
      </button>
      <button
        onClick={() => navigate("/CompletedOrders")}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Completed Orders
      </button>
    </div>
  </div>
)}


        {/* Plain user: My Feedback */}
        {tab === "myfeedback" && isPlainUser && (
          <div className="card overflow-x-auto">
            <table className="min-w-[800px] w-full">
              <thead>
                <tr className="text-left">
                  <th>Date</th>
                  <th>Product</th>
                  <th>Message</th>
                  <th>Reply</th>
                </tr>
              </thead>
              <tbody>
                {myFeedbacks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">No feedback yet</td>
                  </tr>
                ) : (
                  myFeedbacks.map((f) => (
                    <tr key={f._id} className="border-t border-white/10">
                      <td>{f.date ? new Date(f.date).toLocaleDateString() : "-"}</td>
                      <td>{f.productName || "-"}</td>
                      <td className="max-w-[320px] truncate">{f.message}</td>
                      <td className="max-w-[320px] truncate">{f.reply || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Plain user: Supplying */}
{tab === "supplying" && isPlainUser && (
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
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="input max-w-xs">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
