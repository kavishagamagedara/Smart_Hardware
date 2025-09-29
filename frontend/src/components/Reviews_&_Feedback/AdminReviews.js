import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import StarRating from './StarRating.js';
import './AdminReviews.css';

const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const MODERATION_PERMS = ['moderate_feedback', 'cc_view_feedback', 'cc_respond_feedback', 'cc_manage_returns'];

const resolveMediaUrl = (url) => {
  if (!url) return '';
  const normalized = url.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${API_ROOT}${withLeadingSlash}`;
};

function AdminReviewItem({
  review,
  onReply,
  onVisibilityChange,
  onDeleteReview,
  onDeleteReply,
  onUpdateReply,
  onTogglePin,
  busyReviewId,
  busyReplyKey
}) {
  const { user, token } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyImages, setReplyImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyMessage, setEditReplyMessage] = useState('');
  const [editReplyImages, setEditReplyImages] = useState([]);
  const [editRetainedImages, setEditRetainedImages] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErr, setEditErr] = useState('');

  const isBusyReview = busyReviewId === review._id;
  const isPinned = !!review.isPinned;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleReplyImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + replyImages.length > 3) {
      setErr('You can upload a maximum of 3 images');
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setErr('Only image files are allowed');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErr('Each image must be less than 5MB');
        return false;
      }
      return true;
    });

    setReplyImages(prev => [...prev, ...validFiles]);
    setErr('');
  };

  const removeReplyImage = (index) => {
    setReplyImages(prev => prev.filter((_, i) => i !== index));
  };

  const openEditReply = (reply) => {
    setEditingReplyId(reply._id);
    setEditReplyMessage(reply.message || '');
    setEditRetainedImages(Array.isArray(reply.images) ? reply.images : []);
    setEditReplyImages([]);
    setEditErr('');
  };

  const cancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyMessage('');
    setEditReplyImages([]);
    setEditRetainedImages([]);
    setEditSubmitting(false);
    setEditErr('');
  };

  const handleEditImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const existingCount = editRetainedImages.length + editReplyImages.length;
    if (existingCount + files.length > 3) {
      setEditErr('You can upload a maximum of 3 images');
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setEditErr('Only image files are allowed');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setEditErr('Each image must be less than 5MB');
        return false;
      }
      return true;
    });

    setEditReplyImages((prev) => [...prev, ...validFiles]);
    setEditErr('');
  };

  const removeEditNewImage = (index) => {
    setEditReplyImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditExistingImage = (image) => {
    setEditRetainedImages((prev) => prev.filter((img) => img !== image));
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) {
      setErr('Reply message is required');
      return;
    }

    setSubmitting(true);
    setErr('');

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user._id,
        'x-user-role': user.role,
        'x-user-name': user.name
      };

      const formData = new FormData();
      formData.append('message', replyMessage);
      
      replyImages.forEach((file) => {
        formData.append('images', file);
      });

      await axios.post(
        `${API_ROOT}/api/reviews/${review._id}/replies`,
        formData,
        { headers }
      );

      onReply(review._id);
      setReplyMessage('');
      setReplyImages([]);
      setShowReplyForm(false);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e, replyId) => {
    e.preventDefault();
    if (!editReplyMessage.trim()) {
      setEditErr('Reply message is required');
      return;
    }

    setEditSubmitting(true);
    setEditErr('');

    try {
      await onUpdateReply?.(
        review._id,
        replyId,
        editReplyMessage,
        editRetainedImages,
        editReplyImages
      );
      cancelEditReply();
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to update reply';
      setEditErr(msg);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleVisibilityChange = async (action) => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user._id,
        'x-user-role': user.role,
        'x-user-name': user.name
      };

      await axios.post(
        `${API_ROOT}/api/reviews/${review._id}/visibility`,
        { action },
        { headers }
      );

      onVisibilityChange(review._id, action === 'hide' ? 'hidden' : 'public');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to update visibility');
    }
  };

  return (
    <div className={`admin-review-card ${review.status === 'hidden' ? 'hidden-review' : ''} ${isPinned ? 'pinned-review' : ''}`}>
      <div className="review-header">
        <div className="reviewer-info">
          <h3>{review.userName || 'Anonymous User'}</h3>
          <p className="review-meta">
            {formatDate(review.createdAt)} • Product: {review.targetName}
          </p>
        </div>
        <div className="review-rating">
          <StarRating value={review.rating} readOnly />
          <span className="rating-number">{review.rating}/5</span>
          {isPinned && <span className="pin-badge" aria-label="Pinned review">📌 Pinned</span>}
        </div>
      </div>

      {review.title && (
        <h4 className="review-title">{review.title}</h4>
      )}

      <p className="review-comment">{review.comment}</p>

      {review.images && review.images.length > 0 && (
        <div className="review-images">
          {review.images.map((image, index) => (
            <img
              key={index}
              src={resolveMediaUrl(image)}
              alt={`${review.userName || 'Customer'} attachment ${index + 1}`}
              className="review-image"
              onClick={() => window.open(resolveMediaUrl(image), '_blank')}
            />
          ))}
        </div>
      )}

      {review.replies && review.replies.length > 0 && (
        <div className="existing-replies">
          <h5>Previous Responses:</h5>
          {review.replies.map((reply, index) => (
            <div key={reply._id || index} className="admin-reply">
              <div className="reply-header">
                <span className="admin-name">{reply.adminName || 'Admin'}</span>
                <span className="reply-date">{formatDate(reply.createdAt)}</span>
                {reply.admin?.toString?.() === user?._id?.toString() && (
                  <div className="reply-actions">
                    <button
                      type="button"
                      className="reply-edit"
                      onClick={() => (editingReplyId === reply._id ? cancelEditReply() : openEditReply(reply))}
                      disabled={(busyReplyKey && busyReplyKey.startsWith(`${review._id}:${reply._id}`)) || editSubmitting}
                    >
                      {editingReplyId === reply._id ? 'Cancel edit' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="reply-delete"
                      onClick={() => onDeleteReply?.(review._id, reply._id)}
                      disabled={busyReplyKey && busyReplyKey.startsWith(`${review._id}:${reply._id}`)}
                    >
                      {busyReplyKey === `${review._id}:${reply._id}` ? 'Removing…' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>

              {editingReplyId === reply._id ? (
                <form className="reply-edit-form" onSubmit={(e) => handleEditSubmit(e, reply._id)}>
                  <textarea
                    value={editReplyMessage}
                    onChange={(e) => setEditReplyMessage(e.target.value)}
                    placeholder="Update your response..."
                    rows={4}
                    maxLength={2000}
                    required
                  />
                  <small>{editReplyMessage.length}/2000 characters</small>

                  <div className="form-group">
                    <label htmlFor={`edit-reply-images-${reply._id}`}>Attachments</label>
                    {editRetainedImages.length > 0 && (
                      <div className="image-previews existing-images">
                        {editRetainedImages.map((image) => (
                          <div key={image} className="image-preview">
                            <img src={resolveMediaUrl(image)} alt="Existing attachment" />
                            <button
                              type="button"
                              onClick={() => removeEditExistingImage(image)}
                              className="remove-image"
                              aria-label="Remove existing attachment"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {editReplyImages.length > 0 && (
                      <div className="image-previews">
                        {editReplyImages.map((file, idx) => (
                          <div key={idx} className="image-preview">
                            <img src={URL.createObjectURL(file)} alt={`Selected attachment ${idx + 1}`} />
                            <button
                              type="button"
                              onClick={() => removeEditNewImage(idx)}
                              className="remove-image"
                              aria-label="Remove selected attachment"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      id={`edit-reply-images-${reply._id}`}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleEditImageChange}
                      disabled={editRetainedImages.length + editReplyImages.length >= 3}
                    />
                    <small>You can keep or upload up to 3 images (max 5MB each)</small>
                  </div>

                  {editErr && (
                    <div className="error-message">
                      <p>{editErr}</p>
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={cancelEditReply}
                      className="btn-cancel"
                      disabled={editSubmitting || (busyReplyKey && busyReplyKey.startsWith(`${review._id}:${reply._id}`))}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={
                        editSubmitting ||
                        (busyReplyKey && busyReplyKey.startsWith(`${review._id}:${reply._id}`)) ||
                        !editReplyMessage.trim()
                      }
                    >
                      {busyReplyKey === `${review._id}:${reply._id}:edit` || editSubmitting ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="reply-message">{reply.message}</p>
                  {(reply.editedAt || (reply.updatedAt && reply.updatedAt !== reply.createdAt)) && (
                    <span className="reply-edited">
                      Edited {formatDate(reply.editedAt || reply.updatedAt)}
                    </span>
                  )}
                  {reply.images && reply.images.length > 0 && (
                    <div className="reply-images">
                      {reply.images.map((image, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={resolveMediaUrl(image)}
                          alt={`Admin reply attachment ${imgIndex + 1}`}
                          className="reply-image"
                          onClick={() => window.open(resolveMediaUrl(image), '_blank')}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="admin-actions">
        <button
          onClick={() => setShowReplyForm(!showReplyForm)}
          className="btn-reply"
          disabled={submitting}
        >
          {showReplyForm ? 'Cancel Reply' : 'Reply to Review'}
        </button>
        
        <button
          onClick={() => handleVisibilityChange(review.status === 'public' ? 'hide' : 'unhide')}
          className={`btn-visibility ${review.status === 'hidden' ? 'btn-unhide' : 'btn-hide'}`}
          disabled={submitting || isBusyReview}
        >
          {review.status === 'hidden' ? 'Show Review' : 'Hide Review'}
        </button>

        <button
          onClick={() => onTogglePin?.(review)}
          className={`btn-pin ${isPinned ? 'active' : ''}`}
          disabled={submitting || isBusyReview}
        >
          {isPinned ? 'Unpin review' : 'Pin to top'}
        </button>

        <button
          onClick={() => onDeleteReview?.(review._id)}
          className="btn-delete"
          disabled={submitting || isBusyReview}
        >
          {isBusyReview ? 'Working…' : 'Delete review'}
        </button>
      </div>

      {showReplyForm && (
        <div className="reply-form">
          <h5>Reply to this review:</h5>
          <form onSubmit={handleReplySubmit}>
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Write your response..."
              rows={4}
              maxLength={2000}
              required
            />
            <small>{replyMessage.length}/2000 characters</small>

            <div className="form-group">
              <label htmlFor="reply-images">Add Images (Optional)</label>
              <input
                id="reply-images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleReplyImageChange}
                disabled={replyImages.length >= 3}
              />
              <small>You can upload up to 3 images (max 5MB each)</small>
              
              {replyImages.length > 0 && (
                <div className="image-previews">
                  {replyImages.map((file, index) => (
                    <div key={index} className="image-preview">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Selected attachment ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeReplyImage(index)}
                        className="remove-image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && (
              <div className="error-message">
                <p>{err}</p>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyMessage('');
                  setReplyImages([]);
                  setErr('');
                }}
                className="btn-cancel"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={submitting || !replyMessage.trim()}
              >
                {submitting ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function AdminReviews() {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [busyReviewId, setBusyReviewId] = useState(null);
  const [busyReplyKey, setBusyReplyKey] = useState(null);

  const roleNorm = useMemo(() => String(user?.role || '').toLowerCase(), [user?.role]);
  const permissionSet = useMemo(
    () => new Set((user?.permissions || []).map((perm) => String(perm || '').toLowerCase())),
    [user?.permissions]
  );
  const canModerate = useMemo(() => {
    if (!user?._id) return false;
    if (roleNorm === 'admin') return true;
    if (roleNorm.includes('care') || roleNorm.includes('support')) return true;
    return MODERATION_PERMS.some((perm) => permissionSet.has(perm));
  }, [user?._id, roleNorm, permissionSet]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const sortReviews = useCallback((list) => {
    return [...list].sort((a, b) => {
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aDate = a.isPinned && a.pinnedAt ? new Date(a.pinnedAt) : new Date(a.createdAt);
      const bDate = b.isPinned && b.pinnedAt ? new Date(b.pinnedAt) : new Date(b.createdAt);
      return bDate - aDate;
    });
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setErr('');

      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user._id,
        'x-user-role': user.role,
        'x-user-name': user.name
      };

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (debouncedSearch) {
        params.append('q', debouncedSearch);
      }

      const response = await axios.get(
        `${API_ROOT}/api/reviews?${params.toString()}`,
        { headers }
      );

      setReviews(sortReviews(response.data.data || []));
      setTotalPages(response.data.pages || 1);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [token, user, currentPage, statusFilter, debouncedSearch, sortReviews]);

  useEffect(() => {
    if (!canModerate) {
      setErr('Access denied. Feedback moderation privileges required.');
      setLoading(false);
      return;
    }
    setErr('');
    fetchReviews();
  }, [user, canModerate, fetchReviews]);

  const handleReply = () => {
    // Refresh the reviews to show the new reply
    fetchReviews();
  };

  const buildHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'x-user-id': user._id,
    'x-user-role': user.role,
    'x-user-name': user.name
  });

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    setBusyReviewId(reviewId);
    setErr('');
    try {
      await axios.delete(`${API_ROOT}/api/reviews/${reviewId}`, { headers: buildHeaders() });
      setReviews((prev) => sortReviews(prev.filter((r) => r._id !== reviewId)));
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to delete review');
    } finally {
      setBusyReviewId(null);
    }
  };

  const handleDeleteReply = async (reviewId, replyId) => {
    if (!window.confirm('Delete this reply?')) return;
    const key = `${reviewId}:${replyId}`;
    setBusyReplyKey(key);
    setErr('');
    try {
      await axios.delete(`${API_ROOT}/api/reviews/${reviewId}/replies/${replyId}`, { headers: buildHeaders() });
      setReviews((prev) =>
        sortReviews(
          prev.map((review) => {
            if (review._id !== reviewId) return review;
            const nextReplies = (review.replies || []).filter((reply) => reply._id !== replyId);
            return {
              ...review,
              replies: nextReplies,
              replyCount: nextReplies.length
            };
          })
        )
      );
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to delete reply');
    } finally {
      setBusyReplyKey(null);
    }
  };

  const handleUpdateReply = async (reviewId, replyId, message, retainedImages, newFiles) => {
    const key = `${reviewId}:${replyId}:edit`;
    setBusyReplyKey(key);
    setErr('');

    try {
      const headers = buildHeaders();
      const formData = new FormData();
      formData.append('message', message);
      formData.append('retainImages', JSON.stringify(retainedImages));
      (newFiles || []).forEach((file) => {
        formData.append('images', file);
      });

      const response = await axios.patch(
        `${API_ROOT}/api/reviews/${reviewId}/replies/${replyId}`,
        formData,
        { headers }
      );

      const updatedReview = response.data?.review || response.data;
      if (updatedReview && updatedReview._id) {
        setReviews((prev) =>
          sortReviews(prev.map((review) => (review._id === reviewId ? updatedReview : review)))
        );
      } else {
        await fetchReviews();
      }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to update reply');
      throw e;
    } finally {
      setBusyReplyKey(null);
    }
  };

  const handleTogglePin = async (review) => {
    setBusyReviewId(review._id);
    setErr('');
    try {
      const action = review.isPinned ? 'unpin' : 'pin';
      const response = await axios.post(
        `${API_ROOT}/api/reviews/${review._id}/pin`,
        { action },
        { headers: buildHeaders() }
      );
      const updated = response.data;
      setReviews((prev) =>
        sortReviews(
          prev.map((item) => (item._id === review._id ? { ...item, ...updated } : item))
        )
      );
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to update pin');
    } finally {
      setBusyReviewId(null);
    }
  };

  const handleVisibilityChange = (reviewId, newStatus) => {
    setReviews(prev => sortReviews(prev.map(review => 
      review._id === reviewId ? { ...review, status: newStatus, isPinned: newStatus === 'hidden' ? false : review.isPinned } : review
    )));
  };

  if (!canModerate) {
    return (
      <div className="admin-reviews-container">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need feedback moderation privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-reviews-container">
        <div className="loading">Loading reviews...</div>
      </div>
    );
  }

  return (
    <div className="admin-reviews-container">
      <div className="admin-reviews-header">
        <h1>Customer Reviews Management</h1>
        <p>Manage customer reviews, reply to feedback, and moderate content</p>
      </div>

      <div className="reviews-controls">
        <div className="filter-section">
          <label htmlFor="status-filter">Filter by status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="status-filter"
          >
            <option value="all">All reviews</option>
            <option value="public">Public reviews</option>
            <option value="hidden">Hidden reviews</option>
          </select>
        </div>

        <div className="search-section">
          <label htmlFor="review-search">Search</label>
          <div className="search-input">
            <span aria-hidden="true">🔍</span>
            <input
              id="review-search"
              type="search"
              placeholder="Search by name, review ID, or text…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {err && (
        <div className="error-message">
          <p>{err}</p>
          <button onClick={fetchReviews} className="btn-retry">
            Try Again
          </button>
        </div>
      )}

      {reviews.length === 0 && !err && (
        <div className="no-reviews">
          <h3>No Reviews Found</h3>
          <p>There are no reviews matching your current filter.</p>
        </div>
      )}

      <div className="reviews-list">
        {reviews.map((review) => (
          <AdminReviewItem
            key={review._id}
            review={review}
            onReply={handleReply}
            onVisibilityChange={handleVisibilityChange}
            onDeleteReview={handleDeleteReview}
            onDeleteReply={handleDeleteReply}
            onUpdateReply={handleUpdateReply}
            onTogglePin={handleTogglePin}
            busyReviewId={busyReviewId}
            busyReplyKey={busyReplyKey}
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