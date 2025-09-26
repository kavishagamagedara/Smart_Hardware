import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SupplierProductForm.css";

function SupplierProductForm() {
  const navigate = useNavigate();
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
      const token = localStorage.getItem("token"); // ✅ attach JWT if required
      const res = await fetch("http://localhost:5000/SupplierProducts", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        body: data,
      });

      const result = await res.json();
      if (res.ok) {
        alert("Supplier product added successfully!");
        navigate("/supplier-products");
      } else {
        alert(result.message || "Failed to add product");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="supplier-form">
      <div className="form-group">
        <label htmlFor="name">Product Name</label>
        <input
          id="name"
          type="text"
          name="name"
          placeholder="Enter product name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="price">Price</label>
        <input
          id="price"
          type="number"
          name="price"
          placeholder="Enter price"
          value={formData.price}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          placeholder="Enter description"
          value={formData.description}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="image">Upload Product Image</label>
        <input
          id="image"
          type="file"
          name="image"
          accept="image/*"
          onChange={handleChange}
          required
        />
      </div>

      <button type="submit">Add Supplier Product</button>
    </form>
  );
}

export default SupplierProductForm;
