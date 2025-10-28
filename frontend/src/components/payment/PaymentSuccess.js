// src/Components/Payment/PaymentSuccess.js
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../Order/Customer/CartContext";

export default function PaymentSuccess() {
  const [msg, setMsg] = useState("Recording your payment…");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { removeMultipleFromCart, clearServerCart } = useContext(CartContext) || {};

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
          let pendingProductIds = [];
          try {
            const pendingRaw = localStorage.getItem("pendingOrder");
            if (pendingRaw) {
              const parsed = JSON.parse(pendingRaw);
              if (Array.isArray(parsed?.items)) {
                pendingProductIds = parsed.items
                  .map((item) => item?.productId || item?._id)
                  .filter(Boolean);
              }
            }
          } catch (e) {
            console.warn("Failed to read pending order for cart cleanup", e);
          }
          try { localStorage.removeItem('pendingOrder'); } catch(e) {}
          try {
            if (typeof removeMultipleFromCart === "function" && pendingProductIds.length) {
              const uniqueProductIds = Array.from(new Set(pendingProductIds));
              removeMultipleFromCart(uniqueProductIds);
            }
          } catch (e) {
            console.warn("Failed to remove paid items from cart", e);
          }
          try {
            if (typeof clearServerCart === "function") {
              await clearServerCart();
            }
          } catch (e) {
            console.warn("Failed to clear server cart after payment", e);
          }
          setMsg("✅ Payment saved! Redirecting to your dashboard…");
          setTimeout(() => navigate("/dashboard?tab=orders"), 2000);
        }
      } catch (err) {
        console.error("Payment success error:", err);
        setMsg("❌ Failed to save payment due to an error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, removeMultipleFromCart, clearServerCart]);

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", textAlign: "center" }}>
      <h1>Payment Successful</h1>
      <p>{msg}</p>
      {!loading && (
        <a href="/dashboard?tab=orders" style={{ textDecoration: "underline" }}>
          Go to Dashboard
        </a>
      )}
    </div>
  );
}
