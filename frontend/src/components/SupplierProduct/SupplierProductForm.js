import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./SupplierProductForm.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

function SupplierProductForm() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    image: null,
  });

  const handleChange = (e) => {
    if (e.target.name === "image") {
      setFormData({ ...formData, image: e.target.files[0] });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.image) return alert("Please select an image!");

    const data = new FormData();
    data.append("name", formData.name);
    data.append("price", formData.price);
    data.append("description", formData.description);
    data.append("image", formData.image);

    try {
      if (!token) {
        alert("You need to be logged in as a supplier to add products.");
        return;
      }
      const res = await fetch(`${API_ROOT}/supplier-products`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        body: data,
      });
      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await res.json() : await res.text();

      if (res.ok) {
        alert("Supplier product added successfully!");
        navigate("/supplier-products");
      } else {
        const message =
          (payload && typeof payload === "object" && payload.message) ||
          (typeof payload === "string" && payload) ||
          "Failed to add product";
        alert(message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <div className="form-container">
      <h2>Add supplier product</h2>
      <form onSubmit={handleSubmit} className="product-form">
        <div>
          <label htmlFor="name">Product name</label>
          <input
            id="name"
            className="input"
            type="text"
            name="name"
            placeholder="Enter product name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="price">Price</label>
          <input
            id="price"
            className="input"
            type="number"
            name="price"
            placeholder="Enter price"
            value={formData.price}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            className="input"
            name="description"
            placeholder="Enter description"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="image">Upload product image</label>
          <input
            id="image"
            className="input"
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Add supplier product
        </button>
      </form>
    </div>
  );
}

export default SupplierProductForm;
