import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./CancelledOrders.css";
import { formatLKR } from "../../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const getStoredToken = () => {
  try {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
  } catch (err) {
    try {
      return sessionStorage.getItem("token");
    } catch {
      return null;
    }
  }
};

function CancelledOrders({ initialOrders = null, embedded = false, onOrdersChange }) {
  const [cancelledOrders, setCancelledOrders] = useState(() => initialOrders || []);
  const [loading, setLoading] = useState(() => !initialOrders);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCancelledOrders = useCallback(async () => {
    const token = getStoredToken();
    try {
      setLoading(true);
      setError("");
      if (!token) throw new Error("You must be logged in to view cancelled orders");

      const response = await fetch(`${API_ROOT}/api/orders/cancelled`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch cancelled orders");
      }

      const data = await response.json();
      const list = Array.isArray(data?.cancelledOrders) ? data.cancelledOrders : [];
      setCancelledOrders(list);
      onOrdersChange?.(list);
    } catch (err) {
      console.error("Error fetching cancelled orders:", err);
      setError(err?.message || "Unable to load cancelled orders");
      setCancelledOrders([]);
      onOrdersChange?.([]);
    } finally {
      setLoading(false);
    }
  }, [onOrdersChange]);

  useEffect(() => {
    if (initialOrders) {
      setCancelledOrders(initialOrders);
      setLoading(false);
      return;
    }
    fetchCancelledOrders();
  }, [initialOrders, fetchCancelledOrders]);

  const displayedOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return cancelledOrders;
    return cancelledOrders.filter((order) => {
      const fields = [
        order?.contact,
        order?.paymentMethod,
        order?.cancelReason,
        order?._id,
      ];
      if (
        fields.some(
          (value) =>
            value &&
            String(value)
              .toLowerCase()
              .includes(term)
        )
      ) {
        return true;
      }

      return (order?.items || []).some((item) =>
        String(item?.productName || "")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [cancelledOrders, searchTerm]);

  const formatDate = (value) => {
    if (!value) return "Date unavailable";
    try {
      return new Date(value).toLocaleString();
    } catch (err) {
      return String(value);
    }
  };

  const emptyStateMessage = searchTerm.trim()
    ? "No cancelled orders match your search."
    : "You have not cancelled any orders yet.";

  if (loading) {
    return (
      <div
        className={`cancelled-orders-container${
          embedded ? " cancelled-orders-container--embedded" : ""
        }`}
      >
        <div className="status-banner status-banner--info">Loading cancelled orders…</div>
      </div>
    );
  }

  return (
    <section
      className={`cancelled-orders-container${
        embedded ? " cancelled-orders-container--embedded" : ""
      }`}
    >
      <header className="cancelled-orders-header stack-sm">
        <div className="stack-xs">
          <h2 className="heading-md">Cancelled orders</h2>
          <p className="muted-text">
            A complete log of orders you cancelled. Review the reason, refund status, and item details
            anytime.
          </p>
        </div>
      </header>

      <div className="cancelled-orders-toolbar">
        <div className="cancelled-orders-search">
          <label htmlFor="cancelled-orders-search" className="visually-hidden">
            Search cancelled orders
          </label>
          <input
            id="cancelled-orders-search"
            type="search"
            placeholder="Search by product, contact, or reason"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="cancelled-orders-refresh"
          onClick={fetchCancelledOrders}
          disabled={loading}
        >
          Refresh list
        </button>
      </div>

      {error && (
        <div className="status-banner status-banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="cancelled-orders-list">
        {displayedOrders.length ? (
          displayedOrders.map((order) => {
            const suffix = String(order?._id || "").slice(-6) || "";
            const items = Array.isArray(order?.items) ? order.items : [];
            const cancelledOn = formatDate(order?.cancelledAt || order?.updatedAt);
            const reason = order?.cancelReason || "No reason provided";

            return (
              <article key={order?._id} className="cancelled-order-card">
                <header className="cancelled-order-card__header">
                  <div>
                    <div className="cancelled-order-card__title">
                      Order {suffix ? `#${suffix}` : ""}
                    </div>
                    <div className="cancelled-order-card__meta">Cancelled on {cancelledOn}</div>
                  </div>
                  <span className="cancelled-order-card__badge" aria-label="Order status: cancelled">
                    Cancelled
                  </span>
                </header>

                <div className="cancelled-order-card__body">
                  <div className="cancelled-order-card__column">
                    <span className="label">Contact</span>
                    <span className="value">{order?.contact || "Not provided"}</span>
                  </div>
                  <div className="cancelled-order-card__column">
                    <span className="label">Payment</span>
                    <span className="value">{order?.paymentMethod || "-"}</span>
                  </div>
                  <div className="cancelled-order-card__column">
                    <span className="label">Total</span>
                    <span className="value">{formatLKR(order?.totalAmount || 0)}</span>
                  </div>
                </div>

                <div className="cancelled-order-card__reason">
                  <span className="label">Cancellation reason</span>
                  <p>{reason}</p>
                </div>

                <div className="cancelled-order-card__items">
                  <span className="label">Items in this order</span>
                  {items.length ? (
                    <ul>
                      {items.map((item, idx) => (
                        <li key={`${item?.productId || idx}-${idx}`}>
                          <div className="item-name">{item?.productName || "Unnamed product"}</div>
                          <div className="item-meta">
                            Qty {item?.quantity || 0} · {formatLKR(item?.price || 0)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="orders-empty-state">No items recorded for this order.</div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="orders-empty-state">{emptyStateMessage}</div>
        )}
      </div>
    </section>
  );
}

export default CancelledOrders;
