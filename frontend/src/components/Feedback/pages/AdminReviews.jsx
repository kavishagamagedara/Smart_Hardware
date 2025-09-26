import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import ReplyModal from '../Components/ReplyModal.jsx';

function AdminHeader() {
  const [name, setName] = useState('');

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('auth') || '{}');
    setName(stored.userName || 'Admin');
  }, []);

  const enableAdmin = () => {
    const stored = JSON.parse(localStorage.getItem('auth') || '{}');
    localStorage.setItem('auth', JSON.stringify({ ...stored, userName: name || 'Admin', role: 'admin' }));
    alert('Admin mode enabled for this browser tab.');
    window.location.reload();
  };

  return (
    <header className="border-b border-slate-800" style={{ background: 'linear-gradient(90deg,#0b1020,#101a3a)' }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-extrabold tracking-wide">Admin · Feedback</div>
        <div className="flex items-center gap-2">
          <label className="text-slate-300 text-sm">Admin name</label>
          <input className="w-64 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
                 value={name} onChange={e=>setName(e.target.value)} />
          <button className="ml-2 bg-indigo-400 hover:bg-indigo-300 text-slate-900 font-semibold px-3 py-1 rounded"
                  onClick={enableAdmin}>Enter Admin Mode</button>
        </div>
      </div>
    </header>
  );
}

export default function AdminReviews() {
  const [status, setStatus] = useState('public');
  const [targetType, setTargetType] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyFor, setReplyFor] = useState(null);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const params = { sort: '-createdAt', limit: 50, status, ...(targetType && { targetType }) };
      const { data } = await api.get('/reviews', { params });
      setItems(data.data || []);
    } catch (e) { setErr(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status, targetType]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(it =>
      (it.title || '').toLowerCase().includes(needle) ||
      (it.comment || '').toLowerCase().includes(needle) ||
      (it._id || '').toLowerCase().includes(needle) ||
      (it.userName || '').toLowerCase().includes(needle)
    );
  }, [items, q]);

  const actionVis = async (item, action) => {
    try {
      const { data } = await api.post(`/reviews/${item._id}/visibility`, { action });
      setItems(prev => prev.map(x => x._id === item._id ? data : x));
    } catch (e) { alert(e?.response?.data?.message || e.message); }
  };

  const sendReply = async (message) => {
    try {
      const { data } = await api.post(`/reviews/${replyFor._id}/replies`, { message });
      setItems(prev => prev.map(x => x._id === replyFor._id ? data : x));
      setReplyOpen(false); setReplyFor(null);
    } catch (e) { alert(e?.response?.data?.message || e.message); }
  };

  return (
    <>
      <AdminHeader />
      <div className="space-y-3 mt-6">
        <h2 className="text-2xl font-semibold">Admin Reviews</h2>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-slate-300">Status</label>
            <select className="bg-slate-950 border border-slate-700 rounded p-2" value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="public">public</option><option value="hidden">hidden</option><option value="deleted">deleted</option>
            </select>

            <label className="ml-4 text-slate-300">Type</label>
            <select className="bg-slate-950 border border-slate-700 rounded p-2" value={targetType} onChange={e=>setTargetType(e.target.value)}>
              <option value="">(any)</option><option>Hardware</option><option>Vendor</option><option>Ticket</option>
            </select>

            <input className="flex-1 min-w-[220px] bg-slate-950 border border-slate-700 rounded p-2"
                  placeholder="Search title/comment/id/user…" value={q} onChange={e=>setQ(e.target.value)} />
            <button className="px-3 py-1 rounded border border-slate-600" onClick={load}>Refresh</button>
          </div>
        </div>

        {loading && <p>Loading…</p>}
        {err && <p className="text-rose-400">❌ {err}</p>}

        {filtered.map(item => (
          <div key={item._id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <b>#{item.reviewNo ?? '—'}</b> · <span className="text-slate-300">{item.targetType}</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs border
                  ${item.status==='public' ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300' :
                    item.status==='hidden' ? 'bg-amber-900/30 border-amber-700 text-amber-300' :
                    'bg-rose-900/30 border-rose-700 text-rose-300'}`}>
                  {item.status}
                </span>
                <div className="text-slate-400 text-sm">by {item.userName || 'Anonymous'} · key: {item.targetKey || '—'}</div>
              </div>
              <div className="text-slate-400 text-sm">{new Date(item.createdAt).toLocaleString()}</div>
            </div>

            <div><span className="text-slate-300 mr-2">Rating</span>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</div>
            {item.title && <div><span className="text-slate-300 mr-2">Title</span>{item.title}</div>}
            {item.comment && <div><span className="text-slate-300 mr-2">Comment</span>{item.comment}</div>}

            {item.replies?.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-slate-300 font-medium">Replies</div>
                {item.replies.map((r, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded p-2">
                    <div className="text-slate-400 text-sm">{new Date(r.createdAt).toLocaleString()}</div>
                    <div>{r.message}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {item.status!=='hidden' && <button className="px-3 py-1 rounded border border-slate-600" onClick={()=>actionVis(item,'hide')}>Hide</button>}
              {item.status!=='public' && <button className="px-3 py-1 rounded border border-slate-600" onClick={()=>actionVis(item,'unhide')}>Unhide</button>}
              <button className="px-3 py-1 rounded bg-indigo-400 text-slate-900 font-semibold" onClick={()=>{ setReplyFor(item); setReplyOpen(true); }}>Reply</button>
            </div>
          </div>
        ))}

        {!loading && filtered.length===0 && <p className="text-slate-400">No reviews match your filters.</p>}

        <ReplyModal open={replyOpen} onClose={()=>setReplyOpen(false)} onSubmit={sendReply} />
      </div>
    </>
  );
}
