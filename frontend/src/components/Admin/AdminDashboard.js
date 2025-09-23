// src/Components/Admin/AdminDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api";

/** Privilege catalog grouped by business area (hardware store) */
const PRIV_CATEGORIES = [
  {
    title: "General User",
    items: [
      { id: "view_products", label: "View products" },
      { id: "place_orders", label: "Place orders" },
      { id: "view_own_orders", label: "View own orders" },
      { id: "submit_feedback", label: "Submit feedback" },
    ],
  },
  {
    title: "Admin",
    items: [
      { id: "manage_users", label: "Manage users & roles" },
      { id: "manage_roles", label: "Manage roles & privileges" },
      { id: "manage_products", label: "Manage products" },
      { id: "manage_inventory", label: "Manage inventory" },
      { id: "manage_all_orders", label: "Manage all orders" },
      { id: "moderate_feedback", label: "Moderate all feedback" },
      { id: "manage_suppliers", label: "Manage suppliers" },
      { id: "view_analytics", label: "View analytics & reports" },
      { id: "export_data", label: "Export data" },
      { id: "system_config", label: "System configuration" },
    ],
  },
  {
    title: "Sales Manager",
    items: [
      { id: "sales_manage_orders", label: "Manage sales/orders" },
      { id: "sales_process_refunds", label: "Process refunds" },
      { id: "sales_manage_discounts", label: "Manage discounts & promos" },
      { id: "sales_view_reports", label: "View sales reports" },
    ],
  },
  {
    title: "Finance Manager",
    items: [
      { id: "fin_view_dashboard", label: "View finance dashboard" },
      { id: "fin_record_payments", label: "Record payments" },
      { id: "fin_payroll", label: "Run payroll / salaries" },
      { id: "fin_statements", label: "Financial statements & reports" },
    ],
  },
  {
    title: "Customer Care Manager",
    items: [
      { id: "cc_view_feedback", label: "View feedback" },
      { id: "cc_respond_feedback", label: "Respond to customers" },
      { id: "cc_manage_returns", label: "Manage returns / issues" },
    ],
  },
  {
    title: "Inventory Manager",
    items: [
      { id: "inv_view_stock", label: "View stock balances" },
      { id: "inv_update_stock", label: "Update / adjust stock" },
      { id: "inv_reorder", label: "Create re-order / purchase requests" },
      { id: "inv_receive_goods", label: "Receive goods" },
      { id: "inv_reports", label: "Inventory reports" },
    ],
  },
];

const roleBadge = (r) =>
  r === "admin"
    ? "badge badge-amber"
    : r === "staff"
    ? "badge badge-green"
    : "badge badge-gray";

export default function AdminDashboard() {
  const { user, token, updateProfile, changePassword,logout } = useAuth();
  const navigate = useNavigate();

  // ---------------- Tabs (hash-aware) ----------------
  const [tab, setTab] = useState("dashboard");
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash) setTab(fromHash);
    const onHash = () => setTab(window.location.hash.replace("#", "") || "dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const setTabAndHash = (t) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  // ---------------- Data: Users / Roles ----------------
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadUsers = async () => {
    setLoadingUsers(true);
    setErr("");
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      if (!res.ok)
        throw new Error((await res.json().catch(() => ({}))).message || "Failed to load users");
      setUsers(await res.json());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  // ✅ roles list requires Authorization
  const loadRoles = async () => {
    setLoadingRoles(true);
    setErr("");
    try {
      const res = await fetch(`${API}/roles`, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      if (!res.ok)
        throw new Error((await res.json().catch(() => ({}))).message || "Failed to load roles");
      setRoles(await res.json());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
  if (tab === "users") {
    loadUsers();
  }
  if (tab === "roles") {
    loadRoles();
  }
}, [tab, token]);  // reruns whenever tab or token changes


  // ---------------- Profile ----------------
  const initials = (user?.name || "A")
    .trim()
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [profile, setProfile] = useState({
    name: user?.name || "",
    age: user?.age ?? "",
    address: user?.address || "",
  });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
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
      setMsg("Profile updated");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!pwd.next || pwd.next.length < 6) return setErr("New password must be at least 6 characters");
    if (pwd.next !== pwd.confirm) return setErr("Passwords do not match");
    try {
      await changePassword(pwd.current, pwd.next);
      setMsg("Password changed");
      setPwd({ current: "", next: "", confirm: "" });
      setShowPwd({ current: false, next: false, confirm: false });
    } catch (ex) {
      setErr(ex.message);
    }
  };

  // ---------------- Users: CRUD ----------------
  const emptyUser = useMemo(
    () => ({
      _id: "",
      name: "",
      email: "",
      password: "",
      age: "",
      address: "",
      role: "user",
    }),
    []
  );

  const [userForm, setUserForm] = useState(emptyUser);
  const [userMode, setUserMode] = useState("create"); // create | edit
  const [userBusy, setUserBusy] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  const openCreateUser = () => {
    setUserForm(emptyUser);
    setUserMode("create");
    setShowUserForm(true);
    setMsg("");
    setErr("");
  };
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

  const submitUser = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!userForm.name || !userForm.email) return setErr("Name and email are required.");

    try {
      setUserBusy(true);
      if (userMode === "create") {
        const payload = {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password || "changeme123",
          age: userForm.age ? Number(userForm.age) : undefined,
          address: userForm.address || undefined,
          role: userForm.role || "user",
        };
        const res = await fetch(`${API}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined,
          },
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
          role: userForm.role || "user",
        };
        const res = await fetch(`${API}/users/${userForm._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined,
          },
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

  const removeUser = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`${API}/users/${u._id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Delete failed");
      setMsg("User deleted");
      await loadUsers();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  // ---------------- Roles: CRUD ----------------
  const emptyRole = useMemo(
    () => ({
      _id: "",
      name: "",
      description: "",
      privileges: [],
    }),
    []
  );
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [roleMode, setRoleMode] = useState("create"); // create | edit
  const [roleBusy, setRoleBusy] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);

  const openCreateRole = () => {
    setRoleForm(emptyRole);
    setRoleMode("create");
    setShowRoleForm(true);
    setMsg("");
    setErr("");
  };
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

  const submitRole = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!roleForm.name) return setErr("Role name is required.");

    try {
      setRoleBusy(true);
      if (roleMode === "create") {
        const res = await fetch(`${API}/roles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined, // ✅ auth
          },
          body: JSON.stringify({
            name: roleForm.name,
            description: roleForm.description,
            privileges: roleForm.privileges,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Create role failed");
        setMsg("Role created");
      } else {
        const res = await fetch(`${API}/roles/${roleForm._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : undefined, // ✅ auth
          },
          body: JSON.stringify({
            name: roleForm.name,
            description: roleForm.description,
            privileges: roleForm.privileges,
          }),
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

  const removeRole = async (r) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`${API}/roles/${r._id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : undefined }, // ✅ auth
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Delete role failed");
      setMsg("Role deleted");
      await loadRoles();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  // ---------------- Admin quick views: Sales & Finance ----------------
  const [salesStats, setSalesStats] = useState({ totalOrders: 0, refunded: 0, recent: [] });
  const [salesOrders, setSalesOrders] = useState([]);
  useEffect(() => {
    if (tab !== "sales") return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const s = await fetch(`${API}/sales/dashboard`, { headers });
        const o = await fetch(`${API}/sales/orders`, { headers });
        if (s.ok) setSalesStats(await s.json());
        else setSalesStats({ totalOrders: 128, refunded: 3, recent: [] });
        if (o.ok) setSalesOrders(await o.json());
        else setSalesOrders([]);
      } catch {
        setSalesStats({ totalOrders: 128, refunded: 3, recent: [] });
        setSalesOrders([]);
      }
    })();
  }, [tab, token]);

  const [finStats, setFinStats] = useState({ totalReceived: 0, recent: [] });
  useEffect(() => {
    if (tab !== "finance") return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/finance/dashboard`, { headers });
        if (r.ok) setFinStats(await r.json());
        else setFinStats({ totalReceived: 0, recent: [] });
      } catch {
        setFinStats({ totalReceived: 0, recent: [] });
      }
    })();
  }, [tab, token]);

  // ---------------- Users: search (by name or role) ----------------
  const [q, setQ] = useState("");
  const filteredUsers = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter(
      (u) => (u.name || "").toLowerCase().includes(t) || (u.role || "").toLowerCase().includes(t)
    );
  }, [q, users]);

  // ---------------- Theme (Settings) ----------------
  const [theme, setTheme] = useState("light"); // 'light' | 'dark'
  const applyTheme = (t) => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", t);
  };
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      applyTheme(saved);
    } else {
      const isDark = document.documentElement.classList.contains("dark");
      const initial = isDark ? "dark" : "light";
      setTheme(initial);
      localStorage.setItem("theme", initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Suppliers ----------------
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  useEffect(() => {
    if (tab !== "suppliers") return;
    setLoadingSuppliers(true);
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/suppliers`, { headers });
        if (r.ok) setSuppliers(await r.json());
        else setSuppliers([]);
      } catch {
        setSuppliers([]);
      } finally {
        setLoadingSuppliers(false);
      }
    })();
  }, [tab, token]);

  const handleLogout = () => {
  logout();
  navigate("/login", { replace: true });
};


  // ---------------- Render ----------------
  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 mx-auto max-w-7xl px-4 py-6">
      {/* Sidebar */}
      <aside className="card p-4 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] overflow-auto">
        <div className="flex items-center gap-3 mb-4">
          {user?.avatar ? (
            <img alt="avatar" src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center font-black">
              {initials}
            </div>
          )}
          <div>
            <div className="font-extrabold">{user?.name || "Admin"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
          </div>
        </div>

        <nav className="space-y-2">
          <button
            onClick={() => setTabAndHash("dashboard")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "dashboard" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>📊</span>
            <span className="font-semibold">Dashboard</span>
          </button>
          <button
            onClick={() => setTabAndHash("profile")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "profile" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>👤</span>
            <span className="font-semibold">Profile</span>
          </button>
          <button
            onClick={() => setTabAndHash("users")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "users" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>👥</span>
            <span className="font-semibold">User Management</span>
          </button>
          <button
            onClick={() => setTabAndHash("roles")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "roles" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>🛡️</span>
            <span className="font-semibold">Roles & Privileges</span>
          </button>
          <button
            onClick={() => setTabAndHash("product")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "product" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>📦</span>
            <span className="font-semibold">Product Management</span>
          </button>
          <button
            onClick={() => setTabAndHash("feedback")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "feedback" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>💬</span>
            <span className="font-semibold">Feedback & Reviews</span>
          </button>

          {/* NEW: Suppliers */}
          <button
           onClick={() => navigate("/admin-supplier-product")}
           className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
>
            <span>🤝</span>
            <span className="font-semibold">Suppliers</span>
          </button>


          {/* Admin quick views */}
          <button
            onClick={() => setTabAndHash("sales")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "sales" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>🛒</span>
            <span className="font-semibold">Sales</span>
          </button>
          <button
            onClick={() => setTabAndHash("finance")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "finance" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>💳</span>
            <span className="font-semibold">Finance</span>
          </button>

          <button
            onClick={() => setTabAndHash("settings")}
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
              ? "Admin Dashboard"
              : tab === "profile"
              ? "Profile"
              : tab === "users"
              ? "Users"
              : tab === "roles"
              ? "Roles & privileges"
              : tab === "product"
              ? "Product Management"
              : tab === "feedback"
              ? "Feedback & Reviews"
              : tab === "suppliers"
              ? "Suppliers"
              : tab === "sales"
              ? "Sales"
              : tab === "finance"
              ? "Finance"
              : "Settings"}
          </h2>
        </header>

        {msg && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 px-3 py-2">
            {msg}
          </div>
        )}
        {err && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 px-3 py-2">
            {err}
          </div>
        )}

        {/* DASHBOARD quick tiles */}
        {tab === "dashboard" && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Orders", value: "1,284", sub: "+37 today" },
              { label: "Revenue (30d)", value: "$124,380", sub: "+4.3% MoM" },
              { label: "Products in Stock", value: "842", sub: "32 categories" },
              { label: "Low Stock", value: "19", sub: "need re-order" },
            ].map((k, i) => (
              <div className="card" key={i}>
                <div className="text-slate-500 dark:text-slate-400 font-semibold">{k.label}</div>
                <div className="text-3xl font-black mt-1">{k.value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{k.sub}</div>
              </div>
            ))}
          </section>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="card space-y-5">
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

        {/* USERS (with search) */}
        {tab === "users" && (
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h3 className="text-lg font-black">User management</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    className="input pl-9"
                    placeholder="Search by name or role…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">🔎</span>
                </div>
                <button className="btn btn-primary px-4 py-2" onClick={openCreateUser}>
                  Create user
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[200px_1fr_120px_100px_1fr_160px] font-extrabold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 pb-2 mb-2">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Age</span>
                  <span>Address</span>
                  <span>Actions</span>
                </div>
                {loadingUsers ? (
                  <div className="py-10 text-center text-slate-500 dark:text-slate-400">Loading…</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {q ? "No matching users." : "No users found."}
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u._id}
                      className="grid grid-cols-[200px_1fr_120px_100px_1fr_160px] items-center py-2 border-b last:border-none border-slate-200 dark:border-white/10"
                    >
                      <span className="truncate">{u.name}</span>
                      <span className="truncate">{u.email}</span>
                      <span>
                        <span className={roleBadge(u.role)}>{u.role || "user"}</span>
                      </span>
                      <span>{u.age ?? "-"}</span>
                      <span className="truncate">{u.address || "-"}</span>
                      <span className="flex gap-2">
                        <button className="btn btn-ghost px-3 py-1.5" onClick={() => openEditUser(u)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost px-3 py-1.5" onClick={() => removeUser(u)}>
                          Delete
                        </button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ROLES */}
        {tab === "roles" && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black">Roles & privileges</h3>
              <button className="btn btn-primary px-4 py-2" onClick={openCreateRole}>
                Create role
              </button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[220px_1fr_260px] font-extrabold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 pb-2 mb-2">
                  <span>Role</span>
                  <span>Description</span>
                  <span>Actions</span>
                </div>
                {loadingRoles ? (
                  <div className="py-10 text-center text-slate-500 dark:text-slate-400">Loading…</div>
                ) : roles.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No roles yet. Create one.
                  </div>
                ) : (
                  roles.map((r) => (
                    <div
                      key={r._id}
                      className="grid grid-cols-[220px_1fr_260px] items-center py-2 border-b last:border-none border-slate-200 dark:border-white/10"
                    >
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {Array.isArray(r.privileges) && r.privileges.length
                            ? r.privileges.join(", ")
                            : "No privileges"}
                        </div>
                      </div>
                      <div className="truncate">{r.description || "-"}</div>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost px-3 py-1.5" onClick={() => openEditRole(r)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost px-3 py-1.5" onClick={() => removeRole(r)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT MANAGEMENT */}
        {tab === "product" && (
        <div className="card flex flex-col gap-4 p-6">
            <h3 className="text-lg font-bold mb-2">Product Management</h3>
            <div className="flex gap-4">
              <button
                className="btn btn-primary px-4 py-2"
                onClick={() => navigate("/add-product")}
              >
             ➕ Add Product
               </button>
                <button
                  className="btn btn-secondary px-4 py-2"
                  onClick={() => navigate("/products")}
                >
                📦 View Product List
              </button>

              <button
                  className="btn btn-accent px-4 py-2"
                  onClick={() => navigate("/admin-supplier-product")}
            >
                🛒 View Supplier Product List
              </button>
            </div>
        </div>
        )}


        {/* SUPPLIERS */}
        {tab === "suppliers" && (
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black">Suppliers</h3>
            </div>
            <table className="min-w-[720px] w-full">
              <thead>
                <tr className="text-left">
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingSuppliers ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500">
                      No suppliers yet
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s._id || s.email} className="border-t border-white/10">
                      <td className="py-2">{s.name || "-"}</td>
                      <td className="py-2">{s.email || "-"}</td>
                      <td className="py-2">{s.status || "active"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SALES quick view */}
        {tab === "sales" && (
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
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No data yet
                      </td>
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

        {/* FINANCE quick view */}
        {tab === "finance" && (
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

        {/* SETTINGS — Theme selector */}
        {tab === "settings" && (
          <div className="card space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                <label className="label mb-2 block">Theme</label>
                <select
                  className="input"
                  value={theme}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTheme(val);
                    applyTheme(val);
                  }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* USER MODAL */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 grid place-items-center px-3">
          <form onSubmit={submitUser} className="card w-full max-w-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">{userMode === "create" ? "Create user" : "Edit user"}</h3>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1.5"
                onClick={() => setShowUserForm(false)}
              >
                Close
              </button>
            </div>

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
                  {(roles.length ? roles.map((r) => r.name) : ["admin", "staff", "user"]).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button className="btn btn-primary px-4 py-2" disabled={userBusy}>
                {userBusy ? "Saving..." : userMode === "create" ? "Create user" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ROLE MODAL */}
      {showRoleForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 grid place-items-center px-2 sm:px-3">
          <form
            onSubmit={submitRole}
            className="card w-full max-w-5xl h-[86vh] sm:h-[88vh] p-0 overflow-hidden flex flex-col"
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-black">{roleMode === "create" ? "Create role" : "Edit role"}</h3>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1.5"
                onClick={() => setShowRoleForm(false)}
              >
                Close
              </button>
            </div>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
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

            {/* sticky footer */}
            <div className="sticky bottom-0 px-4 py-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 z-20">
              <button className="btn btn-primary px-4 py-2" disabled={roleBusy}>
                {roleBusy ? "Saving..." : roleMode === "create" ? "Create role" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
