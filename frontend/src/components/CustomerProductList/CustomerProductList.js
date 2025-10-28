// src/components/CustomerProductList/CustomerProductList.js
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CartContext } from "../Order/Customer/CartContext";
import "./CustomerProductList.css";
import { formatLKR } from "../../utils/currency";

const resolveImageUrl = (apiRoot, imageUrl = "") => {
  if (!imageUrl) return "";
  if (/^https?:/i.test(imageUrl)) return imageUrl;
  const normalized = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${apiRoot}${normalized}`;
};

const summarizeText = (text = "") => {
  if (!text) return "Tap to explore the full product story.";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
};

const uniqueCount = (items, selector) => {
  return Array.from(new Set(items.map(selector).filter(Boolean))).length;
};

function CustomerProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("search") || "";
  });
  const [sortOrder, setSortOrder] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useContext(CartContext);
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const API_ROOT = useMemo(
    () => (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, ""),
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`${API_ROOT}/products`)
      .then(async (res) => {
        if (!res.ok) {
          const errMsg = await res.json().catch(() => ({}));
          throw new Error(errMsg.message || "Failed to fetch products");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.error("Error fetching products:", err);
        if (!cancelled) setError(err.message || "Unable to load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [API_ROOT]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("search") || "";
    setSearchTerm((prev) => (prev === query ? prev : query));
  }, [location.search]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products
      .filter((product) =>
        [product.name, product.brand, product.category]
          .map((value) => value?.toLowerCase() || "")
          .some((value) => value.includes(query))
      )
      .sort((a, b) => {
        switch (sortOrder) {
          case "price-asc":
            return (a.price || 0) - (b.price || 0);
          case "price-desc":
            return (b.price || 0) - (a.price || 0);
          case "brand-asc":
            return (a.brand || "").localeCompare(b.brand || "");
          case "brand-desc":
            return (b.brand || "").localeCompare(a.brand || "");
          case "category-asc":
            return (a.category || "").localeCompare(b.category || "");
          case "category-desc":
            return (b.category || "").localeCompare(a.category || "");
          default:
            return 0;
        }
      });
  }, [products, searchTerm, sortOrder]);

  const catalogueStats = useMemo(() => {
    const total = products.length;
    const categories = uniqueCount(products, (p) => p.category);
    const inStock = products.filter((p) => p.inStock && Number(p.stockAmount) > 0).length;
    return { total, categories, inStock };
  }, [products]);

  const handleAddToCart = (product) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    addToCart(product);
    navigate("/customercart");
  };

  const visitCart = () => navigate("/customercart");

  return (
    <div className="catalogue">
      <section className="catalogue-hero">
        <span className="catalogue-hero__glow" aria-hidden />
        <div className="catalogue-hero__content">
          <div className="catalogue-hero__header">
            <span className="label-pill">Premium tools &amp; hardware</span>
            {user && !isAdmin && (
              <button type="button" className="hero-cart" onClick={visitCart}>
                <span aria-hidden>🛒</span> View cart
              </button>
            )}
          </div>

          <h1 className="catalogue-title">Find the right tool for every build</h1>
          <p className="catalogue-subtitle">
            Discover curated gear, compare brands, and keep your projects moving with real-time stock visibility and rapid checkout.
          </p>

          <div className="catalogue-stats" role="list" aria-label="Catalogue stats">
            <div className="catalogue-stat" role="listitem">
              <span className="catalogue-stat__label">Products</span>
              <span className="catalogue-stat__value">{catalogueStats.total}</span>
            </div>
            <div className="catalogue-stat" role="listitem">
              <span className="catalogue-stat__label">Categories</span>
              <span className="catalogue-stat__value">{catalogueStats.categories}</span>
            </div>
            <div className="catalogue-stat" role="listitem">
              <span className="catalogue-stat__label">In stock</span>
              <span className="catalogue-stat__value">{catalogueStats.inStock}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="catalogue-toolbar" aria-label="Product filters">
        <div className="search-group">
          <input
            type="text"
            value={searchTerm}
            placeholder="Search by name, brand, or category"
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm && (
            <button type="button" className="btn-clear" onClick={() => setSearchTerm("")}>
              Clear
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="">Sort products</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="brand-asc">Brand: A → Z</option>
            <option value="brand-desc">Brand: Z → A</option>
            <option value="category-asc">Category: A → Z</option>
            <option value="category-desc">Category: Z → A</option>
          </select>

          <div className="view-toggle" role="group" aria-label="Toggle layout">
            <button
              type="button"
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
            >
              Grid
            </button>
            <button
              type="button"
              className={viewMode === "list" ? "active" : ""}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              List
            </button>
          </div>
        </div>
      </section>

      <section className={`catalogue-grid catalogue-grid--${viewMode}`} aria-label="Product catalogue">
        {loading ? (
          <div className="catalogue-skeletons" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="product-card product-card--skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="catalogue-error">
            <h2>Unable to load products</h2>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="catalogue-empty">
            <h2>No products matched your filters</h2>
            <p>Try adjusting the search or sorting options to discover more gear.</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const imageUrl = resolveImageUrl(API_ROOT, product.imageUrl);
            const inStock = product.inStock && Number(product.stockAmount) > 0;

            return (
              <article key={product._id} className="product-card">
                <div className="product-card__media">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} loading="lazy" />
                  ) : (
                    <div className="product-card__placeholder" aria-hidden>
                      <span>No image</span>
                    </div>
                  )}
                  {!inStock && <span className="product-card__badge">Out of stock</span>}
                </div>

                <div className="product-card__body">
                  <h3 className="product-card__title">{product.name}</h3>
                  <p className="product-card__summary">{summarizeText(product.description)}</p>

                  <dl className="product-card__meta">
                    <div>
                      <dt>Brand</dt>
                      <dd>{product.brand || "N/A"}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{product.category || "Uncategorized"}</dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd>{formatLKR(product.price)}</dd>
                    </div>
                    <div>
                      <dt>Stock</dt>
                      <dd>{inStock ? `${product.stockAmount} available` : "Out of stock"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="product-card__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/product/${product._id}`)}
                  >
                    View details
                  </button>
                  {!isAdmin && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleAddToCart(product)}
                      disabled={!inStock}
                    >
                      {inStock ? "Add to cart" : "Notify me"}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

export default CustomerProductList;
