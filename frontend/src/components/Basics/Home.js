import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // ✅ Import Auth
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ Get current user

  return (
    <div className="home-container">
      <center>
        <img src="/images/logoo.png" alt="Logo" className="logo-body-image" />
      </center>
      <main className="hero">
        <h2>
          OSH Hardware PVT Ltd <br />
          <span className="highlight">Hello There.....</span>
        </h2>
        <p>We are OSH Hardware Pvt Ltd.</p>

        {/* ✅ Show only if user NOT logged in */}
        {!user && (
          <div className="cta-buttons">
            <button
              className="btn-primary"
              onClick={() => navigate("/register")}
            >
              Sign Up
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          </div>
        )}

        <div className="showcase">
          <img
            src="/images/combination-cutting-plier-500x500.webp"
            alt="art1"
          />
          <img src="/images/POW.POW.627290870_1725432863741.webp" alt="art2" />
          <img
            src="/images/realistic-hand-tools-claw-hammer-with-yellow-accents-and-adjustable-wrench-free-png.webp"
            alt="art3"
          />
          <img src="/images/Interiror.avif" alt="art4" />
          <img src="/images/istockphoto-1448349078-612x612.jpg" alt="art5" />
        </div>
      </main>
    </div>
  );
}

export default Home;
