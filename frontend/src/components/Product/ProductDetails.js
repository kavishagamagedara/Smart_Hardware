import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import StarRating from "../Reviews_&_Feedback/StarRating";
import "./ProductDetails.css";
import { formatLKR } from "../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const resolveImageUrl = (imageUrl = "") => {
  if (!imageUrl) return null;
  if (/^https?:/i.test(imageUrl)) return imageUrl;
  const normalized = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${API_ROOT}${normalized}`;
};

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");

    axios
      .get(`${API_ROOT}/products/${id}`)
      .then((res) => {
        if (!cancelled) setProduct(res.data);
      })
      .catch((err) => {
        console.error("Error fetching product:", err);
        if (!cancelled) setError("Unable to load this product. Please try again shortly.");
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const reviewCount = useMemo(() => {
    if (!product) return 0;
    return (
      Number(
        product.totalReviews ??
          product.reviewCount ??
          (Array.isArray(product.reviews) ? product.reviews.length : 0)
      ) || 0
    );
  }, [product]);

  const ratingValue = useMemo(() => {
    if (!product) return 0;
    return Number(product.averageRating ?? product.rating ?? 0) || 0;
  }, [product]);

  const hasRating = reviewCount > 0 && ratingValue > 0;

  const stockAmount = Number(product?.stockAmount ?? 0);
  const stockLabel = product?.inStock
    ? stockAmount > 0
      ? `${stockAmount} in stock`
      : "Available"
    : "Out of stock";

  const imageUrl = resolveImageUrl(product?.imageUrl);
  const priceDisplay = product?.price != null ? formatLKR(product.price) : "Not available";
  const sku = product?.sku || (product?._id ? `#${String(product._id).slice(-8).toUpperCase()}` : "N/A");
  const descriptionText = product?.description?.trim() || "We’re preparing more details for this product. Check back soon!";
  const updatedOn = product?.updatedAt
    ? new Date(product.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : product?.createdAt
    ? new Date(product.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Recently added";

  const specItems = [
    { label: "Brand", value: product?.brand || "Not specified" },
    { label: "Category", value: product?.category || "Uncategorized" },
    { label: "SKU", value: sku },
    { label: "Last updated", value: updatedOn },
  ];

  if (!product && !error) {
    return (
      <div className="product-page product-page--loading">
        <div className="product-skeleton" aria-hidden />
        <p className="loading-message">Loading beautiful product details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-page product-page--error">
        <div className="product-error-card">
          <h2 className="heading-md">Something went wrong</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="product-page">
      <div className="product-back">
        <button type="button" className="product-back__btn" onClick={() => navigate(-1)}>
          <span aria-hidden>←</span> Back to previous page
        </button>
      </div>

      <section className="product-hero">
        <span className="product-hero__glow" aria-hidden />
        <div className="product-hero__content">
          <div className="product-hero__details">
            <div className="product-tags" aria-label="Product categories">
              {product?.category && <span className="product-tag">{product.category}</span>}
              {product?.brand && <span className="product-tag product-tag--muted">{product.brand}</span>}
            </div>

            <h1 className="product-title">{product?.name || "Product"}</h1>

            <div className="product-rating">
              {hasRating ? (
                <>
                  <StarRating value={ratingValue} readOnly size={22} />
                  <span className="product-rating__value">{ratingValue.toFixed(1)}</span>
                  <span className="product-rating__count">({reviewCount} review{reviewCount === 1 ? "" : "s"})</span>
                </>
              ) : (
                <span className="product-rating__empty">No reviews yet</span>
              )}
            </div>

            <p className="product-summary">{descriptionText}</p>

            <div className="product-price-card">
              <div>
                <span className="product-price-card__label">Price</span>
                <span className="product-price-card__value">{priceDisplay}</span>
              </div>
              <span
                className={`stock-pill ${product?.inStock ? "stock-pill--available" : "stock-pill--out"}`}
              >
                {stockLabel}
              </span>
            </div>

            <div className="product-actions">
              <button
                type="button"
                className="btn btn-primary product-actions__cta"
                onClick={() => navigate(`/product/${id}/reviews`)}
              >
                Read customer reviews{reviewCount > 0 ? ` (${reviewCount})` : ""}
              </button>
              <button
                type="button"
                className="btn btn-ghost product-actions__secondary"
                onClick={() => navigate("/customer-products")}
              >
                Browse more products
              </button>
            </div>
          </div>

          <div className="product-hero__media">
            <div className="product-hero__image-wrapper">
              {imageUrl ? (
                <img src={imageUrl} alt={product?.name || "Product image"} className="product-hero__image" />
              ) : (
                <div className="product-hero__image product-hero__image--placeholder" aria-hidden>
                  <span>No image available</span>
                </div>
              )}
              <span className="product-hero__image-shadow" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      <section className="product-secondary">
        <div className="product-spec-grid" aria-label="Key product attributes">
          {specItems.map((item) => (
            <article key={item.label} className="product-spec-card">
              <span className="product-spec-card__label">{item.label}</span>
              <span className="product-spec-card__value">{item.value}</span>
            </article>
          ))}
        </div>

        <article className="product-description-card">
          <h2 className="product-description-card__title">About this product</h2>
          <p className="product-description-card__text">{descriptionText}</p>
          <div className="product-description-meta">
            <span>Updated {updatedOn}</span>
            <span>Product ID {sku}</span>
          </div>
        </article>
      </section>
    </div>
  );
}

export default ProductDetails;
