export default function StarRating({ value, onChange, readOnly=false, size=22 }) {
  const stars = [1,2,3,4,5];
  return (
    <div className="star-rating" role="radiogroup" aria-label="Rating">
      {stars.map(n => (
        <button
          key={n}
          type="button"
          className={`star-rating__star${value >= n ? ' star-rating__star--active' : ''}${readOnly ? ' star-rating__star--readonly' : ''}`}
          onClick={() => !readOnly && onChange?.(n)}
          role="radio"
          aria-checked={value === n}
          style={{ fontSize: size }}
          disabled={readOnly}
          aria-label={`Rate ${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}