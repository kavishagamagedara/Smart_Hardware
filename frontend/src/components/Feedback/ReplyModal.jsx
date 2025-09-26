import { useState } from 'react';

export default function ReplyModal({ open, onClose, onSubmit }) {
  const [message, setMessage] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-[520px] max-w-[92vw] bg-slate-900 border border-slate-700 rounded-xl p-4" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-3">Send admin reply</h3>
        <textarea
          rows={5}
          className="w-full bg-slate-950 border border-slate-700 rounded p-2"
          placeholder="Type your reply..."
          value={message}
          onChange={e=>setMessage(e.target.value)}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button className="px-3 py-1 rounded border border-slate-600" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-indigo-400 text-slate-900 font-semibold" onClick={()=>{ onSubmit(message); setMessage(''); }}>Send</button>
        </div>
      </div>
    </div>
  );
}
