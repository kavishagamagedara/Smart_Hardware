

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TABS = [
  { key: "all", label: "All Payments" },
  { key: "online", label: "Online Payments" },
  { key: "bank", label: "Bank Transfers" },
  { key: "unsuccessful", label: "Unsuccessful Payments" },
  { key: "notifications", label: "Notifications" },
  { key: "recycle", label: "Recycle Bin" },
];

export default function FinanceDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ totalReceived: 0, recent: [] });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all");
  const [deletedPayments, setDeletedPayments] = useState([]); // Placeholder for recycle bin
  const [notifications, setNotifications] = useState([]); // Placeholder for notifications

  useEffect(() => {
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/finance/dashboard`, { headers });
        if (r.ok) setStats(await r.json());
        else setStats({ totalReceived: 0, recent: [] });
      } catch {
        setStats({ totalReceived: 0, recent: [] });
      }
    })();
  }, [token]);

  useEffect(() => {
    setLoading(true);
    setErr("");
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    fetch(`${API}/api/payments`, { headers })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => setPayments(data.payments || []))
      .catch(() => setErr("Failed to load payments"))
      .finally(() => setLoading(false));
  }, [token]);

  // Filtered payment lists
  const onlinePayments = payments.filter(p => p.method === "stripe");
  const bankPayments = payments.filter(p => p.method === "slip");
  const unsuccessfulPayments = payments.filter(p => ["failed", "canceled"].includes((p.paymentStatus || p.status || "").toLowerCase()));

  // Placeholder: notifications and recycle bin (deleted payments)
  // In a real app, fetch notifications and deleted payments from backend

  function renderPaymentsTable(list) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-500">No payments found</td></tr>
            ) : list.map((p) => (
              <tr key={p._id}>
                <td>{new Date(p.createdAt).toLocaleString()}</td>
                <td>{p.method}</td>
                <td>${p.amount}</td>
                <td>{p.paymentStatus || p.status}</td>
                <td>{p.reference || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, height: '100%'}} className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <header className="card"><h2 className="text-xl font-black">Finance Manager</h2></header>

      {/* Tabs */}
      <div className="card mt-6" style={{flexGrow: 1, minHeight: 0}}>
        <div className="flex gap-2 mb-4">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`btn px-4 py-2 rounded-xl ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "all" && (
          loading ? <div>Loading payments…</div> : err ? <div className="text-red-600">{err}</div> : renderPaymentsTable(payments)
        )}
        {tab === "online" && (
          loading ? <div>Loading payments…</div> : err ? <div className="text-red-600">{err}</div> : renderPaymentsTable(onlinePayments)
        )}
        {tab === "bank" && (
          loading ? <div>Loading payments…</div> : err ? <div className="text-red-600">{err}</div> : renderPaymentsTable(bankPayments)
        )}
        {tab === "unsuccessful" && (
          loading ? <div>Loading payments…</div> : err ? <div className="text-red-600">{err}</div> : renderPaymentsTable(unsuccessfulPayments)
        )}
        {tab === "notifications" && (
          <div>
            <h4 className="text-lg font-bold mb-2">Notifications</h4>
            <div className="text-slate-500">(Notifications feature placeholder. Integrate with backend for real data.)</div>
            <ul className="mt-2 space-y-1 text-sm">
              {notifications.length === 0 ? (
                <li className="py-2 text-slate-500">No notifications</li>
              ) : notifications.map((n, i) => (
                <li key={i}>{n.message}</li>
              ))}
            </ul>
          </div>
        )}
        {tab === "recycle" && (
          <div>
            <h4 className="text-lg font-bold mb-2">Recycle Bin</h4>
            <div className="text-slate-500">(Deleted payment records placeholder. Integrate with backend for real data.)</div>
            <ul className="mt-2 space-y-1 text-sm">
              {deletedPayments.length === 0 ? (
                <li className="py-2 text-slate-500">No deleted payments</li>
              ) : deletedPayments.map((p, i) => (
                <li key={i}>{p.paymentName || p._id}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
