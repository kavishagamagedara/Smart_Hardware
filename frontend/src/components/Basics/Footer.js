import React from "react";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Footer.css";

function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const year = new Date().getFullYear();

  const goHomeAndScroll = (sectionId) => {
    if (!sectionId) return;

    if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: sectionId } });
      return;
    }

    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleNav = (path) => {
    if (!path) return;
    navigate(path);
  };

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="footer-logo">
            <span>SmartHardware</span>
          </div>
          <p>
            Streamline procurement, manage tooling, and keep every project on schedule with
            SmartHardware’s integrated hardware platform.
          </p>
          <div className="footer-social">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit SmartHardware on Facebook"
            >
              <Facebook size={18} aria-hidden="true" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit SmartHardware on Twitter"
            >
              <Twitter size={18} aria-hidden="true" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit SmartHardware on Instagram"
            >
              <Instagram size={18} aria-hidden="true" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit SmartHardware on LinkedIn"
            >
              <Linkedin size={18} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="footer-links">
          <h4>Quick Links</h4>
          <button type="button" onClick={() => goHomeAndScroll("hero")}>
            Overview
          </button>
          <button type="button" onClick={() => goHomeAndScroll("featured-products")}>
            Featured products
          </button>
          <button type="button" onClick={() => goHomeAndScroll("services")}>
            Services
          </button>
          <button type="button" onClick={() => goHomeAndScroll("testimonials")}>
            Testimonials
          </button>
          <button type="button" onClick={() => handleNav("/customer-products")}>
            Catalogue
          </button>
        </div>

        <div className="footer-links">
          <h4>Solutions</h4>
          <button type="button" onClick={() => handleNav("/InventoryDashboard")}>
            Inventory dashboard
          </button>
          <button type="button" onClick={() => handleNav("/CustomerOrders")}>
            Order tracking
          </button>
          <button type="button" onClick={() => handleNav("/caredashboard")}>
            Customer care
          </button>
          <button type="button" onClick={() => handleNav("/customercart")}>
            Shopping cart
          </button>
          <span>Enterprise onboarding</span>
        </div>

        <div className="footer-contact">
          <h4>Contact</h4>
          <div>
            <MapPin size={18} aria-hidden="true" />
            <span>123 Hardware Street, Industrial District, Colombo</span>
          </div>
          <div>
            <Phone size={18} aria-hidden="true" />
            <span>+94 11 456 7890</span>
          </div>
          <div>
            <Mail size={18} aria-hidden="true" />
            <span>support@smarthardware.com</span>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {year} SmartHardware. All rights reserved.</p>
        <div className="footer-meta-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:support@smarthardware.com">Support</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
