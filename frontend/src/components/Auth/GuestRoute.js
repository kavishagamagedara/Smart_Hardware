// src/Components/Auth/GuestRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardRoute } from "../../utils/roles";

function GuestRoute({ children }) {
  const { user } = useAuth();

  if (user) {
    // ✅ Already logged in → go to correct dashboard
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return children;
}

export default GuestRoute;
