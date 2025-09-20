import React, { useEffect, useState } from "react";
import "./SupplierProductList.css";
import { useNavigate } from "react-router-dom";

function SupplierProductList() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/SupplierProducts/") 
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

  const handleEdit = (id) => navigate(`/update-supplier-product/${id}`);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`http://localhost:5000/SupplierProducts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts(products.filter((p) => p._id !== id));
        alert("Product deleted successfully!");
      } else {
        alert("Failed to delete product.");
      }
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  if (loading) return <p> Loading supplier products...</p>;
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
              <p><strong>Price:</strong> Rs.{p.price}</p>
              <div className="product-actions">
                <button onClick={() => handleEdit(p._id)}>Edit</button>
                <button onClick={() => handleDelete(p._id)}> Delete</button>
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

export default SupplierProductList;
