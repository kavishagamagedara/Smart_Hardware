import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function FinanceDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ totalReceived: 0, recent: [] });

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <header className="card"><h2 className="text-xl font-black">Finance Manager</h2></header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="text-slate-500">Total received</div>
          <div className="text-3xl font-black">
            ${stats.totalReceived?.toFixed?.(2) ?? stats.totalReceived}
          </div>
        </div>

        <div className="card">
          <div className="text-slate-500">Recent payments</div>
          <ul className="mt-2 space-y-1 text-sm">
            {(stats.recent || []).map(p => (
              <li key={p._id} className="flex justify-between border-b border-white/10 py-1">
                <span>{p.method}</span><span>${p.amount}</span>
              </li>
            ))}
            {(!stats.recent || stats.recent.length === 0) && (
              <li className="py-2 text-slate-500">No data yet</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
