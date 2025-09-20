import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

function SupplierProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/SupplierProducts/${id}`)
      .then(res => res.json())
      .then(data => setProduct(data))
      .catch(err => console.error("Error fetching product:", err));
  }, [id]);

  if (!product) return <p>Loading product details...</p>;

  return (
    <div className="product-details-container">
      <h2>{product.name}</h2>
      <img
        src={product.imageUrl.startsWith("http") ? product.imageUrl : `http://localhost:5000${product.imageUrl}`}
        alt={product.name}
        width="300"
      />
      <p><strong>Price:</strong> ${product.price}</p>
      <p><strong>Description:</strong> {product.description}</p>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}

export default SupplierProductDetails;
