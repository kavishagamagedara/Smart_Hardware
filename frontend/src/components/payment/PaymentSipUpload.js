import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000/api"; // your backend

export default function UserSlipUpload() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ 
    paymentId: "", 
    paymentName: "", 
    orderId: "", 
    description: "" 
  });
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [created, setCreated] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", msg: "" });

    try {
      if (!form.paymentId || !form.paymentName || !form.orderId) {
        setStatus({ type: "err", msg: "Payment ID, Payment Name, and Order ID are required" });
        return;
      }
      if (!file) {
        setStatus({ type: "err", msg: "Please choose a slip image/PDF" });
        return;
      }
      if (file && file.size > 10 * 1024 * 1024) { // 10MB limit
        setStatus({ type: "err", msg: "File size must be less than 10MB" });
        return;
      }
      // Upload
      const fd = new FormData();
      fd.append("paymentId", form.paymentId);
      fd.append("paymentName", form.paymentName);
      fd.append("orderId", form.orderId);
      if (form.description.trim()) {
        fd.append("description", form.description);
      }
      fd.append("slip", file);

      const res = await fetch(`${API_BASE}/payments/slip`, { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Upload failed (${res.status}): ${t}`);
      }

      const data = await res.json();
      setCreated(data.payment);
      setStatus({ type: "ok", msg: "Slip uploaded. Status is pending until admin review." });
      setForm({ paymentId: "", paymentName: "", orderId: "" });
      setFile(null);
    } catch (err) {
      setStatus({ type: "err", msg: err.message || "Upload failed" });
    }
  };

  /* --------------------------- Dark blue theme --------------------------- */
  const colors = {
    bg: "#0B1220",            // page background (very dark blue)
    card: "#0F1B2D",          // panel/card background
    border: "#1E2A44",        // card/input borders
    text: "#E6F0FF",          // primary text
    textDim: "#A8B3CF",       // secondary text
    inputBg: "#0F1B2D",       // input background (same as card)
    inputBorder: "#2B3B5E",   // input border
    focusRing: "rgba(59,130,246,0.45)", // blue-500-ish glow
    primary: "#2563EB",       // primary button
    primaryHover: "#1D4ED8",  // primary hover
    noteBg: "#0B1526",        // subtle note background
    noteBorder: "#233252",    // note border
    successBg: "rgba(16,185,129,0.12)", // emerald-500 @ low alpha on dark
    successBorder: "rgba(16,185,129,0.35)",
    successText: "#8EF2C0",
    errBg: "rgba(244,63,94,0.12)",      // rose-500 @ low alpha on dark
    errBorder: "rgba(244,63,94,0.4)",
    errText: "#FCA5A5",
    link: "#93C5FD",          // light blue link
    linkHover: "#BFDBFE",
  };

  const page = { padding: 16, background: colors.bg, color: colors.text, minHeight: "100vh" };

  const wrap = {
    maxWidth: 520,
    margin: "24px auto",
    background: colors.card,
    padding: 16,
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    boxShadow: "0 12px 30px rgba(2, 6, 23, 0.35)",
  };

  const label = { display: "block", margin: "10px 0 6px", fontSize: 14, color: colors.textDim, fontWeight: 700 };

  const input = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    background: colors.inputBg,
    color: colors.text,
    border: `1px solid ${colors.inputBorder}`,
    outline: "none",
    transition: "box-shadow .15s ease, border-color .15s ease",
  };

  const inputFocus = { boxShadow: `0 0 0 3px ${colors.focusRing}`, borderColor: colors.primary };

  const textarea = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    background: colors.inputBg,
    color: colors.text,
    border: `1px solid ${colors.inputBorder}`,
    outline: "none",
    transition: "box-shadow .15s ease, border-color .15s ease",
    resize: "vertical",
    minHeight: "80px",
    fontFamily: "inherit",
    fontSize: "14px",
    lineHeight: "1.5",
  };

  const textareaFocus = { boxShadow: `0 0 0 3px ${colors.focusRing}`, borderColor: colors.primary };

  const fileInput = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    background: colors.inputBg,
    color: colors.text,
    border: `1px solid ${colors.inputBorder}`,
    outline: "none",
    cursor: "pointer",
    fontSize: "14px",
  };

  const btn = {
    padding: "11px 16px",
    borderRadius: 12,
    background: colors.primary,
    color: "#fff",
    border: `1px solid ${colors.primary}`,
    cursor: "pointer",
    fontWeight: 700,
    transition: "background .15s ease, transform .05s ease",
  };

  const btnHover = { background: colors.primaryHover };
  const btnActive = { transform: "translateY(1px)" };

  const note = {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 12,
    background: colors.noteBg,
    border: `1px solid ${colors.noteBorder}`,
    color: colors.textDim,
  };

  const [focusKey, setFocusKey] = useState("");

  return (
    <div style={page}>
      <div style={wrap}>
        <div style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: "none",
              border: "2px solid #667eea",
              color: "#667eea",
              borderRadius: "8px",
              padding: "8px 16px",
              marginRight: "20px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            ← Back to Payment Options
          </button>
        </div>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>User · Upload Bank Slip</h2>
        
        <div style={{
          ...note,
          marginBottom: "20px",
          background: "#1E3A8A15",
          border: "1px solid #3B82F650",
          color: colors.text
        }}>
          <div style={{ fontWeight: 600, marginBottom: "8px", color: "#60A5FA" }}>
            📋 Instructions:
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6" }}>
            <li>Fill in all required payment details</li>
            <li>Add payment description for reference (optional)</li>
            <li>Upload a clear image or PDF of your payment slip</li>
            <li>Supported formats: JPG, PNG, PDF (Max 10MB)</li>
          </ul>
        </div>
        
        <form onSubmit={onSubmit}>
          <label style={label}>Payment ID</label>
          <input
            style={{ ...input, ...(focusKey === "paymentId" ? inputFocus : {}) }}
            value={form.paymentId}
            onChange={(e) => setForm((f) => ({ ...f, paymentId: e.target.value }))}
            onFocus={() => setFocusKey("paymentId")}
            onBlur={() => setFocusKey("")}
            required
          />

          <label style={label}>Payment Name</label>
          <input
            style={{ ...input, ...(focusKey === "paymentName" ? inputFocus : {}) }}
            value={form.paymentName}
            onChange={(e) => setForm((f) => ({ ...f, paymentName: e.target.value }))}
            onFocus={() => setFocusKey("paymentName")}
            onBlur={() => setFocusKey("")}
            required
          />

          <label style={label}>Order ID</label>
          <input
            style={{ ...input, ...(focusKey === "orderId" ? inputFocus : {}) }}
            value={form.orderId}
            onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
            onFocus={() => setFocusKey("orderId")}
            onBlur={() => setFocusKey("")}
            required
          />

          <label style={label}>Payment Description (Optional)</label>
          <textarea
            style={{ 
              ...textarea, 
              ...(focusKey === "description" ? textareaFocus : {}) 
            }}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            onFocus={() => setFocusKey("description")}
            onBlur={() => setFocusKey("")}
            placeholder="Enter payment details, bank transfer reference, or any additional notes..."
            rows={4}
          />

          <label style={label}>Slip (image or PDF)</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={fileInput}
          />
          {file && (
            <div style={{
              marginTop: "8px",
              padding: "8px 12px",
              background: colors.successBg,
              border: `1px solid ${colors.successBorder}`,
              borderRadius: "8px",
              color: colors.successText,
              fontSize: "12px"
            }}>
              ✅ Selected: {file.name}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <button
              type="submit"
              style={btn}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, btnHover)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: colors.primary })}
              onMouseDown={(e) => Object.assign(e.currentTarget.style, btnActive)}
              onMouseUp={(e) => Object.assign(e.currentTarget.style, { transform: "none" })}
            >
              Upload Slip
            </button>
          </div>
        </form>

        {status.msg && (
          <div
            style={{
              ...note,
              color: status.type === "err" ? colors.errText : colors.successText,
              background: status.type === "err" ? colors.errBg : colors.successBg,
              borderColor: status.type === "err" ? colors.errBorder : colors.successBorder,
            }}
          >
            {status.msg}
          </div>
        )}

        {created && (
          <div style={note}>
            <div>
              <b style={{ color: colors.text }}>Created:</b>{" "}
              <span style={{ color: colors.text }}>{created.paymentName}</span>{" "}
              <span style={{ color: colors.textDim }}>({created.paymentId})</span>
            </div>
            {created.slipUrl ? (
              <div style={{ marginTop: 8 }}>
                <a
                  href={created.slipUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: colors.link, textDecoration: "underline" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = colors.linkHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = colors.link)}
                >
                  View uploaded slip
                </a>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
