import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

function Header() {
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ get logged-in user

  const handleDashboardRedirect = () => {
    if (!user) {
      navigate("/login"); // just in case
      return;
    }

    if (user.role === "admin") {
      navigate("/AdminDashboard");
    } else if (user.role === "supplier") {
      navigate("/SalesDashboard");
    } else {
      navigate("/dashboard"); // default for normal users
    }
  };

  return (
    <header className="header">
      <div className="logo-section">
        <img src="/images/logoo.png" alt="Logo" className="logo-image" />
        <h1 className="logo-text">Smart Hardware</h1>
      </div>

      <nav className="nav-links">
        <a href="/customer-products">Products</a>
        <a href="#pricing">About Us</a>
        <a href="#contact">Contact Us</a>
        <a href="/">Home</a>
      </nav>

      {/* ✅ Show button only if user exists */}
      {user && (
        <button className="btn-primary" onClick={handleDashboardRedirect}>
          Get in touch
        </button>
      )}
    </header>
  );
}

export default Header;
