import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i; // Basic email regex
const strongPwd = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/; // At least 6 characters, with letters and numbers

// Supplier signup component
export default function SupplierSignup() {
  const { registerSupplier } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    address: "",
    agree: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const showcaseVariants = {
    hidden: { opacity: 0, x: -24 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const formVariants = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: "easeOut", delay: 0.1 },
    },
  };

  // Helper to update form fields
  const updateField = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // Form submission handler
  const submit = async (event) => {
    event.preventDefault();
    setErr("");

    if (!form.name.trim()) return setErr("Business name is required"); // Basic name check
    if (!emailRe.test(form.email)) return setErr("Enter a valid email address"); // Basic email format check
    if (!strongPwd.test(form.password)) 
      return setErr("Password must include letters and numbers (min 6 characters)"); // Strong password: at least 6 characters, with letters and numbers
    if (form.password !== form.confirm) return setErr("Passwords do not match"); // Password confirmation check
    if (!form.agree) return setErr("Please accept the supplier terms"); // Must agree to terms

    try {
      setBusy(true);
      await registerSupplier({
        name: form.name,
        email: form.email,
        password: form.password,
        address: form.address || undefined,
      });
      navigate("/SupplierDashboard");
    } catch (ex) {
      setErr(ex.message || "Failed to create supplier account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-shell auth-shell--supplier">
        <motion.section
          className="auth-showcase auth-showcase--supplier"
          variants={showcaseVariants}
          initial="hidden"
          animate="show"
        >
          <span className="auth-badge">Smart Hardware Partners</span>
          <h1 className="auth-title">Supplier success starts here</h1>
          <p className="auth-subtitle">
            Connect your catalog, receive instant RFQs, and get paid faster with our
            streamlined procurement hub.
          </p>
          <ul className="auth-perks">
            <li>
              <span className="perk-icon">📈</span> Real-time demand insights
            </li>
            <li>
              <span className="perk-icon">🧾</span> Automated invoicing &amp; PO workflows
            </li>
            <li>
              <span className="perk-icon">🚚</span> Logistics tracking for every delivery
            </li>
          </ul>
          <div className="auth-cta">
            <p className="muted">Already onboard?</p>
            <Link to="/login" className="btn btn-secondary">
              Supplier sign in
            </Link>
          </div>
        </motion.section>

        <motion.form
          className="auth-card auth-card--form"
          onSubmit={submit}
          noValidate
          variants={formVariants}
          initial="hidden"
          animate="show"
        >
          <div className="auth-card__header">
            <h2>Register as a supplier</h2>
            <p className="small">We just need a few details to open your portal.</p>
          </div>

          <div className="auth-toast" role="note">
            <span className="auth-toast__icon" aria-hidden="true">
              🤝
            </span>
            <div>
              <h3 className="auth-toast__title">Welcome, partner!</h3>
              <p className="auth-toast__body">
                Complete the form and our vendor success team will help you list products,
                sync inventory, and reach new buyers instantly.
              </p>
            </div>
          </div>

          {err && (
            <div className="alert" role="alert" aria-live="assertive">
              {err}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="supplier-name">Business / contact name</label>
            <input
              id="supplier-name"
              className="input"
              value={form.name}
              onChange={updateField("name")}
              placeholder="Acme Supplies"
              autoComplete="organization"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="supplier-email">Work email</label>
            <input
              id="supplier-email"
              className="input"
              type="email"
              value={form.email}
              onChange={updateField("email")}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-grid">
            <div className="auth-field">
              <label htmlFor="supplier-password">Password</label>
              <div className="pwd-field">
                <input
                  id="supplier-password"
                  className="input"
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={updateField("password")}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="icon-btn toggle-visibility"
                  onClick={() => setShowPwd((value) => !value)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
              <p className="auth-hint">
                Minimum 6 characters with at least one letter and one number.
              </p>
            </div>
            <div className="auth-field">
              <label htmlFor="supplier-confirm">Confirm password</label>
              <div className="pwd-field">
                <input
                  id="supplier-confirm"
                  className="input"
                  type={showConfirm ? "text" : "password"}
                  value={form.confirm}
                  onChange={updateField("confirm")}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="icon-btn toggle-visibility"
                  onClick={() => setShowConfirm((value) => !value)}
                  aria-label={
                    showConfirm ? "Hide confirm password" : "Show confirm password"
                  }
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="supplier-address">Business address (optional)</label>
            <input
              id="supplier-address"
              className="input"
              value={form.address}
              onChange={updateField("address")}
              placeholder="123 Industrial Park"
              autoComplete="street-address"
            />
          </div>

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, agree: event.target.checked }))
              }
            />
            <span>
              I agree to the Smart Hardware supplier partnership terms and service
              policies.
            </span>
          </label>

          <button className="btn btn-primary wide auth-submit" disabled={busy}>
            {busy ? "Creating supplier account..." : "Create supplier account"}
          </button>

          <p className="small center auth-mobile-cta">
            Already have a portal?{" "}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>
          <p className="small center auth-secondary-link">
            Need a customer seat instead?{" "}
            <Link to="/register" className="link">
              Register here
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
