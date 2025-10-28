export const normalizeRole = (role) => {
  return String(role || "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

export const getDashboardRoute = (role, { profile = false } = {}) => {
  const normalized = normalizeRole(role);
  const suffix = profile ? "#profile" : "";

  if (normalized === "admin") return `/AdminDashboard${suffix}`;
  if (normalized.includes("finance")) return `/FinanceDashboard${suffix}`;
  if (normalized.includes("sales")) return `/SalesDashboard${suffix}`;
  if (normalized.includes("inventory")) return `/InventoryDashboard${suffix}`;
  if (normalized.includes("supplier")) return `/SupplierDashboard${suffix}`;
  if (normalized.includes("care")) return `/caredashboard${suffix}`;

  const tab = profile ? "profile" : "orders";
  return `/dashboard?tab=${tab}`;
};
