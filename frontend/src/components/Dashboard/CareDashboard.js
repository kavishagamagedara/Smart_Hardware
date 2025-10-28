// Customer care dashboard helper route wraps the unified dashboard.
import React from "react";
import Dashboard from "./Dashboard";

export default function CustomerCareDashboard() {
  return <Dashboard initialTab="care" />;
}
