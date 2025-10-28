import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatLKR } from "../../utils/currency";
import "./MyRefunds.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const statusTone = {
	pending: "badge badge-amber",
	processing: "badge badge-blue",
	accepted: "badge badge-green",
	declined: "badge badge-red",
};

const prettyStatus = (value = "") => {
	const normalized = String(value).toLowerCase();
	return normalized
		.replace(/_/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
};

const conversationLabel = (entry) =>
	entry?.authorType === "staff" ? "Support" : entry?.author?.name || "You";

export default function MyRefunds() {
	const { token } = useAuth();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [refunds, setRefunds] = useState([]);
	const [selectedId, setSelectedId] = useState(null);
	const [replyText, setReplyText] = useState("");
	const [replyBusy, setReplyBusy] = useState(false);

	const selectedRefund = useMemo(
		() => refunds.find((refund) => refund?._id === selectedId) || null,
		[refunds, selectedId]
	);

	const fetchRefunds = async () => {
		try {
			setLoading(true);
			setError("");
			const response = await fetch(`${API_ROOT}/api/refunds/mine`, {
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
			if (list.length && !selectedId) {
				setSelectedId(list[0]._id);
			}
		} catch (err) {
			setError(err?.message || "Unable to load refund requests");
			setRefunds([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!token) {
			setLoading(false);
			setError("You need to be logged in to view refunds");
			return;
		}
		fetchRefunds();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token]);

	const handleReply = async (event) => {
		event.preventDefault();
		if (!selectedRefund || !replyText.trim()) return;
		setReplyBusy(true);
		try {
			const response = await fetch(`${API_ROOT}/api/refunds/${selectedRefund._id}/reply`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: token ? `Bearer ${token}` : undefined,
				},
				body: JSON.stringify({ message: replyText.trim() }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload?.message || "Failed to send reply");
			}

			setRefunds((prev) =>
				prev.map((refund) => (refund._id === payload._id ? payload : refund))
			);
			setReplyText("");
		} catch (err) {
			alert(err?.message || "Failed to send reply");
		} finally {
			setReplyBusy(false);
		}
	};

		return (
			<section className="my-refunds stack-lg">
			<header className="stack-sm">
				<h2 className="heading-md">Refunds &amp; returns</h2>
				<p className="muted-text">
					Track the status of your refund and return requests. You can add extra details for our
					team at any time.
				</p>
			</header>

			<div className="card stack-sm" style={{ padding: "20px" }}>
				<div className="refunds-toolbar">
					<div className="stack-xs">
						<strong>Need to start a new refund?</strong>
						<span>
							Visit your <Link to="/CustomerOrders">order history</Link> and choose the item you
							want to request a refund for.
						</span>
					</div>
					<button type="button" className="btn btn-secondary" onClick={fetchRefunds} disabled={loading}>
						{loading ? "Refreshing" : "Refresh"}
					</button>
				</div>

				{error && <div className="status-banner status-banner--error">{error}</div>}

				{loading ? (
					<p>Loading refund requests…</p>
				) : refunds.length === 0 ? (
					<div className="orders-empty-state">You have not submitted any refund requests yet.</div>
				) : (
					<div className="refunds-layout">
						<aside className="refunds-list">
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
									</button>
								);
							})}
						</aside>

						<article className="refunds-detail">
							{selectedRefund ? (
								<div className="stack-md">
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
											<span>Requested on</span>
											<span>
												{selectedRefund.createdAt
													? new Date(selectedRefund.createdAt).toLocaleString()
													: ""}
											</span>
										</div>
									</header>

									<section className="stack-sm">
										<span className="refunds-detail__label">Reason</span>
										<p>{selectedRefund.reason}</p>
									</section>

									{selectedRefund.message && (
										<section className="stack-sm">
											<span className="refunds-detail__label">Your note</span>
											<p>{selectedRefund.message}</p>
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

									<form className="refund-reply stack-sm" onSubmit={handleReply}>
										<label htmlFor="refund-reply">Add an update for our team</label>
										<textarea
											id="refund-reply"
											rows={3}
											placeholder="Provide more context or attach additional details."
											value={replyText}
											onChange={(event) => setReplyText(event.target.value)}
											disabled={replyBusy}
										/>
										<div className="refund-form__actions">
											<button type="submit" className="btn btn-primary" disabled={replyBusy || !replyText.trim()}>
												{replyBusy ? "Sending…" : "Send update"}
											</button>
										</div>
									</form>
								</div>
							) : (
								<div className="orders-empty-state">Select a refund request to see the details.</div>
							)}
						</article>
					</div>
				)}
			</div>
		</section>
	);
}
