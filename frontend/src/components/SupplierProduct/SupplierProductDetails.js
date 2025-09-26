import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

function SupplierProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
  const token = localStorage.getItem("token");

  fetch(`http://localhost:5000/SupplierProducts/${id}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        console.error("Error:", data.message);
      } else {
        setProduct(data.supplierProducts || data);
      }
    })
    .catch(err => console.error("Error fetching product:", err));
}, [id]);



  if (!product) return <p>Loading product details...</p>;

  return (
    <div className="product-details-container">
      <h2>{product.name}</h2>
      <img
  src={
    product.imageUrl
      ? product.imageUrl.startsWith("http")
        ? product.imageUrl
        : `http://localhost:5000${product.imageUrl}`
      : "/images/placeholder.png"  // fallback placeholder
  }
  alt={product.name || "Product"}
  style={{ maxWidth: "300px" }}
/>

      <p><strong>Price:</strong> ${product.price}</p>
      <p><strong>Description:</strong> {product.description}</p>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}

export default SupplierProductDetails;
