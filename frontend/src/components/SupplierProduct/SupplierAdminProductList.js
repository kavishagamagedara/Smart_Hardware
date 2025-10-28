import React, { useEffect, useState, useContext } from "react";
import "./SupplierProductList.css";
import { useNavigate } from "react-router-dom";
import { AdminCartContext } from "../Order/Admin/AdminCartContext";
import { formatLKR } from "../../utils/currency";

function SupplierAdminProductList() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [activeSupplier, setActiveSupplier] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const navigate = useNavigate();

  // ✅ Cart Context
  const { addToCart, cartItems } = useContext(AdminCartContext);

  useEffect(() => {
    const token = localStorage.getItem("token");
  fetch("http://localhost:5000/supplier-products", {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errMsg = await res.json();
          throw new Error(errMsg.message || "Failed to fetch products");
        }
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        try {
          // Extract unique suppliers from product list (support populated supplierId)
          const byId = new Map();
          for (const p of data) {
            // supplierId may be an object when populated, or an id string
            const sid = p.supplierId?._id || p.supplierId || p.supplier?._id;
            const sname = p.supplierId?.name || p.supplierName || p.supplier?.name || undefined;
            if (!sid) continue;
            const key = String(sid);
            if (!byId.has(key)) {
              byId.set(key, { _id: sid, name: sname || `Supplier ${sid}` });
            }
          }
          const list = Array.from(byId.values());
          setSuppliers(list);
        } catch (err) {
          // ignore supplier extraction errors
        }
        setError("");
      })
      .catch((err) => {
        console.error("Error fetching supplier products:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleAddToCart = (product) => {
    const alreadyInCart = cartItems?.some((item) => item.productId === product._id);

    addToCart({
      productId: product._id,
      name: product.name,
      price: product.price,
      img: product.imageUrl,
      supplierId: product.supplierId,
      quantity: 1,
    });

    setFeedback({
      type: "success",
      message: alreadyInCart
        ? `${product.name} quantity updated in cart.`
        : `${product.name} added to cart.`,
    });
  };

  const filteredProducts = products
    .filter((p) => p.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((p) => {
      if (activeSupplier === "all") return true;
      const sid = p.supplierId?._id || p.supplierId || p.supplier?._id;
      return String(sid) === String(activeSupplier);
    })
    .sort((a, b) => {
      if (sortOrder === "asc") return a.price - b.price;
      if (sortOrder === "desc") return b.price - a.price;
      return 0;
    });

  if (loading) return <p>Loading supplier products...</p>;
  if (error) return <p style={{ color: "red" }}> {error}</p>;

  const currentSupplierName = activeSupplier === "all" ? "All Suppliers" : (suppliers.find((s) => String(s._id) === String(activeSupplier))?.name || String(activeSupplier));

  return (
    <div className="product-list-container">
      <div className="product-list-header">
        <div>
          <h2>Supplier Products</h2>
          <div className="muted-text" style={{ fontSize: 13 }}>{currentSupplierName}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/AdminCart")}>
          View Cart
        </button>
      </div>

      {/* Suppliers selector */}
      <div className="suppliers-bar" style={{ display: "flex", gap: 8, margin: "12px 0", overflowX: "auto" }}>
        <button
          className={`btn ${activeSupplier === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveSupplier("all")}
        >
          All Suppliers
        </button>
        {suppliers.map((s) => (
          <button
            key={s._id}
            className={`btn ${String(activeSupplier) === String(s._id) ? "btn-primary" : "btn-outline"}`}
            onClick={() => setActiveSupplier(s._id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`cart-feedback ${
            feedback.type === "success" ? "cart-feedback--success" : "cart-feedback--error"
          }`}
          role="status"
          aria-live="polite"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="cart-feedback__close"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <div className="search-sort">
        <input
          type="text"
          placeholder="Search by product name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          <option value="">Sort by price</option>
          <option value="asc">Low to High</option>
          <option value="desc">High to Low</option>
        </select>
      </div>

      <div className="product-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => (
            <div key={p._id} className="product-card">
              <img
                src={
                  p.imageUrl?.startsWith("http")
                    ? p.imageUrl
                    : `http://localhost:5000${p.imageUrl}`
                }
                alt={p.name}
              />
              <h3>{p.name}</h3>
              <p>
                <strong>Price:</strong> {formatLKR(p.price)}
              </p>
              <p>{p.description}</p>
              <div className="product-actions">
                {/* ✅ Always push productId */}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    console.log("🛒 Adding to cart:", {
                      productId: p._id,
                      name: p.name,
                      price: p.price,
                      supplierId: p.supplierId,
                    });
                    handleAddToCart(p);
                  }}
                >
                  Add to Cart
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/supplier-admin-product/${p._id}`)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No supplier products found.</p>
        )}
      </div>

    </div>
  );
}

export default SupplierAdminProductList;
