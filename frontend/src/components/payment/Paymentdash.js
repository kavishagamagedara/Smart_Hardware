// AdminDashboard.js 
import React, { useEffect, useMemo, useState } from "react";

/* ------------------------------ API utilities ------------------------------ */
const BASE =
  process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/+$/, "")
    : ""; // empty means use CRA proxy (package.json "proxy")

const api = async (path, { method = "GET", body, headers } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.message || j?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.status !== 204 ? res.json() : null;
};

// Map UI statuses <-> backend statuses
const uiToApiStatus = (ui) => {
  switch (String(ui).toLowerCase()) {
    case "approved":
      return "paid";
    case "rejected":
      return "failed";
    case "pending":
    default:
      return "pending";
  }
};
const apiToUiStatus = (api) => {
  switch (String(api).toLowerCase()) {
    case "paid":
      return "approved";
    case "failed":
      return "rejected";
    case "requires_action":
      return "pending";
    case "canceled":
      return "rejected";
    default:
      return "pending";
  }
};

// REST calls
const listPayments = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.method) qs.set("method", params.method);
  if (params.status) qs.set("status", params.status);
  if (params.orderId) qs.set("orderId", params.orderId);
  const qstr = qs.toString() ? `?${qs}` : "";
  const { payments } = await api(`/payments${qstr}`);
  return payments;
};

const createPayment = async ({ paymentId, paymentName, orderId, paymentStatus }) => {
  const body = {
    paymentId,
    paymentName,
    orderId,
    paymentStatus: uiToApiStatus(paymentStatus),
    method: "slip",
  };
  const { payment } = await api(`/payments`, { method: "POST", body });
  return payment;
};

const updatePaymentStatus = async (id, newUiStatus) => {
  const body = { paymentStatus: uiToApiStatus(newUiStatus) };
  const { payment } = await api(`/payments/${id}`, { method: "PUT", body });
  return payment;
};

const deletePayment = async (id) => {
  await api(`/payments/${id}`, { method: "DELETE" });
};

/* -------------------------- Tailwind-inspired styles ------------------------ */
/** Palette approximations from Tailwind v3 */
const COLORS = {
  // slates
  slate950: "#020617",
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  white: "#ffffff",
  black: "#000000",
  // blue brand
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  // emerald
  emerald100: "#d1fae5",
  emerald800: "#065f46",
  emerald900_40: "rgba(6,95,70,0.4)",
  emerald200: "#a7f3d0",
  emerald600: "#059669",
  // amber
  amber100: "#fef3c7",
  amber800: "#92400e",
  amber900_40: "rgba(120,53,15,0.4)",
  // rose
  rose50: "#fff1f2",
  rose200: "#fecaca",
  rose300: "#fecdd3",
  rose600: "#e11d48",
  rose800: "#9f1239",
};

const baseShadow = "0 10px 25px rgba(2,6,23,0.08)";

/** App-level */
const page = { minHeight: "100vh", background: COLORS.white, padding: 16, color: COLORS.slate900 };

/** Card (matches .card) */
const card = {
  background: COLORS.white,
  border: `1px solid ${COLORS.slate200}`,
  borderRadius: 16,
  boxShadow: baseShadow,
};

/** Buttons (.btn, .btn-primary, .btn-ghost) */
const btn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  borderRadius: 12,
  transition: "all 150ms ease",
  padding: "10px 14px",
  border: `1px solid ${COLORS.slate200}`,
  background: COLORS.white,
  color: COLORS.slate900,
  cursor: "pointer",
};

const btnPrimary = {
  ...btn,
  background: COLORS.blue600,
  color: COLORS.white,
  border: `1px solid ${COLORS.blue600}`,
};
const btnGhost = {
  ...btn,
  background: COLORS.slate100,
  color: COLORS.slate900,
};

/** Inputs (.input, .label) */
const input = {
  width: "100%",
  borderRadius: 12,
  border: `1px solid ${COLORS.slate200}`,
  background: COLORS.white,
  padding: "10px 12px",
  outline: "none",
  boxShadow: "0 0 0 0 rgba(37,99,235,0)",
};
const inputFocus = (focused) =>
  focused
    ? {
        boxShadow: "0 0 0 3px rgba(37,99,235,0.35)",
        borderColor: COLORS.blue600,
      }
    : {};

const label = { display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6 };

/** Badges (.badge + variants) */
const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
};
const badgeGreen = { ...badgeBase, background: COLORS.emerald100, color: COLORS.emerald800 };
const badgeAmber = { ...badgeBase, background: COLORS.amber100, color: COLORS.amber800 };
const badgeGray = { ...badgeBase, background: COLORS.slate200, color: COLORS.slate800 };

const alert = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: COLORS.rose50,
  border: `1px solid ${COLORS.rose200}`,
  color: COLORS.rose800,
};

/** Tiny helpers */
const brand600Bg = { background: COLORS.blue600 };
const brand700Bg = { background: COLORS.blue700 };
const brandText600 = { color: COLORS.blue600 };
const ringBrand500 = { boxShadow: "0 0 0 3px rgba(59,130,246,0.5)" }; // blue-500 ring

const tableTh = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: `1px solid ${COLORS.slate100}`,
  background: COLORS.slate100,
  fontSize: 14,
};
const tableTd = { padding: "12px 14px", borderBottom: `1px solid ${COLORS.slate100}`, verticalAlign: "middle" };

const iconBtn = { ...btn, padding: "8px 10px" };

const statusBadgeStyle = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return badgeGreen;
  if (s === "rejected") return badgeGray; // or a red variant; keeping gray per your palette
  return badgeAmber; // pending
};

/* --------------------------------- Component -------------------------------- */
export default function AdminDashboard() {
  // data + fetch lifecycle
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ui state (search, filters, modals)
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workingId, setWorkingId] = useState(null);
  const [showSlip, setShowSlip] = useState(null); // {url, mime}
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    paymentId: "",
    paymentName: "",
    orderId: "",
    paymentStatus: "pending",
  });
  const [error, setError] = useState("");
  const [focusField, setFocusField] = useState(""); // for input focus ring

  const fetchAll = async () => {
    try {
      setErr("");
      setLoading(true);
      const items = await listPayments();
      const adapted = items.map((p) => ({
        ...p,
        paymentStatus: apiToUiStatus(p.paymentStatus),
        // Fix slipUrl to work with proxy - remove localhost:5000 if present
        slipUrl: p.slipUrl ? p.slipUrl.replace('http://localhost:5000', '') : p.slipUrl
      }));
      setPayments(adapted);
    } catch (e) {
      setErr(e?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------- UI handlers (local) -------------------------- */
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      setWorkingId(id);
      await updatePaymentStatus(id, newStatus);
      // optimistic update
      setPayments((prev) =>
        prev.map((r) => (r._id === id ? { ...r, paymentStatus: newStatus } : r))
      );
      // optional: re-sync
      await fetchAll();
    } catch (e) {
      setError(e?.message || "Update failed");
    } finally {
      setWorkingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this payment? This cannot be undone.")) return;
    try {
      setWorkingId(id);
      await deletePayment(id);
      setPayments((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      setError(e?.message || "Delete failed");
    } finally {
      setWorkingId(null);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setError("");
    const { paymentId, paymentName, orderId, paymentStatus } = form;
    if (!paymentId || !paymentName || !orderId || !paymentStatus) {
      setError("All fields are required");
      return;
    }
    try {
      await createPayment({ paymentId, paymentName, orderId, paymentStatus });
      setShowCreate(false);
      setForm({
        paymentId: "",
        paymentName: "",
        orderId: "",
        paymentStatus: "pending",
      });
      await fetchAll();
    } catch (e) {
      setError(e?.message || "Create failed");
    }
  };

  /* ------------------------------ Derived rows ------------------------------ */
  const filtered = useMemo(() => {
    let data = payments;
    if (statusFilter !== "all")
      data = data.filter(
        (p) => (p.paymentStatus || "").toLowerCase() === statusFilter
      );
    if (q.trim()) {
      const needle = q.toLowerCase();
      data = data.filter((p) =>
        [p.paymentId, p.paymentName, p.orderId]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle))
      );
    }
    return data;
  }, [payments, q, statusFilter]);

  /* ---------------------------------- UI ----------------------------------- */
  return (
    <div style={page}>
      {/* Header bar */}
      <div style={{ ...card, padding: 14, margin: "16px auto", maxWidth: 1100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Admin · Payments</h2>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setShowCreate(true)} style={btnPrimary}>
              New Payment
            </button>
            <button onClick={fetchAll} style={btnGhost}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Controls + table */}
      <div style={{ ...card, margin: "16px auto", maxWidth: 1100, padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Search by Payment ID, Name, or Order ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocusField("search")}
            onBlur={() => setFocusField("")}
            style={{
              ...input,
              ...(focusField === "search" ? inputFocus(true) : {}),
              flex: 1,
              minWidth: 260,
            }}
          />
          {["all", "pending", "approved", "rejected"].map((k) => {
            const active = statusFilter === k;
            return (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                style={active ? { ...btnPrimary } : { ...btnGhost }}
                aria-pressed={active}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            );
          })}
        </div>

        {(error || err) && <div style={alert}>{error || err}</div>}
        {loading && <div style={{ marginTop: 10 }}>Loading…</div>}

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={tableTh}>Payment ID</th>
                <th style={tableTh}>Name</th>
                <th style={tableTh}>Order ID</th>
                <th style={tableTh}>Slip</th>
                <th style={tableTh}>Status</th>
                <th style={tableTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td style={{ ...tableTd, textAlign: "center" }} colSpan={6}>
                    No payments found
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td style={tableTd}>
                    <code style={{ ...brandText600 }}>{p.paymentId || "-"}</code>
                  </td>
                  <td style={tableTd}>{p.paymentName || "-"}</td>
                  <td style={tableTd}>{p.orderId || "-"}</td>
                  <td style={tableTd}>
                    {p.slipUrl ? (
                      <button
                        onClick={() => {
                          console.log("Viewing slip:", { url: p.slipUrl, mime: p.slipMimeType });
                          setShowSlip({ url: p.slipUrl, mime: p.slipMimeType || "" });
                        }}
                        style={btnPrimary}
                      >
                        View
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={tableTd}>
                    <span style={statusBadgeStyle((p.paymentStatus || "pending").toLowerCase())}>
                      {(p.paymentStatus || "pending").toLowerCase()}
                    </span>
                  </td>
                  <td style={tableTd}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        disabled={workingId === p._id}
                        onClick={() => handleUpdateStatus(p._id, "approved")}
                        style={{ ...btn, background: COLORS.emerald600, color: COLORS.white, border: `1px solid ${COLORS.emerald600}` }}
                      >
                        Approve
                      </button>
                      <button
                        disabled={workingId === p._id}
                        onClick={() => handleUpdateStatus(p._id, "rejected")}
                        style={{ ...btn, background: COLORS.rose600, color: COLORS.white, border: `1px solid ${COLORS.rose600}` }}
                      >
                        Reject
                      </button>
                      <button
                        disabled={workingId === p._id}
                        onClick={() => handleUpdateStatus(p._id, "pending")}
                        style={btnGhost}
                      >
                        Pending
                      </button>
                      <button
                        disabled={workingId === p._id}
                        onClick={() => handleDelete(p._id)}
                        style={{ ...iconBtn, background: COLORS.rose50, color: COLORS.rose800, border: `1px solid ${COLORS.rose300}` }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip modal */}
      {showSlip && (
        <div
          onClick={() => setShowSlip(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 30,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "95%",
              maxWidth: 900,
              height: "85vh",
              background: COLORS.white,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: baseShadow,
              border: `1px solid ${COLORS.slate200}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderBottom: `1px solid ${COLORS.slate200}`,
                background: COLORS.slate100,
              }}
            >
              <b>Slip Preview</b>
              <button onClick={() => setShowSlip(null)} style={btnGhost}>
                Close
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", background: COLORS.black, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {showSlip.mime?.includes("pdf") ? (
                <iframe
                  title="slip"
                  src={showSlip.url}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  onError={(e) => {
                    console.error("Failed to load PDF:", showSlip.url, e);
                  }}
                />
              ) : (
                <img
                  alt="slip"
                  src={showSlip.url}
                  style={{
                    maxWidth: "90%",
                    maxHeight: "90%",
                    objectFit: "contain",
                    display: "block",
                  }}
                  onError={(e) => {
                    console.error("Failed to load image:", showSlip.url, e);
                    e.target.style.display = "none";
                    e.target.parentNode.innerHTML = `
                      <div style="color: white; text-align: center; padding: 20px;">
                        <p>Failed to load image</p>
                        <p style="font-size: 12px; opacity: 0.7;">${showSlip.url}</p>
                        <a href="${showSlip.url}" target="_blank" style="color: #60a5fa; text-decoration: underline;">
                          Open in new tab
                        </a>
                      </div>
                    `;
                  }}
                  onLoad={() => {
                    console.log("Image loaded successfully:", showSlip.url);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 30,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "95%",
              maxWidth: 560,
              background: COLORS.white,
              borderRadius: 16,
              overflow: "hidden",
              border: `1px solid ${COLORS.slate200}`,
              boxShadow: baseShadow,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderBottom: `1px solid ${COLORS.slate200}`,
                background: COLORS.slate100,
              }}
            >
              <b>New Payment</b>
              <button onClick={() => setShowCreate(false)} style={btnGhost}>
                Close
              </button>
            </div>
            <form onSubmit={submitCreate} style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Payment ID</label>
                <input
                  value={form.paymentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentId: e.target.value }))
                  }
                  onFocus={() => setFocusField("paymentId")}
                  onBlur={() => setFocusField("")}
                  style={{ ...input, ...(focusField === "paymentId" ? inputFocus(true) : {}) }}
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={label}>Payment Name</label>
                  <input
                    value={form.paymentName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paymentName: e.target.value }))
                    }
                    onFocus={() => setFocusField("paymentName")}
                    onBlur={() => setFocusField("")}
                    style={{ ...input, ...(focusField === "paymentName" ? inputFocus(true) : {}) }}
                    required
                  />
                </div>
                <div>
                  <label style={label}>Order ID</label>
                  <input
                    value={form.orderId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, orderId: e.target.value }))
                    }
                    onFocus={() => setFocusField("orderId")}
                    onBlur={() => setFocusField("")}
                    style={{ ...input, ...(focusField === "orderId" ? inputFocus(true) : {}) }}
                    required
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={label}>Status</label>
                <select
                  value={form.paymentStatus}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentStatus: e.target.value }))
                  }
                  onFocus={() => setFocusField("status")}
                  onBlur={() => setFocusField("")}
                  style={{ ...input, ...(focusField === "status" ? inputFocus(true) : {}) }}
                >
                  {["pending", "approved", "rejected"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={btnGhost}
                >
                  Cancel
                </button>
                <button type="submit" style={btnPrimary}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
