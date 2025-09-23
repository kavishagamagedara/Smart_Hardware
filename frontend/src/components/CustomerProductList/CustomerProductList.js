// src/components/CustomerProductList/CustomerProductList.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // ✅ import auth
import "./CustomerProductList.css";

function CustomerProductList() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState(""); 
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ get logged-in user

  useEffect(() => {
    fetch("http://localhost:5000/products")
      .then(async (res) => {
        if (!res.ok) {
          const errMsg = await res.json();
          throw new Error(errMsg.message || "Failed to fetch products");
        }
        return res.json();
      })
      .then((data) => setProducts(data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  const filteredProducts = products
    .filter((p) => p.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortOrder) {
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "brand-asc": return (a.brand || "").localeCompare(b.brand || "");
        case "brand-desc": return (b.brand || "").localeCompare(a.brand || "");
        case "category-asc": return (a.category || "").localeCompare(b.category || "");
        case "category-desc": return (b.category || "").localeCompare(a.category || "");
        default: return 0;
      }
    });

  const handleAddToCart = (product) => {
    if (!user) {
      alert("You need to sign in to add items to the cart.");
      navigate("/login");
      return;
    }
    alert(`${product.name} added to cart!`); 
    // TODO: replace with real API call to add to cart
  };

  const goToCart = () => {
    navigate("/cart");
  };

  return (
    <div className="product-list-container">
      {/* ✅ Cart Button only for logged-in users */}
      {user && (
        <button className="cart-btn" onClick={goToCart}>
          🛒 Cart
        </button>
      )}

      <h2>Products</h2>

      {/* Search + Sort */}
      <div className="search-sort">
        <input
          type="text"
          placeholder="Search by product name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="">Sort products</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="brand-asc">Brand: A → Z</option>
          <option value="brand-desc">Brand: Z → A</option>
          <option value="category-asc">Category: A → Z</option>
          <option value="category-desc">Category: Z → A</option>
        </select>
      </div>

      {/* Product Grid */}
      <div className="product-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => (
            <div key={p._id} className="product-card">
              <img src={`http://localhost:5000${p.imageUrl}`} alt={p.name} />
              <h3>{p.name}</h3>
              <p><strong>Price:</strong> Rs.{p.price}</p>
              <p><strong>Brand:</strong> {p.brand || "N/A"}</p>
              <p><strong>Category:</strong> {p.category || "N/A"}</p>

              {p.inStock ? (
                <p className="stock-status" style={{ color: "green" }}>
                  In Stock ({p.stockAmount})
                </p>
              ) : (
                <p className="stock-status" style={{ color: "red" }}>
                  Out of Stock
                </p>
              )}

              <div className="product-actions">
                {/* ✅ Add to Cart only if logged-in */}
                {user && p.inStock && p.stockAmount > 0 ? (
                  <button onClick={() => handleAddToCart(p)}>Add to Cart</button>
                ) : (
                  <button
                    disabled
                    style={{ background: "#ccc", cursor: "not-allowed" }}
                  >
                    {user ? "Out of Stock" : "Login to Add"}
                  </button>
                )}

                <button
                  onClick={() => navigate(`/product/${p._id}`)}
                  style={{ marginLeft: "10px", background: "#2563eb", color: "white" }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No products found.</p>
        )}
      </div>
    </div>
  );
}

export default CustomerProductList;
