import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

function CancelOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const finalReason = reason === "Other" ? customReason : reason;

  const handleCancel = async () => {
    if (!finalReason) {
      alert("Please select a reason");
      return;
    }

    try {
      const response = await axios.put(
        `http://localhost:5000/api/orders/cancel/${id}`,
        { cancelReason: finalReason } // Must match backend
      );

      if (response.status === 200) {
        alert("Order canceled successfully");
        navigate("/CustomerOrders");
      } else {
        alert("Failed to cancel the order");
      }
    } catch (error) {
      console.error("Error canceling order:", error);
      alert("Error canceling the order");
    }
  };

  return (
    <div>
      <h2>Cancel Order</h2>
      <p>Why are you canceling this order?</p>

      <div>
        <label>
          <input
            type="radio"
            name="cancelReason"
            value="Changed my mind"
            checked={reason === "Changed my mind"}
            onChange={(e) => setReason(e.target.value)}
          />
          Changed my mind
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="cancelReason"
            value="Found a better price"
            checked={reason === "Found a better price"}
            onChange={(e) => setReason(e.target.value)}
          />
          Found a better price
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="cancelReason"
            value="Order placed by mistake"
            checked={reason === "Order placed by mistake"}
            onChange={(e) => setReason(e.target.value)}
          />
          Order placed by mistake
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="cancelReason"
            value="Other"
            checked={reason === "Other"}
            onChange={(e) => setReason(e.target.value)}
          />
          Other
        </label>
      </div>

      {reason === "Other" && (
        <input
          type="text"
          placeholder="Enter your reason"
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
        />
      )}

      <br /><br />
      <button onClick={handleCancel}>Submit</button>
    </div>
  );
}

export default CancelOrder;
