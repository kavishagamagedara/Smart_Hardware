import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i; // Basic email regex
const strongPwd = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/; // At least 6 characters, with letters and numbers


export default function Signup() {
  const { signup } = useAuth(); 
  const navigate = useNavigate(); 
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    age: "",
    address: "",
    agree: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Animation variants
  const showcaseVariants = {
    hidden: { opacity: 0, x: -24 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };
  // Animation variants
  const formVariants = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: "easeOut", delay: 0.1 },
    },
  };

  // Update form field 
  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Form submission handler
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("Name is required"); // Basic name check
    if (!emailRe.test(form.email)) return setErr("Enter a valid email"); // Basic email format check
    if (!strongPwd.test(form.password)) 
      return setErr("Use letters & numbers (min 6)");  // Strong password: at least 6 characters, with letters and numbers
    if (form.password !== form.confirm) // Password confirmation check
      return setErr("Passwords do not match");
    if (!form.agree) return setErr("Please accept Terms & Privacy");
    try {
      setBusy(true);
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        age: form.age ? Number(form.age) : undefined,
        address: form.address || undefined,
      });
      navigate("/dashboard?tab=orders"); // Redirect to dashboard after successful signup
    } catch (ex) {
      setErr(ex.message || "Signup failed"); 
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-shell">
        <motion.section
          className="auth-showcase auth-showcase--signup"
          variants={showcaseVariants}
          initial="hidden"
          animate="show"
        >
          <span className="auth-badge">Smart Hardware</span>
          <h1 className="auth-title">Create your smart workspace HQ</h1>
          <p className="auth-subtitle">
            Unlock member-only pricing, track every delivery, and keep your crews in sync
            with effortless automation.
          </p>
          <ul className="auth-perks">
            <li>
              <span className="perk-icon">🧰</span> Personalized project dashboards
            </li>
            <li>
              <span className="perk-icon">📦</span> Live shipment &amp; stock alerts
            </li>
            <li>
              <span className="perk-icon">💬</span> Supplier collaboration tools
            </li>
          </ul>
          <div className="auth-cta">
            <p className="muted">Already with us?</p>
            <Link to="/login" className="btn btn-secondary">
              Sign in
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
            <h2>Join Smart Hardware</h2>
            <p className="small">We&apos;re excited to build with you.</p>
          </div>

          <div className="auth-toast" role="note">
            <span className="auth-toast__icon" aria-hidden="true">
              🎉
            </span>
            <div>
              <h3 className="auth-toast__title">Welcome aboard!</h3>
              <p className="auth-toast__body">
                Fill in your details below to unlock instant access to curated deals,
                shipment tracking, and project insights tailored for your team.
              </p>
            </div>
          </div>

          {err && (
            <div className="alert" role="alert" aria-live="assertive">
              {err}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              className="input"
              value={form.name}
              onChange={updateField("name")}
              placeholder="Jane Doe"
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className="input"
              type="email"
              value={form.email}
              onChange={updateField("email")}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-grid">
            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <div className="pwd-field">
                <input
                  id="signup-password"
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
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
              <p className="auth-hint">
                Use at least 6 characters with letters and numbers.
              </p>
            </div>

            <div className="auth-field">
              <label htmlFor="signup-confirm">Confirm password</label>
              <div className="pwd-field">
                <input
                  id="signup-confirm"
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
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={
                    showConfirm ? "Hide confirm password" : "Show confirm password"
                  }
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div className="auth-grid">
            <div className="auth-field">
              <label htmlFor="signup-age">Age (optional)</label>
              <input
                id="signup-age"
                className="input"
                type="number"
                value={form.age}
                onChange={updateField("age")}
                placeholder="eg: 25"
                min="17"
                inputMode="numeric"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="signup-address">Address (optional)</label>
              <input
                id="signup-address"
                className="input"
                value={form.address}
                onChange={updateField("address")}
                placeholder="123 Main St"
                autoComplete="street-address"
              />
            </div>
          </div>

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, agree: e.target.checked }))
              }
            />
            <span>I agree to the Terms &amp; Privacy Policy.</span>
          </label>

          <button className="btn btn-primary wide auth-submit" disabled={busy}>
            {busy ? "Creating..." : "Create account"}
          </button>

          <p className="small center auth-mobile-cta">
            Already have an account?{" "}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>
          <p className="small center auth-secondary-link">
            Want to partner with us?{" "}
            <Link to="/register-supplier" className="link">
              Register as a supplier
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
