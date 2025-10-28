import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { formatLKR } from "../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

function emptyFormState() {
  return {
    productId: "",
    discountPercent: "",
    minQuantity: "",
    note: "",
  };
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export default function SupplierDiscounts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [form, setForm] = useState(emptyFormState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeader = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_ROOT}/supplier-products`, {
        headers: {
          ...authHeader,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load products");
      }
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload?.supplierProducts || [];
      setProducts(list);
      if (!form.productId && list.length) {
        setForm((prev) => ({ ...prev, productId: list[0]._id || list[0].id || "" }));
      }
    } catch (err) {
      console.error("Unable to fetch supplier products", err);
      setError("Unable to load your products. Try refreshing the page.");
    }
  }, [authHeader, form.productId]);

  const fetchDiscounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_ROOT}/api/supplier-discounts`, {
        headers: {
          ...authHeader,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load discounts");
      }
      const payload = await res.json();
      setDiscounts(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error("Unable to fetch supplier discounts", err);
      setError("Unable to load current discount offers.");
    }
  }, [authHeader]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchProducts(), fetchDiscounts()])
      .catch((err) => {
        console.error("Initial discount data load failed", err);
      })
      .finally(() => setLoading(false));
  }, [token, fetchProducts, fetchDiscounts]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetStatus = () => {
    setMessage("");
    setError("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    resetStatus();
    if (!form.productId) {
      setError("Select a product to discount");
      return;
    }
    const numericDiscount = Number(form.discountPercent);
    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0 || numericDiscount > 100) {
      setError("Enter a discount percentage between 0 and 100");
      return;
    }
    const numericQty = Number(form.minQuantity);
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      setError("Threshold must be at least 1");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_ROOT}/api/supplier-discounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          productId: form.productId,
          discountPercent: numericDiscount,
          minQuantity: Math.floor(numericQty),
          note: form.note.trim() || undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to create discount");
      }

      const discountDoc = payload?.discount;
      setDiscounts((prev) => {
        if (!discountDoc) return prev;
        return [discountDoc, ...prev];
      });
  setMessage("Discount offer saved");
  setForm((prev) => ({ ...emptyFormState(), productId: prev.productId || form.productId }));
    } catch (err) {
      console.error("Failed to create supplier discount", err);
      setError(err.message || "Failed to save discount");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    resetStatus();
    if (!window.confirm("Remove this discount offer?")) return;
    try {
      const res = await fetch(`${API_ROOT}/api/supplier-discounts/${id}`, {
        method: "DELETE",
        headers: {
          ...authHeader,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to remove discount");
      }
      setDiscounts((prev) => prev.filter((discount) => (discount._id || discount.id) !== id));
      setMessage("Discount removed");
    } catch (err) {
      console.error("Failed to delete supplier discount", err);
      setError(err.message || "Failed to remove discount");
    }
  };

  const productLookup = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const key = product?._id || product?.id;
      if (key) {
        map.set(String(key), product);
      }
    });
    return map;
  }, [products]);

  if (!token) {
    return (
      <div className="muted-text text-sm">Sign in again to manage discounts.</div>
    );
  }

  return (
    <div className="stack-lg">
      <form className="card stack-md" onSubmit={handleCreate}>
        <div className="stack-xs">
          <h3 className="heading-md">Add a discount offer</h3>
          <p className="muted-text text-sm">
            Create tiered deals for admins to apply when ordering in bulk from you.
          </p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="stack-xxs">
            <span className="label">Product</span>
            <select
              className="input"
              value={form.productId}
              onChange={(event) => handleInputChange("productId", event.target.value)}
              disabled={!products.length || busy || loading}
            >
              {products.length === 0 && <option value="">No products available</option>}
              {products.length > 0 && !form.productId && <option value="">Select a product</option>}
              {products.map((product) => {
                const value = product?._id || product?.id;
                return (
                  <option key={value} value={value}>
                    {product?.name || value || "Unnamed"}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="stack-xxs">
            <span className="label">Discount %</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.discountPercent}
              onChange={(event) => handleInputChange("discountPercent", event.target.value)}
              placeholder="e.g. 15"
              disabled={busy}
            />
          </label>

          <label className="stack-xxs">
            <span className="label">Minimum order quantity</span>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={form.minQuantity}
              onChange={(event) => handleInputChange("minQuantity", event.target.value)}
              placeholder="e.g. 25"
              disabled={busy}
            />
          </label>

          <label className="stack-xxs md:col-span-2 xl:col-span-3">
            <span className="label">Internal note (optional)</span>
            <textarea
              className="input"
              rows={2}
              value={form.note}
              onChange={(event) => handleInputChange("note", event.target.value)}
              placeholder="Add a short reminder or description for this offer"
              maxLength={400}
              disabled={busy}
            />
          </label>
        </div>

        <div className="action-grid justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy || loading || !products.length}>
            {busy ? "Saving…" : "Save discount"}
          </button>
        </div>
      </form>

      <div className="card stack-md">
        <div className="stack-xs">
          <h3 className="heading-md">Current offers</h3>
          <p className="muted-text text-sm">Admins will see these deals when they place purchase orders.</p>
        </div>

        {loading ? (
          <div className="empty-cell">Loading discounts…</div>
        ) : discounts.length === 0 ? (
          <div className="empty-cell">No discount offers yet. Create your first deal above.</div>
        ) : (
          <div className="table-scroller">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Discount</th>
                  <th>Threshold qty</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => {
                  const key = discount._id || discount.id;
                  const productId = discount.productId?._id || discount.productId?.id || discount.productId;
                  const product = productLookup.get(String(productId));
                  const productName = discount.productId?.name || product?.name || "Product";
                  const created = discount.createdAt ? new Date(discount.createdAt) : null;
                  const percent = Number(
                    discount.discountPercent ?? discount.discountAmount ?? 0
                  );
                  return (
                    <tr key={key}>
                      <td>
                        <div className="stack-xxs">
                          <span className="font-semibold">{productName}</span>
                          {product && (
                            <span className="muted-text text-xs">Current price: {formatLKR(product?.price)}</span>
                          )}
                        </div>
                      </td>
                      <td>{formatPercent(percent)}</td>
                      <td>{Number(discount.minQuantity || 0).toLocaleString()}</td>
                      <td>{created ? created.toLocaleDateString() : "—"}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDelete(key)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
