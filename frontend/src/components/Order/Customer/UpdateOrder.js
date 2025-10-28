import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateOrder.css";
import { formatLKR } from "../../../utils/currency";

function UpdateOrder() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    const fetchHandler = async () => {
      const tokenFromStorage = (() => {
        try {
          return localStorage.getItem("token") || sessionStorage.getItem("token");
        } catch (err) {
          try {
            return sessionStorage.getItem("token");
          } catch {
            return null;
          }
        }
      })();

      if (!tokenFromStorage) {
        console.warn("Missing auth token; redirecting to orders list");
        navigate("/CustomerOrders", { replace: true });
        return;
      }

      try {
        const response = await axios.get(`http://localhost:5000/api/orders/${id}`, {
          headers: {
            Authorization: `Bearer ${tokenFromStorage}`,
          },
        });
        setOrder(response.data.order || null);
        setError(null);
      } catch (error) {
        console.error("Error fetching order:", error);
        setError("Unable to load order. It may no longer be available.");
        setOrder(null);
      }
      setLoading(false);
    };
    fetchHandler();
  }, [id, navigate]);

  const handleChangeItemQty = (index, value) => {
    const updatedItems = [...order.items];
    const nextValue = Number(value);
    updatedItems[index].quantity = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1;
    setOrder({ ...order, items: updatedItems });
  };

  const sendRequest = async () => {
    const tokenFromStorage = (() => {
      try {
        return localStorage.getItem("token") || sessionStorage.getItem("token");
      } catch (err) {
        try {
          return sessionStorage.getItem("token");
        } catch {
          return null;
        }
      }
    })();

    if (!tokenFromStorage) throw new Error("Authentication required");

    await axios.put(
      `http://localhost:5000/api/orders/${id}`,
      {
      contact: String(order.contact), // keep same
      items: order.items.map((item) => ({
        productId: item.productId || item._id,
        productName: item.productName,
        quantity: Number(item.quantity),
        price: Number(item.price), // keep same
      })),
      //status: order.status, // keep same
      totalAmount: order.items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      ), // recalc total
      },
      {
        headers: {
          Authorization: `Bearer ${tokenFromStorage}`,
        },
      }
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Updating order:", order);
    sendRequest()
      .then(() => navigate("/CustomerOrders"))
      .catch((err) => {
        console.error("Failed to update order", err);
        alert(err?.message || "Failed to update order. Please try again.");
      });
  };

  if (loading) {
    return (
      <div className="update-order-container">
        <p>Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="update-order-container">
        <p style={{ color: "#b91c1c" }}>{error || "Order not found."}</p>
        <button type="button" onClick={() => navigate("/CustomerOrders")}>Back to orders</button>
      </div>
    );
  }

  return (
    <div className="update-order-container">
      <h1>Update Order</h1>
      <form onSubmit={handleSubmit}>
        <p><strong>Contact:</strong> {order.contact}</p>
        
        <p>
          <strong>Total Amount:</strong> {formatLKR(order.items.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 0), 0))}
        </p>

  <p><strong>Payment Method:</strong> {order.paymentMethod || "-"}</p>

  <h3>Items:</h3>
        {order.items.map((item, index) => (
          <div key={index} style={{ marginBottom: "15px" }} className="item-block">
            <p>
              <strong>{item.productName}</strong> @ {formatLKR(item.price)}
            </p>
            <label>Quantity:</label>
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => handleChangeItemQty(index, e.target.value)}
            />
          </div>
        ))}

        <button type="submit">Update Order</button>
      </form>
    </div>
  );
}

export default UpdateOrder;
