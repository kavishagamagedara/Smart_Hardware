// src/App.js
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import SupplierDashboard from "./components/Dashboard/SupplierDashboard";

import CustomerCart from "./components/Order/Customer/Cart";
import Checkout from "./components/Order/Customer/Checkout";
import CustomerOrders from "./components/Order/Customer/CustomerOrders";
import CancelledOrders from "./components/Order/Customer/CancelledOrders";
import Receipt from "./components/Order/Customer/Receipt";
import ReceivedOrders from "./components/Order/Supplier/ReceivedOrders";

import AdminCart from "./components/Order/Admin/AdminCart";
import AdminCheckout from "./components/Order/Admin/AdminCheckout";
import AdminOrders from "./components/Order/Admin/AdminOrders";
import AdminUpdateOrder from "./components/Order/Admin/AdminUpdateOrder";
import UpdateOrder from "./components/Order/Customer/UpdateOrder";

import PaymentSuccess from "./components/payment/PaymentSuccess";

import SubmitReview from "./components/Reviews_&_Feedback/SubmitReviewNew"
import ProductReviews from "./components/Reviews_&_Feedback/ProductReviews";
import CareDashboard from "./components/Dashboard/CareDashboard";
import MyRefunds from "./components/Refund/MyRefunds";
import RefundRequestPage from "./components/Refund/RefundRequestPage";

import Home from "./components/Basics/Home";
import AboutPage from "./components/Basics/AboutPage";
import Header from "./components/Basics/Header";
import Footer from "./components/Basics/Footer";

import Login from "./components/Auth/Login";
import Register from "./components/Auth/Signup";
import SupplierSignup from "./components/Auth/SupplierSignup";

import { useAuth } from "./components/context/AuthContext";
import "./App.css";

/* ---------------- Protected Route Wrapper ---------------- */
const normalizeRoleValue = (value) => {
  if (!value) return "";
  const normalized = String(value)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (normalized === "customer") return "user";
  if (["customer care", "customer care manger", "customer care manager"].includes(normalized)) {
    return "customer care manager";
  }
  return normalized;
};

const USER_PRIVILEGES = ["view_products", "place_orders", "view_own_orders", "submit_feedback"];

const INVENTORY_PRIVILEGES = [
  "manage_inventory",
  "inv_view_stock",
  "inv_update_stock",
  "inv_reorder",
  "inv_receive_goods",
  "inv_reports",
];

const FINANCE_PRIVILEGES = [
  "fin_view_online_payments",
  "fin_view_supplier_payments",
  "fin_view_declined_payments",
  "fin_manage_declined_payments",
  "fin_manage_salary",
  "fin_view_finance_notifications",
  "fin_export_statements",
  "fin_record_payments",
  "fin_payroll",
  "fin_view_dashboard",
  "fin_payments",
  "fin_payouts",
  "fin_reconcile",
  "fin_reports",
  "fin_statements",
  "fin_view_notifications",
];

const FEEDBACK_PRIVILEGES = [
  "cc_view_feedback",
  "cc_respond_feedback",
  "cc_manage_returns",
  "moderate_feedback",
  "refund_view_requests",
  "refund_manage_requests",
];

const CARE_PRIVILEGES = FEEDBACK_PRIVILEGES;

const SUPPLIER_PRIVILEGES = [
  "supplier_portal",
  "supplier_manage_products",
  "supplier_receive_orders",
  "supplier_manage_inventory",
  "manage_suppliers",
];

const SALES_PRIVILEGES = [
  "sales_manage_orders",
  "sales_process_refunds",
  "sales_manage_discounts",
  "sales_view_reports",
  "sales_dashboard",
  "sales_refund",
  "sales_promotions",
  "sales_reports",
  ...SUPPLIER_PRIVILEGES,
];

const SALES_DASHBOARD_PRIVILEGES = Array.from(new Set(SALES_PRIVILEGES));

const ADMIN_PRIVILEGES = Array.from(
  new Set([
    "manage_users",
    "manage_roles",
    "manage_products",
    "manage_all_orders",
    "system_config",
    "view_reports",
    "view_analytics",
    "export_data",
    ...USER_PRIVILEGES,
    ...INVENTORY_PRIVILEGES,
    ...FINANCE_PRIVILEGES,
    ...FEEDBACK_PRIVILEGES,
    ...SALES_PRIVILEGES,
  ])
);

function PrivateRoute({ children, roles, privileges }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const role = normalizeRoleValue(user.role);
  const allowedRoles = Array.isArray(roles) ? roles.map(normalizeRoleValue) : [];
  const privilegeSet = new Set(
    (user?.permissions || []).map((perm) => String(perm || "").trim().toLowerCase())
  );
  const hasPrivilege = Array.isArray(privileges)
    ? privileges.some((perm) => privilegeSet.has(String(perm || "").trim().toLowerCase()))
    : false;

  const roleAllowed = allowedRoles.length === 0 || allowedRoles.includes(role);

  if (!roleAllowed && !hasPrivilege) {
    return <Navigate to="/" replace />;
  }

  if (privileges?.length && !hasPrivilege && allowedRoles.length === 0) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/* ---------------- Guest Route Wrapper ---------------- */
function GuestRoute({ children }) {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  const location = useLocation();
  const authRoutes = ["/login", "/register", "/register-supplier"];
  const currentPath = location.pathname.toLowerCase();
  const isAuthRoute = authRoutes.includes(currentPath);
  const isDashboardRoute = currentPath.includes("dashboard");
  const isFlush = location.pathname === "/" || isAuthRoute || isDashboardRoute;

  return (
    <AuthProvider>
      {/* ✅ Admin Cart Provider */}
      <AdminCartProvider>
        {/* ✅ Customer Cart Provider */}
        <CartProvider>
          <Header />

          <div
            className={`content ${isFlush ? "content--flush" : ""} ${
              isAuthRoute ? "content--auth" : ""
            }`}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutPage />} />

              {/* Guest routes */}
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/register-supplier" element={<GuestRoute><SupplierSignup /></GuestRoute>} />

              {/* Customer routes */}
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/customer-products" element={<CustomerProductList />} />
              <Route path="/CustomerDashboard" element={
                <PrivateRoute roles={["user"]}>
                  <Navigate to="/dashboard?tab=orders" replace />
                </PrivateRoute>
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
                <PrivateRoute roles={["user","admin"]}><CustomerOrders allowReceipts /></PrivateRoute>
              } />
              <Route path="/update-order/:id" element={
                <PrivateRoute roles={["user"]}><UpdateOrder /></PrivateRoute>
              } />
              <Route path="/refunds" element={
                <PrivateRoute roles={["user","admin"]}><MyRefunds /></PrivateRoute>
              } />
              <Route path="/refund-request" element={
                <PrivateRoute roles={["user","admin"]}><RefundRequestPage /></PrivateRoute>
              } />
              <Route path="/receipt/:orderId" element={
                <PrivateRoute roles={["user","admin"]}><Receipt /></PrivateRoute>
              } />
              <Route path="/CancelledOrders" element={
                <PrivateRoute roles={["user","admin"]}><CancelledOrders /></PrivateRoute>
              } />

              {/* Admin routes */}
              <Route path="/AdminDashboard" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <AdminDashboard />
                </PrivateRoute>
              } />
              <Route path="/AdminCart" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <AdminCart />
                </PrivateRoute>
              } />
              <Route path="/AdminUpdateOrder/:id" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <AdminUpdateOrder />
                </PrivateRoute>
              } />
              <Route path="/AdminCheckout" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <AdminCheckout />
                </PrivateRoute>
              } />
              <Route path="/products" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <ProductList />
                </PrivateRoute>
              } />
              <Route path="/AdminOrders" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <AdminOrders />
                </PrivateRoute>
              } />
              <Route path="/add-product" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <ProductForm />
                </PrivateRoute>
              } />
              <Route path="/update-product/:id" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <UpdateProduct />
                </PrivateRoute>
              } />
              <Route path="/admin-supplier-product" element={
                <PrivateRoute roles={["admin"]} privileges={ADMIN_PRIVILEGES}>
                  <SupplierAdminProductList />
                </PrivateRoute>
              } />
              
              <Route path="/caredashboard" element={
                <PrivateRoute roles={["customer care manager","feedback manager","admin"]} privileges={CARE_PRIVILEGES}>
                  <CareDashboard />
                </PrivateRoute>
              } />

              {/* Supplier routes */}
              <Route path="/supplier-products" element={
                <PrivateRoute roles={["supplier","admin"]} privileges={SUPPLIER_PRIVILEGES}>
                  <SupplierProductList />
                </PrivateRoute>
              } />
              <Route path="/product/:id/reviews" element={
                <PrivateRoute roles={["user","supplier","admin"]}><ProductReviews /></PrivateRoute>
              } />
              <Route path="/add-supplier-product" element={
                <PrivateRoute roles={["supplier","admin"]} privileges={SUPPLIER_PRIVILEGES}>
                  <SupplierProductForm />
                </PrivateRoute>
              } />
              <Route path="/update-supplier-product/:id" element={
                <PrivateRoute roles={["supplier","admin"]} privileges={SUPPLIER_PRIVILEGES}>
                  <UpdateSupplierProduct />
                </PrivateRoute>
              } />
              <Route path="/supplier-admin-product/:id" element={
                <PrivateRoute roles={["supplier","admin"]} privileges={SUPPLIER_PRIVILEGES}>
                  <SupplierProductDetails />
                </PrivateRoute>
              } />
               <Route path="/ReceivedOrders" element={
                <PrivateRoute roles={["supplier"]} privileges={SUPPLIER_PRIVILEGES}>
                  <ReceivedOrders />
                </PrivateRoute>
              } />
              <Route path="/SupplierDashboard" element={
                <PrivateRoute roles={["supplier"]} privileges={SUPPLIER_PRIVILEGES}>
                  <SupplierDashboard />
                </PrivateRoute>
              } />

              {/* Dashboards */}
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/FinanceDashboard" element={
                <PrivateRoute roles={["admin","finance manager"]} privileges={FINANCE_PRIVILEGES}>
                  <FinanceDashboard />
                </PrivateRoute>
              } />
              <Route path="/SalesDashboard" element={
                <PrivateRoute roles={["admin","sales manager","supplier"]} privileges={SALES_DASHBOARD_PRIVILEGES}>
                  <SalesDashboard />
                </PrivateRoute>
              } />
              <Route path="/InventoryDashboard" element={
                <PrivateRoute roles={["admin","inventory manager"]} privileges={INVENTORY_PRIVILEGES}>
                  <InventoryDashboard />
                </PrivateRoute>
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
