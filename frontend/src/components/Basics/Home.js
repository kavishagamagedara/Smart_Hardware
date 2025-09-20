import React from "react";
//import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {

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
        <p>
          We are OSH Hardware Pvt Ltd.
        </p>

        <div className="cta-buttons">
          <button className="btn-primary">Sign Up</button>
          <button className="btn-secondary">Sign In</button>
        </div>

        <div className="showcase">
          <img src="/images/combination-cutting-plier-500x500.webp" alt="art1" />
          <img src="/images/POW.POW.627290870_1725432863741.webp" alt="art1" />
          <img src="/images/realistic-hand-tools-claw-hammer-with-yellow-accents-and-adjustable-wrench-free-png.webp" alt="art1" />
          <img src="/images/Interiror.avif" alt="art1" />
          <img src="/images/istockphoto-1448349078-612x612.jpg" alt="art1" />
        </div>
      </main>
    </div>
  );
}

export default Home;
