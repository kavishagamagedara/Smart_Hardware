export const formatLKR = (
  value,
  {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = {}
) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(0);
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
};

export const formatLKRCompact = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "LKR 0";

  if (Math.abs(amount) < 1000) {
    return formatLKR(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  const compact = new Intl.NumberFormat("en-LK", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

  return `LKR ${compact}`;
};
