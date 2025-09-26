import React, { useState } from "react";
import "./AdminCheckout.css";
import { useNavigate, useLocation } from "react-router-dom";

function AdminCheckout() {
  const navigate = useNavigate();
  const location = useLocation();

  const itemsFromCart = location.state?.items || [];
  const subtotalFromCart = location.state?.total || 0;

  const [contact, setContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash Payment");
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    if (!contact) {
      alert("Please enter a contact number.");
      return;
    }

    if (itemsFromCart.length === 0) {
      alert("No items in the cart to place order!");
      return;
    }

    setLoading(true);

    const orderItems = itemsFromCart.map(item => ({
      productId: item.id, // backend expects productId
      quantity: item.quantity,
      price: item.price,
    }));

    const orderData = {
      items: orderItems,
      totalAmount: subtotalFromCart,
      paymentMethod,
      contact,
      status: "Pending",
    };

    try {
      const token = localStorage.getItem("token"); // ✅ Include admin token
      const response = await fetch("http://localhost:5000/api/orders/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (response.ok) {
        alert("Order placed successfully!");
        navigate("/AdminDashboard"); // redirect admin after order
      } else {
        alert(result.message || "Failed to place order.");
      }
    } catch (err) {
      console.error("Error placing order:", err);
      alert("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <h2>Admin Checkout</h2>

      <div className="checkout-form">
        <label>Contact Number:</label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Enter customer contact"
        />

        <label>Payment Method:</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="Cash Payment">Cash Payment</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
      </div>

      <div className="checkout-summary">
        <h3>Order Summary</h3>
        {itemsFromCart.map((item, index) => (
          <p key={index}>
            {item.name} × {item.quantity} = Rs.{" "}
            {(item.price * item.quantity).toFixed(2)}
          </p>
        ))}
        <h4>Total: Rs. {subtotalFromCart.toFixed(2)}</h4>
      </div>

      <button
        className="place-order-btn"
        onClick={handlePlaceOrder}
        disabled={loading}
      >
        {loading ? "Placing Order..." : "Place Order"}
      </button>
    </div>
  );
}

export default AdminCheckout;
