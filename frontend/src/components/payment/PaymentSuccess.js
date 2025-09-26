// src/Components/Payment/PaymentSuccess.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PaymentSuccess() {
  const [msg, setMsg] = useState("Recording your payment…");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        if (!sessionId) {
          setMsg("❌ Missing session_id in URL.");
          setLoading(false);
          return;
        }

        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/api/payments/stripe/record-session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ sessionId }),
});


        const data = await res.json();
        if (!res.ok) {
          setMsg("❌ " + (data?.message || data?.error || "Failed to save payment."));
        } else {
          setMsg("✅ Payment saved! Redirecting to your dashboard…");
          setTimeout(() => navigate("/CustomerDashboard"), 3000);
        }
      } catch (err) {
        console.error("Payment success error:", err);
        setMsg("❌ Failed to save payment due to an error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", textAlign: "center" }}>
      <h1>Payment Successful</h1>
      <p>{msg}</p>
      {!loading && (
        <a href="/CustomerDashboard" style={{ textDecoration: "underline" }}>
          Go to Dashboard
        </a>
      )}
    </div>
  );
}
