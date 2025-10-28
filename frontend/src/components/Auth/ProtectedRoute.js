// src/Components/Auth/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();

  if (!user) {
    // ❌ No user → send to login
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // ❌ User exists but doesn’t have correct role
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Allowed
  return children;
}

export default ProtectedRoute;
