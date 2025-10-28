import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
}

export default function SupplierDiscountAdminList() {
  const { token } = useAuth();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    fetch(`${API_ROOT}/api/supplier-discounts`, {
      headers: {
        ...authHeader,
      },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(payload?.message || "Failed to load discount offers");
        }
        setDiscounts(Array.isArray(payload) ? payload : []);
      })
      .catch((err) => {
        console.error("Failed to load supplier discounts for admin", err);
        setError(err.message || "Failed to load discount offers");
      })
      .finally(() => setLoading(false));
  }, [token, authHeader]);

  if (!token) {
    return null;
  }

  return (
    <div className="card stack-md">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="stack-xs">
          <h3 className="heading-md">Supplier discount offers</h3>
          <p className="muted-text text-sm">
            Review bulk discount programs submitted by suppliers. These will be available when placing purchase orders.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="empty-cell">Loading discounts…</div>
      ) : discounts.length === 0 ? (
        <div className="empty-cell">No supplier discounts available yet.</div>
      ) : (
        <div className="table-scroller">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Product</th>
                <th>Discount</th>
                <th>Minimum quantity</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => {
                const key = discount._id || discount.id;
                const supplierName = discount.supplierId?.name || "Supplier";
                const supplierId = normalizeId(discount.supplierId);
                const productName = discount.productId?.name || "Product";
                const created = discount.createdAt ? new Date(discount.createdAt) : null;
                return (
                  <tr key={key}>
                    <td>
                      <div className="stack-xxs">
                        <span className="font-semibold">{supplierName}</span>
                        {supplierId && (
                          <span className="muted-text text-xs">ID • {supplierId.slice(-6)}</span>
                        )}
                      </div>
                    </td>
                    <td>{productName}</td>
                    <td>{formatPercent(discount.discountPercent ?? discount.discountAmount ?? 0)}</td>
                    <td>{Number(discount.minQuantity || 0).toLocaleString()}</td>
                    <td>{created ? created.toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
