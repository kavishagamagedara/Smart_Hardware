import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./AdminUpdateOrder.css";

function AdminUpdateOrder() {
  const [order, setOrder] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();

  // Fetch admin order by ID
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/admin-orders/${id}`);
        console.log("Fetched admin order:", response.data);
        setOrder(response.data.order || null);
      } catch (error) {
        console.error("Error fetching admin order:", error);
        alert("Failed to fetch order data.");
      }
    };
    fetchOrder();
  }, [id]);

  // Update item quantity
  const handleChangeItemQty = (index, value) => {
    const updatedItems = [...order.items];
    updatedItems[index].quantity = Number(value);
    setOrder({ ...order, items: updatedItems });
  };

  // Send update request
  const sendRequest = async () => {
    try {
      const response = await axios.put(`http://localhost:5000/api/admin-orders/${id}`, {
        supplierId: order.supplierId?._id || null,
        status: order.status,
        notes: order.notes,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalCost: order.items.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0
        ),
      });

      if (response.status === 200) {
        alert("Order updated successfully!"); // ✅ success popup
        navigate("/admin-orders", { state: { refresh: true } }); // redirect after update
      }
    } catch (error) {
      console.error("Error updating admin order:", error);
      alert("Failed to update order.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Updating admin order:", order);
    sendRequest();
  };

  if (!order) return <p>Loading admin order...</p>;

  return (
    <div className="admin-update-order-container">
      <h1>Update Admin Order</h1>
      <form onSubmit={handleSubmit}>
        <p>
          <strong>Supplier:</strong> {order.supplierId?.name || "N/A"}
        </p>

        <p>
          <strong>Total Cost:</strong> Rs.
          {order.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0
          ).toFixed(2)}
        </p>

        <h3>Items:</h3>
        {order.items.map((item, index) => (
          <div key={index} style={{ marginBottom: "15px" }} className="item-block">
            <p>
              <strong>{item.name}</strong> @ Rs.{item.price}
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

        <br />
        <button type="submit">Update Order</button>
      </form>
    </div>
  );
}

export default AdminUpdateOrder;
