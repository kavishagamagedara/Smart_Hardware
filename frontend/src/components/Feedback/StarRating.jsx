export default function StarRating({ value, onChange, readOnly=false, size=22 }) {
  const stars = [1,2,3,4,5];
  return (
    <div className="inline-flex gap-1">
      {stars.map(n => (
        <button
          key={n}
          type="button"
          className={`transition ${readOnly ? 'cursor-default' : 'hover:scale-110'} ${value>=n ? 'text-yellow-400' : 'text-slate-600'}`}
          onClick={() => !readOnly && onChange?.(n)}
          style={{ fontSize: size }}
          aria-label={`Rate ${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
