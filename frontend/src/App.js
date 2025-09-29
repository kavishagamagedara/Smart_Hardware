// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "./components/context/AuthContext";
import { CartProvider } from "./components/Order/Customer/CartContext";
import { AdminCartProvider } from "./components/Order/Admin/AdminCartContext";

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
import CustomerDashboard from "./components/Dashboard/CustomerDashboard";

import CustomerCart from "./components/Order/Customer/Cart";
import Checkout from "./components/Order/Customer/Checkout";
import CustomerOrders from "./components/Order/Customer/CustomerOrders";
import CancelledOrders from "./components/Order/Customer/CancelledOrders";
import ReceivedOrders from "./components/Order/Supplier/ReceivedOrders";

import AdminCart from "./components/Order/Admin/AdminCart";
import AdminCheckout from "./components/Order/Admin/AdminCheckout";
import AdminOrders from "./components/Order/Admin/AdminOrders";
import AdminUpdateOrder from "./components/Order/Admin/AdminUpdateOrder";

import PaymentSuccess from "./components/payment/PaymentSuccess";

import SubmitReview from "./components/Reviews_&_Feedback/SubmitReviewNew"
import ProductReviews from "./components/Reviews_&_Feedback/ProductReviews";
import CareDashboard from "./components/Dashboard/CareDashboard";

import Home from "./components/Basics/Home";
import Header from "./components/Basics/Header";
import Footer from "./components/Basics/Footer";

import Login from "./components/Auth/Login";
import Register from "./components/Auth/Signup";

import { useAuth } from "./components/context/AuthContext";
import "./App.css";

/* ---------------- Protected Route Wrapper ---------------- */
function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  // Normalize role for robust matching
  const role = String(user.role || "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (roles && !roles.map(r => String(r).replace(/[_-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase()).includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/* ---------------- Guest Route Wrapper ---------------- */
function GuestRoute({ children }) {
  const { user } = useAuth();
  if (user) {
    const role = String(user.role || "")
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (role === "admin") return <Navigate to="/AdminDashboard" replace />;
    if (role === "supplier") return <Navigate to="/SalesDashboard" replace />;
    if (role === "customer care manager") return <Navigate to="/caredashboard" replace />;
    return <Navigate to="/CustomerDashboard" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      {/* ✅ Admin Cart Provider */}
      <AdminCartProvider>
        {/* ✅ Customer Cart Provider */}
        <CartProvider>
          <Header />

          <div className="content">
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Guest routes */}
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

              {/* Customer routes */}
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/customer-products" element={<CustomerProductList />} />
              <Route path="/CustomerDashboard" element={
                <PrivateRoute roles={["user"]}><CustomerDashboard /></PrivateRoute>
              } />
              <Route path="/customercart" element={
                <PrivateRoute roles={["user"]}><CustomerCart /></PrivateRoute>
              } />
              <Route path="/PaymentSuccess" element={
                <PrivateRoute roles={["user"]}><PaymentSuccess /></PrivateRoute>
              } />
              <Route path="/Checkout" element={
                <PrivateRoute roles={["user"]}><Checkout /></PrivateRoute>
              } />
              <Route path="/add-review" element={
                <PrivateRoute roles={["user"]}><SubmitReview /></PrivateRoute>
              } />
              <Route path="/CustomerOrders" element={
                <PrivateRoute roles={["user","admin"]}><CustomerOrders /></PrivateRoute>
              } />
              <Route path="/CancelledOrders" element={
                <PrivateRoute roles={["user","admin"]}><CancelledOrders /></PrivateRoute>
              } />

              {/* Admin routes */}
              <Route path="/AdminDashboard" element={
                <PrivateRoute roles={["admin"]}><AdminDashboard /></PrivateRoute>
              } />
              <Route path="/AdminCart" element={
                <PrivateRoute roles={["admin"]}><AdminCart /></PrivateRoute>
              } />
              <Route path="/AdminUpdateOrder/:id" element={
                <PrivateRoute roles={["admin"]}><AdminUpdateOrder /></PrivateRoute>
              } />
              <Route path="/AdminCheckout" element={
                <PrivateRoute roles={["admin"]}><AdminCheckout /></PrivateRoute>
              } />
              <Route path="/products" element={
                <PrivateRoute roles={["admin"]}><ProductList /></PrivateRoute>
              } />
              AdminOrders
              <Route path="/AdminOrders" element={
                <PrivateRoute roles={["admin"]}><AdminOrders /></PrivateRoute>
              } />
              <Route path="/add-product" element={
                <PrivateRoute roles={["admin"]}><ProductForm /></PrivateRoute>
              } />
              <Route path="/update-product/:id" element={
                <PrivateRoute roles={["admin"]}><UpdateProduct /></PrivateRoute>
              } />
              <Route path="/admin-supplier-product" element={
                <PrivateRoute roles={["admin"]}><SupplierAdminProductList /></PrivateRoute>
              } />
              
              <Route path="/caredashboard" element={
                <PrivateRoute roles={["customer care manager","admin"]}><CareDashboard /></PrivateRoute>
              } />

              {/* Supplier routes */}
              <Route path="/supplier-products" element={
                <PrivateRoute roles={["user","supplier","admin"]}><SupplierProductList /></PrivateRoute>
              } />
              <Route path="/product/:id/reviews" element={<ProductReviews />} />
              <Route path="/add-supplier-product" element={
                <PrivateRoute roles={["user","supplier","admin"]}><SupplierProductForm /></PrivateRoute>
              } />
              <Route path="/update-supplier-product/:id" element={
                <PrivateRoute roles={["supplier","admin"]}><UpdateSupplierProduct /></PrivateRoute>
              } />
              ReceivedOrders
              <Route path="/supplier-admin-product/:id" element={
                <PrivateRoute roles={["supplier","admin"]}><SupplierProductDetails /></PrivateRoute>
              } />
               <Route path="/ReceivedOrders" element={
                <PrivateRoute roles={["supplier"]}><ReceivedOrders /></PrivateRoute>
              } />

              {/* Dashboards */}
              <Route path="/dashboard" element={
                <PrivateRoute roles={["user","supplier","admin"]}><Dashboard /></PrivateRoute>
              } />
              <Route path="/FinanceDashboard" element={
                <PrivateRoute roles={["admin"]}><FinanceDashboard /></PrivateRoute>
              } />
              <Route path="/SalesDashboard" element={
                <PrivateRoute roles={["admin"]}><SalesDashboard /></PrivateRoute>
              } />
              <Route path="/InventoryDashboard" element={
                <PrivateRoute roles={["admin"]}><InventoryDashboard /></PrivateRoute>
              } />
            </Routes>
          </div>

          <Footer />
        </CartProvider>
      </AdminCartProvider>
    </AuthProvider>
  );
}

export default App;
