import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./ProductList.css";
import { formatLKR } from "../../../utils/currency";

function ProductList() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://localhost:5000/products")
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`http://localhost:5000/products/${id}`);
      setProducts(products.filter((p) => p._id !== id));
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  const handleUpdate = (id) => {
    navigate(`/update-product/${id}`);
  };

  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") return a.price - b.price;
      if (sortOrder === "desc") return b.price - a.price;
      return 0;
    });

  return (
    <div className="product-list-page">
      <header className="product-list-header">
        <div className="product-list-header__titles">
          <p className="product-list-kicker">Catalog</p>
          <h1 className="heading-lg">Store products</h1>
          <p className="muted-text">
            Browse and manage every item available in your storefront. Search, sort, or update entries without leaving this view.
          </p>
        </div>
        <div className="product-list-header__actions">
          <div className="search-sort">
            <input
              type="text"
              placeholder="Search products by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="">Sort by price</option>
              <option value="asc">Low to High</option>
              <option value="desc">High to Low</option>
            </select>
          </div>
          <Link to="/add-product" className="btn btn-primary btn-sm">
            ➕ Add product
          </Link>
        </div>
      </header>

      <section className="product-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <article key={product._id} className="product-card">
              <div className="product-card__media">
                {product.imageUrl ? (
                  <img
                    src={`http://localhost:5000${product.imageUrl}`}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <div className="product-card__placeholder" aria-hidden="true">📦</div>
                )}
              </div>
              <div className="product-card__body">
                <div className="product-card__title-group">
                  <h2>{product.name}</h2>
                  <span className="product-card__price">{formatLKR(product.price)}</span>
                </div>
                <dl className="product-card__meta">
                  <div>
                    <dt>Brand</dt>
                    <dd>{product.brand || "—"}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{product.category || "—"}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {product.inStock ? (
                        <span className="badge badge-success">{(product.stockAmount ?? 0).toLocaleString()} in stock</span>
                      ) : (
                        <span className="badge badge-amber">Out of stock</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <footer className="product-card__actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleUpdate(product._id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleDelete(product._id)}
                >
                  Delete
                </button>
              </footer>
            </article>
          ))
        ) : (
          <div className="product-grid__empty">
            <p className="muted-text">No products match your filters. Try adjusting your search.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default ProductList;
