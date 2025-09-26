import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import StarRating from '../StarRating.jsx';

const FALLBACK_PRODUCT = { id: 'PRD-0001', name: 'Demo Widget 2000' };

export default function SubmitReview() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // edit mode (when coming from My Reviews → “Edit in full page” you could pass rid=)
  const rid = params.get('rid');

  // when opened from product/order page
  const queryKey  = params.get('targetKey')  || '';
  const queryName = params.get('targetName') || '';

  const [product, setProduct] = useState({ ...FALLBACK_PRODUCT });

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setErr(''); setErrors([]); setExisting(null);

      if (rid) {
        try {
          const { data } = await api.get(`/reviews/${rid}`);
          if (cancelled) return;
          setExisting(data);
          setRating(data.rating);
          setTitle(data.title || '');
          setComment(data.comment || '');
          setProduct({
            id: data.targetKey || data.targetId || FALLBACK_PRODUCT.id,
            name: data.targetName || queryName || FALLBACK_PRODUCT.name
          });
        } catch (e) {
          if (!cancelled) setErr(e?.response?.data?.message || e.message || 'Failed to load review');
        }
        return;
      }

      const key = queryKey || FALLBACK_PRODUCT.id;
      const name = queryName || FALLBACK_PRODUCT.name;
      setProduct({ id: key, name });

      try {
        const { data } = await api.get('/reviews', { params: { mine: true, targetKey: key, limit: 1 } });
        const old = data?.data?.[0];
        if (cancelled) return;
        if (old) {
          setExisting(old);
          setRating(old.rating);
          setTitle(old.title || '');
          setComment(old.comment || '');
        } else {
          setRating(5); setTitle(''); setComment('');
        }
      } catch { /* show empty form */ }
    }

    boot();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, queryKey, queryName]);

  const validate = () => {
    const e = [];
    if (!(rating >= 1 && rating <= 5)) e.push('Rating must be 1..5');
    if (title.length > 200) e.push('Title is too long (max 200)');
    if (comment.trim().length < 5) e.push('Comment must be at least 5 characters');
    if (comment.length > 3000) e.push('Comment is too long (max 3000)');
    setErrors(e);
    return e.length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true); setErr('');
    try {
      if (existing || rid) {
        const id = rid || existing._id;
        await api.patch(`/reviews/${id}`, { rating, title, comment });
      } else {
        await api.post('/reviews', {
          targetType: 'Product',
          targetKey: product.id,
          targetName: product.name,
          rating, title, comment
        });
      }
      navigate('/reviews/mine');
    } catch (e2) {
      const msg = e2?.response?.data?.message || e2.message || 'Server error';
      setErr(msg);
      setErrors(e2?.response?.data?.errors || []);
    } finally {
      setSaving(false);
    }
  };

  const mode = useMemo(() => (rid || existing ? 'update' : 'create'), [rid, existing]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">{mode === 'update' ? 'Update Review' : 'Send a Review'}</h2>

      <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <label className="w-40 text-slate-300">Product</label>
          <div className="flex-1">
            <div className="font-medium">{product.name}</div>
            <div className="text-slate-400 text-sm">ID: {product.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="w-40 text-slate-300">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div className="flex items-center gap-3">
          <label className="w-40 text-slate-300">
            Title <span className="text-slate-500 text-xs">(optional)</span>
          </label>
          <input
            className="flex-1 bg-slate-950 border border-slate-700 rounded p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="w-40 text-slate-300">Comment</label>
          <textarea
            className="flex-1 bg-slate-950 border border-slate-700 rounded p-2"
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            minLength={5}
            maxLength={3000}
          />
        </div>

        {errors.length > 0 && (
          <ul className="bg-amber-900/30 border border-amber-700 text-amber-200 rounded p-3">
            {errors.map((x, i) => <li key={i}>• {x}</li>)}
          </ul>
        )}
        {err && <p className="text-rose-400">❌ {err}</p>}

        <div className="flex justify-end">
          <button
            className="px-4 py-2 rounded font-semibold bg-indigo-400 text-slate-900 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? (mode === 'update' ? 'Updating…' : 'Sending…') : (mode === 'update' ? 'Update Review' : 'Send Review')}
          </button>
        </div>
      </form>
    </div>
  );
}
