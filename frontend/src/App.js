import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import AuthProvider, { useAuth } from "./components/context/AuthContext";

import ProductList from "./components/Product/ProductList/ProductList";
import ProductForm from "./components/Product/ProductForm/ProductForm";
import UpdateProduct from "./components/UpdateProduct/UpdateProduct";
import CustomerProductList from "./components/CustomerProductList/CustomerProductList";
import SupplierProductForm from "./components/SupplierProduct/SupplierProductForm";
import SupplierProductList from "./components/SupplierProduct/SupplierProductList";
import SupplierAdminProductList from "./components/SupplierProduct/SupplierAdminProductList";
import UpdateSupplierProduct from "./components/SupplierProduct/UpdateSupplierProduct";
import ProductDetails from "./components/Product/ProductDetails";
import SupplierProductDetails from "./components/SupplierProduct/SupplierProductDetails";
import Dashboard from "./components/Dashboard/Dashboard";
import FinanceDashboard from "./components/Dashboard/FinanceDashboard";
import SalesDashboard from "./components/Dashboard/SalesDashboard";
import InventoryDashboard from "./components/Dashboard/InventoryDashboard";
import AdminDashboard from "./components/Admin/AdminDashboard";

import Home from "./components/Basics/Home";
import Header from "./components/Basics/Header";
import Footer from "./components/Basics/Footer";

import Login from "./components/Auth/Login";
import Register from "./components/Auth/Signup";

import "./App.css";

/* ---------------- Protected Route Wrapper ---------------- */
function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />; // not logged in

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />; // forbidden
  }

  return children;
}

/* ---------------- Guest Route Wrapper ---------------- */
function GuestRoute({ children }) {
  const { user } = useAuth();

  if (user) {
    // logged-in users can't access login/register
    if (user.role === "admin") return <Navigate to="/AdminDashboard" replace />;
    if (user.role === "supplier") return <Navigate to="/SalesDashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Header />

      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          
          {/* Guest-only routes */}
          <Route path="/login" element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }/>
          <Route path="/register" element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }/>

          {/* User accessible */}
          <Route path="/product/:id" element={
              <ProductDetails />
          }/>

          <Route path="/customer-products" element={
              <CustomerProductList />
          }/>

          <Route path="/dashboard" element={
            <PrivateRoute roles={["user", "supplier", "admin"]}>
              <Dashboard />
            </PrivateRoute>
          }/>

          <Route path="/FinanceDashboard" element={
            <PrivateRoute roles={["admin"]}>
              <FinanceDashboard/>
            </PrivateRoute>
          }/>

          <Route path="/SalesDashboard" element={
            <PrivateRoute roles={["admin"]}>
              <SalesDashboard/>
            </PrivateRoute>
          }/>

          <Route path="/InventoryDashboard" element={
            <PrivateRoute roles={["admin"]}>
              <InventoryDashboard/>
            </PrivateRoute>
          }/>

          <Route path="/AdminDashboard" element={
            <PrivateRoute roles={["admin"]}>
              <AdminDashboard/>
            </PrivateRoute>
          }/>

          {/* Supplier routes */}
          <Route path="/supplier-products" element={
            <PrivateRoute roles={["supplier", "admin"]}>
              <SupplierProductList />
            </PrivateRoute>
          }/>
          <Route path="/add-supplier-product" element={
            <PrivateRoute roles={["supplier", "admin"]}>
              <SupplierProductForm />
            </PrivateRoute>
          }/>
          <Route path="/update-supplier-product/:id" element={
            <PrivateRoute roles={["supplier", "admin"]}>
              <UpdateSupplierProduct />
            </PrivateRoute>
          }/>
          <Route path="/supplier-admin-product/:id" element={
            <PrivateRoute roles={["supplier", "admin"]}>
              <SupplierProductDetails />
            </PrivateRoute>
          }/>

          {/* Admin routes */}
          <Route path="/products" element={
            <PrivateRoute roles={["admin"]}>
              <ProductList />
            </PrivateRoute>
          }/>
          <Route path="/add-product" element={
            <PrivateRoute roles={["admin"]}>
              <ProductForm />
            </PrivateRoute>
          }/>
          <Route path="/update-product/:id" element={
            <PrivateRoute roles={["admin"]}>
              <UpdateProduct />
            </PrivateRoute>
          }/>
          <Route path="/admin-supplier-product" element={
            <PrivateRoute roles={["admin"]}>
              <SupplierAdminProductList />
            </PrivateRoute>
          }/>
        </Routes>
      </div>

      {/* Example: buttons visible only if logged in */}
      <RoleButtons />

      <Footer />
    </AuthProvider>
  );
}

/* ---------------- Conditional Navigation Buttons ---------------- */
function RoleButtons() {
  const { user } = useAuth();

  if (!user) return null; // hide if not logged in

  return (
    <div className="user-btn-container">
      {user.role === "user" && (
        <Link to="/customer-products"><button className="user-btn">User</button></Link>
      )}
      {user.role === "supplier" && (
        <Link to="/supplier-products"><button className="supplier-btn">Supplier</button></Link>
      )}
      {user.role === "admin" && (
        <>
          <Link to="/admin-supplier-product"><button className="admin-supplier-btn">Admin-Supplier</button></Link>
          <Link to="/add-product"><button className="add-product-btn">Admin-Add-Product</button></Link>
          <Link to="/add-supplier-product"><button className="add-product-btn">Admin-Form</button></Link>
          <Link to="/products"><button className="add-product-btn">Admin-list</button></Link>
        </>
      )}
    </div>
  );
}

export default App;
