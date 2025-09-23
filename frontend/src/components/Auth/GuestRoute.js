// src/Components/Auth/GuestRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function GuestRoute({ children }) {
  const { user } = useAuth();

  if (user) {
    // ✅ Already logged in → go to correct dashboard
    if (user.role === "admin") return <Navigate to="/AdminDashboard" replace />;
    if (user.role === "supplier") return <Navigate to="/SalesDashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default GuestRoute;
