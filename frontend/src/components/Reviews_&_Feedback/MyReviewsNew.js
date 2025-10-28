import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import StarRating from './StarRating.js';
import NotificationsPanel from '../Notifications/NotificationsPanel';
import { Bell, PenSquare } from 'lucide-react';
import './MyReviews.css';

const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API = `${API_ROOT}/api`;

const MEDIA_KEYS_REVIEW = ['images', 'image', 'imageUrl', 'media', 'attachments', 'photos'];
const MEDIA_KEYS_REPLY = ['images', 'image', 'imageUrl', 'media', 'attachments', 'photos'];

const resolveMediaUrl = (url) => {
  if (!url) return '';
  const normalized = url.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${API_ROOT}${withLeadingSlash}`;
};

const normalizeMediaList = (value) => {
  if (!value) return [];

  const coerce = (item) => {
    if (!item) return null;
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      if (Array.isArray(item)) return item.map(coerce).filter(Boolean);
      return item.url || item.path || item.src || item.href || null;
    }
    return String(item);
  };

  if (Array.isArray(value)) {
    return value.flatMap((item) => coerce(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => coerce(item)).filter(Boolean);
      }
    } catch (_) {
      /* not JSON; fall through */
    }
    return [value];
  }

  if (typeof value === 'object') {
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

function ReviewItem({ item, onDeleted, onUpdated }) {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleEdit = () => {
    navigate(`/add-review?rid=${item._id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    
    setBusy(true); 
    setErr('');
    
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user._id,
        'x-user-role': user.role,
        'x-user-name': user.name
      };

      await axios.delete(`${API}/reviews/${item._id}`, { headers });
      onDeleted?.(item._id);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Failed to delete review');
    } finally { 
      setBusy(false); 
    }
  };

  const handleViewProduct = () => {
    navigate(`/product/${item.targetId || item.targetKey}`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const reviewImages = Array.isArray(item.displayImages)
    ? item.displayImages
    : extractMedia(item, MEDIA_KEYS_REVIEW);

  return (
    <div className="review-item-card">
      <div className="review-header">
        <div className="product-info">
          <h3 className="product-name">{item.targetName || item.targetKey}</h3>
          <p className="product-id">Product ID: {item.targetKey || item.targetId}</p>
          <p className="review-date">Reviewed on {formatDate(item.createdAt)}</p>
        </div>
        <div className="review-rating">
          <StarRating value={item.rating} readOnly />
          <span className="rating-number">{item.rating}/5</span>
        </div>
      </div>

      {item.title && (
        <h4 className="review-title">{item.title}</h4>
      )}

      <p className="review-comment">{item.comment}</p>

      {reviewImages.length > 0 && (
        <div className="review-images">
          {reviewImages.map((image, index) => {
            const src = resolveMediaUrl(image);
            return (
              <img
                key={index}
                src={src}
                alt={`Attachment ${index + 1} for ${item.targetName || 'this review'}`}
                className="review-image"
                onClick={() => window.open(src, '_blank')}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.style.display = 'none';
                }}
              />
            );
          })}
        </div>
      )}

      {item.replies && item.replies.length > 0 && (
        <div className="admin-replies">
          <h5>Store Response:</h5>
          {item.replies.map((reply, index) => {
            const replyImages = Array.isArray(reply.displayImages)
              ? reply.displayImages
              : extractMedia(reply, MEDIA_KEYS_REPLY);
            return (
              <div key={reply._id || index} className="admin-reply">
                <div className="reply-header">
                  <span className="admin-name">{reply.adminName || 'Store Admin'}</span>
                  <span className="reply-date">{formatDate(reply.createdAt)}</span>
                </div>
                <p className="reply-message">{reply.message}</p>
                {replyImages.length > 0 && (
                  <div className="reply-images">
                    {replyImages.map((image, imgIndex) => {
                      const src = resolveMediaUrl(image);
                      return (
                        <img
                          key={imgIndex}
                          src={src}
                          alt={`Store response attachment ${imgIndex + 1}`}
                          className="reply-image"
                          onClick={() => window.open(src, '_blank')}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {err && (
        <div className="error-message">
          <p>{err}</p>
        </div>
      )}

      <div className="review-actions">
        <button
          onClick={handleViewProduct}
          className="btn-view-product"
          disabled={busy}
        >
          View Product
        </button>
        <button
          onClick={handleEdit}
          className="btn-edit"
          disabled={busy}
        >
          Edit Review
        </button>
        <button
          onClick={handleDelete}
          className="btn-delete"
          disabled={busy}
        >
          {busy ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function MyReviews({ embedded = false }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchMyReviews = useCallback(async () => {
    try {
      setLoading(true);
      setErr('');

      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user._id,
        'x-user-role': user.role,
        'x-user-name': user.name
      };

      const response = await axios.get(
        `${API}/reviews?mine=true&page=${currentPage}&limit=10`,
        { headers }
      );

      setReviews((response.data.data || []).map(hydrateReview));
      setTotalPages(response.data.pages || 1);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [token, user, currentPage]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchMyReviews();
  }, [user, navigate, fetchMyReviews]);

  const repliesCount = useMemo(
    () =>
      reviews.reduce(
        (sum, review) => sum + (Array.isArray(review.replies) ? review.replies.length : 0),
        0
      ),
    [reviews]
  );

  const containerClass = [
    'my-reviews-container',
    embedded ? 'my-reviews-container--embedded' : 'my-reviews-container--standalone',
  ]
    .filter(Boolean)
    .join(' ');

  const headerClass = `my-reviews-header ${embedded ? 'my-reviews-header--embedded' : 'my-reviews-header--standalone'}`;
  const headingTitle = embedded ? 'My feedback' : 'My Reviews';

  const handleReviewDeleted = (reviewId) => {
    setReviews(prev => prev.filter(review => review._id !== reviewId));
  };

  const handleReviewUpdated = (updatedReview) => {
    const hydrated = hydrateReview(updatedReview);
    setReviews(prev => prev.map(review => 
      review._id === hydrated._id ? hydrated : review
    ));
  };

  if (!user) {
    return (
      <div className={containerClass}>
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to view your reviews.</p>
          <button onClick={() => navigate('/login')} className="btn-login">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={containerClass}>
        <div className="loading">Loading your reviews...</div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <div className="my-reviews-heading">
          <h1>{headingTitle}</h1>
          <p>Keep track of what you&apos;ve shared and how the store responds.</p>
        </div>
        <div className="my-reviews-actions">
          <button
            type="button"
            className={`my-reviews-action-button ${showNotifications ? 'is-active' : ''}`}
            onClick={() => setShowNotifications((open) => !open)}
          >
            <Bell size={16} />
            <span>
              {showNotifications ? 'Hide reply notifications' : 'Reply notifications'}
              {repliesCount > 0 && !showNotifications && (
                <span className="my-reviews-action-badge">{repliesCount}</span>
              )}
            </span>
          </button>
          {!embedded && (
            <button
              type="button"
              className="my-reviews-action-button my-reviews-action-button--primary"
              onClick={() => navigate('/add-review')}
            >
              <PenSquare size={16} />
              <span>Write a review</span>
            </button>
          )}
        </div>
      </div>

      {showNotifications && (
        <div className="my-reviews-notifications">
          <NotificationsPanel types={["review-replied"]} />
        </div>
      )}

      {err && (
        <div className="error-message">
          <p>{err}</p>
          <button onClick={fetchMyReviews} className="btn-retry">
            Try Again
          </button>
        </div>
      )}

      {reviews.length === 0 && !err && (
        <div className="no-reviews">
          <h3>No Reviews Yet</h3>
          <p>You haven't written any reviews yet. Start by purchasing and reviewing products!</p>
          <button onClick={() => navigate('/customer-products')} className="btn-browse">
            Browse Products
          </button>
        </div>
      )}

      <div className="reviews-list">
        {reviews.map((review) => (
          <ReviewItem
            key={review._id}
            item={review}
            onDeleted={handleReviewDeleted}
            onUpdated={handleReviewUpdated}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}