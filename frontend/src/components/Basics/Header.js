import React from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";

function Header() {
  const navigate = useNavigate();

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

      <button className="btn-primary" onClick={() => navigate("/login")}>
        Get in touch
      </button>
    </header>
  );
}

export default Header;
