import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {api} from "./api";
import StarRating from '../StarRating';

function Item({ item, onDeleted, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // inline edit state
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(item.rating);
  const [title, setTitle] = useState(item.title || '');
  const [comment, setComment] = useState(item.comment || '');
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (editing) {
      setRating(item.rating);
      setTitle(item.title || '');
      setComment(item.comment || '');
      setErrors([]);
      setErr('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, item._id]);

  const validate = () => {
    const e = [];
    if (!(rating >= 1 && rating <= 5)) e.push('Rating must be 1..5');
    if (title.length > 200) e.push('Title is too long (max 200)');
    const c = comment.trim();
    if (c.length < 5) e.push('Comment must be at least 5 characters');
    if (c.length > 3000) e.push('Comment is too long (max 3000)');
    setErrors(e);
    return e.length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true); setErr('');
    try {
      const { data } = await api.patch(`/reviews/${item._id}`, { rating, title, comment });
      onUpdated?.(data);
      setEditing(false);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Server error');
      setErrors(e?.response?.data?.errors || []);
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this review?')) return;
    setBusy(true); setErr('');
    try {
      await api.delete(`/reviews/${item._id}`);
      onDeleted?.(item._id);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="border border-slate-800 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{item.targetName || item.targetKey}</div>
          <div className="text-xs text-slate-400">ID: {item.targetKey || item.targetId}</div>
        </div>

        {!editing ? (
          <div className="flex items-center gap-2">
            <StarRating value={item.rating} readOnly />
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1 bg-indigo-400 hover:bg-indigo-300 text-slate-900 rounded disabled:opacity-60"
              disabled={busy}
            >
              Edit
            </button>
            <button
              onClick={remove}
              className="px-3 py-1 bg-rose-500/90 hover:bg-rose-400 text-slate-900 rounded disabled:opacity-60"
              disabled={busy}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              className="px-3 py-1 bg-emerald-400 hover:bg-emerald-300 text-slate-900 rounded disabled:opacity-60"
              disabled={busy}
              title="Save changes"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setErrors([]); setErr(''); }}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded disabled:opacity-60"
              disabled={busy}
              title="Cancel editing"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <>
          {item.title && <div className="mt-2 text-slate-200">{item.title}</div>}
          {item.comment && <div className="mt-1 text-slate-300 text-sm whitespace-pre-wrap">{item.comment}</div>}
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <label className="w-28 text-slate-300">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div className="flex items-center gap-3">
            <label className="w-28 text-slate-300">Title</label>
            <input
              className="flex-1 bg-slate-950 border border-slate-700 rounded p-2"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3">
            <label className="w-28 text-slate-300 mt-2">Comment</label>
            <textarea
              className="flex-1 bg-slate-950 border border-slate-700 rounded p-2"
              rows={5}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={3000}
            />
          </div>

          {errors.length > 0 && (
            <ul className="bg-amber-900/30 border border-amber-700 text-amber-200 rounded p-3">
              {errors.map((x, i) => <li key={i}>• {x}</li>)}
            </ul>
          )}
        </div>
      )}

      {err && <div className="text-rose-400 mt-2 text-sm">❌ {err}</div>}
      <div className="text-xs text-slate-500 mt-2">
        #{item.reviewNo} • {new Date(item.updatedAt || item.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

export default function MyReviews() {
  const [searchParams] = useSearchParams();
  const presetKey = searchParams.get('targetKey') || ''; // optional filter from “View reviews” button

  const [q, setQ] = useState(presetKey ? `ID:${presetKey}` : '');
  const [debouncedQ, setDebouncedQ] = useState(presetKey ? `ID:${presetKey}` : '');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = async (p = 1, qArg) => {
    const qVal = (qArg ?? debouncedQ) || '';
    setBusy(true); setErr('');
    try {
      const { data } = await api.get('/reviews', {
        params: { mine: true, page: p, limit: 10, q: qVal || undefined }
      });
      setItems(data.data || []);
      setPage(data.page || 1);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  useEffect(() => { load(1); /* eslint-disable-line */ }, [debouncedQ]);

  const onDeleted = (id) => {
    setItems((arr) => arr.filter((x) => x._id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const onUpdated = (updated) => {
    setItems((arr) => arr.map((x) => (x._id === updated._id ? updated : x)));
  };

  const hasResults = useMemo(() => items.length > 0, [items]);
  const submitSearch = () => load(1, q.trim());
  const onKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitSearch(); } };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">My Reviews</h2>

      <div className="mb-4 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder='Search by product name, product ID (e.g. "ID:PRD-0002"), title, or comment'
          className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2"
        />
        <button
          onClick={submitSearch}
          className="px-3 py-2 bg-indigo-400 text-slate-900 rounded font-semibold"
          disabled={busy}
        >
          Search
        </button>
      </div>

      {busy && <div className="text-slate-400 mb-3">Loading…</div>}
      {err && <div className="text-rose-400 mb-3">❌ {err}</div>}
      <div className="text-slate-400 text-sm mb-2">{total} result{total === 1 ? '' : 's'}</div>

      {hasResults ? (
        <div className="space-y-3">
          {items.map((it) => (
            <Item key={it._id} item={it} onDeleted={onDeleted} onUpdated={onUpdated} />
          ))}
        </div>
      ) : (
        <div className="text-slate-400">No reviews found.</div>
      )}

      {pages > 1 && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { if (page > 1) load(page - 1); }}
            className="px-3 py-1 border border-slate-700 rounded disabled:opacity-50"
            disabled={page <= 1 || busy}
          >
            Prev
          </button>
          <div className="px-3 py-1 text-slate-300">Page {page} / {pages}</div>
          <button
            onClick={() => { if (page < pages) load(page + 1); }}
            className="px-3 py-1 border border-slate-700 rounded disabled:opacity-50"
            disabled={page >= pages || busy}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
