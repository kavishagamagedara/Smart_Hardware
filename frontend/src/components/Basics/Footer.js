import React from "react";
//import { useNavigate } from "react-router-dom";
import "./Footer.css";

function Footer() {
  //const navigate = useNavigate();

  return (
    <footer className="footer">
      <div className="footer-logo-section">
        <img src="/images/logoo.png" alt="Logo" className="footer-logo-image" />
        <h1 className="footer-logo-text">Smart Hardware</h1>
      </div>

      <nav className="footer-nav-links">
        <a href="/customer-products">Products</a>
        <a href="#pricing">About Us</a>
        <a href="#contact">Contact Us</a>
        <a href="/">Home</a>
      </nav>

      <p className="footer-copy">© {new Date().getFullYear()} Smart Hardware. All rights reserved.</p>
    </footer>
  );
}

export default Footer;
