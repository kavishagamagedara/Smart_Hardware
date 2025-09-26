import React, { useEffect, useState, useContext } from "react";
import "./SupplierProductList.css";
import { useNavigate } from "react-router-dom";
import { AdminCartContext } from "../Order/Admin/AdminCartContext";

function SupplierAdminProductList() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ Cart Context
  const { addToCart } = useContext(AdminCartContext);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://localhost:5000/SupplierProducts/", {
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
        setError("");
      })
      .catch((err) => {
        console.error("Error fetching supplier products:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products
    .filter((p) => p.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") return a.price - b.price;
      if (sortOrder === "desc") return b.price - a.price;
      return 0;
    });

  if (loading) return <p>Loading supplier products...</p>;
  if (error) return <p style={{ color: "red" }}> {error}</p>;

  return (
    <div className="product-list-container">
      <h2>Supplier Products</h2>

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
                src={p.imageUrl.startsWith("http") ? p.imageUrl : `http://localhost:5000${p.imageUrl}`}
                alt={p.name}
              />
              <h3>{p.name}</h3>
              <p><strong>Price:</strong> ${p.price}</p>
              <p>{p.description}</p>
              <div className="product-actions">
                {/* ✅ Add to Cart button */}
                <button
                  onClick={() =>
                    addToCart({
                      id: p._id,
                      name: p.name,
                      price: p.price,
                      img: p.imageUrl,
                      quantity: 1,
                    })
                  }
                >
                  Add to Cart
                </button>

                <button
                  onClick={() => navigate(`/supplier-admin-product/${p._id}`)}
                  style={{ marginLeft: "10px", background: "#2563eb", color: "white" }}
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

      {/* ✅ Cart Button */}
      <div className="cart-button">
        <button onClick={() => navigate("/AdminCart")}>
          Go to Cart
        </button>
      </div>
    </div>
  );
}

export default SupplierAdminProductList;
