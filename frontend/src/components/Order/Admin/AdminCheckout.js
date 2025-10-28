import React, { useContext, useMemo, useRef, useState } from "react";
import "./AdminCheckout.css";
import { useNavigate, useLocation } from "react-router-dom";
import { AdminCartContext } from "./AdminCartContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

function AdminCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart, removeFromCart, clearServerCart } = useContext(AdminCartContext) || {};

  const [checkoutSnapshot] = useState(() => {
    const state = location.state || {};
    const gross = Number(state.grossTotal ?? state.total ?? 0) || 0;
    const discount = Number(state.totalDiscount ?? 0) || 0;
    const net = Number(state.total ?? (gross - discount)) || 0;
    return {
      items: Array.isArray(state.items) ? state.items : [],
      grossTotal: gross,
      totalDiscount: discount,
      netTotal: net,
      mode: state.checkoutMode || "full",
      cartProductIds: Array.isArray(state.cartProductIds) ? state.cartProductIds : [],
    };
  });

  const itemsFromCart = checkoutSnapshot.items;
  const grossTotal = checkoutSnapshot.grossTotal;
  const totalDiscount = checkoutSnapshot.totalDiscount;
  const netTotal = checkoutSnapshot.netTotal;

  const [contact, setContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash Payment");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [bannerMessage, setBannerMessage] = useState("");
  const [slipDetails, setSlipDetails] = useState(null);
  const slipInputRef = useRef(null);

  // Validation states
  const [contactTouched, setContactTouched] = useState(false);
  const [notesTouched, setNotesTouched] = useState(false);

  const isBankTransfer = paymentMethod === "Bank Transfer";

  // Validation helpers
  const isValidPhone = (phone) => {
    const phoneRegex = /^0\d{9}$/;
    const cleanedPhone = phone.trim().replace(/\s/g, '');
    return phoneRegex.test(cleanedPhone);
  };

  const getWordCount = (text) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const isNotesValid = (text) => {
    return !text.trim() || getWordCount(text) >= 5;
  };

  const totalQuantity = useMemo(
    () => itemsFromCart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [itemsFromCart]
  );

  const aggregatedModalItem = useMemo(() => {
    if (!itemsFromCart.length) return null;

    const descriptor =
      itemsFromCart.length === 1
        ? itemsFromCart[0].name
        : `${itemsFromCart.length} supplier items`;

    const detailedList = itemsFromCart
      .map((item) => `${item.name} × ${item.quantity}`)
      .join(", ");

    return {
      productId: itemsFromCart.map((item) => item.productId).join("-"),
      name: descriptor,
      quantity: 1,
      price: netTotal,
      supplierId: itemsFromCart[0]?.supplierId || null,
      prefillNotes: detailedList,
    };
  }, [itemsFromCart, netTotal]);

  const handleSlipFilePrompt = () => {
    if (!aggregatedModalItem) return;
    setFormError("");
    slipInputRef.current?.click();
  };

  const handleSlipSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const referenceId = `SUP-${Date.now()}`;
    const payload = {
      paymentName: aggregatedModalItem?.name || file.name,
      referenceId,
      amount: netTotal,
      notes: aggregatedModalItem?.prefillNotes || "",
      slipFile: file,
      fileName: file.name,
    };

    setSlipDetails(payload);
    setBannerMessage(`Slip "${payload.paymentName}" attached for this order.`);
    setFormError("");
    if (event.target) {
      // allow re-selecting same file later
      event.target.value = "";
    }
  };

  const clearSlipAttachment = () => {
    setSlipDetails(null);
    setBannerMessage("Slip attachment removed.");
    if (slipInputRef.current) {
      slipInputRef.current.value = "";
    }
  };

  const handlePlaceOrder = async () => {
    setFormError("");
    setBannerMessage("");

    // Validate contact number
    if (!contact.trim()) {
      setFormError("Please enter a contact number.");
      return;
    }

    // Phone number validation: must be 10 digits starting with 0
    const phoneRegex = /^0\d{9}$/;
    const cleanedContact = contact.trim().replace(/\s/g, ''); // Remove spaces
    if (!phoneRegex.test(cleanedContact)) {
      setFormError("Contact number must be 10 digits starting with 0 (e.g., 0712345678).");
      return;
    }

    // Notes validation: minimum 5 words if provided
    if (notes.trim()) {
      const wordCount = notes.trim().split(/\s+/).length;
      if (wordCount < 5) {
        setFormError("Internal notes must contain at least 5 words if provided.");
        return;
      }
    }

    if (!itemsFromCart.length) {
      setFormError("Your checkout session has expired. Please return to the cart.");
      return;
    }

    if (isBankTransfer && !slipDetails?.slipFile) {
      setFormError("Attach your bank transfer slip before placing the order.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("contact", contact.trim());
    formData.append("paymentMethod", paymentMethod);
  formData.append("totalCost", netTotal);
    formData.append("status", "Pending");
    formData.append("items", JSON.stringify(itemsFromCart));

    const consolidatedNotes = [notes, slipDetails?.notes]
      .filter(Boolean)
      .join(" | ");

    if (consolidatedNotes) {
      formData.append("notes", consolidatedNotes);
    }

    if (isBankTransfer && slipDetails?.slipFile) {
      formData.append("slip", slipDetails.slipFile);
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/admin-orders`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Clear server-side cart first
        try {
          if (clearServerCart) await clearServerCart();
        } catch (err) {
          console.warn('Failed to clear admin server cart after order', err);
        }

        if (checkoutSnapshot.mode === "single" && checkoutSnapshot.cartProductIds.length) {
          checkoutSnapshot.cartProductIds.forEach((id) => removeFromCart(id));
        } else {
          clearCart();
        }
        alert("Order placed successfully!");
        navigate("/AdminDashboard");
      } else {
        setFormError(result.message || "Failed to place order. Please try again.");
      }
    } catch (err) {
      setFormError("Something went wrong while placing the order. Please try again.");
      console.error("❌ Error placing order:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!itemsFromCart.length) {
    return (
      <div className="admin-checkout-page">
        <div className="checkout-container">
          <div className="checkout-empty">
            <h2>Checkout session expired</h2>
            <p>Head back to the supplier cart to refresh your items and start again.</p>
            <button className="btn btn-primary" type="button" onClick={() => navigate("/AdminCart")}>
              Return to supplier cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-checkout-page">
      <div className="checkout-container">
        <section className="checkout-hero">
          <div>
            <h1>Finalize supplier purchase</h1>
            <p>Confirm contact details, choose a payment route, and attach any slips before submitting.</p>
          </div>
          <div className="checkout-pills">
            <span>{itemsFromCart.length} items</span>
            <span>{totalQuantity} units</span>
            <span>{formatCurrency(netTotal)}</span>
          </div>
        </section>

        {bannerMessage && <div className="checkout-banner checkout-banner--success">{bannerMessage}</div>}
        {formError && <div className="checkout-banner checkout-banner--error">{formError}</div>}

        <div className="checkout-grid">
          <section className="checkout-card checkout-card--form">
            <header className="checkout-card__header">
              <h2>Contact & payment</h2>
              <p>Provide a point of contact for suppliers and tell us how you paid.</p>
            </header>

            <div className="checkout-fieldset">
              <label htmlFor="checkout-contact">Contact number</label>
              <input
                id="checkout-contact"
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                onBlur={() => setContactTouched(true)}
                placeholder="e.g. 0712345678"
                autoComplete="tel"
                maxLength="10"
                pattern="0[0-9]{9}"
                title="Enter a 10-digit phone number starting with 0"
                className={contactTouched && contact && !isValidPhone(contact) ? 'invalid' : ''}
              />
              <small className={`field-help ${contactTouched && contact && !isValidPhone(contact) ? 'field-help--error' : ''}`}>
                {contactTouched && contact && !isValidPhone(contact) 
                  ? '❌ Invalid format. Use 10 digits starting with 0 (e.g., 0712345678)'
                  : 'Enter 10 digits starting with 0 (e.g., 0712345678)'
                }
              </small>
            </div>

            <div className="checkout-fieldset">
              <label htmlFor="checkout-notes">Internal notes (optional)</label>
              <textarea
                id="checkout-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => setNotesTouched(true)}
                placeholder="Add reminders for the finance team or delivery instructions (minimum 5 words if provided)"
                className={notesTouched && notes.trim() && !isNotesValid(notes) ? 'invalid' : ''}
              />
              <small className={`field-help ${notesTouched && notes.trim() && !isNotesValid(notes) ? 'field-help--error' : ''}`}>
                {notes.trim() ? (
                  <>
                    Word count: {getWordCount(notes)} 
                    {notesTouched && !isNotesValid(notes) && (
                      <span className="text-error"> (minimum 5 words required)</span>
                    )}
                  </>
                ) : (
                  'Optional field - minimum 5 words if you choose to add notes'
                )}
              </small>
            </div>

            <div className="checkout-fieldset">
              <label htmlFor="checkout-method">Payment method</label>
              <select
                id="checkout-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cash Payment">Cash payment</option>
                <option value="Bank Transfer">Bank transfer</option>
              </select>
            </div>

            {isBankTransfer && (
              <div className="checkout-slip-card">
                <div className="checkout-slip-card__header">
                  <h3>Bank transfer slip</h3>
                  <p>Upload the deposit slip so finance can reconcile this purchase.</p>
                </div>

                <input
                  type="file"
                  ref={slipInputRef}
                  onChange={handleSlipSelection}
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                />

                {slipDetails ? (
                  <div className="checkout-slip-card__body">
                    <div className="slip-meta">
                      <span className="slip-status">Slip attached</span>
                      <h4>{slipDetails.paymentName || "Supplier payment"}</h4>
                      <dl>
                        <div>
                          <dt>Reference</dt>
                          <dd>{slipDetails.referenceId || "—"}</dd>
                        </div>
                        <div>
                          <dt>Amount</dt>
                          <dd>{formatCurrency(slipDetails.amount)}</dd>
                        </div>
                      </dl>
                      {slipDetails.notes && <p className="slip-notes">{slipDetails.notes}</p>}
                      {slipDetails.fileName && (
                        <p className="slip-notes">File: {slipDetails.fileName}</p>
                      )}
                    </div>

                    <div className="checkout-slip-card__actions">
                      <button type="button" className="btn btn-secondary" onClick={handleSlipFilePrompt}>
                        Replace slip
                      </button>
                      <button type="button" className="btn btn-link" onClick={clearSlipAttachment}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="checkout-slip-card__body checkout-slip-card__body--empty">
                    <p>
                      Attach the scanned deposit slip. Click “Upload slip” to pick the image or PDF from
                      your device and we’ll attach it to this order.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={handleSlipFilePrompt}>
                      Upload slip
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="checkout-summary-card">
            <header className="checkout-summary__header">
              <h2>Order summary</h2>
              <p>Double-check quantities before confirming the purchase.</p>
            </header>
            <ul className="checkout-line-items">
              {itemsFromCart.map((item) => {
                const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
                const quantity = Number(item.quantity || 0);
                const lineSubtotal = Number(item.lineSubtotal ?? unitPrice * quantity);
                const discountValue = Number(item.discountValue ?? 0);
                const lineTotal = Number(item.lineTotal ?? lineSubtotal - discountValue);
                const discountPercent = Number(item.discountPercent ?? 0);
                return (
                  <li key={item.productId}>
                    <div>
                      <h4>{item.name}</h4>
                      <p>{quantity} units × {formatCurrency(unitPrice)}</p>
                      {discountPercent > 0 && (
                        <small className="checkout-line-items__discount">
                          Discount applied: {discountPercent}% (−{formatCurrency(discountValue)})
                        </small>
                      )}
                    </div>
                    <span>{formatCurrency(lineTotal)}</span>
                  </li>
                );
              })}
            </ul>

            <div className="checkout-summary__totals">
              <div>
                <span>Gross items total</span>
                <span>{formatCurrency(grossTotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div>
                  <span>Supplier discounts</span>
                  <span>−{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="checkout-summary__totals--accent">
                <span>Amount payable</span>
                <span>{formatCurrency(netTotal)}</span>
              </div>
            </div>

            <button
              className="btn btn-primary checkout-submit"
              type="button"
              onClick={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? "Placing order…" : "Confirm purchase"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default AdminCheckout;
