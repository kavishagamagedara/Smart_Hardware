import React, { useEffect, useState } from "react";
import "./CancelledOrders.css";

function CancelledOrders() {
  const [cancelledOrders, setCancelledOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCancelledOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("You must be logged in");

        const response = await fetch("http://localhost:5000/api/orders/cancelled", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to fetch cancelled orders");
        }

        const data = await response.json();
        setCancelledOrders(data.cancelledOrders || []); // backend returns { cancelledOrders: [...] }
      } catch (err) {
        console.error("Error fetching cancelled orders:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCancelledOrders();
  }, []);

  if (loading) return <p>Loading cancelled orders...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Cancelled Orders</h2>
      {cancelledOrders.length === 0 ? (
        <p>No cancelled orders found.</p>
      ) : (
        cancelledOrders.map((order) => (
          <div key={order._id} className="cancelled-order-card">
            <p><strong>Contact:</strong> {order.contact}</p>
            <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
            <p><strong>Total Amount:</strong> ${order.totalAmount}</p>
            <p><strong>Cancelled At:</strong> {new Date(order.cancelledAt).toLocaleString()}</p>
            <p><strong>Reason:</strong> {order.cancelReason}</p>

            <h4>Items:</h4>
            {order.items && order.items.length > 0 ? (
              <ul>
                {order.items.map((item, idx) => (
                  <li key={idx}>
                    {item.productName} - Qty: {item.quantity} @ ${item.price}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No items found</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default CancelledOrders;
