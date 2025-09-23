// src/components/Dashboard/CustomerDashboard.js
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function CustomerDashboard() {
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

  const [tab, setTab] = useState("CustomerDashboard");

  /* ---- Plain user data ---- */
  const [userOrders, setUserOrders] = useState([]);
  const [myFeedbacks, setMyFeedbacks] = useState([]);

  useEffect(() => {
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    if (tab === "orders") {
      (async () => {
        try {
          const o = await fetch(`${API}/orders/my`, { headers });
          setUserOrders(o.ok ? await o.json() : []);
        } catch {
          setUserOrders([]);
        }
      })();
    }
    if (tab === "myfeedback") {
      (async () => {
        try {
          const f = await fetch(`${API}/feedback/my`, { headers });
          setMyFeedbacks(f.ok ? await f.json() : []);
        } catch {
          setMyFeedbacks([]);
        }
      })();
    }
  }, [tab, token]);

  /* ---- Profile ---- */
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
      setProfile(updated);
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
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white grid place-items-center font-black">
              {initials}
            </div>
          )}
          <div>
            <div className="font-extrabold">{user?.name || "User"}</div>
            <div className="text-xs text-slate-500">{user?.email}</div>
          </div>
        </div>

        <nav className="space-y-2">
          <button onClick={() => setTab("dashboard")} className={`w-full px-3 py-2 rounded-xl ${tab==="dashboard"?"bg-blue-600 text-white":"hover:bg-slate-100"}`}>📊 Dashboard</button>
          <button onClick={() => setTab("profile")} className={`w-full px-3 py-2 rounded-xl ${tab==="profile"?"bg-blue-600 text-white":"hover:bg-slate-100"}`}>👤 Profile</button>
          <button onClick={() => setTab("orders")} className={`w-full px-3 py-2 rounded-xl ${tab==="orders"?"bg-blue-600 text-white":"hover:bg-slate-100"}`}>🧾 My Orders</button>
          <button onClick={() => setTab("myfeedback")} className={`w-full px-3 py-2 rounded-xl ${tab==="myfeedback"?"bg-blue-600 text-white":"hover:bg-slate-100"}`}>📝 My Feedback</button>
          <button onClick={() => setTab("settings")} className={`w-full px-3 py-2 rounded-xl ${tab==="settings"?"bg-blue-600 text-white":"hover:bg-slate-100"}`}>⚙️ Settings</button>
        </nav>

        <hr className="my-4" />
        <button onClick={handleLogout} className="w-full px-3 py-2 rounded-xl bg-red-600 text-white">🚪 Logout</button>
      </aside>

      {/* Main */}
      <section className="space-y-4">
        <header className="card">
          <h2 className="text-xl font-black">
            {tab === "dashboard" ? "Dashboard" :
             tab === "profile" ? "Profile" :
             tab === "orders" ? "My Orders" :
             tab === "myfeedback" ? "My Feedback" : "Settings"}
          </h2>
        </header>

        {/* Dashboard widgets */}
        {tab === "dashboard" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">📦 Orders: {userOrders.length}</div>
            <div className="card">📝 Feedback: {myFeedbacks.length}</div>
          </div>
        )}

        {/* Orders */}
        {tab === "orders" && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr><th>#</th><th>Date</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {userOrders.length === 0 ? <tr><td colSpan={4}>No orders</td></tr> :
                  userOrders.map(o => (
                    <tr key={o._id}>
                      <td>{o.number}</td>
                      <td>{new Date(o.date).toLocaleDateString()}</td>
                      <td>{o.status}</td>
                      <td>{o.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Feedback */}
        {tab === "myfeedback" && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr><th>Date</th><th>Product</th><th>Message</th><th>Reply</th></tr></thead>
              <tbody>
                {myFeedbacks.length === 0 ? <tr><td colSpan={4}>No feedback</td></tr> :
                  myFeedbacks.map(f => (
                    <tr key={f._id}>
                      <td>{new Date(f.date).toLocaleDateString()}</td>
                      <td>{f.productName}</td>
                      <td>{f.message}</td>
                      <td>{f.reply || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Profile + Settings (unchanged) */}
        {tab === "profile" && (
          <div className="card">
            <form onSubmit={saveProfile}>
              <label>Name</label>
              <input className="input" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/>
              <label>Address</label>
              <input className="input" value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/>
              <button className="btn btn-primary mt-2">Save</button>
            </form>
          </div>
        )}

        {tab === "settings" && (
          <div className="card">
            <label>Theme</label>
            <select value={theme} onChange={(e)=>setTheme(e.target.value)} className="input">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
