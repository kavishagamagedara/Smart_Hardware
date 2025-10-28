import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import "./AdminCart.css";
import { useNavigate } from "react-router-dom";
import { formatLKR } from "../../../utils/currency";
import { AdminCartContext } from "./AdminCartContext";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const roundCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
};

function AdminCart() {
  const { cartItems, removeFromCart, updateQuantity } = useContext(AdminCartContext);
  const navigate = useNavigate();
  const [discounts, setDiscounts] = useState([]);
  const [discountError, setDiscountError] = useState("");
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    (async () => {
      try {
        setLoadingDiscounts(true);
        setDiscountError("");
        const response = await fetch(`${API_ROOT}/api/supplier-discounts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Failed to load supplier discounts");
        }
        const payload = await response.json().catch(() => []);
        if (cancelled) return;
        setDiscounts(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to fetch supplier discounts", error);
          setDiscountError("Unable to load supplier discounts. Totals exclude supplier offers until refresh.");
        }
      } finally {
        if (!cancelled) {
          setLoadingDiscounts(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const discountIndex = useMemo(() => {
    const map = new Map();
    discounts.forEach((discount) => {
      const productId = normalizeId(discount.productId);
      if (!productId) return;
      const list = map.get(productId) || [];
      list.push({
        id: discount._id || discount.id || null,
        minQuantity: Number(discount.minQuantity || 0),
        percent: Number(
          typeof discount.discountPercent !== "undefined"
            ? discount.discountPercent
            : discount.discountAmount || 0
        ),
      });
      map.set(productId, list);
    });
    map.forEach((list, key) => {
      list.sort((a, b) => {
        const percentDiff = (b.percent || 0) - (a.percent || 0);
        if (percentDiff !== 0) return percentDiff;
        return (b.minQuantity || 0) - (a.minQuantity || 0);
      });
      map.set(key, list);
    });
    return map;
  }, [discounts]);

  const enrichCartItem = useCallback(
    (item) => {
      const productId = normalizeId(item.productId || item.id);
      const quantity = Number(item.quantity || 0) || 1;
      const unitPrice = Number(item.price || 0);
      const lineSubtotal = roundCurrency(unitPrice * quantity);

      const offers = discountIndex.get(productId) || [];
      let appliedOffer = null;
      for (const offer of offers) {
        if (quantity >= offer.minQuantity) {
          appliedOffer = offer;
          break;
        }
      }

      const discountPercent = appliedOffer ? Number(appliedOffer.percent || 0) : 0;
      const discountValue = roundCurrency((lineSubtotal * discountPercent) / 100);
      const lineTotal = roundCurrency(Math.max(0, lineSubtotal - discountValue));

      const nextOffer = offers
        .filter((offer) => quantity < offer.minQuantity)
        .sort((a, b) => (a.minQuantity || 0) - (b.minQuantity || 0))[0] || null;

      return {
        ...item,
        productId,
        quantity,
        unitPrice,
        lineSubtotal,
        discountPercent,
        discountValue,
        lineTotal,
        appliedDiscount: appliedOffer,
        nextDiscount: nextOffer,
      };
    },
    [discountIndex]
  );

  const enrichedItems = useMemo(() => cartItems.map(enrichCartItem), [cartItems, enrichCartItem]);

  const cartTotals = useMemo(() => {
    const gross = enrichedItems.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0);
    const discountTotal = enrichedItems.reduce((sum, item) => sum + Number(item.discountValue || 0), 0);
    const net = enrichedItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    return {
      gross: roundCurrency(gross),
      discount: roundCurrency(discountTotal),
      net: roundCurrency(net),
    };
  }, [enrichedItems]);

  const syncServerCartNow = async (items) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;
      await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/admin-carts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
      });
    } catch (err) {
      console.warn('Failed to sync admin cart immediately', err);
    }
  };

  const handleIncrease = (productId) => {
    const item = cartItems.find((i) => i.productId === productId);
    if (!item) return;
    const nextQty = Number(item.quantity ?? 0) + 1;
    updateQuantity(productId, nextQty);
  };

  const handleDecrease = (productId) => {
    const item = cartItems.find((i) => i.productId === productId);
    if (!item) return;
    const currentQty = Number(item.quantity ?? 0);
    if (currentQty > 1) updateQuantity(productId, currentQty - 1);
  };

  const handleInputChange = (productId, value) => {
    const qty = parseInt(value) || 1;
    updateQuantity(productId, qty);
  };

  const handleSingleCheckout = (item) => {
    const enriched = enrichedItems.find((entry) => entry.productId === item.productId);
    if (!enriched) return;

    const normalized = {
      productId: enriched.productId,
      name: enriched.name,
      price: enriched.unitPrice,
      quantity: enriched.quantity,
      img: enriched.img,
      supplierId: enriched.supplierId,
      lineSubtotal: enriched.lineSubtotal,
      discountPercent: enriched.discountPercent,
      discountValue: enriched.discountValue,
      lineTotal: enriched.lineTotal,
      appliedDiscountId: enriched.appliedDiscount?.id || null,
      discountThreshold: enriched.appliedDiscount?.minQuantity || null,
    };

    if (!normalized.supplierId) {
      alert("Supplier reference missing. Remove and re-add this product.");
      return;
    }

    navigate("/AdminCheckout", {
      state: {
        items: [normalized],
        total: normalized.lineTotal,
        grossTotal: normalized.lineSubtotal,
        totalDiscount: normalized.discountValue,
        checkoutMode: "single",
        cartProductIds: [normalized.productId],
      },
    });
  };

  const grossTotal = cartTotals.gross;
  const totalDiscount = cartTotals.discount;
  const netTotal = cartTotals.net;

  const handlePlaceOrder = () => {
    if (enrichedItems.length === 0) {
      alert("No items in the cart to place order!");
      return;
    }

    const orderItems = enrichedItems.map((item) => ({
      productId: item.productId || item.id,
      name: item.name,
      price: Number(item?.unitPrice ?? item?.price ?? 0),
      quantity: Number(item?.quantity ?? 0) || 1,
      img: item.img,
      supplierId: item.supplierId,
      lineSubtotal: item.lineSubtotal,
      discountPercent: item.discountPercent,
      discountValue: item.discountValue,
      lineTotal: item.lineTotal,
      appliedDiscountId: item.appliedDiscount?.id || null,
      discountThreshold: item.appliedDiscount?.minQuantity || null,
    }));

    console.log("🛒 Cart Items before checkout:", cartItems);
    console.log("🛒 Normalized OrderItems to send:", orderItems);

    // Extra safeguard: check missing supplierIds
    const missing = orderItems.filter((i) => !i.supplierId);
    if (missing.length > 0) {
      console.error("❌ Missing supplierId in:", missing);
      alert("Some items are missing supplierId. Please re-add products to cart.");
      return;
    }

    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (token) {
          await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/admin-carts`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ items: cartItems }),
          });
        }
      } catch (err) {
        console.warn('Failed to sync admin cart before checkout', err);
      } finally {
        navigate('/AdminCheckout', {
          state: {
            items: orderItems,
            total: netTotal,
            grossTotal,
            totalDiscount,
          },
        });
      }
    })();
  };


  return (
    <div className="admin-cart-page">
      <div className="cart-container">
        <h2>Admin Supplier Cart</h2>

        {enrichedItems.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty__icon" aria-hidden="true">🛒</div>
            <h3>No supplier items yet</h3>
            <p className="muted">Browse supplier listings and add products you want to restock.</p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Back to supplier products
            </button>
          </div>
        ) : (
          <div className="cart-layout">
            <section className="cart-items-grid">
              {enrichedItems.map((item, index) => {
                const price = Number(item?.unitPrice ?? item?.price ?? 0);
                const quantity = Number(item?.quantity ?? 0) || 1;
                const lineSubtotal = Number(item?.lineSubtotal ?? price * quantity ?? 0);
                const discountPercent = Number(item?.discountPercent || 0);
                const discountValue = Number(item?.discountValue || 0);
                const lineTotal = Number(item?.lineTotal ?? lineSubtotal - discountValue ?? 0);
                return (
                  <article
                    className="cart-item"
                    key={item.productId || `${index}-${item?.name || "item"}`}
                  >
                    <figure className="cart-item__media">
                      <img
                        src={
                          item.img?.startsWith("http")
                            ? item.img
                            : item.img
                            ? `http://localhost:5000${item.img}`
                            : "https://via.placeholder.com/260x180?text=Product"
                        }
                        alt={item.name}
                      />
                      <figcaption className="muted">Supplier SKU: {item.productId}</figcaption>
                    </figure>
                    <div className="cart-item__body">
                      <header className="cart-item__header">
                        <h3>{item.name}</h3>
                        <span className="cart-item__price">{formatLKR(price)} per unit</span>
                      </header>
                      <p className="cart-item__total">
                        Line total <span>{formatLKR(lineTotal)}</span>
                      </p>
                      {discountPercent > 0 && (
                        <p className="cart-item__discount" aria-live="polite">
                          Discount applied ({discountPercent}% for {item.appliedDiscount?.minQuantity || 0}+ units)
                          <span>−{formatLKR(discountValue)}</span>
                        </p>
                      )}
                      {discountPercent <= 0 && item.nextDiscount && (
                        <p className="cart-item__discount-hint muted" aria-live="polite">
                          Order {Math.max(0, item.nextDiscount.minQuantity - quantity)} more to unlock
                          {' '}
                          {item.nextDiscount.percent}% off from this supplier.
                        </p>
                      )}
                      <div className="cart-item__controls">
                        <div className="quantity" aria-label="Adjust quantity">
                          <button onClick={() => handleDecrease(item.productId)} aria-label="Decrease quantity">
                            −
                          </button>
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => handleInputChange(item.productId, e.target.value)}
                            min="1"
                          />
                          <button onClick={() => handleIncrease(item.productId)} aria-label="Increase quantity">
                            +
                          </button>
                        </div>
                        <div className="cart-item__actions">
                          <button
                            className="purchase"
                            onClick={() => handleSingleCheckout(item)}
                            disabled={!item.supplierId}
                          >
                            Make purchase
                          </button>
                          <button className="remove" onClick={() => {
                            removeFromCart(item.productId);
                            // sync removal immediately so refresh doesn't restore it
                            const next = cartItems.filter((i) => i.productId !== item.productId);
                            syncServerCartNow(next);
                          }}>
                            Remove
                          </button>
                        </div>
                      </div>
                      {!item.supplierId && (
                        <p className="helper-text">Supplier reference missing. Remove and re-add this product.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="cart-summary">
              <div className="cart-summary__header">
                <h3>Purchase summary</h3>
                <p className="muted">Review quantities and finish checkout when you're ready.</p>
              </div>
              <div className="cart-summary__line">
                <span>Gross items total</span>
                <span>{formatLKR(grossTotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="cart-summary__line">
                  <span>Supplier discounts</span>
                  <span>−{formatLKR(totalDiscount)}</span>
                </div>
              )}
              <div className="cart-summary__line cart-summary__line--total">
                <span>Total payable</span>
                <span>{formatLKR(netTotal)}</span>
              </div>
              {discountError && (
                <div className="cart-summary__notice" role="alert">
                  ⚠️ {discountError}
                </div>
              )}
              <button className="place-order" onClick={handlePlaceOrder}>
                Proceed to checkout
              </button>
              {loadingDiscounts && (
                <p className="muted" style={{ fontSize: 12 }}>Checking supplier discounts…</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCart;
