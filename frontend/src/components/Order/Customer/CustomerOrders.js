import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { formatLKR } from "../../../utils/currency";
import "./CustomerOrders.css";

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

const REFUND_REASONS = [
  "Received a damaged or defective product",
  "Received the wrong item",
  "Product quality was not as expected",
  "Item arrived late",
  "Accidental or duplicate purchase",
  "Other",
];

const CANCEL_REASON_OPTIONS = [
  "Change of Mind",
  "Change of Payment Method",
  "Other",
];

const ModalPortal = ({ children }) => {
  const [container] = useState(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    element.className = "refund-modal-root";
    return element;
  });

  useEffect(() => {
    if (!container || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.appendChild(container);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [container]);

  if (!container) return null;
  return createPortal(children, container);
};

const getStatusVariant = (status = "") => {
  const state = String(status).toLowerCase();
  if (state.includes("deliver")) return "delivered";
  if (state.includes("cancel")) return "cancelled";
  if (state.includes("confirm")) return "confirmed";
  if (state.includes("processing")) return "processing";
  return "pending";
};

const toTitleCase = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

function CustomerOrders({
  initialOrders = null,
  embedded = false,
  onOrdersChange,
  allowReceipts = false,
}) {
  const [orders, setOrders] = useState(() => initialOrders || []);
  const [allOrders, setAllOrders] = useState(() => initialOrders || []);
  const [loading, setLoading] = useState(() => (initialOrders ? false : true));
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [refunds, setRefunds] = useState([]);
  const [refundModal, setRefundModal] = useState(null);
  const [refundForm, setRefundForm] = useState({ reason: "", message: "" });
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundNotice, setRefundNotice] = useState({ type: "", message: "" });
  const [refundReply, setRefundReply] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: CANCEL_REASON_OPTIONS[0], message: "" });
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelNotice, setCancelNotice] = useState({ type: "", message: "" });

  const acceptedRefunds = useMemo(
    () =>
      refunds
        .filter((refund) => String(refund?.status || "").toLowerCase() === "accepted")
        .sort(
          (a, b) =>
            new Date(b?.decision?.decidedAt || b?.updatedAt || b?.createdAt || 0) -
            new Date(a?.decision?.decidedAt || a?.updatedAt || a?.createdAt || 0)
        ),
    [refunds]
  );

  const fetchRefunds = async () => {
    try {
  const token = getStoredToken();
      if (!token) return;
  const response = await fetch(`${API_ROOT}/api/refunds/mine`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to load refund requests");
      }
      const payload = await response.json();
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setRefunds(list);
    } catch (err) {
      console.warn("Failed to load refunds", err?.message || err);
    }
  };

  // ✅ Fetch user's orders with token
  useEffect(() => {
    let active = true;
  const token = getStoredToken();
    const fetchOrders = async () => {
      try {
        if (!token) throw new Error("You must login first");
  const response = await fetch(`${API_ROOT}/api/orders`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to fetch orders");
        }
        const data = await response.json();
        const ordersData = data.orders || [];
        if (!active) return;
        setOrders(ordersData);
        setAllOrders(ordersData);
        setError(null);
        onOrdersChange?.(ordersData);
      } catch (err) {
        if (!active) return;
        setError(err.message);
      } finally {
        if (active) setLoading(false);
      }

    };

    if (initialOrders) {
      setOrders(initialOrders);
      setAllOrders(initialOrders);
      setLoading(false);
    } else {
      setLoading(true);
      fetchOrders();
    }

    return () => {
      active = false;
    };
  }, [initialOrders, onOrdersChange]);

  useEffect(() => {
    fetchRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findLatestRefund = (orderId, productId) => {
    if (!orderId || !productId) return null;
    const orderKey = String(orderId);
    const productKey = String(productId);
    const candidates = refunds.filter((refund) => {
      const refundOrder = refund?.order?._id || refund?.order;
      const refundProduct =
        refund?.item?.productId?._id || refund?.item?.productId;
      return (
        String(refundOrder) === orderKey && String(refundProduct) === productKey
      );
    });
    if (!candidates.length) return null;
    return candidates.sort(
      (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
    )[0];
  };

  const resetRefundNotice = () => setRefundNotice({ type: "", message: "" });

  const closeRefundModal = () => {
    setRefundModal(null);
    setRefundForm({ reason: "", message: "" });
    setRefundSubmitting(false);
    setRefundReply("");
    setReplySubmitting(false);
    resetRefundNotice();
  };

  const resetCancelNotice = () => setCancelNotice({ type: "", message: "" });

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setCancelModal(null);
    setCancelForm({ reason: CANCEL_REASON_OPTIONS[0], message: "" });
    resetCancelNotice();
  };

  const openRefundModal = (order, item, existingOverride = null) => {
    const existing =
      existingOverride ||
      (order?._id && item?.productId ? findLatestRefund(order._id, item.productId) : null);

    setRefundModal({
      order,
      item,
      existing,
    });
    setRefundForm({ reason: "", message: "" });
    setRefundReply("");
    setReplySubmitting(false);
    resetRefundNotice();
  };

  const openCancelModal = (order) => {
    if (!order?._id) return;
    setCancelModal(order);
    setCancelForm({ reason: CANCEL_REASON_OPTIONS[0], message: "" });
    resetCancelNotice();
  };

  const openRefundFromList = (refund) => {
    if (!refund) return;

    const orderId = refund?.order?._id || refund?.order;
    const orderRecord = (allOrders || []).find(
      (entry) => String(entry?._id || "") === String(orderId || "")
    );

    const itemRecord = {
      productId: refund?.item?.productId,
      productName: refund?.item?.productName,
      quantity: refund?.item?.quantity,
      price: refund?.item?.price,
    };

    openRefundModal(orderRecord || { _id: orderId }, itemRecord, refund);
  };

  const handleRefundInput = (field, value) => {
    setRefundForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancelFieldChange = (field, value) => {
    setCancelForm((prev) => ({ ...prev, [field]: value }));
    resetCancelNotice();
  };

  const submitCancellation = async (event) => {
    event?.preventDefault?.();
    if (!cancelModal?._id) return;

    const selectedReason = cancelForm.reason || CANCEL_REASON_OPTIONS[0];
    const note = (cancelForm.message || "").trim();
    if (selectedReason === "Other" && !note) {
      setCancelNotice({ type: "error", message: "Please provide a reason under Other." });
      return;
    }

    const reasonText = note ? `${selectedReason}: ${note}` : selectedReason;

    try {
      resetCancelNotice();
      setCancelSubmitting(true);
      const token = getStoredToken();
      if (!token) {
        throw new Error("You must login first");
      }

      const response = await fetch(
        `${API_ROOT}/api/orders/cancel/${cancelModal._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cancelReason: reasonText }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to cancel order");
      }

      setOrders((prev) => prev.filter((o) => o._id !== cancelModal._id));
      setAllOrders((prev) => prev.filter((o) => o._id !== cancelModal._id));
      onOrdersChange?.((prev) => (prev || []).filter((o) => o._id !== cancelModal._id));
  setCancelSubmitting(false);
  setCancelModal(null);
  setCancelForm({ reason: CANCEL_REASON_OPTIONS[0], message: "" });
  resetCancelNotice();
      alert("Order cancelled successfully!");
    } catch (err) {
      setCancelSubmitting(false);
      setCancelNotice({ type: "error", message: err?.message || "Failed to cancel order." });
    }
  };

  const sendRefundReply = async (event) => {
    event?.preventDefault();
    const refundId = refundModal?.existing?._id;
    if (!refundId) return;

    const message = refundReply.trim();
    if (!message) {
      setRefundNotice({ type: "error", message: "Please enter a message before sending." });
      return;
    }

    setReplySubmitting(true);
    try {
  const token = getStoredToken();
      if (!token) throw new Error("You must be logged in to send a message");

      const response = await fetch(`${API_ROOT}/api/refunds/${refundId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to send message");
      }

      setRefunds((prev) =>
        prev.map((refund) => (refund._id === payload._id ? payload : refund))
      );
      setRefundModal((prev) => (prev ? { ...prev, existing: payload } : prev));
      setRefundReply("");
      setRefundNotice({ type: "success", message: "Message sent successfully." });
    } catch (err) {
      setRefundNotice({ type: "error", message: err?.message || "Failed to send message." });
    } finally {
      setReplySubmitting(false);
    }
  };

  const submitRefundRequest = async (event) => {
    event.preventDefault();
    if (!refundModal) return;

    const { order, item, existing } = refundModal;
    if (!order?._id || !item?.productId) return;

    if (existing && existing.status !== "declined") {
      setRefundNotice({
        type: "info",
        message: "This item already has an active refund request.",
      });
      return;
    }

    const reason = refundForm.reason.trim();
    if (!reason) {
      setRefundNotice({ type: "error", message: "Please select a reason." });
      return;
    }

    setRefundSubmitting(true);
    setRefundNotice({ type: "", message: "" });

    try {
  const token = getStoredToken();
      if (!token) throw new Error("You must be logged in to request a refund");

  const response = await fetch(`${API_ROOT}/api/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order._id,
          productId: item.productId,
          reason,
          message: refundForm.message.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to submit refund request");
      }

      setRefunds((prev) => [payload, ...prev]);
      setRefundModal({ order, item, existing: payload });
      setRefundSubmitting(false);
      setRefundForm({ reason: "", message: "" });
      setRefundNotice({
        type: "success",
        message: "Refund request submitted successfully.",
      });
    } catch (err) {
      setRefundSubmitting(false);
      setRefundNotice({
        type: "error",
        message: err?.message || "Failed to submit refund request.",
      });
    }
  };

  // ✅ Sort
  const handleSort = (field) => {
    if (!field) return;

    setSortField(field);
    let sortedOrders = [...orders];
    const orderMultiplier = sortOrder === "asc" ? 1 : -1;

    sortedOrders.sort((a, b) => {
      if (typeof a[field] === "string")
        return a[field].localeCompare(b[field]) * orderMultiplier;
      if (typeof a[field] === "number")
        return (a[field] - b[field]) * orderMultiplier;
      return 0;
    });

    setOrders(sortedOrders);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  // ✅ Navigate to Add Review page
  const handleAddReview = (productId, productName) => {
    if (!productId || productId.length !== 24) {
      alert("⚠️ Invalid productId, cannot review this item.");
      return;
    }

    navigate(
      `/add-review?productId=${productId}&productName=${encodeURIComponent(
        productName
      )}`
    );
  };

  const openReceipt = (url) => {
    if (!url) return;
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleGenerateReceipt = (orderId) => {
    if (!orderId) return;
    navigate(`/receipt/${orderId}`);
  };

  const handleUpdateOrder = (orderId) => {
    if (!orderId) return;
    navigate(`/update-order/${orderId}`);
  };

  // ⬇️ THESE RETURNS must stay inside the function
  if (loading) return <p>Loading orders...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div className={`orders-container${embedded ? " orders-container--embedded" : ""}`}>
      <header className="orders-header">
        <h3 className="heading-sm">Order history</h3>
        <p className="muted-text">Review purchases, track fulfilment, and leave feedback.</p>
      </header>

      <div className="orders-toolbar">
        <div className="sort-dropdown">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sortField} onChange={(e) => handleSort(e.target.value)}>
            <option value="">Select</option>
            <option value="totalAmount">Total amount</option>
            <option value="status">Status</option>
            <option value="contact">Contact</option>
          </select>
        </div>
      </div>

      <div className="orders-list">
        {orders.length > 0 ? (
          orders.map((order, index) => {
            const statusVariant = getStatusVariant(order.status);
            const suffix = String(order?._id || "").slice(-6) || "…";
            const placedOn = order?.createdAt
              ? new Date(order.createdAt).toLocaleString()
              : "Date unavailable";
            const items = Array.isArray(order.items) ? order.items : [];
            const acceptedItems = items.filter((item) => {
              const refund = findLatestRefund(order._id, item.productId);
              return String(refund?.status || "").toLowerCase() === "accepted";
            });
            const visibleItems = items.filter((item) => {
              const refund = findLatestRefund(order._id, item.productId);
              return String(refund?.status || "").toLowerCase() !== "accepted";
            });
            const totalAmount = formatLKR(order.totalAmount);
            const canCancel = statusVariant !== "cancelled" && (order.status || "") !== "Canceled";
            const paymentStatusRaw = order?.paymentInfo?.paymentStatus;
            const paymentStatusLabel = paymentStatusRaw ? toTitleCase(paymentStatusRaw) : null;
            const paymentStatusNormalized = String(paymentStatusRaw || "").toLowerCase();
            const paymentComplete = paymentStatusNormalized === "paid";
            const receiptUrl = order?.paymentInfo?.receiptUrl;
            const slipUrl = order?.paymentInfo?.slipUrl;
            const receiptSourceUrl = paymentComplete ? receiptUrl || slipUrl : slipUrl;
            const canDownloadReceipt = allowReceipts && Boolean(receiptSourceUrl);
            const paymentMethodLabel = order?.paymentMethod || "-";
            const canUpdate = statusVariant === "pending";
            const isConfirmed = statusVariant === "confirmed";

            return (
              <article
                key={order?._id || `${suffix}-${index}`}
                className={`order-card order-card--${statusVariant}`}
              >
                <header className="order-card__header">
                  <div>
                    <div className="order-card__title">Order #{suffix}</div>
                    <div className="order-card__meta">Placed {placedOn}</div>
                  </div>
                  <div className={`order-card__status order-card__status--${statusVariant}`}>
                    {order.status || "Pending"}
                  </div>
                </header>

                <div className="order-card__body">
                  <div className="order-card__column">
                    <span className="order-card__label">Contact</span>
                    <span className="order-card__value">{order.contact || "Not provided"}</span>
                  </div>
                  <div className="order-card__column">
                    <span className="order-card__label">Payment</span>
                    <span className="order-card__value">
                      {paymentMethodLabel}
                      {paymentStatusLabel && (
                        <span className="order-card__subvalue">• {paymentStatusLabel}</span>
                      )}
                    </span>
                  </div>
                  <div className="order-card__total">
                    <span className="order-card__label">Total</span>
                    <span className="order-card__total-value">{totalAmount}</span>
                  </div>
                </div>

                <div className="order-card__items">
                  {visibleItems.length ? (
                    visibleItems.map((item, idx) => {
                      const productName = item.productName || "Unnamed product";
                      const productId = item.productId;
                      const canReview = typeof productId === "string" && productId.length === 24;
                      const refundRequest = findLatestRefund(order._id, productId);
                      const refundStatus = refundRequest?.status;
                      const refundStatusLabel = refundStatus ? toTitleCase(refundStatus) : null;
                      const showRefundButton = isConfirmed || Boolean(refundRequest);
                      const showReviewButton = isConfirmed && canReview;

                      return (
                        <div key={productId || idx} className="order-item">
                          <div>
                            <div className="order-item__name">{productName}</div>
                            <div className="order-item__meta">
                              Qty {item.quantity} · {formatLKR(item.price)}
                            </div>
                          </div>
                          <div className="order-item__buttons">
                            {refundStatusLabel && (
                              <span
                                className={`refund-status-badge refund-status-badge--${refundStatus}`}
                                title={`Refund status: ${refundStatusLabel}`}
                              >
                                {refundStatusLabel}
                              </span>
                            )}
                            {showRefundButton && (
                              <button
                                type="button"
                                className="order-item__refund"
                                onClick={() => openRefundModal(order, item)}
                              >
                                {refundRequest ? "View refund" : "Request refund"}
                              </button>
                            )}
                            {canDownloadReceipt && (
                              <button
                                type="button"
                                className="order-item__receipt"
                                onClick={() => openReceipt(receiptSourceUrl)}
                              >
                                {paymentComplete ? "Download receipt" : "View payment slip"}
                              </button>
                            )}
                            {showReviewButton && (
                              <button
                                type="button"
                                className="order-item__review"
                                onClick={() => handleAddReview(productId, productName)}
                              >
                                Leave review
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : acceptedItems.length ? (
                    <div className="orders-empty-state">
                      All items in this order have approved refunds. You can manage them in the
                      refunded items section below.
                    </div>
                  ) : (
                    <div className="orders-empty-state">No items recorded for this order.</div>
                  )}
                </div>

                <footer className="order-card__footer">
                  <div className="order-card__actions">
                    <div className="order-card__action-group">
                      {paymentComplete && (
                        <button
                          type="button"
                          className="order-card__action order-card__action--receipt"
                          onClick={() => handleGenerateReceipt(order._id)}
                        >
                          📄 Generate Receipt
                        </button>
                      )}
                      {canDownloadReceipt && (
                        <button
                          type="button"
                          className="order-card__action order-card__action--receipt"
                          onClick={() => openReceipt(receiptSourceUrl)}
                        >
                          {paymentComplete ? "Download receipt" : "View payment slip"}
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          className="order-card__action order-card__action--pill"
                          onClick={() => handleUpdateOrder(order._id)}
                        >
                          Update order
                        </button>
                      )}
                      {canCancel ? (
                        <button
                          type="button"
                          className="order-card__action order-card__action--pill order-card__action--cancel"
                          onClick={() => openCancelModal(order)}
                        >
                          Cancel order
                        </button>
                      ) : (
                        <span className="order-card__note">This order can no longer be cancelled.</span>
                      )}
                    </div>
                    {!canDownloadReceipt && allowReceipts && !paymentComplete && (
                      <span className="order-card__note">
                        Receipts or payment slips will appear once your payment is processed.
                      </span>
                    )}
                  </div>
                </footer>
              </article>
            );
          })
        ) : (
          <div className="orders-empty-state">
            No orders yet. Add items to your cart and complete checkout to see them here.
          </div>
        )}
      </div>

      {acceptedRefunds.length > 0 && (
        <section className="refunded-items card">
          <header className="refunded-items__header">
            <div className="stack-xs">
              <h4 className="heading-sm">Refunded items</h4>
              <p className="muted-text">
                Items with approved refunds move here so you can revisit the details anytime.
              </p>
            </div>
            <span className="refunded-items__count" aria-label="Approved refunds count">
              {acceptedRefunds.length}
            </span>
          </header>

          <div className="refunded-items__list">
            {acceptedRefunds.map((refund) => {
              const amount = formatLKR(
                (refund?.item?.price || 0) * (refund?.item?.quantity || 1)
              );
              const decidedAt =
                refund?.decision?.decidedAt || refund?.updatedAt || refund?.createdAt;
              const decidedLabel = decidedAt ? new Date(decidedAt).toLocaleString() : "";
              const orderId = refund?.order?._id || refund?.order;
              const orderSuffix = orderId ? String(orderId).slice(-6) : null;

              return (
                <article key={refund._id} className="refunded-item">
                  <div className="refunded-item__info">
                    <div className="refunded-item__name">
                      {refund?.item?.productName || "Refunded item"}
                    </div>
                    <div className="refunded-item__meta">
                      <span>Qty {refund?.item?.quantity || 1}</span>
                      <span aria-hidden="true">•</span>
                      <span>{amount}</span>
                      {orderSuffix && (
                        <>
                          <span aria-hidden="true">•</span>
                          <span>Order #{orderSuffix}</span>
                        </>
                      )}
                    </div>
                    {decidedLabel && (
                      <div className="refunded-item__date">Approved {decidedLabel}</div>
                    )}
                  </div>
                  <div className="refunded-item__actions">
                    <button
                      type="button"
                      className="order-item__refund"
                      onClick={() => openRefundFromList(refund)}
                    >
                      View refund
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {cancelModal ? (
        <ModalPortal>
          <div className="refund-modal" role="dialog" aria-modal="true">
            <div
              className="refund-modal__backdrop"
              onClick={cancelSubmitting ? undefined : closeCancelModal}
              aria-hidden="true"
            />
            <div className="refund-modal__content card">
              <div className="refund-modal__header">
                <div>
                  <h4>Cancel order</h4>
                  <p className="muted-text">Let us know why you’re cancelling.</p>
                </div>
                <button
                  type="button"
                  className="refund-modal__close"
                  onClick={closeCancelModal}
                  disabled={cancelSubmitting}
                  aria-label="Close cancellation dialog"
                >
                  ×
                </button>
              </div>

              {cancelNotice.message && (
                <div className={`refund-alert refund-alert--${cancelNotice.type || "info"}`}>
                  {cancelNotice.message}
                </div>
              )}

              <form className="refund-form stack-md" onSubmit={submitCancellation}>
                <div className="form-field">
                  <label htmlFor="cancel-reason">Reason</label>
                  <select
                    id="cancel-reason"
                    value={cancelForm.reason}
                    onChange={(event) => handleCancelFieldChange("reason", event.target.value)}
                    disabled={cancelSubmitting}
                    required
                  >
                    {CANCEL_REASON_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="cancel-message">Additional details</label>
                  <textarea
                    id="cancel-message"
                    rows={3}
                    value={cancelForm.message}
                    onChange={(event) => handleCancelFieldChange("message", event.target.value)}
                    placeholder="Share more context for our team (required when selecting Other)."
                    disabled={cancelSubmitting}
                  />
                </div>

                <div className="refund-form__actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={closeCancelModal}
                    disabled={cancelSubmitting}
                  >
                    Keep order
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={cancelSubmitting}>
                    {cancelSubmitting ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {refundModal ? (
        <ModalPortal>
          <div className="refund-modal" role="dialog" aria-modal="true">
            <div
              className="refund-modal__backdrop"
              onClick={refundSubmitting ? undefined : closeRefundModal}
              aria-hidden="true"
            />
            <div className="refund-modal__content card">
              <div className="refund-modal__header">
                <div>
                  <h4>Refund request</h4>
                  <p className="muted-text">{refundModal.item?.productName || "Selected item"}</p>
                </div>
                <button
                  type="button"
                  className="refund-modal__close"
                  onClick={closeRefundModal}
                  disabled={refundSubmitting}
                  aria-label="Close refund dialog"
                >
                  ×
                </button>
              </div>

              {refundNotice.message && (
                <div className={`refund-alert refund-alert--${refundNotice.type || "info"}`}>
                  {refundNotice.message}
                </div>
              )}

              {refundModal.existing && (
                <section className="refund-modal__existing stack-sm">
                  <div className="refund-existing__status">
                    <span className="refund-existing__label">Current status</span>
                    <span
                      className={`refund-status-badge refund-status-badge--${refundModal.existing.status}`}
                    >
                      {toTitleCase(refundModal.existing.status)}
                    </span>
                  </div>
                  <div className="refund-existing__reason">
                    <span className="refund-existing__label">Reason provided</span>
                    <p>{refundModal.existing.reason}</p>
                  </div>
                  {refundModal.existing.message && (
                    <div className="refund-existing__reason">
                      <span className="refund-existing__label">Customer note</span>
                      <p>{refundModal.existing.message}</p>
                    </div>
                  )}

                  {Array.isArray(refundModal.existing.messages) && refundModal.existing.messages.length > 0 && (
                    <div className="refund-thread">
                      <span className="refund-existing__label">Conversation</span>
                      <ul className="refund-thread__list">
                        {refundModal.existing.messages.map((entry, idx) => (
                          <li key={`${entry.createdAt || idx}-${idx}`}>
                            <div className="refund-thread__meta">
                              <strong>{entry.authorType === "staff" ? "Team" : "You"}</strong>
                              <span>
                                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
                              </span>
                            </div>
                            <p>{entry.message}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {refundModal.existing && refundModal.existing.status !== "declined" && (
                <form className="refund-form stack-md" onSubmit={sendRefundReply}>
                  <div className="form-field">
                    <label htmlFor="refund-reply-message">Send a message to our team</label>
                    <textarea
                      id="refund-reply-message"
                      rows={3}
                      value={refundReply}
                      onChange={(event) => setRefundReply(event.target.value)}
                      placeholder="Share updates or answer any questions from our team."
                      disabled={replySubmitting}
                    />
                  </div>
                  <div className="refund-form__actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={closeRefundModal}
                      disabled={replySubmitting}
                    >
                      Close
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={replySubmitting}>
                      {replySubmitting ? "Sending..." : "Send message"}
                    </button>
                  </div>
                </form>
              )}

              {(!refundModal.existing || refundModal.existing.status === "declined") && (
                <form className="refund-form stack-md" onSubmit={submitRefundRequest}>
                  <div className="form-field">
                    <label htmlFor="refund-reason">Reason for refund</label>
                    <select
                      id="refund-reason"
                      value={refundForm.reason}
                      onChange={(event) => handleRefundInput("reason", event.target.value)}
                      disabled={refundSubmitting}
                      required
                    >
                      <option value="">Select a reason</option>
                      {REFUND_REASONS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="refund-message">Additional details (optional)</label>
                    <textarea
                      id="refund-message"
                      rows={4}
                      value={refundForm.message}
                      onChange={(event) => handleRefundInput("message", event.target.value)}
                      placeholder="Share any details that can help us process your request quickly."
                      disabled={refundSubmitting}
                    />
                  </div>
                  <div className="refund-form__actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={closeRefundModal}
                      disabled={refundSubmitting}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={refundSubmitting}>
                      {refundSubmitting ? "Sending..." : "Submit refund request"}
                    </button>
                  </div>
                </form>
              )}

              {refundModal.existing && refundModal.existing.status !== "declined" && (
                <div className="refund-existing__footnote">
                  We'll notify you by email and in the app when there is an update on your refund request.
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}

export default CustomerOrders;
