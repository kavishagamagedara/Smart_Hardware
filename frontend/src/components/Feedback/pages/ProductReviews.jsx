import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from './api.js';
import StarRating from '../StarRating.jsx';

export default function ProductReviews() {
  const { targetKey } = useParams();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [productName, setProductName] = useState('');

  const load = async (p = 1) => {
    setBusy(true); setErr('');
    try {
      const { data } = await api.get('/SubmitReview', {
        params: { targetKey, page: p, limit: 10, sort: '-createdAt' } // public list (status=public enforced by backend)
      });
      setItems(data.data || []);
      setPage(data.page || 1);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setProductName(data.data?.[0]?.targetName || '');
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  useEffect(() => { load(1); /* eslint-disable-line */ }, [targetKey]);

  const avg = useMemo(() => {
    if (!items.length) return 0;
    return Math.round((items.reduce((s, x) => s + (x.rating || 0), 0) / items.length) * 10) / 10;
  }, [items]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Reviews for {productName || targetKey}</h2>
      <div className="mb-4 text-slate-400">
        Average rating: <span className="font-semibold text-slate-200">{avg}</span> ({total} total)
      </div>

      <div className="mb-4">
        <Link
          to={`/reviews/new?targetKey=${encodeURIComponent(targetKey)}&targetName=${encodeURIComponent(productName || '')}`}
          className="px-3 py-2 bg-indigo-400 text-slate-900 rounded font-semibold"
        >
          Write a review
        </Link>
      </div>

      {busy && <div className="text-slate-400 mb-3">Loading…</div>}
      {err && <div className="text-rose-400 mb-3">❌ {err}</div>}

      {items.length ? (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r._id} className="border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <StarRating value={r.rating} readOnly />
                <div className="text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
              {r.title && <div className="mt-2 font-medium text-slate-200">{r.title}</div>}
              {r.comment && <div className="mt-1 text-slate-300 text-sm whitespace-pre-wrap">{r.comment}</div>}
              {r.replyCount > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  {r.replyCount} admin repl{r.replyCount === 1 ? 'y' : 'ies'}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !busy && <div className="text-slate-400">No reviews yet.</div>
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
