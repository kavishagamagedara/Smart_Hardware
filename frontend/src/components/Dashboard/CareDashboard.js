// src/Components/Dashboards/CustomerCareDashboard.js


import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import ReplyModal from "./ReplyModal";
import NotificationsPanel from "../Notifications/NotificationsPanel";
import AdminReviewRecycleBin from "../Reviews_&_Feedback/AdminReviewRecycleBin";

const API = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api";

export default function CustomerCareDashboard() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState("reviews");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyFor, setReplyFor] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fetch all product reviews
  useEffect(() => {
    if (tab !== "reviews" || !token) return;
    setLoading(true);
    setErr("");
    (async () => {
      try {
        const res = await fetch(`${API}/reviews?targetType=Product&status=public&sort=-createdAt&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load reviews");
        setReviews(Array.isArray(data.data) ? data.data : data);
      } catch (e) {
        setErr(e.message);
        setReviews([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, tab]);

  // Send reply to a review
  const sendReply = async (message) => {
    if (!replyFor || !message.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/reviews/${replyFor._id}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(user?._id ? { "x-user-id": user._id } : {}),
          ...(user?.role ? { "x-user-role": user.role } : {}),
          ...(user?.name ? { "x-user-name": user.name } : {}),
        },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to send reply");
      setReviews((prev) => prev.map((r) => (r._id === replyFor._id ? data : r)));
      setReplyOpen(false);
      setReplyFor(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <header className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-xl font-black">Customer Care Manager</h2>
        <div className="flex gap-2 mt-2 sm:mt-0">
          <button
            className={`btn btn-sm ${tab === "reviews" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("reviews")}
          >Reviews</button>
          <button
            className={`btn btn-sm ${tab === "notifications" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("notifications")}
          >Notifications</button>
          <button
            className={`btn btn-sm ${tab === "recycle" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("recycle")}
          >Recycle Bin</button>
        </div>
      </header>

  {tab === "reviews" && (
        <div className="card overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="text-left">
                <th>Date</th>
                <th>User</th>
                <th>Product</th>
                <th>Rating</th>
                <th>Title</th>
                <th>Comment</th>
                <th>Replies</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-6 text-center text-slate-500">Loading…</td></tr>
              ) : err ? (
                <tr><td colSpan={8} className="py-6 text-center text-rose-500">{err}</td></tr>
              ) : reviews.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-center text-slate-500">No reviews yet</td></tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r._id} className="border-t border-white/10 align-top">
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                    <td>{r.userName || r.user?.name || "-"}</td>
                    <td>{r.targetName || r.targetKey || "-"}</td>
                    <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                    <td>{r.title || "-"}</td>
                    <td className="max-w-[280px] whitespace-pre-wrap">{r.comment}</td>
                    <td>
                      {Array.isArray(r.replies) && r.replies.length > 0 ? (
                        <ul className="space-y-2">
                          {r.replies.map((rep, idx) => (
                            <li key={rep._id || idx} className="bg-slate-100 dark:bg-slate-800 rounded p-2">
                              <div className="text-xs text-slate-500 mb-1">{rep.adminName || "Admin"} • {rep.createdAt ? new Date(rep.createdAt).toLocaleString() : "-"}</div>
                              <div>{rep.message}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">No replies</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => { setReplyFor(r); setReplyOpen(true); }}
                      >Reply</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}


      {tab === "notifications" && (
        <div className="card">
          <NotificationsPanel scope="care" />
        </div>
      )}

      {tab === "recycle" && (
        <div className="card">
          <AdminReviewRecycleBin />
        </div>
      )}

      <ReplyModal open={replyOpen} onClose={() => { setReplyOpen(false); setReplyFor(null); }} onSubmit={sendReply} />
    </div>
  );
}
