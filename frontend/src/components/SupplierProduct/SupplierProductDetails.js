import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./SupplierProductDetails.css";

function SupplierProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("token");

    setLoading(true);
    setError("");

    fetch(`http://localhost:5000/supplier-products/${id}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load supplier product");
        }
        return res.json();
      })
      .then((data) => {
        setProduct(data.supplierProducts || data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error fetching product:", err);
          setError(err.message || "Failed to load product details");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  const imageSrc = useMemo(() => {
    if (!product?.imageUrl) return "/images/placeholder.png";
    return product.imageUrl.startsWith("http")
      ? product.imageUrl
      : `http://localhost:5000${product.imageUrl}`;
  }, [product]);

  const formattedPrice = useMemo(() => {
    const amount = Number(product?.price) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
    }).format(amount);
  }, [product]);

  const details = [
    { label: "Category", value: product?.category || "—" },
    { label: "Brand", value: product?.brand || "—" },
    { label: "Supplier", value: product?.supplierName || product?.supplierId || "—" },
    { label: "Stock", value: product?.stock !== undefined ? product.stock : "—" },
    { label: "Status", value: product?.status || (product?.inStock ? "In stock" : "Out of stock") },
  ];

  if (loading) {
    return (
      <div className="supplier-product-details__state">
        <div className="loader" aria-hidden="true" />
        <p>Loading supplier product…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="supplier-product-details__state supplier-product-details__state--error">
        <h2>Unable to load product</h2>
        <p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="supplier-product-details__state supplier-product-details__state--error">
        <h2>Product not found</h2>
        <p>This supplier product may have been removed.</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="supplier-product-details">
      <div className="supplier-product-details__header">
        <button
          type="button"
          className="btn btn-ghost supplier-product-details__back"
          onClick={() => navigate(-1)}
        >
          ← Back to supplier products
        </button>
        <div>
          <p className="badge">Supplier product</p>
          <h1>{product.name}</h1>
          <p className="supplier-product-details__price">{formattedPrice}</p>
        </div>
      </div>

      <div className="supplier-product-details__content">
        <figure className="supplier-product-details__image">
          <img src={imageSrc} alt={product.name || "Supplier product"} />
          {product?.imageUrl && (
            <figcaption>Uploaded preview</figcaption>
          )}
        </figure>

        <div className="supplier-product-details__info">
          <div className="supplier-product-details__description">
            <h2>Description</h2>
            <p>{product.description || "No description provided."}</p>
          </div>

          <dl className="supplier-product-details__meta">
            {details.map(({ label, value }) => (
              <div key={label} className="supplier-product-details__meta-row">
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>

          {product?.specs && Array.isArray(product.specs) && product.specs.length > 0 && (
            <div className="supplier-product-details__specs">
              <h3>Specifications</h3>
              <ul>
                {product.specs.map((spec, idx) => (
                  <li key={idx}>{spec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierProductDetails;
