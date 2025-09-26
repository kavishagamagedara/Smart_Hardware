import React, { useEffect, useState } from "react";
import "./AdminCancelledOrders.css";

function AdminCancelledOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCancelledOrders = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/admin-cancelled-orders");
        const data = await response.json();
        console.log("Cancelled Orders Response:", data);

        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error("Error fetching cancelled orders:", err);
        alert("Error connecting to server.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCancelledOrders();
  }, []);

  return (
    <div className="admin-cancelled-orders-page">
      <h2>Cancelled Orders</h2>
      {loading ? (
        <p>Loading cancelled orders...</p>
      ) : orders.length === 0 ? (
        <p>No cancelled orders found.</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Supplier</th>
              <th>Total Cost</th>
              <th>Items</th>
              <th>Notes</th>
              <th>Cancelled At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id}>
                <td>{order._id}</td>
                <td>{typeof order.supplierId === "string" ? order.supplierId : order.supplierId?.name || "N/A"}</td>
                <td>Rs. {order.totalCost?.toFixed(2) || "0.00"}</td>
                <td>
                  {Array.isArray(order.items) && order.items.length > 0
                    ? order.items.map((item, idx) => (
                        <div key={idx}>
                          {item.name} × {item.quantity} (Rs. {item.price})
                        </div>
                      ))
                    : "No items"}
                </td>
                <td>{order.notes || "None"}</td>
                <td>{order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminCancelledOrders;
