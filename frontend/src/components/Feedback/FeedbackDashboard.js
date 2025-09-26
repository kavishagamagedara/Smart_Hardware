// src/Components/Dashboard/Dashboard.js
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MyReviews from "../../pages/MyReviews.jsx";

// If you have an auth context, replace this stub with your real user
const useAuthStub = () => ({
  user: { name: "User", email: "user@example.com", role: "user", permissions: [] },
  theme: "dark",
  setTheme: () => {},
  token: "",
});

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const APIv2 = `${String(API).replace(/\/$/, "")}/api`;

export default function Dashboard() {
  const { user, theme, setTheme, token } = useAuthStub(); // swap to your real useAuth()
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

  // ----- role gates (same idea as your original) -----
  const roleNorm = String(user?.role || "").trim().toLowerCase();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const has = (p) => perms.includes(p);
  const hasAny = (arr) => arr.some((p) => has(p));

  const isAdmin =
    roleNorm === "admin" || has("admin") || has("manage_users") || has("manage_roles");

  const canCare =
    roleNorm === "customer_care_manager" ||
    roleNorm === "customer_care" ||
    roleNorm.includes("customer care") ||
    roleNorm.includes("customer_care") ||
    roleNorm.includes("support") ||
    roleNorm.endsWith("care") ||
    hasAny(["cc_view_feedback", "cc_respond_feedback", "cc_manage_returns"]);

  // A plain user is not admin/care
  const isPlainUser = !isAdmin && !canCare;

  // ---------------- state ----------------
  const [tab, setTab] = useState("dashboard");

  // Care list (only if care/admin selects the same “Feedback & Reviews” menu)
  const [careList, setCareList] = useState([]);
  useEffect(() => {
    if (!(canCare || isAdmin)) return;
    if (tab !== "feedback") return;
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/care/feedbacks`, { headers });
        setCareList(r.ok ? await r.json() : []);
      } catch {
        setCareList([]);
      }
    })();
  }, [tab, canCare, isAdmin, token]);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 mx-auto max-w-7xl px-4 py-6">
      {/* Sidebar */}
      <aside className="card p-4 h-max md:sticky md:top-24">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center font-black">
            {initials}
          </div>
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

          {/* >>> ONE menu for both roles: Feedback & Reviews <<< */}
          <button
            onClick={() => setTab("feedback")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "feedback" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>💬</span>
            <span className="font-semibold">Feedback & Reviews</span>
          </button>

          {/* Orders link for users (review writing happens from Orders page) */}
          {isPlainUser && (
            <button
              onClick={() => navigate("/orders-sample")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <span>🧾</span>
              <span className="font-semibold">My Orders (sample)</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => setTab("settings")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${
              tab === "settings" ? "bg-brand-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            <span>⚙</span>
            <span className="font-semibold">Settings</span>
          </button>
        </nav>
      </aside>

      {/* Main */}
      <section className="space-y-4">
        <header className="card">
          <h2 className="text-xl font-black">
            {tab === "dashboard"
              ? "Dashboard"
              : tab === "feedback"
              ? "Feedback & Reviews"
              : "Settings"}
          </h2>
        </header>

        {tab === "dashboard" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <div className="text-slate-500">Welcome</div>
              <div className="text-3xl font-black">👋</div>
              <div className="text-sm text-slate-500">Use the left menu</div>
            </div>
          </div>
        )}

        {/* >>> THIS is the tab you asked for <<< */}
        {tab === "feedback" && (
          <>
            {isPlainUser ? (
              // USER view: your existing MyReviews UI (search + inline edit/delete)
              <div className="card p-4">
                <MyReviews embedded />
              </div>
            ) : (
              // CARE/ADMIN view: keep your existing table (placeholder fetch above)
              <div className="card overflow-x-auto p-4">
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
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          No feedback yet
                        </td>
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
          </>
        )}

        {tab === "settings" && (
          <div className="card p-4">
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
