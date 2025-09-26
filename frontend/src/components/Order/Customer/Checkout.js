// src/Components/Order/Customer/Checkout.js
import React, { useContext, useState } from "react";
import { CartContext } from "../../Order/Customer/CartContext";
import { useLocation, useNavigate } from "react-router-dom";
import "./CheckOut.css";

// ✅ Stripe import
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function Checkout() {
  const { removeFromCart } = useContext(CartContext);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedItems = location.state?.selectedItems || [];
  const [contact, setContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Pay Online");

  const subtotal = selectedItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    if (!contact || !/^\d+$/.test(contact)) {
      alert("Please enter a valid contact number");
      return;
    }

    if (selectedItems.length === 0) {
      alert("No items selected for checkout");
      return;
    }

    const items = selectedItems.map((item) => ({
      productId: item._id || item.id,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const orderData = {
      contact,
      paymentMethod,
      items,
      totalAmount: subtotal,
    };

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must login first");
        navigate("/login");
        return;
      }

      // 1️⃣ Create the order (must hit /api/orders/orders)
      console.log("📦 Sending orderData:", orderData);
      const orderRes = await fetch("http://localhost:5000/api/orders/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      const orderResult = await orderRes.json();
      console.log("✅ Order API response:", orderResult);

      if (!orderRes.ok) {
        alert(orderResult.message || "Failed to place order");
        return;
      }

      // 2️⃣ If Pay Online, create Stripe Checkout Session
      if (paymentMethod === "Pay Online") {
        console.log("💳 Creating Stripe Checkout Session...");
        const paymentRes = await fetch(
          "http://localhost:5000/api/payments/stripe/create-checkout-session",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              amount: Math.round(subtotal * 100), // cents
              currency: "usd",
              orderId: orderResult.order._id, // ✅ use order from backend
            }),
          }
        );

        const paymentJson = await paymentRes.json();
        console.log("✅ Payment API response:", paymentJson);

        const { id, error } = paymentJson;
        if (!id) {
          alert(
            "Failed to initialize Stripe Checkout: " +
              (error || "Unknown error")
          );
          return;
        }

        const stripe = await stripePromise;
        await stripe.redirectToCheckout({ sessionId: id });
      } else {
        // Pay Later flow
        alert("Order placed successfully!");
        selectedItems.forEach((item) =>
          removeFromCart(item._id || item.id)
        );
        navigate("/CustomerDashboard");
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
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Enter your contact number"
        />
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
        <p key={item._id || item.id}>
          {item.name} x {item.quantity} = $
          {(item.price * item.quantity).toFixed(2)}
        </p>
      ))}

      <h4>Subtotal: ${subtotal.toFixed(2)}</h4>

      <button onClick={handlePlaceOrder}>Place Order</button>
    </div>
  );
}

export default Checkout;
