import React, { useEffect, useMemo, useState } from "react";
import "./SupplierPaymentModal.css";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api";

const generateReference = () => `SUP-${Date.now()}`;

const formatCurrency = (amount) => {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(numeric);
};

function SupplierPaymentModal({
  open,
  item,
  onClose,
  onSuccess,
  onError,
  onSubmitPayment,
  skipSupplierValidation = false,
}) {
  const [paymentName, setPaymentName] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [slipFile, setSlipFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const totalCost = useMemo(() => {
    if (!item) return 0;
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    return qty * price;
  }, [item]);

  useEffect(() => {
    if (!open || !item) return;

  const baseName = item.name || "Supplier Purchase";
    setPaymentName(`Supplier Purchase • ${baseName}`);
    setReferenceId(generateReference());
  const inferredNotes = item?.prefillNotes || `${item.quantity} × ${baseName}`;
  setNotes(inferredNotes);
    setAmount((totalCost || 0).toFixed(2));
    setSlipFile(null);
    setSubmitting(false);
    setLocalError("");
  }, [open, item, totalCost]);

  if (!open || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!skipSupplierValidation && !item?.supplierId) {
      setLocalError("Missing supplier reference. Please remove and re-add the product.");
      onError?.("Missing supplier reference for this product.");
      return;
    }

    if (!paymentName.trim()) {
      setLocalError("Payment name is required.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setLocalError("Please enter a valid payment amount.");
      return;
    }

    if (!slipFile) {
      setLocalError("Please upload a payment slip.");
      return;
    }

    try {
      setSubmitting(true);
      setLocalError("");

      if (onSubmitPayment) {
        const payload = {
          referenceId: referenceId.trim(),
          paymentName: paymentName.trim(),
          supplierId: item?.supplierId || null,
          amount: numericAmount,
          notes: notes.trim(),
          slipFile,
        };

        const result = await onSubmitPayment(payload);
        onSuccess?.({ payment: result ?? payload, productId: item?.productId });
      } else {
        const form = new FormData();
        if (referenceId.trim()) {
          form.append("paymentId", referenceId.trim());
        }
        form.append("paymentName", paymentName.trim());
        form.append("supplierId", item.supplierId);
        form.append("amount", numericAmount);
        form.append("currency", "lkr");
        form.append("description", notes.trim());
        form.append("slip", slipFile);

        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/payments/slip`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to submit payment");
        }

        const data = await response.json();
        onSuccess?.({ payment: data.payment, productId: item.productId });
      }
    } catch (err) {
      const message = err?.message || "Failed to submit payment";
      setLocalError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target.classList.contains("supplier-payment-modal-overlay")) {
      onClose?.();
    }
  };

  return (
    <div
      className="supplier-payment-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-payment-title"
      onClick={handleBackdropClick}
    >
      <div className="supplier-payment-modal">
        <header className="supplier-payment-modal__header">
          <div>
            <h3 id="supplier-payment-title">Slip Payment</h3>
            <p className="supplier-payment-modal__subtitle">
              Submit a bank slip to record this supplier purchase.
            </p>
          </div>
          <button
            type="button"
            className="supplier-payment-modal__close"
            onClick={() => onClose?.()}
            aria-label="Close payment form"
          >
            ×
          </button>
        </header>

        <section className="supplier-payment-summary">
          <div className="summary-row">
            <span className="summary-label">Product</span>
            <span className="summary-value">{item.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Quantity</span>
            <span className="summary-value">{item.quantity}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Unit price</span>
            <span className="summary-value">{formatCurrency(item.price)}</span>
          </div>
          <div className="summary-row summary-row--total">
            <span className="summary-label">Total</span>
            <span className="summary-value">{formatCurrency(totalCost)}</span>
          </div>
        </section>

        <form className="supplier-payment-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-label">Payment reference</span>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="e.g. SUP-20241015"
            />
          </label>

          <label className="form-field">
            <span className="form-label">Payment name</span>
            <input
              type="text"
              value={paymentName}
              onChange={(e) => setPaymentName(e.target.value)}
              placeholder="Supplier Purchase"
              required
            />
          </label>

          <label className="form-field">
            <span className="form-label">Amount (LKR)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span className="form-label">Notes (optional)</span>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes or bank reference"
            />
          </label>

          <label className="form-field">
            <span className="form-label">Upload payment slip</span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
              required
            />
            {slipFile && (
              <span className="form-helper">Selected file: {slipFile.name}</span>
            )}
          </label>

          {localError && <div className="form-error">{localError}</div>}

          <div className="supplier-payment-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onClose?.()}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Uploading…" : "Submit payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SupplierPaymentModal;
