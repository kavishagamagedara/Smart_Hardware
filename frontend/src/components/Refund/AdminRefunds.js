import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { formatLKR } from "../../utils/currency";
import "./MyRefunds.css";
import "./AdminRefunds.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const STATUS_OPTIONS = ["all", "pending", "processing", "accepted", "declined"];

const statusTone = {
  pending: "badge badge-amber",
  processing: "badge badge-blue",
  accepted: "badge badge-green",
  declined: "badge badge-red",
};

const prettyStatus = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const hasPermission = (user, perms = []) => {
  const role = String(user?.role || "").toLowerCase();
  if (role === "admin") return true;
  const existing = Array.isArray(user?.permissions) ? user.permissions : [];
  const set = new Set(existing.map((p) => String(p || "").toLowerCase()));
  return perms.some((p) => set.has(String(p || "").toLowerCase()));
};

const conversationLabel = (entry) =>
  entry?.authorType === "staff" ? entry?.author?.name || "Team" : entry?.author?.name || "Customer";

const timelineSort = (history = []) =>
  [...history].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));

export default function AdminRefunds() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refunds, setRefunds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [filters, setFilters] = useState({ status: "pending", search: "" });
  const skipStatusFetch = useRef(false);

  const canManage = useMemo(
    () => hasPermission(user, ["refund_manage_requests", "cc_manage_returns", "moderate_feedback"]),
    [user]
  );

  const selectedRefund = useMemo(
    () => refunds.find((refund) => refund?._id === selectedId) || null,
    [refunds, selectedId]
  );

  const hasActiveFilters = useMemo(() => {
    const searchTerm = filters.search?.trim();
    return filters.status !== "all" || Boolean(searchTerm);
  }, [filters]);

  const resultSummary = useMemo(() => {
    if (loading) return "Loading refund requests…";
    if (!refunds.length) {
      return hasActiveFilters ? "No requests match the current filters" : "No refund requests found";
    }
    return refunds.length === 1 ? "Showing 1 refund request" : `Showing ${refunds.length} refund requests`;
  }, [hasActiveFilters, loading, refunds.length]);

  const buildQuery = (state) => {
    const params = new URLSearchParams();
    const source = state || filters;
    const status = source.status;
    const search = source.search;
    if (status && status !== "all") params.set("status", status);
    if (search) params.set("search", search.trim());
    return params.toString();
  };

  const fetchRefunds = async (overrideFilters) => {
    try {
      setLoading(true);
      setError("");
      const query = buildQuery(overrideFilters);
      const response = await fetch(`${API_ROOT}/api/refunds${query ? `?${query}` : ""}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to load refund requests");
      }
      const payload = await response.json();
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setRefunds(list);
      if (list.length) {
        setSelectedId((prev) => (prev && list.some((refund) => refund._id === prev) ? prev : list[0]._id));
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err?.message || "Unable to load refund requests");
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    if (!hasActiveFilters) return;
    const defaults = { status: "all", search: "" };
    skipStatusFetch.current = true;
    setFilters(defaults);
    fetchRefunds(defaults);
  };

  useEffect(() => {
    if (!token) {
      setError("Unauthorized");
      setLoading(false);
      return;
    }
    if (skipStatusFetch.current) {
      skipStatusFetch.current = false;
      return;
    }
    fetchRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status]);

  const performAction = async ({ status, message }) => {
    if (!selectedRefund) return;
    if (!canManage && status) {
      alert("You do not have permission to change refund status.");
      return;
    }

    if (!message && !status) {
      alert("Add a message or pick an action.");
      return;
    }

    setActionBusy(true);
    try {
      const body = {};
      if (message) body.message = message;
      if (status) body.status = status;
      const response = await fetch(`${API_ROOT}/api/refunds/${selectedRefund._id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Action failed");
      }
      setRefunds((prev) => prev.map((refund) => (refund._id === payload._id ? payload : refund)));
      setSelectedId(payload._id);
      setReplyText("");
    } catch (err) {
      alert(err?.message || "Failed to update refund request");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    fetchRefunds();
  };

  const selectedAmount = selectedRefund
    ? formatLKR((selectedRefund.item?.price || 0) * (selectedRefund.item?.quantity || 1))
    : null;
  const selectedQuantity = selectedRefund?.item?.quantity || 1;

  return (
    <section className="admin-refunds stack-lg">
      <header className="stack-xs">
        <h3 className="heading-md">Refunds &amp; returns</h3>
        <p className="muted-text">
          Review customer refund requests, collaborate with the team, and keep customers informed.
        </p>
      </header>

  <div className="card stack-md admin-refunds__panel">
        <form className="refunds-toolbar admin-refunds__toolbar" onSubmit={handleSearchSubmit}>
          <div className="refunds-toolbar__group">
            <label className="refunds-detail__label" htmlFor="refund-status-filter">
              Filter by status
            </label>
            <select
              id="refund-status-filter"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {prettyStatus(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="refunds-toolbar__search">
            <label className="refunds-detail__label" htmlFor="refund-search">
              Search
            </label>
            <div className="refunds-toolbar__search-row">
              <input
                id="refund-search"
                type="search"
                placeholder="Search by product, reason, or note"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
              <button type="submit" className="btn btn-primary" disabled={loading && !refunds.length}>
                {loading && hasActiveFilters ? "Searching" : "Search"}
              </button>
            </div>
          </div>
          <div className="refunds-toolbar__actions">
            {hasActiveFilters && (
              <button type="button" className="btn btn-ghost" onClick={clearFilters} disabled={loading}>
                Clear filters
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => fetchRefunds()} disabled={loading}>
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </form>

        <div className="admin-refunds__summary">
          <div className="admin-refunds__summary-text">
            <span className="admin-refunds__summary-count">{resultSummary}</span>
            <span className="admin-refunds__summary-meta">
              {filters.status === "all"
                ? "All statuses included"
                : `Filtered by ${prettyStatus(filters.status)} status`}
            </span>
          </div>
          <div className="admin-refunds__summary-tags">
            <span className="admin-refunds__chip admin-refunds__chip--status">
              {filters.status === "all" ? "All statuses" : prettyStatus(filters.status)}
            </span>
            {filters.search ? (
              <span className="admin-refunds__chip admin-refunds__chip--search" title="Active search term">
                “{filters.search.trim()}”
              </span>
            ) : null}
          </div>
        </div>

        {error && <div className="status-banner status-banner--error">{error}</div>}

        {loading ? (
          <p>Loading refund requests…</p>
        ) : refunds.length === 0 ? (
          <div className="orders-empty-state">No refund requests match your filters.</div>
        ) : (
          <div className="refunds-layout admin-refunds__grid">
            <aside className="refunds-list admin-refunds__list">
              <header className="admin-refunds__list-header">
                <span className="admin-refunds__list-title">Refund requests</span>
                <span className="admin-refunds__list-count">{refunds.length}</span>
              </header>
              <div className="admin-refunds__list-scroll">
                {refunds.map((refund) => {
                const status = String(refund.status || "pending").toLowerCase();
                const statusClass = statusTone[status] || "badge";
                const amount = formatLKR((refund.item?.price || 0) * (refund.item?.quantity || 1));
                const created = refund.createdAt
                  ? new Date(refund.createdAt).toLocaleString()
                  : "";

                  return (
                    <button
                      key={refund._id}
                      type="button"
                      onClick={() => setSelectedId(refund._id)}
                      className={`refunds-list__item ${
                        refund._id === selectedId ? "is-active" : ""
                      }`}
                    >
                      <div className="refunds-list__head">
                        <span className={statusClass}>{prettyStatus(status)}</span>
                        <span className="refunds-list__date">{created}</span>
                      </div>
                      <div className="refunds-list__title">{refund.item?.productName}</div>
                      <div className="refunds-list__meta">
                        Qty {refund.item?.quantity || 1} · {amount}
                      </div>
                      <div className="refunds-list__meta refunds-list__meta--customer">
                        Customer: {refund.user?.name || "Unknown"}
                      </div>
                      {refund.reason && (
                        <div className="refunds-list__reason" title={refund.reason}>
                          {refund.reason}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            <article className="refunds-detail admin-refunds__detail stack-md">
              {selectedRefund ? (
                <>
                  <header className="stack-xs">
                    <h3>{selectedRefund.item?.productName}</h3>
                    <div className="refunds-detail__status">
                      <span className="refunds-detail__label">Status</span>
                      <span
                        className={`refund-status-badge refund-status-badge--${selectedRefund.status}`}
                      >
                        {prettyStatus(selectedRefund.status)}
                      </span>
                    </div>
                    <div className="refunds-detail__summary">
                      <span>Requested</span>
                      <span>
                        {selectedRefund.createdAt
                          ? new Date(selectedRefund.createdAt).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <div className="refunds-detail__summary">
                      <span>Customer</span>
                      <span>{selectedRefund.user?.name || "Unknown"}</span>
                    </div>
                    <div className="refunds-detail__summary">
                      <span>Order</span>
                      <span>{selectedRefund.order?._id || selectedRefund.order}</span>
                    </div>
                    <div className="admin-refunds__pill-row">
                      <div className="admin-refunds__pill">
                        <span>Amount</span>
                        <strong>{selectedAmount}</strong>
                      </div>
                      <div className="admin-refunds__pill">
                        <span>Quantity</span>
                        <strong>{selectedQuantity}</strong>
                      </div>
                    </div>
                  </header>

                  <section className="stack-sm">
                    <span className="refunds-detail__label">Reason</span>
                    <p>{selectedRefund.reason}</p>
                  </section>

                  {selectedRefund.message && (
                    <section className="stack-sm">
                      <span className="refunds-detail__label">Customer message</span>
                      <p>{selectedRefund.message}</p>
                    </section>
                  )}

                  {Array.isArray(selectedRefund.history) && selectedRefund.history.length > 0 && (
                    <section className="stack-sm">
                      <span className="refunds-detail__label">Timeline</span>
                      <ul className="refund-thread__list">
                        {timelineSort(selectedRefund.history).map((entry, idx) => (
                          <li key={`${entry.createdAt || idx}-${idx}`}>
                            <div className="refund-thread__meta">
                              <strong>{prettyStatus(entry.status)}</strong>
                              <span>
                                {entry.createdAt
                                  ? new Date(entry.createdAt).toLocaleString()
                                  : ""}
                              </span>
                            </div>
                            {entry.note && <p>{entry.note}</p>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {Array.isArray(selectedRefund.messages) && selectedRefund.messages.length > 0 && (
                    <section className="stack-sm">
                      <span className="refunds-detail__label">Conversation</span>
                      <div className="refund-thread">
                        <ul className="refund-thread__list">
                          {selectedRefund.messages.map((entry, idx) => (
                            <li key={`${entry.createdAt || idx}-${idx}`}>
                              <div className="refund-thread__meta">
                                <strong>{conversationLabel(entry)}</strong>
                                <span>
                                  {entry.createdAt
                                    ? new Date(entry.createdAt).toLocaleString()
                                    : ""}
                                </span>
                              </div>
                              <p>{entry.message}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}

                  <section className="stack-sm">
                    <label className="refunds-detail__label" htmlFor="refund-reply-admin">
                      Add a reply
                    </label>
                    <textarea
                      id="refund-reply-admin"
                      rows={3}
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder="Share updates or instructions for the customer"
                      disabled={actionBusy}
                    />
                    <div className="refund-form__actions" style={{ justifyContent: "space-between" }}>
                      <div className="stack-xs" style={{ flexDirection: "row", display: "flex", gap: 8 }}>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => performAction({ status: "processing", message: replyText.trim() || undefined })}
                              disabled={actionBusy}
                            >
                              Mark processing
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => performAction({ status: "accepted", message: replyText.trim() || undefined })}
                              disabled={actionBusy}
                            >
                              Accept refund
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => performAction({ status: "declined", message: replyText.trim() || undefined })}
                              disabled={actionBusy}
                            >
                              Decline refund
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => performAction({ message: replyText.trim() })}
                        disabled={actionBusy || !replyText.trim()}
                      >
                        {actionBusy ? "Sending" : "Send reply"}
                      </button>
                    </div>
                  </section>
                </>
              ) : (
                <div className="orders-empty-state">Select a refund request to review the details.</div>
              )}
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
