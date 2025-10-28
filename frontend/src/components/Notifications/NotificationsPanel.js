import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CreditCard,
  MessageCircle,
  RotateCcw,
  Star,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./NotificationsPanel.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const ICON_MAP = {
  "review-submitted": Star,
  "review-replied": MessageCircle,
  "review-restored": RotateCcw,
  "review-deleted": Trash2,
  "payment": CreditCard,
  "payment-online": CreditCard,
  "payment-status": CreditCard,
  "payment-supplier": CreditCard,
  "payment-supplier-approved": CheckCircle,
  "payment-supplier-declined": XCircle,
  "payment-supplier-pending": Clock,
  "refund-request": RotateCcw,
  "refund-update": MessageCircle,
  "refund-status": RotateCcw,
  "refund-reply": MessageCircle,
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "";
  const seconds = Math.floor(Math.abs(diff) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleString();
};

export default function NotificationsPanel({ scope = "user", feed = "", types }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const serializedTypes = useMemo(() => {
    if (!Array.isArray(types)) return "";
    return types
      .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
      .filter(Boolean)
      .join(",");
  }, [types]);

  const headers = useMemo(() => {
    const base = { "Content-Type": "application/json" };
    if (token) base.Authorization = `Bearer ${token}`;
    if (user?._id) base['x-user-id'] = user._id;
    if (user?.name) base['x-user-name'] = user.name;
    if (user?.role) base['x-user-role'] = user.role;
    return base;
  }, [token, user]);

  const loadNotifications = useCallback(async () => {
    if (!token || !user?._id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (feed) params.set("scope", feed);
      if (serializedTypes) params.set("types", serializedTypes);

      const res = await fetch(`${API_ROOT}/api/notifications?${params.toString()}`, {
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load notifications");
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(err.message || "Unable to load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [headers, token, user?._id, feed, serializedTypes]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => items.filter((item) => item.status !== "read").length, [items]);

  const updateItem = useCallback((id, changes) => {
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, ...changes } : item)));
  }, []);

  const handleMarkRead = useCallback(async (id) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_ROOT}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to update notification");
      }
      updateItem(id, { status: "read", readAt: new Date().toISOString() });
    } catch (err) {
      setError(err.message || "Failed to mark notification as read");
    } finally {
      setBusyId("");
    }
  }, [headers, updateItem]);

  const handleRemove = useCallback(async (id) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_ROOT}/api/notifications/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to remove notification");
      }
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.message || "Failed to remove notification");
    } finally {
      setBusyId("");
    }
  }, [headers]);

  const handleMarkAll = useCallback(async () => {
    if (!unreadCount) return;
    setMarkingAll(true);
    setError("");
    try {
      const res = await fetch(`${API_ROOT}/api/notifications/read-all`, {
        method: "PATCH",
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to mark all as read");
      }
      setItems((prev) => prev.map((item) => ({ ...item, status: "read", readAt: new Date().toISOString() })));
    } catch (err) {
      setError(err.message || "Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }, [headers, unreadCount]);

  if (!token || !user?._id) {
    return (
      <div className="notifications-panel">
        <div className="notifications-empty">
          <p>Log in to see notifications.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`notifications-panel ${scope}`}>
      <header className="notifications-header">
        <div className="header-left">
          <Bell size={20} />
          <div>
            <h2>Notifications</h2>
            <p>{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadNotifications}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleMarkAll}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        </div>
      </header>

      {error && (
        <div className="notifications-error">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="notifications-loading">
          <div className="spinner" />
          <p>Loading notifications…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="notifications-empty">
          <p>No notifications yet.</p>
        </div>
      ) : (
        <ul className="notifications-list">
          {items.map((item) => {
            const rawType = String(item.type || "").toLowerCase();
            const Icon =
              ICON_MAP[rawType] || (rawType.startsWith("payment") ? CreditCard : Bell);
            const read = item.status === "read";
            return (
              <li key={item._id} className={`notification-item ${read ? "read" : "unread"}`}>
                <button
                  className="notification-content"
                  onClick={() => (!read ? handleMarkRead(item._id) : undefined)}
                  disabled={busyId === item._id}
                >
                  <span className="notification-icon">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.message}</p>
                    <span className="timestamp">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </button>
                <div className="notification-actions">
                  {!read && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleMarkRead(item._id)}
                      disabled={busyId === item._id}
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleRemove(item._id)}
                    disabled={busyId === item._id}
                    aria-label="Remove notification"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
