import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import StarRating from "./StarRating";
import "./MyReviews.css";
import "./ProductReviews.css";

const PAGE_SIZE = 5;
const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const resolveImageUrl = (url) => {
  if (!url) return "";
  const normalized = url.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${API_ROOT}${withLeadingSlash}`;
};

const MEDIA_KEYS_REVIEW = ["images", "image", "imageUrl", "media", "attachments", "photos"];
const MEDIA_KEYS_REPLY = ["images", "image", "imageUrl", "media", "attachments", "photos"];

const normalizeMediaList = (value) => {
  if (!value) return [];

  const coerce = (item) => {
    if (!item) return null;
    if (typeof item === "string") return item;
    if (typeof item === "object") {
      if (Array.isArray(item)) return item.map(coerce).filter(Boolean);
      return item.url || item.path || item.src || item.href || null;
    }
    return String(item);
  };

  if (Array.isArray(value)) {
    return value.flatMap((item) => coerce(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => coerce(item)).filter(Boolean);
      }
    } catch (_) {
      /* not json, treat as single path */
    }
    return [value];
  }

  if (typeof value === "object") {
    const extracted = coerce(value);
    if (Array.isArray(extracted)) return extracted.filter(Boolean);
    if (extracted) return [extracted];
  }

  return [];
};

const extractMedia = (entity, keys = MEDIA_KEYS_REVIEW) => {
  if (!entity) return [];
  for (const key of keys) {
    const media = normalizeMediaList(entity[key]);
    if (media.length) return media;
  }
  return [];
};

const hydrateReply = (reply) => {
  if (!reply) return reply;
  const media = extractMedia(reply, MEDIA_KEYS_REPLY);
  return {
    ...reply,
    displayImages: media,
  };
};

const hydrateReview = (review) => {
  if (!review) return review;
  const media = extractMedia(review, MEDIA_KEYS_REVIEW);
  return {
    ...review,
    displayImages: media,
    replies: Array.isArray(review.replies) ? review.replies.map(hydrateReply) : [],
  };
};

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProductReviews() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [productError, setProductError] = useState("");
  const [reviewError, setReviewError] = useState("");

  const loadProduct = useCallback(async () => {
    setLoadingProduct(true);
    setProductError("");
    try {
  const { data } = await axios.get(`${API_ROOT}/products/${id}`);
      setProduct((prev) => ({ ...prev, ...data }));
    } catch (err) {
      setProductError(err?.response?.data?.message || err.message || "Failed to load product details");
    } finally {
      setLoadingProduct(false);
    }
  }, [id]);

  const fetchReviews = useCallback(
    async (pageToLoad = 1) => {
      setLoadingReviews(true);
      setReviewError("");
      try {
        const config = {
          params: { page: pageToLoad, limit: PAGE_SIZE },
        };

        if (user && token) {
          config.headers = {
            Authorization: `Bearer ${token}`,
            "x-user-id": user._id,
            "x-user-role": user.role,
            "x-user-name": user.name,
          };
        }

  const { data } = await axios.get(`${API_ROOT}/api/reviews/product/${id}`, config);

  setReviews((data.reviews || []).map(hydrateReview));
        setPage(data.pagination?.page || pageToLoad);
        setPages(data.pagination?.pages || 1);
        setStats({
          averageRating: Number(data.product?.averageRating || 0),
          totalReviews:
            Number(data.product?.totalReviews ?? data.pagination?.total ?? data.reviews?.length ?? 0),
        });

        if (data.product) {
          setProduct((prev) => ({ ...prev, ...data.product }));
        }
      } catch (err) {
        setReviews([]);
        setReviewError(err?.response?.data?.message || err.message || "Failed to load reviews");
      } finally {
        setLoadingReviews(false);
      }
    },
    [id, token, user]
  );

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const combinedAverage = useMemo(() => {
    if (stats.totalReviews > 0) {
      return Math.round(stats.averageRating * 10) / 10;
    }

    if (!reviews.length) return 0;
    const avg = reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length;
    return Math.round(avg * 10) / 10;
  }, [reviews, stats]);

  const handleWriteReview = () => {
    if (!user) {
      navigate("/login", { state: { from: `/product/${id}/reviews` } });
      return;
    }

    const targetName = encodeURIComponent(product?.name || "");
    navigate(`/submit-review?productId=${id}&productName=${targetName}`);
  };

  const handleBack = () => navigate(`/product/${id}`);

  const renderReviewImages = (images = [], title = "") => {
    if (!images.length) return null;
    return (
      <div className="review-images">
        {images.map((imageUrl, index) => (
          <img
            key={index}
            src={resolveImageUrl(imageUrl)}
            alt={`Attachment ${index + 1} for ${title || "this review"}`}
            className="review-image"
            onClick={() => window.open(resolveImageUrl(imageUrl), "_blank")}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.style.display = "none";
            }}
          />
        ))}
      </div>
    );
  };

  const renderReplyImages = (images = []) => {
    if (!images.length) return null;
    return (
      <div className="reply-images">
        {images.map((imageUrl, index) => (
          <img
            key={index}
            src={resolveImageUrl(imageUrl)}
            alt={`Store response attachment ${index + 1}`}
            className="reply-image"
            onClick={() => window.open(resolveImageUrl(imageUrl), "_blank")}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.style.display = "none";
            }}
          />
        ))}
      </div>
    );
  };

  const isLoading = loadingProduct || loadingReviews;

  return (
    <div className="product-reviews-container">
      <div className="product-reviews-header">
        <div className="product-summary">
          {product?.imageUrl && (
            <img
              src={resolveImageUrl(product.imageUrl)}
              alt={product.name}
              className="product-summary-image"
            />
          )}

          <div className="product-summary-details">
            <h1>{product?.name || "Product Reviews"}</h1>
            {product && (
              <p className="product-meta">
                <span>Brand: {product.brand || "N/A"}</span>
                <span>Category: {product.category || "N/A"}</span>
              </p>
            )}

            <div className="product-rating-summary">
              <StarRating value={combinedAverage} readOnly size={24} />
              <div>
                <strong>{combinedAverage}</strong>
                <span> out of 5</span>
              </div>
              <span className="rating-count">({stats.totalReviews} reviews)</span>
            </div>
          </div>
        </div>

        <div className="product-actions">
          <button type="button" className="btn-secondary" onClick={handleBack}>
            Back to Product
          </button>
          <button type="button" className="btn-primary" onClick={handleWriteReview}>
            Write a Review
          </button>
        </div>
      </div>

      {productError && (
        <div className="error-message">
          <p>{productError}</p>
        </div>
      )}

      {reviewError && (
        <div className="error-message">
          <p>{reviewError}</p>
          <button type="button" className="btn-retry" onClick={() => fetchReviews(page)}>
            Try Again
          </button>
        </div>
      )}

      {isLoading && (
        <div className="loading">Loading product reviews...</div>
      )}

      {!isLoading && !reviews.length && !reviewError && (
        <div className="no-reviews">
          <h3>No Reviews Yet</h3>
          <p>Be the first to share your experience with this product.</p>
        </div>
      )}

      {!isLoading && reviews.length > 0 && (
        <div className="reviews-list">
          {reviews.map((review) => {
            const reviewMedia = Array.isArray(review.displayImages)
              ? review.displayImages
              : extractMedia(review, MEDIA_KEYS_REVIEW);
            return (
              <div key={review._id || review.reviewNo} className="review-item-card">
              <div className="review-header">
                <div className="product-info">
                  <h3 className="product-name">{review.userName || "Verified Customer"}</h3>
                  <p className="review-date">Reviewed on {formatDate(review.createdAt)}</p>
                </div>
                <div className="review-rating">
                  <StarRating value={review.rating} readOnly />
                  <span className="rating-number">{review.rating}/5</span>
                </div>
              </div>

              {review.title && <h4 className="review-title">{review.title}</h4>}

              {review.comment && <p className="review-comment">{review.comment}</p>}

              {renderReviewImages(reviewMedia, review.title || product?.name)}

              {Array.isArray(review.replies) && review.replies.length > 0 && (
                <div className="admin-replies">
                  <h5>Store Response</h5>
                  {review.replies.map((reply, idx) => {
                    const replyMedia = Array.isArray(reply.displayImages)
                      ? reply.displayImages
                      : extractMedia(reply, MEDIA_KEYS_REPLY);
                    return (
                      <div key={reply._id || idx} className="admin-reply">
                        <div className="reply-header">
                          <span className="admin-name">{reply.adminName || "Store Admin"}</span>
                          {reply.createdAt && (
                            <span className="reply-date">{formatDate(reply.createdAt)}</span>
                          )}
                        </div>
                        <p className="reply-message">{reply.message}</p>
                        {renderReplyImages(replyMedia)}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && !isLoading && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => fetchReviews(page - 1)}
            disabled={page <= 1 || loadingReviews}
          >
            Previous
          </button>
          <span className="pagination-info">Page {page} of {pages}</span>
          <button
            type="button"
            className="pagination-btn"
            onClick={() => fetchReviews(page + 1)}
            disabled={page >= pages || loadingReviews}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}