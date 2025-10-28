import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import StarRating from './StarRating.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './AdminReviews.css';

const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const MODERATION_PERMS = [
  'moderate_feedback', 
  'cc_view_feedback', 
  'cc_respond_feedback', 
  'cc_manage_returns',
  'manage_feedback',
  'feedback_moderation'
];

const REPORT_STORAGE_KEY = 'admin-reviews-report-cache';

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
  const navigate = useNavigate();
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

  const handleCardClick = (e) => {
    // Don't navigate if clicking on buttons, inputs, or interactive elements
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('textarea') ||
      e.target.closest('form') ||
      e.target.closest('a') ||
      e.target.closest('.review-image')
    ) {
      return;
    }

    // Navigate to product reviews page if targetId exists
    if (review.targetId && review.targetType === 'Product') {
      navigate(`/product/${review.targetId}/reviews`);
    }
  };

  return (
    <div 
      className={`admin-review-card ${review.status === 'hidden' ? 'hidden-review' : ''} ${isPinned ? 'pinned-review' : ''}`}
      onClick={handleCardClick}
      style={{ cursor: review.targetId ? 'pointer' : 'default' }}
      role={review.targetId ? 'button' : undefined}
      tabIndex={review.targetId ? 0 : undefined}
      onKeyDown={review.targetId ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick(e);
        }
      } : undefined}
    >
      <div className="review-header">
        <div className="reviewer-info">
          <h3>{review.userName || 'Anonymous User'}</h3>
          <p className="review-meta">
            {formatDate(review.createdAt)} • Product: {review.targetName}
            {review.targetId && review.targetType === 'Product' && (
              <span className="click-hint"> • Click to view all reviews →</span>
            )}
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
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [report, setReport] = useState(null);
  const prevStatusFilterRef = useRef(statusFilter);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = window.localStorage.getItem(REPORT_STORAGE_KEY);
      if (!cached) return;

      const parsed = JSON.parse(cached);
      if (!parsed?.report) {
        window.localStorage.removeItem(REPORT_STORAGE_KEY);
        return;
      }

      console.log('📦 Restoring cached report from storage');
      setReport(parsed.report);
      setReportError('');

      if (parsed.filters) {
        if (parsed.filters.from) {
          setReportFrom(parsed.filters.from);
        }
        if (parsed.filters.to) {
          setReportTo(parsed.filters.to);
        }
        if (parsed.filters.status) {
          const cachedStatus = String(parsed.filters.status);
          if (cachedStatus && cachedStatus !== prevStatusFilterRef.current) {
            prevStatusFilterRef.current = cachedStatus;
            setStatusFilter(cachedStatus);
          }
        }
      }
    } catch (storageError) {
      console.error('⚠️ Failed to restore report cache:', storageError);
      window.localStorage.removeItem(REPORT_STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleNorm = useMemo(() => String(user?.role || '').toLowerCase(), [user?.role]);
  const permissionSet = useMemo(
    () => new Set((user?.permissions || []).map((perm) => String(perm || '').toLowerCase())),
    [user?.permissions]
  );
  const canModerate = useMemo(() => {
    if (!user?._id) return false;
    if (roleNorm === 'admin') return true;
    if (roleNorm.includes('care') || roleNorm.includes('support')) return true;
    if (roleNorm.includes('feedback') || roleNorm === 'feedback manager') return true;
    if (roleNorm === 'customer care manager') return true;
    return MODERATION_PERMS.some((perm) => permissionSet.has(perm.toLowerCase()));
  }, [user?._id, roleNorm, permissionSet]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Clear error when dates change
  useEffect(() => {
    if (reportError) {
      setReportError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportFrom, reportTo]);

  // Clear report only when status filter actually changes (not on initial render or report updates)
  useEffect(() => {
    if (prevStatusFilterRef.current !== statusFilter) {
      console.log('🔄 Status filter changed from', prevStatusFilterRef.current, 'to', statusFilter, '- clearing report');
      setReport(null);
      setReportError('');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(REPORT_STORAGE_KEY);
      }
      prevStatusFilterRef.current = statusFilter;
    }
  }, [statusFilter]);

  const formatReportDate = useCallback((value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (error) {
      return String(value);
    }
  }, []);

  const summarise = useCallback((text, max = 140) => {
    if (!text) return '—';
    const trimmed = String(text).trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
  }, []);

  const reportRangeLabel = useMemo(() => {
    if (!report?.range) return 'entire history';
    const fromDate = report.range.from ? new Date(report.range.from) : null;
    const toDate = report.range.to ? new Date(report.range.to) : null;
    const fromText = fromDate ? fromDate.toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'start';
    const toText = toDate ? toDate.toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'today';
    return `${fromText} → ${toText}`;
  }, [report?.range]);

  const reportLimitReached = useMemo(() => {
    if (!report) return false;
    return Number(report.totalMatched || 0) > Number(report.dataCount || 0);
  }, [report]);

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

  const generateReport = async () => {
    if (!canModerate) {
      setReportError('Access denied. Feedback moderation privileges required.');
      return;
    }

    // Allow generating report without dates (will get all reviews)
    if (reportFrom && reportTo) {
      const start = new Date(reportFrom);
      const end = new Date(reportTo);
      if (start > end) {
        setReportError('Start date cannot be later than the end date.');
        return;
      }
    }

    try {
      setReportLoading(true);
      setReportError('');

      const params = new URLSearchParams();
      if (reportFrom) params.append('from', reportFrom);
      if (reportTo) params.append('to', reportTo);
      params.append('status', statusFilter);

      console.log('🔍 Generating report with params:', params.toString());
      console.log('📡 API URL:', `${API_ROOT}/api/reviews/report`);

      const response = await axios.get(
        `${API_ROOT}/api/reviews/report?${params.toString()}`,
        { headers: buildHeaders() }
      );

      console.log('✅ Report generated successfully:', response.data);
      console.log('📊 Report has', response.data?.data?.length || 0, 'reviews');
      console.log('📦 Setting report state...');
      setReport(response.data);
      console.log('✅ Report state set successfully');

      if (typeof window !== 'undefined') {
        const payload = {
          report: response.data,
          filters: {
            from: reportFrom || '',
            to: reportTo || '',
            status: statusFilter
          },
          savedAt: new Date().toISOString()
        };
        window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(payload));
        console.log('💾 Report cached to localStorage');
      }
    } catch (error) {
      console.error('❌ Report generation failed:', error);
      console.error('Error response:', error?.response);
      const message = error?.response?.data?.message || error?.message || 'Failed to generate report.';
      setReportError(message);
      setReport(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(REPORT_STORAGE_KEY);
      }
    } finally {
      setReportLoading(false);
    }
  };

  const clearReport = () => {
    console.log('🗑️ Clearing report');
    setReport(null);
    setReportError('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(REPORT_STORAGE_KEY);
    }
  };

  const exportReportCsv = () => {
    if (!report?.data || report.data.length === 0) {
      setReportError('No report data to export. Generate a report first.');
      return;
    }

    try {
      console.log('📊 Starting CSV export with', report.data.length, 'rows');
      
      const headerRow = [
        'Review ID',
        'Review #',
        'Created At',
        'Target Type',
        'Target Name',
        'Target Identifier',
        'Status',
        'Rating',
        'Reviewer Name',
        'Reviewer ID',
        'Title',
        'Comment',
        'Reply Count',
        'Pinned'
      ];

      const escapeCell = (value) => {
        if (value === null || value === undefined) return '';
        let str = String(value).replace(/\r?\n|\r/g, ' ').trim();
        if (str.includes('"')) {
          str = str.replace(/"/g, '""');
        }
        if (str.includes(',') || str.includes(';')) {
          str = `"${str}"`;
        }
        return str;
      };

      const rows = report.data.map((row) => [
        row.id || '',
        row.reviewNo ?? '',
        row.createdAt || '',
        row.targetType || '',
        row.targetName || '',
        row.targetId || row.targetKey || '',
        row.status || '',
        row.rating ?? '',
        row.userName || '',
        row.userId || '',
        row.title || '',
        row.comment || '',
        row.replyCount ?? 0,
        row.isPinned ? 'Yes' : 'No'
      ]);

      const csvLines = [headerRow, ...rows]
        .map((line) => line.map(escapeCell).join(','))
        .join('\r\n');

      const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const fromLabel = report?.range?.from ? report.range.from.slice(0, 10) : 'start';
      const toLabel = report?.range?.to ? report.range.to.slice(0, 10) : 'today';
      const filename = `review-report-${fromLabel}-${toLabel}.csv`;

      console.log('💾 Downloading CSV file:', filename);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ CSV export completed successfully');
    } catch (error) {
      console.error('❌ CSV export failed:', error);
      const message = error?.message || 'Failed to export report data.';
      setReportError(message);
    }
  };

  const exportReportPdf = () => {
    console.log('📄 exportReportPdf called');
    console.log('📄 Report state:', report);
    
    if (!report?.data || report.data.length === 0) {
      console.error('❌ No report or report.data');
      setReportError('No report data to export. Generate a report first.');
      return;
    }

    try {
      console.log('📄 Starting PDF export with', report.data.length, 'rows');
      console.log('📄 jsPDF available:', typeof jsPDF);
      
      const doc = new jsPDF('landscape', 'pt', 'a4');
      console.log('📄 jsPDF instance created');
      
      // Title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Review & Feedback Report', 40, 40);
      console.log('📄 Title added');
      
      // Date range
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Report Period: ${reportRangeLabel}`, 40, 60);
      doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 40, 75);
      console.log('📄 Date range added');
      
      // Summary metrics
      let yOffset = 95;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Summary', 40, yOffset);
      yOffset += 20;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const summaryLines = [
        `Total Reviews: ${report.totalMatched || 0}`,
        `Average Rating: ${report.averageRating != null ? report.averageRating.toFixed(2) : '—'}`,
        `Rating Range: ${report.minRating ?? '—'} – ${report.maxRating ?? '—'}`,
        `Public: ${report.statusBreakdown?.public ?? 0} | Hidden: ${report.statusBreakdown?.hidden ?? 0} | Deleted: ${report.statusBreakdown?.deleted ?? 0}`
      ];
      
      summaryLines.forEach(line => {
        doc.text(line, 40, yOffset);
        yOffset += 15;
      });
      console.log('📄 Summary metrics added');
      
      // Rating distribution
      yOffset += 10;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Rating Distribution', 40, yOffset);
      yOffset += 20;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      for (let i = 5; i >= 1; i--) {
        doc.text(`★ ${i}: ${report.ratingDistribution?.[i] ?? 0}`, 40, yOffset);
        yOffset += 15;
      }
      console.log('📄 Rating distribution added');
      
      // Top targets
      if (report.topTargets?.length) {
        yOffset += 10;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Most Reviewed Items', 40, yOffset);
        yOffset += 20;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        report.topTargets.slice(0, 5).forEach((item, idx) => {
          const line = `${idx + 1}. ${item.targetName || 'Unnamed'} (${item.count} reviews, avg ${item.averageRating?.toFixed(2) ?? '—'})`;
          doc.text(line, 40, yOffset);
          yOffset += 15;
        });
        console.log('📄 Top targets added');
      }
      
      // Add detailed review table on new page
      console.log('📄 Adding new page for table');
      doc.addPage();
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Detailed Review List', 40, 40);
      
      const tableData = report.data.map((row) => [
        row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US') : '—',
        (row.userName || 'Anonymous').substring(0, 20),
        row.rating != null ? `${row.rating}/5` : '—',
        (row.status || 'unknown').substring(0, 10),
        (row.targetName || '—').substring(0, 30),
        (row.title || '—').substring(0, 30),
        (row.comment || '—').substring(0, 60)
      ]);
      
      console.log('📄 Table data prepared:', tableData.length, 'rows');
      console.log('📄 Calling autoTable...');
      console.log('📄 autoTable type:', typeof autoTable);
      
      autoTable(doc, {
        startY: 60,
        head: [['Date', 'Reviewer', 'Rating', 'Status', 'Product', 'Title', 'Comment']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 40, right: 40 }
      });
      
      console.log('📄 autoTable completed');
      
      // Save
      const fromLabel = report?.range?.from ? report.range.from.slice(0, 10) : 'start';
      const toLabel = report?.range?.to ? report.range.to.slice(0, 10) : 'today';
      const filename = `review-report-${fromLabel}-${toLabel}.pdf`;
      
      console.log('💾 Downloading PDF file:', filename);
      console.log('💾 doc.save type:', typeof doc.save);
      doc.save(filename);
      console.log('✅ PDF export completed successfully');
    } catch (error) {
      console.error('❌ PDF export failed:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      const message = error?.message || 'Failed to export PDF report.';
      setReportError(message);
    }
  };

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

        <div className="report-controls">
          <label htmlFor="report-from">Date range</label>
          <div className="report-range-inputs">
            <input
              id="report-from"
              type="date"
              value={reportFrom}
              max={reportTo || undefined}
              onChange={(e) => setReportFrom(e.target.value)}
            />
            <span>to</span>
            <input
              id="report-to"
              type="date"
              value={reportTo}
              min={reportFrom || undefined}
              onChange={(e) => setReportTo(e.target.value)}
            />
          </div>

          <div className="report-actions">
            <button
              type="button"
              className="btn-report"
              onClick={generateReport}
              disabled={reportLoading}
            >
              {reportLoading ? 'Generating…' : 'Generate report'}
            </button>

            {report && (
              <button
                type="button"
                className="btn-report-secondary"
                onClick={clearReport}
                disabled={reportLoading}
              >
                Clear
              </button>
            )}

            {(() => {
              const hasData = report?.data?.length > 0;
              console.log('🔍 Export buttons check:', { 
                reportExists: !!report, 
                hasData, 
                dataLength: report?.data?.length,
                reportKeys: report ? Object.keys(report) : []
              });
              return hasData ? (
                <>
                  <button
                    type="button"
                    className="btn-report-export"
                    onClick={exportReportCsv}
                    disabled={reportLoading}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="btn-report-export-pdf"
                    onClick={exportReportPdf}
                    disabled={reportLoading}
                  >
                    Export PDF
                  </button>
                </>
              ) : null;
            })()}
          </div>

          {reportError && (
            <p className="report-error" role="alert">{reportError}</p>
          )}
        </div>
      </div>

      {reportLoading && (
        <div className="report-loading" role="status">
          Generating report…
        </div>
      )}

      {(() => {
        const shouldShowReport = report && !reportLoading;
        console.log('🖼️ Report summary check:', { 
          report: !!report, 
          reportLoading, 
          shouldShowReport,
          totalMatched: report?.totalMatched,
          dataCount: report?.dataCount
        });
        return shouldShowReport ? (
          <section className="report-summary-section" aria-live="polite">
            <div className="report-summary-header">
              <div>
                <h2>Review &amp; feedback report</h2>
                <p>
                  Showing {report.totalMatched || 0} review{(report.totalMatched || 0) === 1 ? '' : 's'} for {reportRangeLabel}.
                </p>
                {reportLimitReached && (
                  <p className="report-note">
                    Showing the most recent {report.dataCount} entries. Refine the date range to view the remaining results.
                  </p>
                )}
              </div>
            </div>

          <div className="report-card-grid">
            <article className="report-card">
              <span className="report-card-label">Total reviews</span>
              <strong className="report-card-value">{report.totalMatched || 0}</strong>
              <span className="report-card-sub">Data rows returned: {report.dataCount}</span>
            </article>

            <article className="report-card">
              <span className="report-card-label">Average rating</span>
              <strong className="report-card-value">
                {report.averageRating != null ? `${report.averageRating.toFixed(2)}` : '—'}
              </strong>
              <span className="report-card-sub">
                Range {report.minRating != null ? report.minRating : '—'} – {report.maxRating != null ? report.maxRating : '—'}
              </span>
            </article>

            <article className="report-card">
              <span className="report-card-label">Status breakdown</span>
              <ul className="report-card-list">
                <li>Public: {report.statusBreakdown?.public ?? 0}</li>
                <li>Hidden: {report.statusBreakdown?.hidden ?? 0}</li>
                <li>Deleted: {report.statusBreakdown?.deleted ?? 0}</li>
              </ul>
            </article>

            <article className="report-card">
              <span className="report-card-label">Rating mix</span>
              <ul className="report-card-list">
                <li>⭐ 5: {report.ratingDistribution?.[5] ?? 0}</li>
                <li>⭐ 4: {report.ratingDistribution?.[4] ?? 0}</li>
                <li>⭐ 3: {report.ratingDistribution?.[3] ?? 0}</li>
                <li>⭐ 2: {report.ratingDistribution?.[2] ?? 0}</li>
                <li>⭐ 1: {report.ratingDistribution?.[1] ?? 0}</li>
              </ul>
            </article>
          </div>

          {report.topTargets?.length ? (
            <div className="report-top-targets">
              <h3>Most-reviewed items</h3>
              <ul>
                {report.topTargets.map((item, index) => {
                  const key = `${item.targetType || 'item'}-${item.targetId || item.targetKey || index}`;
                  return (
                    <li key={key}>
                      <div className="target-name">{item.targetName || 'Unnamed target'}</div>
                      <div className="target-meta">
                        {item.targetType || 'Target'} • {item.count} review{item.count === 1 ? '' : 's'}
                        {item.averageRating != null && (
                          <span> • Avg {item.averageRating.toFixed(2)}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="report-table" role="region" aria-live="polite">
            <table>
              <thead>
                <tr>
                  <th scope="col">Created</th>
                  <th scope="col">Reviewer</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Status</th>
                  <th scope="col">Target</th>
                  <th scope="col">Title</th>
                  <th scope="col">Comment</th>
                </tr>
              </thead>
              <tbody>
                {report.data?.length ? (
                  report.data.map((item) => (
                    <tr key={item.id}>
                      <td>{formatReportDate(item.createdAt)}</td>
                      <td>
                        <div className="report-cell-main">{item.userName || 'Anonymous'}</div>
                        <div className="report-cell-sub">{item.userId || '—'}</div>
                      </td>
                      <td>{item.rating != null ? `${item.rating}/5` : '—'}</td>
                      <td>
                        <span className={`report-status report-status-${item.status || 'unknown'}`}>
                          {item.status || 'unknown'}
                        </span>
                      </td>
                      <td>
                        <div className="report-cell-main">{item.targetName || '—'}</div>
                        <div className="report-cell-sub">
                          {item.targetType || '—'}
                          {(item.targetId || item.targetKey) && (
                            <span>
                              {' '}
                              • {item.targetId || item.targetKey}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{item.title || '—'}</td>
                      <td>{summarise(item.comment)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="report-empty">No reviews found for the selected date range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null;
      })()}

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