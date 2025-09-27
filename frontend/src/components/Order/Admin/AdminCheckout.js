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
  const [slip, setSlip] = useState(null);
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

    // ✅ Prepare form data
    const formData = new FormData();
    formData.append("contact", contact);
    formData.append("paymentMethod", paymentMethod);
    formData.append("totalCost", subtotalFromCart);
    formData.append("status", "Pending");
    formData.append("items", JSON.stringify(itemsFromCart)); // pass as-is

    if (paymentMethod === "Bank Transfer" && slip) {
      formData.append("slip", slip); // ✅ attach slip
    }

    console.log("🛒 Final payload to backend:", {
      contact,
      paymentMethod,
      totalCost: subtotalFromCart,
      items: itemsFromCart,
      slip: slip ? slip.name : "none",
    });

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/admin-orders", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: formData,
      });

      const result = await response.json();
      console.log("📩 Backend response:", result);

      if (response.ok) {
        alert("Order placed successfully!");
        navigate("/AdminDashboard");
      } else {
        alert(result.message || "Failed to place order.");
      }
    } catch (err) {
      console.error("❌ Error placing order:", err);
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

        {/* ✅ Slip upload only if Bank Transfer */}
        {paymentMethod === "Bank Transfer" && (
          <div>
            <label>Upload Bank Transfer Slip:</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSlip(e.target.files[0])}
            />
          </div>
        )}
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
