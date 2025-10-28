import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Package2,
  Truck,
  ShieldCheck,
  ShoppingCart,
  Star,
  Quote,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Home.css";
import { formatLKR } from "../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const SERVICE_ITEMS = [
  {
    name: "Inventory Management",
    description:
      "Plan, monitor, and optimize stock in real time. Automated low-stock alerts keep every project on track.",
    icon: BarChart3,
    ctaLabel: "View dashboard",
    path: "/InventoryDashboard",
    requiresAuth: true,
  },
  {
    name: "Equipment Rental",
    description:
      "Source premium, well-maintained tools on demand. Flexible rental periods with instant online booking.",
    icon: Package2,
    ctaLabel: "Browse tools",
    path: "/customer-products",
    requiresAuth: false,
  },
  {
    name: "Fast Delivery",
    description:
      "Same-day dispatch for in-stock items and live delivery tracking so your crews never have to wait.",
    icon: Truck,
    ctaLabel: "Track orders",
    path: "/CustomerOrders",
    requiresAuth: true,
  },
  {
    name: "Extended Warranty",
    description:
      "Safeguard every purchase with coverage for repairs, replacements, and priority technical support.",
    icon: ShieldCheck,
    ctaLabel: "Contact support",
    path: "/caredashboard",
    requiresAuth: true,
  },
];

const TESTIMONIALS = [
  {
    id: 1,
    content:
      "The inventory portal transformed how we schedule crews. Downtime is down 40% since switching to Smart Hardware.",
    author: "Sarah Johnson",
    role: "Operations Manager, BuildRight Construction",
  },
  {
    id: 2,
    content:
      "Their experts walked us through the best tooling mix for our new line. We hit deadlines without overspending.",
    author: "Michael Chen",
    role: "Owner, Chen's Furniture Workshop",
  },
  {
    id: 3,
    content:
      "Reliable rentals and rapid delivery keep multi-site projects moving. It's like adding a logistics team overnight.",
    author: "David Rodriguez",
    role: "Project Manager, Urban Development Co.",
  },
];

const FALLBACK_PRODUCTS = [
  {
    id: "fallback-1",
    name: "Heavy Duty Impact Drill",
    description:
      "Industrial-grade drill with precision torque control for everyday site use.",
    price: 129.99,
    category: "Power Tools",
    brand: "HardTech",
    imageUrl: "/images/POW.POW.627290870_1725432863741.webp",
  },
  {
    id: "fallback-2",
    name: "Pro Series Combination Pliers",
    description:
      "Hardened jaws and insulated grips keep crews productive and safe.",
    price: 24.5,
    category: "Hand Tools",
    brand: "HardTech",
    imageUrl: "/images/combination-cutting-plier-500x500.webp",
  },
  {
    id: "fallback-3",
    name: "Smart Laser Distance Meter",
    description:
      "Bluetooth-enabled measurements with ±1mm accuracy and cloud syncing.",
    price: 89.0,
    category: "Measuring Tools",
    brand: "SmartMeasure",
    imageUrl: "/images/istockphoto-1448349078-612x612.jpg",
  },
  {
    id: "fallback-4",
    name: "Safety Pro Helmet & Visor Kit",
    description:
      "Lightweight composite shell with integrated visor for rugged sites.",
    price: 54.75,
    category: "Safety Equipment",
    brand: "ShieldGuard",
    imageUrl: "/images/realistic-hand-tools-claw-hammer-with-yellow-accents-and-adjustable-wrench-free-png.webp",
  },
];

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  const apiImageRoot = useMemo(() => API_ROOT, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        setLoadingProducts(true);
        setProductsError("");
        const response = await fetch(`${API_ROOT}/products`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Unable to load products (${response.status})`);
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data.slice(0, 4) : [];
        setFeaturedProducts(items.length ? items : FALLBACK_PRODUCTS);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Failed to load featured products:", error);
        setProductsError(
          "We couldn't load featured products right now. Please try again soon."
        );
        setFeaturedProducts(FALLBACK_PRODUCTS);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      }
    }

    fetchProducts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const target = location.state?.scrollTo;
    if (!target) return;

    const scrollToSection = () => {
      const element = document.getElementById(target);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const timeoutId = window.setTimeout(scrollToSection, 120);
    navigate(location.pathname, { replace: true });

    return () => window.clearTimeout(timeoutId);
  }, [location.state, location.pathname, navigate]);

  const resolveProductImage = (imagePath) => {
    if (!imagePath) return "/images/logoo.png";
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    return `${apiImageRoot}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null || Number.isNaN(Number(price))) {
      return "Contact for pricing";
    }
    return formatLKR(price);
  };

  const handleBrowseProducts = () => navigate("/customer-products");
  const handleManagementSolutions = () => {
    if (user) {
      // Role-based dashboard routing
      const role = user.role?.toLowerCase();
      if (role === "admin") {
        navigate("/AdminDashboard");
      } else if (role === "supplier") {
        navigate("/SupplierDashboard");
      } else if (role === "customer care manager") {
        navigate("/caredashboard");
      } else {
        navigate("/dashboard");
      }
    } else {
      navigate("/register");
    }
  };

  const handleServiceNavigation = (service) => {
    if (!service.path) return;
    if (service.requiresAuth && !user) {
      navigate("/login");
      return;
    }
    navigate(service.path);
  };

  return (
    <div className="home-page">
      <main className="home-main">
        <section className="hero-section" id="hero">
          <div className="hero-container">
            <div className="hero-content">
              <span className="hero-eyebrow">Professional Hardware Solutions</span>
              <h1 className="hero-title">
                Equip every project with precision tools and frictionless management.
              </h1>
              <p className="hero-description">
                Streamline procurement, track inventory in real time, and deliver best-in-class customer experiences with the Smart Hardware platform.
              </p>
              <div className="hero-actions">
                <button className="hero-primary" type="button" onClick={handleBrowseProducts}>
                  Browse Products
                </button>
                <button className="hero-secondary" type="button" onClick={handleManagementSolutions}>
                  {user ? "Open Dashboard" : "Management Solutions"}
                  <ArrowRight className="icon" aria-hidden="true" />
                </button>
              </div>
              {!user && (
                <div className="hero-auth">
                  <span>New to Smart Hardware?</span>
                  <button type="button" onClick={() => navigate("/register")}>
                    Create an account
                  </button>
                  <span className="divider" aria-hidden="true">·</span>
                  <button type="button" onClick={() => navigate("/login")}>
                    Sign in
                  </button>
                </div>
              )}
              <div className="hero-stats">
                <div className="hero-stat">
                  <strong>2K+</strong>
                  <span>Products ready to ship</span>
                </div>
                <div className="hero-stat">
                  <strong>98%</strong>
                  <span>On-time delivery rate</span>
                </div>
                <div className="hero-stat">
                  <strong>24/7</strong>
                  <span>Specialist support</span>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <img
                src="/images/OSH-Hardware-Shop.jpg"
                alt="Hardware tools"
                loading="lazy"
              />
              <div className="hero-card">
                <div className="card-icon">
                  <ShoppingCart size={20} aria-hidden="true" />
                </div>
                <div className="card-content">
                  <p>Smart restock reminders</p>
                  <span>Get proactive alerts before supplies run low.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

  <section className="featured-products-section" id="featured-products">
          <div className="section-heading">
            <span className="section-eyebrow">Featured Products</span>
            <h2>Tools teams rely on every day</h2>
            <p>
              Hand-picked selections from our catalogue, refreshed weekly based on demand and customer feedback.
            </p>
          </div>

          {productsError && (
            <div className="section-alert">
              {productsError} Showing curated highlights instead.
            </div>
          )}

          <div className="product-grid" aria-live="polite">
            {loadingProducts
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div className="product-card skeleton" key={`skeleton-${index}`} />
                ))
              : featuredProducts.map((product) => {
                  const imageSrc = resolveProductImage(product.imageUrl);
                  const productId = product._id || product.id;
                  return (
                    <article className="product-card" key={productId}>
                      <div className="product-image">
                        <img src={imageSrc} alt={product.name} loading="lazy" />
                      </div>
                      <div className="product-body">
                        <span className="product-category">{product.category || "Hardware"}</span>
                        <h3 className="product-name">{product.name}</h3>
                        <p className="product-description">{product.description}</p>
                        <div className="product-meta">
                          <span className="product-price">{formatPrice(product.price)}</span>
                          <span className="product-stock">
                            <Star size={16} aria-hidden="true" />
                            {product.brand ? `${product.brand}` : product.inStock ? "In stock" : "Popular"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="product-cta"
                          onClick={() =>
                            productId?.toString().startsWith("fallback-")
                              ? handleBrowseProducts()
                              : navigate(`/product/${productId}`)
                          }
                        >
                          View Details
                        </button>
                      </div>
                    </article>
                  );
                })}
          </div>

          <div className="section-actions">
            <button type="button" onClick={handleBrowseProducts} className="outlined-button">
              View all products
            </button>
          </div>
        </section>

  <section className="services-section" id="services">
          <div className="section-heading">
            <span className="section-eyebrow">Our Services</span>
            <h2>Comprehensive support from supply to maintenance</h2>
            <p>
              Every subscription unlocks integrated workflows, dedicated specialists, and data-driven insights tailored to your role.
            </p>
          </div>

          <div className="services-grid">
            {SERVICE_ITEMS.map((service) => (
              <article className="service-card" key={service.name}>
                <div className="service-icon">
                  <service.icon size={26} aria-hidden="true" />
                </div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <button type="button" onClick={() => handleServiceNavigation(service)}>
                  {service.ctaLabel}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>

  <section className="testimonials-section" id="testimonials">
          <div className="section-heading">
            <span className="section-eyebrow">Testimonials</span>
            <h2>Trusted by field teams and facility managers alike</h2>
          </div>

          <div className="testimonials-grid">
            {TESTIMONIALS.map((testimonial) => (
              <figure className="testimonial-card" key={testimonial.id}>
                <Quote className="quote-icon" size={28} aria-hidden="true" />
                <blockquote>{testimonial.content}</blockquote>
                <figcaption>
                  <span className="avatar" aria-hidden="true">
                    {testimonial.author.charAt(0)}
                  </span>
                  <div>
                    <strong>{testimonial.author}</strong>
                    <span>{testimonial.role}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-card">
            <h2>Ready to modernize your hardware operations?</h2>
            <p>
              Unlock unified product catalogues, role-based dashboards, and instant analytics for every stakeholder.
            </p>
            <div className="cta-actions">
              <button type="button" className="hero-primary" onClick={handleBrowseProducts}>
                Explore catalogue
              </button>
              <button 
                type="button" 
                className="hero-secondary" 
                onClick={() => {
                  if (user) {
                    // Role-based dashboard routing
                    const role = user.role?.toLowerCase();
                    if (role === "admin") {
                      navigate("/AdminDashboard");
                    } else if (role === "supplier") {
                      navigate("/SupplierDashboard");
                    } else if (role === "customer care manager") {
                      navigate("/caredashboard");
                    } else {
                      navigate("/dashboard");
                    }
                  } else {
                    navigate("/login");
                  }
                }}
              >
                Talk to our team
                <ArrowRight className="icon" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
