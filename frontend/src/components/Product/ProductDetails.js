import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./ProductDetails.css";

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    axios
      .get(`http://localhost:5000/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch((err) => console.error("Error fetching product:", err));
  }, [id]);

  if (!product) return <p>Loading...</p>;

  return (
    <div className="product-details-container">
      <div className="product-details-card">
        <img
          src={`http://localhost:5000${product.imageUrl}`}
          alt={product.name}
          className="product-image"
        />
        <div className="product-info">
          <h2>{product.name}</h2>
          <p><strong>Price:</strong> Rs.{product.price}</p>
          <p><strong>Brand:</strong> {product.brand}</p>
          <p><strong>Category:</strong> {product.category}</p>
          <p><strong>Description:</strong> {product.description}</p>
          <p>
            <strong>Stock:</strong>{" "}
            {product.inStock ? `${product.stockAmount} available` : "Out of Stock"}
          </p>
          <button onClick={() => navigate(-1)} className="btn-back">
            Back
          </button>
          <button onClick={() => navigate(`/product/${id}/reviews`)} className="btn-back">
            View Reviews
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductDetails;
