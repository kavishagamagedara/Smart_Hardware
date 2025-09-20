import React, { useState } from "react";
import "./ProductForm.css";

function ProductForm() {
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    brand: "",
    inStock: false,
    stockAmount: "",
    image: null,
  });

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (name === "image") setFormData({ ...formData, image: files[0] });
    else if (type === "checkbox") setFormData({ ...formData, [name]: checked });
    else setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.image) return alert("Please select an image!");

    if (formData.inStock && (!formData.stockAmount || formData.stockAmount <= 0)) {
      return alert("Please enter a valid stock amount.");
    }

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));

    try {
      const res = await fetch("http://localhost:5000/products", { method: "POST", body: data });
      const result = await res.json();
      if (res.ok) {
        alert("Product added successfully!");
        setFormData({ name: "", price: "", description: "", category: "", brand: "", inStock: false, stockAmount: "", image: null });
      } else alert(result.message);
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" placeholder="Name" value={formData.name} onChange={handleChange} required />
      <input type="number" name="price" placeholder="Price" value={formData.price} onChange={handleChange} required />
      <input type="text" name="description" placeholder="Description" value={formData.description} onChange={handleChange} required />
      <input type="text" name="category" placeholder="Category" value={formData.category} onChange={handleChange} required />
      <input type="text" name="brand" placeholder="Brand" value={formData.brand} onChange={handleChange} required />

      <label>
        <input type="checkbox" name="inStock" checked={formData.inStock} onChange={handleChange} />
        In Stock
      </label>

      {formData.inStock && (
        <input type="number" name="stockAmount" placeholder="Stock Amount" value={formData.stockAmount} onChange={handleChange} min="1" required />
      )}

      <input type="file" name="image" accept="image/*" onChange={handleChange} required />
      <button type="submit">Add Product</button>
    </form>
  );
}

export default ProductForm;
