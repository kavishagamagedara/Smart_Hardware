import React, { useEffect, useState } from "react";

function ReceivedOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin-orders/supplier", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      if (!res.ok) throw new Error("Failed to fetch received orders");
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/admin-orders/${id}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (res.ok) {
        alert("Order confirmed successfully!");
        fetchOrders();
      } else {
        alert(data.message || "Failed to confirm order");
      }
    } catch (err) {
      console.error(err);
      alert("Error confirming order");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) return <p>Loading orders...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="received-orders">
      <h2>Received Orders</h2>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Total</th>
            <th>Payment Method</th>
            <th>Slip</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id}>
              <td>{o._id}</td>
              <td>Rs. {o.totalCost}</td>
              <td>{o.paymentMethod}</td>
              <td>
                {o.paymentMethod === "Bank Transfer" && o.slip ? (
                  <a href={`http://localhost:5000${o.slip}`} target="_blank" rel="noreferrer">
                    View Slip
                  </a>
                ) : (
                  "N/A"
                )}
              </td>
              <td>{o.status}</td>
              <td>
                {o.status === "Pending" && (
                  <button onClick={() => handleConfirm(o._id)}>Confirm</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReceivedOrders;
