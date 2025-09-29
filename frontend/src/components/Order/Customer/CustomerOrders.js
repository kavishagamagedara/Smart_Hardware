import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [noResults, setNoResults] = useState(false);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  // ✅ Fetch user's orders with token
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("You must login first");

        const response = await fetch("http://localhost:5000/api/orders", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to fetch orders");
        }

        const data = await response.json();
        const ordersData = data.orders || [];
        setOrders(ordersData);
        setAllOrders(ordersData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // ✅ Cancel order
  const handleCancel = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/orders/cancel/${orderId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cancelReason: "Customer requested" }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to cancel order");
      }

      alert("Order cancelled successfully!");
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
      setAllOrders((prev) => prev.filter((o) => o._id !== orderId));
    } catch (err) {
      alert(err.message);
    }
  };

  // ✅ Search
  const handleSearch = () => {
    const filteredOrders = allOrders.filter((order) =>
      Object.values(order).some(
        (field) =>
          field != null &&
          field.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    setOrders(filteredOrders);
    setNoResults(filteredOrders.length === 0);
  };

  // ✅ Sort
  const handleSort = (field) => {
    if (!field) return;

    setSortField(field);
    let sortedOrders = [...orders];
    const orderMultiplier = sortOrder === "asc" ? 1 : -1;

    sortedOrders.sort((a, b) => {
      if (typeof a[field] === "string")
        return a[field].localeCompare(b[field]) * orderMultiplier;
      if (typeof a[field] === "number")
        return (a[field] - b[field]) * orderMultiplier;
      return 0;
    });

    setOrders(sortedOrders);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  // ✅ Navigate to Add Review page
  const handleAddReview = (productId, productName) => {
    if (!productId || productId.length !== 24) {
      alert("⚠️ Invalid productId, cannot review this item.");
      return;
    }

    navigate(
      `/add-review?productId=${productId}&productName=${encodeURIComponent(
        productName
      )}`
    );
  };

  // ⬇️ THESE RETURNS must stay inside the function
  if (loading) return <p>Loading orders...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div className="orders-container">
      <h2>My Orders</h2>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search Order Details"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {/* Sort */}
      <div className="sort-dropdown">
        <label htmlFor="sort">Sort By: </label>
        <select
          id="sort"
          value={sortField}
          onChange={(e) => handleSort(e.target.value)}
        >
          <option value="">Select</option>
          <option value="totalAmount">Total Amount</option>
          <option value="status">Status</option>
          <option value="contact">Contact</option>
        </select>
      </div>

      {noResults && <p>No Orders Found</p>}

      {/* Orders List */}
      {orders.length > 0 ? (
        orders.map((order) => (
          <div key={order._id} className="order-card">
            <p><strong>Contact:</strong> {order.contact}</p>
            <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
            <p><strong>Status:</strong> {order.status}</p>
            <p><strong>Total Amount:</strong> ${order.totalAmount}</p>

            <h4>Items:</h4>
            {Array.isArray(order.items) && order.items.length > 0 ? (
              <ul>
                {order.items.map((item, idx) => (
                  <li key={item.productId || idx}>
                    {item.productName} - Qty: {item.quantity} @ ${item.price}
                    <button
                      className="review-btn"
                      onClick={() =>
                        handleAddReview(item.productId, item.productName)
                      }
                    >
                      ➕ Add Review
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No items found</p>
            )}

            <div className="order-buttons">
              {order.status !== "Canceled" && (
                <button
                  onClick={() => handleCancel(order._id)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        !noResults && <p>No orders found</p>
      )}
    </div>
  );
}

export default CustomerOrders;
