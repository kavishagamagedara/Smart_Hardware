// src/Components/Auth/Login.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

// Simple email regex for basic validation
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i; 

// Strong password: at least 6 characters, with letters and numbers
export default function Login() { 
  const { login } = useAuth(); // Get login function from context
  const navigate = useNavigate(); 
  // Form state
  const [form, setForm] = useState({ email: "", password: "" }); 
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Animation variants
  const showcaseVariants = {
    hidden: { opacity: 0, x: -28 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };
  // Animation variants
  const formVariants = {
    hidden: { opacity: 0, y: 22 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: "easeOut", delay: 0.1 },
    },
  };
  // Form submission handler
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    // Validate email and password
    if (!emailRe.test(form.email)) return setErr("Enter a valid email"); // Basic email format check
    if (!form.password || form.password.length < 6) // Strong password: at least 6 characters, with letters and numbers
      return setErr("Password too short");

    try {
      setBusy(true);
  const { token } = await login(form.email, form.password); // Call login from context

      if (token) {
        localStorage.setItem("token", token);
      }

      navigate("/", { replace: true }); // Redirect to home/dashboard on successful login

    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };
// Render the login form
  return (
    <div className="auth-wrap">
      <div className="auth-shell">
        <motion.section
          className="auth-showcase"
          variants={showcaseVariants}
          initial="hidden"
          animate="show"
        >
          <span className="auth-badge">Smart Hardware</span>
          <h1 className="auth-title">Sign back in to keep building</h1>
          <p className="auth-subtitle">
            Stay in sync with live inventory, orders, and supplier updates across your
            smart hardware ecosystem.
          </p>
          <ul className="auth-perks">
            <li>
              <span className="perk-icon">⚡</span> Lightning-fast order tracking
            </li>
            <li>
              <span className="perk-icon">🛡️</span> Secure, role-based dashboards
            </li>
            <li>
              <span className="perk-icon">🤝</span> Collaborative supplier workspace
            </li>
          </ul>
          <div className="auth-cta">
            <p className="muted">New here?</p>
            <Link to="/register" className="btn btn-secondary">
              Create an account
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
            <h2>Welcome back</h2>
            <p className="small">Sign in to access your Smart Hardware dashboard.</p>
          </div>

          {err && (
            <div className="alert" role="alert" aria-live="assertive">
              {err}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <div className="pwd-field">
              <input
                id="login-password"
                type={showPwd ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
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
          </div>

          <button className="btn btn-primary wide auth-submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>

          <p className="small center auth-mobile-cta">
            New to Smart Hardware?{" "}
            <Link to="/register" className="link">
              Create an account
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
