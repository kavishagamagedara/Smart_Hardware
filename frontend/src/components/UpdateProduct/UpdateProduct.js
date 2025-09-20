import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateProduct.css";

function UpdateProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    brand: "",
    inStock: false,
    stockAmount: "",
    image: null,     
    imageUrl: "",      
  });

  // Fetch product details
  useEffect(() => {
    fetch(`http://localhost:5000/products/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProduct({
          name: data.name || "",
          price: data.price || "",
          description: data.description || "",
          category: data.category || "",
          brand: data.brand || "",
          inStock: data.inStock || false,
          stockAmount: data.stockAmount || "",
          image: null,
          imageUrl: data.imageUrl || "",
        });
      })
      .catch((err) => console.error("Error fetching product:", err));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "file") {
      setProduct({ ...product, image: files[0] });
    } else if (type === "checkbox") {
      setProduct({ ...product, [name]: checked });
    } else {
      setProduct({ ...product, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (product.inStock && (!product.stockAmount || product.stockAmount <= 0)) {
      alert("Please enter a valid stock amount.");
      return;
    }

    const data = new FormData();
    data.append("name", product.name);
    data.append("price", product.price);
    data.append("description", product.description);
    data.append("category", product.category);
    data.append("brand", product.brand);
    data.append("inStock", product.inStock);
    data.append("stockAmount", product.stockAmount);
    if (product.image) data.append("image", product.image); // optional new image

    try {
      const res = await fetch(`http://localhost:5000/products/${id}`, {
        method: "PUT",
        body: data,
      });

      const result = await res.json();
      if (res.ok) {
        alert("✅ Product updated successfully!");
        navigate("/products");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Something went wrong!");
    }
  };

  return (
    <div className="update-form-container">
      <h2>Edit Product</h2>
      <form onSubmit={handleSubmit} className="update-form">
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={product.name}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="price"
          placeholder="Price"
          value={product.price}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={product.description}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="category"
          placeholder="Category"
          value={product.category}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="brand"
          placeholder="Brand"
          value={product.brand}
          onChange={handleChange}
          required
        />

        <label>
          <input
            type="checkbox"
            name="inStock"
            checked={product.inStock}
            onChange={handleChange}
          />
          Stock Available
        </label>

        {product.inStock && (
          <input
            type="number"
            name="stockAmount"
            placeholder="Stock Amount"
            value={product.stockAmount}
            onChange={handleChange}
            min="1"
            required
          />
        )}

        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={handleChange}
        />

        {product.imageUrl && (
          <div style={{ marginTop: "10px" }}>
            <p>Current Image:</p>
            <img
              src={`http://localhost:5000${product.imageUrl}`}
              alt="Current"
              style={{ width: "150px", borderRadius: "8px" }}
            />
          </div>
        )}

        <button type="submit">Update Product</button>
      </form>
    </div>
  );
}

export default UpdateProduct;
