import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function InventoryDashboard() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const headers = { Authorization: token ? `Bearer ${token}` : undefined };
    (async () => {
      try {
        const r = await fetch(`${API}/inventory/items`, { headers });
        if (r.ok) setItems(await r.json());
        else setItems([]);
      } catch {
        setItems([]);
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <header className="card"><h2 className="text-xl font-black">Inventory Manager</h2></header>

      <div className="card overflow-x-auto">
        <table className="min-w-[720px] w-full">
          <thead><tr className="text-left"><th>SKU</th><th>Name</th><th>On hand</th><th>Unit</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-slate-500">No items</td></tr>
            ) : items.map(it => (
              <tr key={it._id} className="border-t border-white/10">
                <td>{it.sku}</td><td>{it.name}</td><td>{it.onHand}</td><td>{it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
