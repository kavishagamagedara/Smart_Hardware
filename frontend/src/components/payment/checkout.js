// src/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";

const pk = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
console.log("Stripe publishable key loaded:", pk ? "Yes" : "No");
if (!pk) {
  console.error("Missing REACT_APP_STRIPE_PUBLISHABLE_KEY in .env");
  throw new Error("Missing REACT_APP_STRIPE_PUBLISHABLE_KEY in .env");
}
const stripePromise = loadStripe(pk);

// Debug stripe loading
stripePromise.then((stripe) => {
  console.log("Stripe.js loaded:", stripe ? "Success" : "Failed");
}).catch((error) => {
  console.error("Failed to load Stripe.js:", error);
});

function CheckoutForm({ order }) {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [succeeded, setSucceeded] = useState(false);
  const [peReady, setPeReady] = useState(false);
  const [elementsReady, setElementsReady] = useState(false);

  // Check if Elements is ready
  useEffect(() => {
    if (elements) {
      setElementsReady(true);
      console.log("Elements instance ready");
      
      // Fallback: if PaymentElement doesn't call onReady within 10 seconds, assume it's ready
      const fallbackTimer = setTimeout(() => {
        if (!peReady) {
          console.log("PaymentElement onReady timeout - assuming ready");
          setPeReady(true);
        }
      }, 10000);
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [elements, peReady]);

  // Debug logging
  useEffect(() => {
    console.log("CheckoutForm state:", {
      stripe: !!stripe,
      elements: !!elements,
      elementsReady,
      peReady,
      clientSecret: elements?._clientSecret
    });
  }, [stripe, elements, elementsReady, peReady]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    console.log("Payment submission attempted");
    console.log("Form state:", {
      stripe: !!stripe,
      elements: !!elements,
      elementsReady,
      peReady,
      clientSecret: elements?._clientSecret
    });

    // More relaxed ready state check - just need stripe and elements
    if (!stripe || !elements) {
      console.log("Stripe or Elements not ready");
      setErrorMessage("Payment system loading. Please wait...");
      return;
    }

    if (!peReady) {
      console.log("PaymentElement not ready yet");
      setErrorMessage("Payment form loading. Please wait a moment...");
      return;
    }

    // Front-end validation (prevents 400 on incomplete details)
    console.log("Submitting elements for validation...");
    const { error: submitError } = await elements.submit();
    if (submitError) {
      console.error("Elements submit error:", submitError);
      setErrorMessage(submitError.message || "Please check your details.");
      return;
    }
    console.log("Elements submitted successfully");

    setSubmitting(true);
    
    try {
      console.log("Confirming payment with Stripe...");
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-result?orderId=${order.orderId}`,
          receipt_email: order.customerEmail || undefined,
        },
        redirect: "if_required",
      });

      console.log("Payment confirmation result:", { error, paymentIntent });

      if (error) {
        console.error("Payment confirmation error:", error);
        
        // Handle specific error types
        if (error.code === 'payment_intent_unexpected_state') {
          setErrorMessage("This payment has already been processed. Please refresh the page and try again.");
          console.log("Payment intent in unexpected state - needs refresh");
        } else if (error.type === 'card_error') {
          setErrorMessage(`Card Error: ${error.message}`);
        } else if (error.type === 'validation_error') {
          setErrorMessage(`Please check your payment details: ${error.message}`);
        } else {
          setErrorMessage(error.message || "Payment failed");
        }
        
        setSubmitting(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        setSucceeded(true);
        console.log("Payment succeeded:", paymentIntent.id);
        
        // Update payment status in MongoDB
        try {
          const response = await fetch("/api/payments/stripe/update-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              status: "paid"
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log("Payment status updated in MongoDB:", result);
          } else {
            console.error("Failed to update payment status in MongoDB");
          }
        } catch (updateError) {
          console.error("Error updating payment status:", updateError);
        }
      } else if (paymentIntent?.status === "processing") {
        setErrorMessage("Your payment is being processed. Please wait...");
      } else if (paymentIntent?.status === "requires_action") {
        setErrorMessage("Additional action required. Please complete the payment.");
      } else {
        console.log("Unexpected payment status:", paymentIntent?.status);
        setErrorMessage("Payment status unclear. Please check your payment method.");
      }
      
      setSubmitting(false);
    } catch (err) {
      console.error("Payment error:", err);
      setErrorMessage("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  // Styling omitted (same as your version)...
  // [keep your styles unchanged]

  return (
    <div style={{ minHeight: "60vh", padding: 16, background: "#0b1220", color: "#e2e8f0" }}>
      <div style={{
        maxWidth: 520, margin: "32px auto", background: "rgba(15,23,42,0.9)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)"
      }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 480, margin: "0 auto" }}>
          <PaymentElement 
            onReady={() => {
              console.log("PaymentElement is ready");
              setPeReady(true);
            }}
            onLoaderStart={() => {
              console.log("PaymentElement loader started");
            }}
            onLoadError={(error) => {
              console.error("PaymentElement load error:", error);
            }}
          />
          <button
            disabled={!stripe || !elements || submitting}
            style={{
              marginTop: 16, width: "100%", padding: "12px 14px", borderRadius: 12,
              background: "#2563eb", color: "#fff", border: "1px solid #2563eb",
              cursor: "pointer", fontWeight: 600, boxShadow: "0 6px 16px rgba(37,99,235,0.35)",
              opacity: !stripe || !elements || submitting ? 0.7 : 1,
            }}
            type="submit"
          >
            {submitting ? "Processing..." : 
             !stripe ? "Loading Stripe..." :
             !elements ? "Loading Payment..." :
             !peReady ? "Payment Form Loading..." :
             "Pay"}
          </button>

          {errorMessage && (
            <div style={{
              color: "#fecdd3", background: "rgba(244,63,94,0.12)",
              border: "1px solid rgba(244,63,94,0.35)", padding: "10px 12px",
              borderRadius: 12, marginTop: 12, fontSize: 14,
            }}>
              {errorMessage}
            </div>
          )}

          {succeeded && (
            <div style={{
              color: "#bbf7d0", background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)", padding: "10px 12px",
              borderRadius: 12, marginTop: 12, fontSize: 14,
            }}>
              Payment complete!
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState(null); // 'stripe' or 'slip'
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const order = useMemo(
    () => ({
      orderId: "ORD-2069",
      paymentId: "p3652",
      paymentName: "Order #2025",
      amount: 750000, // cents
      currency: "lkr",
      customerEmail: "wadda@gmail.com",
    }),
    []
  );

  // Payment method selection handler
  const handlePaymentMethodSelect = (method) => {
    if (method === 'slip') {
      // Navigate to slip upload page
      navigate('/slip-upload');
    } else {
      setPaymentMethod(method);
    }
  };

  useEffect(() => {
    // Only create payment intent if Stripe method is selected
    if (paymentMethod !== 'stripe') {
      setLoading(false);
      return;
    }

    console.log("CheckoutPage: Starting payment intent creation");
    
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const url = process.env.REACT_APP_API_URL
          ? `${process.env.REACT_APP_API_URL}/api/payments/stripe/create-intent`
          : `/api/payments/stripe/create-intent`;

        console.log("Creating payment intent for order:", order);
        console.log("API URL:", url);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(order),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("API Error:", res.status, errorText);
          throw new Error(`Create intent failed ${res.status}: ${errorText}`);
        }
        
        const data = await res.json();
        console.log("Payment intent created successfully:", data);
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          console.log("Client secret set:", data.clientSecret);
        } else {
          throw new Error("No client secret received from server");
        }
        
      } catch (err) {
        console.error("Failed to create payment intent:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [order, paymentMethod]);

  // Payment method selection screen
  if (!paymentMethod) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px"
      }}>
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "40px",
          maxWidth: "500px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          textAlign: "center"
        }}>
          <h2 style={{
            color: "#333",
            marginBottom: "30px",
            fontSize: "28px",
            fontWeight: "600"
          }}>
            Select Payment Method
          </h2>
          
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px"
          }}>
            <button
              onClick={() => handlePaymentMethodSelect('stripe')}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "20px",
                fontSize: "18px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "0 5px 15px rgba(102, 126, 234, 0.3)"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 5px 15px rgba(102, 126, 234, 0.3)";
              }}
            >
              💳 Pay Online (Credit/Debit Card)
            </button>
            
            <button
              onClick={() => handlePaymentMethodSelect('slip')}
              style={{
                background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "20px",
                fontSize: "18px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "0 5px 15px rgba(17, 153, 142, 0.3)"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(17, 153, 142, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 5px 15px rgba(17, 153, 142, 0.3)";
              }}
            >
              📄 Upload Payment Slip
            </button>
          </div>
          
          <p style={{
            color: "#666",
            marginTop: "20px",
            fontSize: "14px"
          }}>
            Choose your preferred payment method to continue
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1220",
          color: "#94a3b8",
          fontWeight: 600,
        }}
      >
        Loading checkout…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1220",
          color: "#f87171",
          fontWeight: 600,
          textAlign: "center",
          padding: "20px",
        }}
      >
        <div>
          <div>Error loading payment system:</div>
          <div style={{ fontSize: "14px", marginTop: "10px" }}>{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1220",
          color: "#94a3b8",
          fontWeight: 600,
        }}
      >
        No payment session available
      </div>
    );
  }

  console.log("Rendering Elements with clientSecret:", clientSecret);
  const options = { clientSecret, appearance: { theme: "stripe" } };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{
        maxWidth: "600px",
        margin: "0 auto"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "30px"
        }}>
          <button
            onClick={() => setPaymentMethod(null)}
            style={{
              background: "white",
              border: "2px solid #667eea",
              color: "#667eea",
              borderRadius: "8px",
              padding: "8px 16px",
              marginRight: "20px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            ← Back
          </button>
          <h2 style={{
            color: "white",
            margin: "0",
            fontSize: "28px",
            fontWeight: "600"
          }}>
            Complete Payment
          </h2>
        </div>
        
        <Elements stripe={stripePromise} options={options} key={clientSecret}>
          <CheckoutForm order={order} />
        </Elements>
      </div>
    </div>
  );
}
