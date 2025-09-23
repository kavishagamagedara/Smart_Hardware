// src/Components/Dashboards/CustomerCareDashboard.js
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function CustomerCareDashboard() {
  const { token } = useAuth();
  const [list, setList] = useState([]);

  useEffect(() => {
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/care/feedbacks`, { headers });
        if (r.ok) setList(await r.json());
        else setList([]);
      } catch {
        setList([]);
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <header className="card"><h2 className="text-xl font-black">Customer Care Manager</h2></header>

      <div className="card overflow-x-auto">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="text-left">
              <th>User</th><th>Product</th><th>Message</th><th>Reply</th>
            </tr>
          </thead>
        <tbody>
          {list.length === 0 ? (
            <tr><td colSpan={4} className="py-6 text-center text-slate-500">No feedback yet</td></tr>
          ) : list.map(f => (
            <tr key={f._id} className="border-t border-white/10">
              <td>{f.userEmail}</td>
              <td>{f.productName}</td>
              <td className="max-w-[280px] truncate">{f.message}</td>
              <td className="max-w-[280px] truncate">{f.reply || "-"}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
