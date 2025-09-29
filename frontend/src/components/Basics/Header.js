import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout, theme, toggleTheme } = useAuth();

  const initials = useMemo(() => {
    const n = (user?.name || "G U").trim().split(/\s+/);
    return (n[0]?.[0] || "G").toUpperCase() + (n[1]?.[0] || "").toUpperCase();
  }, [user?.name]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const goto = (href) => {
    navigate(href);
    setMenuOpen(false);
  };

  // Improved dashboard redirect logic for all roles
  const handleDashboardRedirect = () => {
    if (!user) return navigate("/login");
    const role = String(user.role || "").toLowerCase();
    const isManager = role.includes("manager") || role.includes("manger");
    if (role === "admin" || (isManager && !role.includes("care") && role !== "finance manager")) navigate("/AdminDashboard");
    else if (role === "finance manager") navigate("/FinanceDashboard");
    else if (role === "customer care manager" || role.includes("care")) navigate("/caredashboard");
    else if (role === "supplier") navigate("/dashboard");
    else navigate("/CustomerDashboard");
    setMenuOpen(false);
  };

  const handleProfileRedirect = () => {
    if (!user) return navigate("/login");
    const role = String(user.role || "").toLowerCase();
    const isManager = role.includes("manager") || role.includes("manger");
    if (role === "admin" || (isManager && !role.includes("care"))) navigate("/AdminDashboard#profile");
    else if (role === "customer care manager" || role.includes("care")) navigate("/caredashboard#profile");
    else if (role === "supplier") navigate("/dashboard#profile");
    else navigate("/CustomerDashboard#profile");
    setMenuOpen(false);
  };

  // close dropdown on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="header smart-hardware-header">
      {/* Left: brand */}
      <div
        className="logo-section"
        onClick={() => navigate("/")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/")}
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        <img src="/images/logoo.png" alt="Logo" className="logo-image" style={{ height: 48, width: 48, borderRadius: 12, boxShadow: "0 2px 8px #0002" }} />
        <div className="logo-text" style={{ fontWeight: 900, fontSize: 24, letterSpacing: 1, color: "#1a237e" }}>Smart Hardware</div>
      </div>

      {/* Center: nav */}
      <nav className="nav-links" aria-label="Primary" style={{ fontWeight: 600, fontSize: 17 }}>
        <a
          className={pathname === "/" ? "active" : ""}
          href="/"
          onClick={(e) => { e.preventDefault(); goto("/"); }}
        >
          Home
        </a>
        <a
          className={pathname.startsWith("/customer-products") ? "active" : ""}
          href="/customer-products"
          onClick={(e) => { e.preventDefault(); goto("/customer-products"); }}
        >
          Products
        </a>
        <a
          className={pathname === "/about" ? "active" : ""}
          href="/about"
          onClick={(e) => { e.preventDefault(); goto("/about"); }}
        >
          About Us
        </a>
        <a
          className={pathname === "/contact" ? "active" : ""}
          href="/contact"
          onClick={(e) => { e.preventDefault(); goto("/contact"); }}
        >
          Contact Us
        </a>
      </nav>

      {/* Right: theme toggle + auth */}
      <div className="right-side" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* dark/light toggle moved here */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="btn-secondary"
          style={{ borderRadius: 12, padding: "6px 10px", fontSize: 20 }}
        >
          {theme === "dark" ? "🌙" : "🌞"}
        </button>

        {user ? (
          <div className="avatar-wrap">
            <button
              ref={btnRef}
              className="avatar"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="user-menu"
              title={user.name || user.email}
              style={{ border: "2px solid #1a237e", background: "#fff", color: "#1a237e" }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" />
              ) : (
                <span className="initials" aria-hidden="true">{initials}</span>
              )}
            </button>

            {menuOpen && (
              <div id="user-menu" ref={menuRef} className="menu card" role="menu" style={{ minWidth: 220 }}>
                <div className="menu-header" style={{ borderBottom: "1px solid #eee", marginBottom: 8, paddingBottom: 8 }}>
                  <div className="avatar small" aria-hidden="true">
                    <span className="initials">{initials}</span>
                  </div>
                  <div style={{ lineHeight: 1.1 }}>
                    <div style={{ fontWeight: 900 }}>{user?.name || "User"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.email}</div>
                  </div>
                </div>
                <button role="menuitem" onClick={handleDashboardRedirect} style={{ fontWeight: 600 }}>📊 Dashboard</button>
                <button role="menuitem" onClick={handleProfileRedirect}>👤 Profile</button>
                <button role="menuitem" className="danger" onClick={logout}>🚪 Logout</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => goto("/login")}>Login</button>
            <button className="btn-primary" onClick={() => goto("/register")}>Sign up</button>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
