import React, { useEffect, useMemo, useState } from "react";
import "./SupplierProductList.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";  // ✅ added
import { formatLKR } from "../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const SORT_OPTIONS = [
  { value: "", label: "Sort by price" },
  { value: "asc", label: "Price: Low to high" },
  { value: "desc", label: "Price: High to low" },
  { value: "name", label: "Title A → Z" },
];

function SupplierProductList() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { token, user } = useAuth();   // ✅ get token and user

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_ROOT}/supplier-products`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",  // ✅ attach token
          },
        });
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        
        if (!res.ok) {
          // Handle 404 as empty product list for suppliers
          if (res.status === 404) {
            setProducts([]);
            setError("");
            return;
          }
          
          const message =
            (payload && typeof payload === "object" && payload.message) ||
            (typeof payload === "string" && payload) ||
            "Failed to fetch products";
          throw new Error(message);
        }
        const data = Array.isArray(payload) ? payload : payload?.supplierProducts || [];
        setProducts(data);
        setError("");
      } catch (err) {
        console.error("Error fetching supplier products:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) loadProducts(); // ✅ only call if logged in
    else setLoading(false); // ✅ stop loading if no token
  }, [token]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = term
      ? products.filter((p) => p.name?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term))
      : products;

    return [...list].sort((a, b) => {
      if (sortOrder === "asc") return Number(a.price) - Number(b.price);
      if (sortOrder === "desc") return Number(b.price) - Number(a.price);
      if (sortOrder === "name") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });
  }, [products, searchTerm, sortOrder]);

  const handleEdit = (id) => navigate(`/update-supplier-product/${id}`);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`${API_ROOT}/supplier-products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",  // ✅ attach token
        },
      });
      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await res.json() : await res.text();
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p._id !== id));
        alert("Product deleted successfully!");
      } else {
        const message =
          (payload && typeof payload === "object" && payload.message) ||
          (typeof payload === "string" && payload) ||
          "Failed to delete product.";
        alert(message);
      }
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  if (loading) return <p> Loading supplier products...</p>;
  if (error) return <p style={{ color: "red" }}> {error}</p>;

  return (
    <div className="product-list-container">
      <div className="product-list-header">
        <div className="stack-2xs">
          <h2>Supplier Products</h2>
          <p className="muted-text text-sm">Refine your catalogue and keep prices in sync.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Refresh
          </button>
          {user && token && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/add-supplier-product")}>
              Add product
            </button>
          )}
        </div>
      </div>

      <div className="catalogue-filters">
        <label className="filter search">
          <span className="icon" aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Search products by name or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        <label className="filter">
          <span className="label-text">Sort</span>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value || "default"} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="product-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => (
            <div key={p._id} className="product-card">
              <img
                src={p.imageUrl ? (p.imageUrl.startsWith("http") ? p.imageUrl : `${API_ROOT}${p.imageUrl}`) : ""}
                alt={p.name}
              />
              <h3>{p.name}</h3>
              <p><strong>Price:</strong> {formatLKR(p.price)}</p>
              <div className="product-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(p._id)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p._id)}>Delete</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No supplier products found.</p>
            {user && token && (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => navigate("/add-supplier-product")}
              >
                Add your first product
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplierProductList;
