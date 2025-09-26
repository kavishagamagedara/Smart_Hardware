/*import React, { useEffect, useState } from "react";

export default function StripePaymentsTable() {
  const [rows, setRows] = useState([]);

  // Prefer CRA env, fallback to proxy-friendly relative path
  const API = process.env.REACT_APP_API_URL; // e.g., http://localhost:5000
  const base = API ?? ""; // if empty, we'll call relative /api/... (CRA proxy)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/api/payments?method=stripe`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.payments || []);
      } catch (err) {
        console.error("Failed to load payments:", err);
      }
    })();
  }, [base]);

  return (
    <div
      style={{
        padding: 24,
        minHeight: "100vh",
        background: "#0b1220",
        color: "#e2e8f0",
      }}
    >
      <h2 style={{ margin: 0, marginBottom: 12, fontWeight: 800 }}>
        Online Payments (Stripe)
      </h2>

      <table
        width="100%"
        cellPadding="12"
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          background: "rgba(15,23,42,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        }}
      >
        <thead>
          <tr
            style={{
              background: "rgba(148,163,184,0.08)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Created
            </th>
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Order
            </th>
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Customer
            </th>
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Amount
            </th>
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Status
            </th>
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Card
            </th>
            <th style={{ textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>
              Receipt
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r._id}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: i % 2 ? "transparent" : "rgba(148,163,184,0.04)",
              }}
            >
              <td style={{ color: "#e2e8f0" }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
              </td>
              <td style={{ color: "#e2e8f0" }}>{r.orderId}</td>
              <td style={{ color: "#cbd5e1" }}>{r.customerEmail || "-"}</td>
              <td style={{ color: "#93c5fd", fontWeight: 600 }}>
                {r.amount != null ? (r.amount / 100).toFixed(2) : "-"}{" "}
                {r.currency?.toUpperCase() || ""}
              </td>
              <td style={{ color: "#e2e8f0" }}>{r.paymentStatus}</td>
              <td style={{ color: "#e2e8f0" }}>
                {r.cardBrand ? `${r.cardBrand} •••• ${r.cardLast4}` : "-"}
              </td>
              <td>
                {r.receiptUrl ? (
                  <a
                    href={r.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#93c5fd" }}
                  >
                    View
                  </a>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}*/
