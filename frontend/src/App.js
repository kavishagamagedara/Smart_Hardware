import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import ProductList from "./components/Product/ProductList/ProductList";
import ProductForm from "./components/Product/ProductForm/ProductForm";
import UpdateProduct from "./components/UpdateProduct/UpdateProduct";
import CustomerProductList from "./components/CustomerProductList/CustomerProductList";
import SupplierProductForm from "./components/SupplierProduct/SupplierProductForm";
import "./App.css";
import SupplierProductList from "./components/SupplierProduct/SupplierProductList";
import SupplierAdminProductList from "./components/SupplierProduct/SupplierAdminProductList";
import UpdateSupplierProduct from "./components/SupplierProduct/UpdateSupplierProduct";
import Home from "./components/Basics/Home";
import Header from "./components/Basics/Header";
import Footer from "./components/Basics/Footer";
import ProductDetails from "./components/Product/ProductDetails";
import SupplierProductDetails from "./components/SupplierProduct/SupplierProductDetails";

function App() {
  return (
    <>
    <Header />
      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/add-product" element={<ProductForm />} />
          <Route path="/update-product/:id" element={<UpdateProduct />} />
          <Route path="/customer-products" element={<CustomerProductList />} />
          <Route path="/supplier-products" element={<SupplierProductList />} />
          <Route path="/add-supplier-product" element={<SupplierProductForm />} />
          <Route path="/admin-supplier-product" element={<SupplierAdminProductList />} />
          <Route path="/update-supplier-product/:id" element={<UpdateSupplierProduct />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/supplier-admin-product/:id" element={<SupplierProductDetails />} />

        </Routes>
      </div>

      <div className="user-btn-container">
        <Link to="/customer-products">
          <button className="user-btn">User</button>
        </Link>
        <Link to="/supplier-products">
          <button className="supplier-btn">Supplier</button>
        </Link>
        <Link to="/admin-supplier-product">
          <button className="admin-supplier-btn">Admin-Supplier</button>
        </Link>
        <Link to="/add-product">
          <button className="add-product-btn">Admin-Add-Product</button>
        </Link>
        <Link to="/add-supplier-product">
          <button className="add-product-btn">Admin-Form</button>
        </Link>
        <Link to="/products">
          <button className="add-product-btn">Admin-list</button>
        </Link>
      </div>
      <Footer />
    </>
    
  );
}

export default App;
