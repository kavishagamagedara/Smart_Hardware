import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Receipt.css";

const formatLKR = (amount) => {
  if (amount == null || isNaN(amount)) return "LKR 0.00";
  return `LKR ${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

function Receipt() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("You must be logged in to view receipts");
        }

        const response = await fetch(`http://localhost:5000/api/receipts/${orderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to fetch receipt");
        }

        const data = await response.json();
        console.log("📄 Receipt data received:", data);
        console.log("📦 Order items:", data.receipt?.order?.items);
        setReceipt(data.receipt);
        setError(null);
      } catch (err) {
        console.error("Error fetching receipt:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchReceipt();
    }
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    // Set document title to include receipt number for better filename
    const originalTitle = document.title;
    const receiptNum = receipt?.receiptNumber || "receipt";
    const fileName = `Receipt-${receiptNum}`;
    document.title = fileName;
    
    // Create a custom message to guide user
    const message = document.createElement('div');
    message.id = 'pdf-download-hint';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 20px 40px -20px rgba(16, 185, 129, 0.6);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;
    message.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">💡</span>
        <div>
          <div style="font-size: 14px; margin-bottom: 4px;">Select "Save as PDF" in the print dialog</div>
          <div style="font-size: 12px; opacity: 0.9;">Destination: Save as PDF</div>
        </div>
      </div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @media print {
        #pdf-download-hint { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(message);
    
    // Remove message after delay
    const removeMessage = () => {
      if (message && message.parentNode) {
        message.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
          if (message && message.parentNode) {
            message.parentNode.removeChild(message);
          }
        }, 300);
      }
      document.title = originalTitle;
      if (style && style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
    
    // Trigger print dialog
    setTimeout(() => {
      window.print();
      // Clean up after print dialog closes
      setTimeout(removeMessage, 1000);
    }, 500);
    
    // Also listen for print events
    const afterPrint = () => {
      removeMessage();
      window.removeEventListener('afterprint', afterPrint);
    };
    window.addEventListener('afterprint', afterPrint);
  };

  if (loading) {
    return (
      <div className="receipt-container">
        <div className="receipt-loading">Loading receipt...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="receipt-container">
        <div className="receipt-error">
          <h3>Error Loading Receipt</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="receipt-container">
        <div className="receipt-error">
          <h3>Receipt Not Found</h3>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { order, payment, customer, company } = receipt;

  // Validate that we have the necessary data
  if (!order || !payment || !customer || !company) {
    return (
      <div className="receipt-container">
        <div className="receipt-error">
          <h3>Incomplete Receipt Data</h3>
          <p>Some receipt information is missing. Please try again or contact support.</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Ensure items array exists
  const items = Array.isArray(order.items) ? order.items : [];
  
  console.log("🛒 Rendering receipt with items:", items);

  return (
    <div className="receipt-container">
      {/* Action buttons (hidden in print) */}
      <div className="receipt-actions no-print">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Back to Orders
        </button>
        <div className="receipt-actions-right">
          <button className="btn btn-outline" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPDF} title="Opens print dialog - select 'Save as PDF' as destination">
            📥 Save as PDF
          </button>
        </div>
      </div>

      {/* Receipt document */}
      <div className="receipt-document">
        {/* Header */}
        <header className="receipt-header">
          <div className="receipt-company">
            <h1>{company?.name || "Smart Hardware Shop"}</h1>
            <p>{company?.address || "Address not available"}</p>
            <p>
              {company?.phone || "N/A"} | {company?.email || "N/A"}
            </p>
          </div>
          <div className="receipt-info">
            <h2>RECEIPT</h2>
            <p>
              <strong>Receipt #:</strong> {receipt?.receiptNumber || "N/A"}
            </p>
            <p>
              <strong>Date:</strong> {formatDate(receipt?.generatedAt)}
            </p>
          </div>
        </header>

        <hr className="receipt-divider" />

        {/* Customer Info */}
        <section className="receipt-section">
          <h3>Bill To:</h3>
          <p>
            <strong>{customer?.name || "N/A"}</strong>
          </p>
          <p>{customer?.email || "N/A"}</p>
          <p>Contact: {order?.contact || "N/A"}</p>
        </section>

        {/* Order Info */}
        <section className="receipt-section">
          <div className="receipt-meta-grid">
            <div>
              <p className="receipt-label">Order Number:</p>
              <p className="receipt-value">{order?.orderNumber || "N/A"}</p>
            </div>
            <div>
              <p className="receipt-label">Order Date:</p>
              <p className="receipt-value">{formatDate(order?.createdAt)}</p>
            </div>
            <div>
              <p className="receipt-label">Payment Method:</p>
              <p className="receipt-value">
                {payment?.method === "stripe" 
                  ? "Online Payment (Card)" 
                  : payment?.method === "slip" 
                  ? "Bank Transfer" 
                  : payment?.method || "N/A"}
                {payment?.cardBrand && payment?.cardLast4 && (
                  <span className="receipt-card-info">
                    {" "}
                    ({payment.cardBrand.toUpperCase()} •••• {payment.cardLast4})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="receipt-label">Payment Status:</p>
              <p className="receipt-value receipt-value--paid">
                {payment?.paymentStatus ? payment.paymentStatus.toUpperCase() : "N/A"}
              </p>
            </div>
          </div>
        </section>

        <hr className="receipt-divider" />

        {/* Items Table */}
        <section className="receipt-section">
          <h3>Order Items:</h3>
          <table className="receipt-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={item.productId || index}>
                    <td>{item.productName || "Unnamed Product"}</td>
                    <td>{item.quantity || 0}</td>
                    <td>{formatLKR(item.price || 0)}</td>
                    <td>{formatLKR((item.price || 0) * (item.quantity || 0))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                    No items found in this order
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <hr className="receipt-divider" />

        {/* Total */}
        <section className="receipt-section">
          <div className="receipt-total">
            <div className="receipt-total-row">
              <span>Subtotal:</span>
              <span>{formatLKR(order?.totalAmount || 0)}</span>
            </div>
            <div className="receipt-total-row receipt-total-row--final">
              <span>Total Paid:</span>
              <span>{formatLKR(payment?.amount || order?.totalAmount || 0)}</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="receipt-footer">
          <p>Thank you for your purchase!</p>
          <p className="receipt-footer-note">
            This is an official receipt for your order. For any inquiries, please contact us at{" "}
            {company?.email || "support@smarthardware.lk"} or {company?.phone || "+94 11 234 5678"}.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default Receipt;
