// src/Components/Auth/Login.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!emailRe.test(form.email)) return setErr("Enter a valid email");
    if (!form.password || form.password.length < 6)
      return setErr("Password too short");

    try {
      setBusy(true);
      const user = await login(form.email, form.password);

      if (user.role === "admin") navigate("/AdminDashboard");
      else if (user.role === "supplier") navigate("/dashboard");
      else navigate("/CustomerDashboard");

    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h2>Sign in</h2>
        <p className="small">Welcome back</p>

        {err && <div className="alert">{err}</div>}

        <label>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
          autoComplete="username"
        />

        <label>Password</label>
        <div className="pwd-field">
          <input
            type={showPwd ? "text" : "password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowPwd((s) => !s)}
            aria-label="Toggle password visibility"
          >
            {showPwd ? "🙈" : "👁️"}
          </button>
        </div>

        <button className="btn btn-primary wide" disabled={busy}>
          {busy ? "Signing in..." : "Sign In"}
        </button>

        <p className="small center" style={{ marginTop: 10 }}>
          No account?{" "}
          <Link to="/register" className="link">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
