// src/Components/Order/Customer/Checkout.js
import React, { useContext, useState, useMemo } from "react";
import { CartContext } from "../../Order/Customer/CartContext";
import { useLocation, useNavigate } from "react-router-dom";
import "./CheckOut.css";
import { loadStripe } from "@stripe/stripe-js";
import { formatLKR } from "../../../utils/currency";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function Checkout() {
  const { removeFromCart, clearServerCart } = useContext(CartContext) || {};
  const location = useLocation();
  const navigate = useNavigate();
  const selectedItems = location.state?.selectedItems || [];

  const [contact, setContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Pay Online");
  const [errors, setErrors] = useState({});

  const subtotal = selectedItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const validate = () => {
    const e = {};
    if (!contact || !/^\d{10}$/.test(contact.trim())) {
      e.contact = "Enter a valid contact number (10 digits)";
    }

    if (!selectedItems || selectedItems.length === 0) {
      e.items = "No items selected for checkout";
    } else {
      for (const it of selectedItems) {
        const q = Number(it.quantity);
        if (!Number.isInteger(q) || q <= 0) {
          e.items = `Invalid quantity for ${it.name}`;
          break;
        }
        if (Number(it.price) < 0) {
          e.items = `Invalid price for ${it.name}`;
          break;
        }
      }
    }

    if (!paymentMethod) e.paymentMethod = "Select a payment method";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validate()) return;

      const items = selectedItems.map((item) => ({
        productId: item.productId || item._id, // always pass real productId
        productName: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price),
      }));

    const orderData = { contact, paymentMethod, items };

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must login first");
        navigate("/login");
        return;
      }

      console.log("📦 Sending orderData:", orderData);

      // If paying online, do NOT create the order yet. Instead create a pendingOrder payload
      if (paymentMethod === "Pay Online") {
        console.log("💳 Initializing online payment with pending order...");

        const pendingOrder = {
          contact,
          paymentMethod,
          items,
          totalAmount: subtotal,
        };

        const paymentRes = await fetch(
          "http://localhost:5000/api/payments/stripe/create-checkout-session",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              amount: Math.round(subtotal * 100),
              currency: "lkr",
              // Do not pass orderId. Provide pendingOrder in metadata so backend can create it after successful payment
              pendingOrder,
            }),
          }
        );

        const paymentJson = await paymentRes.json();
        console.log("✅ Payment API response:", paymentJson);

        const { id, clientSecret, error } = paymentJson;
        // createCheckoutSession returns { id } for Checkout Sessions
        const sessionId = paymentJson.id || paymentJson.sessionId || paymentJson.clientSecret || null;
        if (!sessionId) {
          alert("Failed to initialize Stripe Checkout: " + (error || "Unknown error"));
          return;
        }

        // Save pending order locally so user can return to it if they navigate away
        try {
          localStorage.setItem("pendingOrder", JSON.stringify(pendingOrder));
        } catch (e) {
          console.warn("Failed to persist pendingOrder locally", e);
        }

        const stripe = await stripePromise;
        // If response returned an id for redirectToCheckout
        if (paymentJson.id) {
          await stripe.redirectToCheckout({ sessionId: paymentJson.id });
        } else if (paymentJson.checkoutUrl) {
          window.location.href = paymentJson.checkoutUrl;
        } else {
          alert("Failed to initialize Stripe Checkout: unknown response from server");
        }
      } else {
        // Pay Later or Cash: create order immediately
        const orderRes = await fetch("http://localhost:5000/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(orderData),
        });

        const orderResult = await orderRes.json();
        if (!orderRes.ok) {
          alert(orderResult.message || "Failed to place order");
          return;
        }

        alert("Order placed successfully!");
        selectedItems.forEach((item) => removeFromCart(item.productId));
        // clear server-side cart for logged-in users
        try {
          if (clearServerCart) await clearServerCart();
        } catch (err) {
          console.warn('Failed to clear server cart after order', err);
        }
        navigate("/dashboard?tab=orders");
      }
    } catch (err) {
      console.error("❌ Error placing order:", err);
      alert("Something went wrong. Try again.");
    }
  };

  return (
    <div className="checkout-page">
      <h2>Checkout</h2>

      <div>
        <label>Contact:</label>
        <input
          type="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value.replace(/[^0-9]/g, '').slice(0,10))}
          placeholder="Enter your contact number"
          maxLength={10}
          inputMode="numeric"
          pattern="\d{10}"
        />
        {errors.contact && <div className="field-error">{errors.contact}</div>}
      </div>

      <div>
        <label>Payment Method:</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="Pay Online">Pay Online</option>
          <option value="Pay Later">Pay Later</option>
        </select>
      </div>

      <h3>Order Summary</h3>
      {selectedItems.map((item) => (
        <p key={item.productId}>
          {item.name} x {item.quantity} = {formatLKR(item.price * item.quantity)}
        </p>
      ))}

      {errors.items && <div className="field-error">{errors.items}</div>}

  <h4>Subtotal: {formatLKR(subtotal)}</h4>

      <button onClick={handlePlaceOrder}>Place Order</button>
    </div>
  );
}

export default Checkout;
