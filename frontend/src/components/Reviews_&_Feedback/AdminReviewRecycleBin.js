import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import StarRating from "./StarRating";
import "./AdminReviews.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const MODERATION_PERMS = ["moderate_feedback", "cc_view_feedback", "cc_respond_feedback", "cc_manage_returns"];

const resolveMediaUrl = (url) => {
  if (!url) return "";
  const normalized = url.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${API_ROOT}${withLeadingSlash}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString();
};

export default function AdminReviewRecycleBin() {
  const { user, token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const roleNorm = useMemo(() => String(user?.role || "").toLowerCase(), [user?.role]);
  const permissionSet = useMemo(
    () => new Set((user?.permissions || []).map((perm) => String(perm || "").toLowerCase())),
    [user?.permissions]
  );
  const canModerate = useMemo(() => {
    if (!user?._id) return false;
    if (roleNorm === "admin") return true;
    if (roleNorm.includes("care") || roleNorm.includes("support")) return true;
    return MODERATION_PERMS.some((perm) => permissionSet.has(perm));
  }, [user?._id, roleNorm, permissionSet]);

  const headers = useMemo(() => {
    if (!user?._id || !canModerate) return null;
    const h = {
      "x-user-id": user._id,
      "x-user-role": user.role || "admin",
      "x-user-name": user.name || "Admin",
    };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [user, token, canModerate]);

  const loadDeleted = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${API_ROOT}/api/reviews/recycle-bin`, { headers });
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Failed to load recycle bin";
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!canModerate) {
      setLoading(false);
      setItems([]);
      setError("Access denied. Feedback moderation privileges required.");
      return;
    }
    loadDeleted();
  }, [loadDeleted, canModerate]);

  const handleRestore = useCallback(
    async (id) => {
      if (!headers) return;
      setBusyId(id);
      try {
        await axios.post(`${API_ROOT}/api/reviews/${id}/restore`, {}, { headers });
        setItems((prev) => prev.filter((item) => item._id !== id));
      } catch (err) {
        const msg = err?.response?.data?.message || err.message || "Failed to restore review";
        setError(msg);
      } finally {
        setBusyId(null);
      }
    },
    [headers]
  );

  const handlePurge = useCallback(
    async (id) => {
      if (!headers) return;
      if (!window.confirm("Permanently delete this review? This can’t be undone.")) return;
      setBusyId(id);
      try {
        await axios.delete(`${API_ROOT}/api/reviews/${id}/purge`, { headers });
        setItems((prev) => prev.filter((item) => item._id !== id));
      } catch (err) {
        const msg = err?.response?.data?.message || err.message || "Failed to remove review";
        setError(msg);
      } finally {
        setBusyId(null);
      }
    },
    [headers]
  );

  if (!headers) {
    return (
      <div className="card">
        <p>You need feedback moderation privileges to manage deleted reviews.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card recycle-header">
        <div>
          <h3 className="text-xl font-black">Deleted Reviews</h3>
          <p className="text-sm text-muted">Restore or permanently remove feedback that was deleted by customers or admins.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadDeleted} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="card error-banner">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card loading-state">
          <div className="spinner" />
          <p>Loading deleted reviews…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <p>No reviews in the recycle bin.</p>
        </div>
      ) : (
        <div className="recycle-grid">
          {items.map((review) => (
            <article key={review._id} className="admin-review-card recycle-item">
              <header className="review-header">
                <div>
                  <h3>{review.userName || "Customer"}</h3>
                  <p className="review-meta">
                    Review #{review.reviewNo || "—"} • {formatDateTime(review.createdAt)}
                  </p>
                </div>
                <div className="review-rating">
                  <StarRating value={review.rating} readOnly />
                  <span className="rating-number">{review.rating}/5</span>
                </div>
              </header>

              <div className="recycle-product">
                <span className="meta-label">Product</span>
                <span className="meta-value">{review.targetName || review.targetKey || "Unknown"}</span>
              </div>

              {review.title && <h4 className="review-title">{review.title}</h4>}
              {review.comment && <p className="review-comment">{review.comment}</p>}

              {review.images?.length > 0 && (
                <div className="review-images">
                  {review.images.map((image, idx) => (
                    <img
                      key={idx}
                      src={resolveMediaUrl(image)}
                      alt={`${review.userName || "Customer"} attachment ${idx + 1}`}
                      onClick={() => window.open(resolveMediaUrl(image), "_blank")}
                    />
                  ))}
                </div>
              )}

              <div className="recycle-meta">
                <div>
                  <span className="meta-label">Deleted at</span>
                  <span className="meta-value">{formatDateTime(review.deletedAt)}</span>
                </div>
                <div>
                  <span className="meta-label">Deleted by</span>
                  <span className="meta-value">{review.deletedByName || "Unknown"}</span>
                </div>
              </div>

              <footer className="recycle-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleRestore(review._id)}
                  disabled={busyId === review._id}
                >
                  {busyId === review._id ? "Restoring…" : "Restore"}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handlePurge(review._id)}
                  disabled={busyId === review._id}
                >
                  {busyId === review._id ? "Removing…" : "Delete forever"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
