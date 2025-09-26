import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateOrder.css";

function UpdateOrder() {
  const [order, setOrder] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    const fetchHandler = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/orders/${id}`);
        console.log("Fetched order:", response.data);
        setOrder(response.data.order || null);
      } catch (error) {
        console.error("Error fetching order:", error);
      }
    };
    fetchHandler();
  }, [id]);

  const handleChangeItemQty = (index, value) => {
    const updatedItems = [...order.items];
    updatedItems[index].quantity = Number(value);
    setOrder({ ...order, items: updatedItems });
  };

  const handleChangePayment = (e) => {
    setOrder({ ...order, paymentMethod: e.target.value });
  };

  const sendRequest = async () => {
    await axios.put(`http://localhost:5000/api/orders/${id}`, {
      contact: String(order.contact), // keep same
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price, // keep same
      })),
      paymentMethod: String(order.paymentMethod), // update
      //status: order.status, // keep same
      totalAmount: order.items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      ), // recalc total
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Updating order:", order);
    sendRequest().then(() => navigate("/CustomerOrders"));
  };

  if (!order) return <p>Loading order...</p>;

  return (
    <div className="update-order-container">
      <h1>Update Order</h1>
      <form onSubmit={handleSubmit}>
        <p><strong>Contact:</strong> {order.contact}</p>
        
        <p>
          <strong>Total Amount:</strong> $
          {order.items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)}
        </p>

        <h3>Items:</h3>
        {order.items.map((item, index) => (
          <div key={index} style={{ marginBottom: "15px" }} className="item-block">
            <p>
              <strong>{item.productName}</strong> @ ${item.price}
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

        <label>Payment Method:</label>
        <br />
        <select
          name="paymentMethod"
          onChange={handleChangePayment}
          value={order.paymentMethod || ""}
          required
        >
          <option value="Pay Online">Pay Online</option>
          <option value="Pay Later">Pay Later</option>
        </select>
        <br /><br />

        <button type="submit">Update Order</button>
      </form>
    </div>
  );
}

export default UpdateOrder;
