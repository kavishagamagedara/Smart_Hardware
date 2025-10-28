import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AdminOrders.css";
import { formatLKR } from "../../../utils/currency";

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Keep original list for search
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [noResults, setNoResults] = useState(false);
  const [sortField, setSortField] = useState(""); // e.g., "totalCost" or "createdAt"
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" or "desc"

  const navigate = useNavigate();
  const location = useLocation();

  // Fetch orders
  // Fetch orders
// Fetch orders
const fetchOrders = async () => {
  try {
    const token = localStorage.getItem("token"); // ✅ get token
    const response = await fetch("http://localhost:5000/api/admin-orders", {
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "", // ✅ send token
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status}`);
    }

    const data = await response.json();

    // ✅ Backend already sends an array
    const ordersData = Array.isArray(data) ? data : [];

    setOrders(ordersData);
    setAllOrders(ordersData);
  } catch (err) {
    console.error("Error fetching orders:", err);
    alert("Error connecting to server.");
  } finally {
    setLoading(false);
  }
};



  useEffect(() => {
    fetchOrders();
  }, [location.state?.refresh]);

  // Cancel order
  const handleCancel = async (id) => {
  if (!window.confirm("Are you sure you want to cancel this order?")) return;

  try {
    const token = localStorage.getItem("token");  // ✅ get token

    const response = await fetch(`http://localhost:5000/api/admin-orders/${id}/cancel`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "", // ✅ send token
      },
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || "Order cancelled successfully");
      setOrders((prev) => prev.filter((order) => order._id !== id));
      setAllOrders((prev) => prev.filter((order) => order._id !== id));
    } else {
      alert(data.message || "Failed to cancel order");
    }
  } catch (err) {
    console.error("Error cancelling order:", err);
    alert("Error cancelling order.");
  }
};

  // Navigate to AdminUpdateOrder.js
  const handleUpdate = (id) => {
    navigate(`/AdminUpdateOrder/${id}`);
  };

  // Deep search function
  const handleSearch = () => {
    const search = searchQuery.toLowerCase();

    const matchValue = (value) => {
      if (value == null) return false;
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          return value.some((v) => matchValue(v));
        } else {
          return Object.values(value).some((v) => matchValue(v));
        }
      }
      return value.toString().toLowerCase().includes(search);
    };

    const filteredOrders = allOrders.filter((order) => matchValue(order));
    setOrders(filteredOrders);
    setNoResults(filteredOrders.length === 0);
  };

  // Sort function
  const handleSort = (field) => {
    if (!field) return;

    setSortField(field);

    const sortedOrders = [...orders].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      // If sorting by date, convert to timestamp
      if (field === "createdAt") {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }

      // If numbers, sort numerically
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      // Otherwise, sort as string
      return sortOrder === "asc"
        ? (valA?.toString() || "").localeCompare(valB?.toString() || "")
        : (valB?.toString() || "").localeCompare(valA?.toString() || "");
    });

    setOrders(sortedOrders);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc"); // toggle next
  };

  return (
    <div className="admin-orders-page">
      <h2>Admin Orders</h2>

      {/* Search input */}
      <div style={{ marginBottom: "15px", display: "flex", gap: "5px" }}>
        <input
          type="text"
          placeholder="Search Orders"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: "5px", width: "250px" }}
        />
        <button onClick={handleSearch}>Search</button>

        {/* Sort dropdown */}
        <select
          value={sortField}
          onChange={(e) => handleSort(e.target.value)}
          style={{ padding: "5px" }}
        >
          <option value="">Sort By</option>
          <option value="totalCost">Total Cost</option>
          <option value="createdAt">Created Date</option>
          <option value="status">Status</option>
        </select>
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Supplier</th>
              <th>Total Cost</th>
              <th>Status</th>
              <th>Items</th>
              <th>Notes</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {noResults ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  No orders found.
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  No orders available.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id}>
                  <td>{order._id}</td>
                  <td>
                    {typeof order.supplierId === "string"
                      ? order.supplierId
                      : order.supplierId?.name || "N/A"}
                  </td>
                  <td>{formatLKR(order.totalCost)}</td>
                  <td>{order.status || "Pending"}</td>
                  <td>
                    {Array.isArray(order.items) && order.items.length > 0
                      ? order.items.map((item, idx) => (
                          <div key={idx}>
                            {item.name} × {item.quantity} ({formatLKR(item.price)})
                          </div>
                        ))
                      : "No items"}
                  </td>
                  <td>{order.notes || "None"}</td>
                  <td>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A"}</td>
                  <td>
                    <button className="update-btn" onClick={() => handleUpdate(order._id)}>
                      Update
                    </button>
                    <button className="cancel-btn" onClick={() => handleCancel(order._id)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminOrders;
