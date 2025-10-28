import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { formatLKR } from "../../../utils/currency";

function ReceivedOrders({ onOrdersLoaded }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { token } = useAuth();

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin-orders/supplier", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      if (!res.ok) throw new Error("Failed to fetch received orders");
      const data = await res.json();
      setOrders(data);
      if (typeof onOrdersLoaded === "function") {
        onOrdersLoaded(data);
      }
    } catch (err) {
      console.error(err);
      setError("Server error");
    } finally {
      setLoading(false);
    }
  }, [onOrdersLoaded, token]);

  // Handle accept/decline actions
  const handleRespond = async (id, action) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin-orders/${id}/respond`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "", 
        },
        body: JSON.stringify({ action }),
      });
      // Check if the response is okay
      const data = await res.json();
      if (res.ok) { 
        alert(action === "accept" ? "Order accepted successfully!" : "Order declined." ); // Show success message
        fetchOrders();
      } else {
        alert(data.message || "Failed to update order");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating order");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading) return <p>Loading orders...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="received-orders">
      <h2>Received Orders</h2>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Items</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Slip</th>
            <th>Supplier status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id}>
              <td>{o._id}</td>
              <td>
                {(o.items || []).length === 0 ? (
                  <span className="muted-text">No items</span>
                ) : (
                  <div className="stack-xs">
                    {o.items.map((item) => (
                      <div key={`${o._id}-${item.productId}`}>
                        {item.name} × {item.quantity} @ {formatLKR(item.price)}
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td>{formatLKR(o.totalCost)}</td>
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
              <td>{o.items?.[0]?.supplierStatus || "Pending"}</td>
              <td>
                {(() => {
                  const status = (o.items?.[0]?.supplierStatus || "Pending").toLowerCase();
                  if (status === "accepted") {
                    return <span className="badge badge-green">Accepted</span>;
                  }
                  if (status === "declined") {
                    return <span className="badge badge-gray">Declined</span>;
                  }
                  return (
                    <div className="flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => handleRespond(o._id, "accept")}> 
                        Accept
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleRespond(o._id, "decline")}>
                        Decline
                      </button>
                    </div>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReceivedOrders;
