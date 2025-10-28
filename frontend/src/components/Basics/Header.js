import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  MoreVertical,
  Moon,
  Search,
  ShoppingCart,
  Sun,
  UserCircle,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CartContext } from "../Order/Customer/CartContext";
import { AdminCartContext } from "../Order/Admin/AdminCartContext";
import "./Header.css";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, theme, toggleTheme, deleteAccount } = useAuth();
  const { cartItems: customerCartItems } = useContext(CartContext) || { cartItems: [] };
  const { cartItems: adminCartItems } = useContext(AdminCartContext) || { cartItems: [] };

  const [searchValue, setSearchValue] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const mobileMenuRef = useRef(null);
  const accountMenuRef = useRef(null);

  const cartCount = useMemo(() => {
    if (!user) return 0;
    const role = (user?.role || "").toLowerCase();
    if (role === "admin") {
      return (adminCartItems || []).reduce((total, item) => total + (item.quantity || 0), 0);
    }
    return (customerCartItems || []).reduce((total, item) => total + (item.quantity || 0), 0);
  }, [customerCartItems, adminCartItems, user]);

  const initials = useMemo(() => {
    const segments = (user?.name || user?.email || "Guest User")
      .trim()
      .split(/\s+/);
    return (
      (segments[0]?.[0] || "G").toUpperCase() +
      (segments[1]?.[0] || "").toUpperCase()
    );
  }, [user?.name, user?.email]);

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
  };

  const canDeleteAccount = useMemo(
    () => String(user?.role || "").toLowerCase() === "user",
    [user?.role]
  );

  const handleDeleteAccount = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    const confirmed = window.confirm(
      "Delete your SmartHardware account? This action is permanent and cannot be undone."
    );
    if (!confirmed) return;
    try {
      setIsDeletingAccount(true);
      const response = await deleteAccount();
      closeMenus();
      navigate("/");
      window.alert(response?.message || "Your account has been deleted.");
    } catch (error) {
      window.alert(error.message || "Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }

      if (
        isAccountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, isAccountMenuOpen]);

  const goto = (path) => {
    navigate(path);
    closeMenus();
  };

  const navigateToSection = (sectionId) => {
    closeMenus();
    if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: sectionId } });
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDashboardRedirect = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Redirect based on user role
    const userRole = (user?.role || "").toLowerCase();
    if (userRole === "admin") {
      navigate("/AdminDashboard");
    } else if (userRole === "supplier") {
      navigate("/SupplierDashboard");
    } else if (userRole === "customer care manager") {
      navigate("/caredashboard");
    } else {
      navigate("/dashboard");
    }
    closeMenus();
  };

  const handleProfileRedirect = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Redirect to appropriate dashboard with profile tab
    const userRole = (user?.role || "").toLowerCase();
    if (userRole === "admin") {
      navigate("/AdminDashboard#profile");
    } else if (userRole === "supplier") {
      navigate("/SupplierDashboard#profile");
    } else if (userRole === "customer care manager") {
      navigate("/caredashboard#profile");
    } else {
      navigate("/dashboard#profile");
    }
    closeMenus();
  };

  const handleCartClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    const role = (user?.role || "").toLowerCase();
    if (role === "admin") {
      navigate("/AdminCart");
    } else {
      navigate("/customercart");
    }
    closeMenus();
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const value = searchValue.trim();
    const target = value
      ? `/customer-products?search=${encodeURIComponent(value)}`
      : "/customer-products";
    navigate(target);
    closeMenus();
  };

  const navItems = [
    {
      label: "Home",
      isActive: location.pathname === "/",
      onClick: () => goto("/"),
    },
    {
      label: "Products",
      isActive:
        location.pathname.startsWith("/customer-products") ||
        location.pathname.startsWith("/product/"),
      onClick: () => goto("/customer-products"),
    },
    {
      label: "Services",
      onClick: () => navigateToSection("services"),
    },
    {
      label: "About",
      isActive: location.pathname === "/about",
      onClick: () => goto("/about"),
    },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <div
          className="brand"
          onClick={() => goto("/")}
          role="button"
          tabIndex={0}
        >
          <div className="brand-text">
            <span className="brand-name">SmartHardware</span>
            <span className="brand-subtitle">Future-proof hardware hub</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-link ${item.isActive ? "active" : ""}`}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Search tools, brands, or SKU"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              aria-label="Search products"
            />
            <button type="submit" className="search-submit" aria-label="Submit search">
              <Search size={16} aria-hidden="true" />
            </button>
          </form>

          <div className="icon-cluster">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              className="icon-button cart-button"
              onClick={handleCartClick}
              aria-label="View cart"
            >
              <ShoppingCart size={16} aria-hidden="true" />
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </button>

            {user ? (
              <div className="account-controls" ref={accountMenuRef}>
                <button
                  type="button"
                  className="icon-button profile-button"
                  onClick={handleDashboardRedirect}
                  title="Open dashboard"
                  aria-label="Open dashboard"
                >
                  <UserCircle size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button account-menu-toggle"
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  aria-label="Open account menu"
                >
                  <MoreVertical size={16} aria-hidden="true" />
                </button>

                {isAccountMenuOpen && (
                  <div className="account-menu" role="menu">
                    <div className="account-summary">
                      <span className="avatar" aria-hidden="true">{initials}</span>
                      <div>
                        <p>{user?.name || "Smart Hardware user"}</p>
                        <span>{user?.email}</span>
                      </div>
                    </div>
                    <button type="button" onClick={handleProfileRedirect} role="menuitem">
                      View profile
                    </button>
                    {canDeleteAccount && (
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        role="menuitem"
                        className="danger"
                        disabled={isDeletingAccount}
                      >
                        {isDeletingAccount ? "Deleting…" : "Delete account"}
                      </button>
                    )}
                    <button type="button" onClick={logout} role="menuitem" className="danger">
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <button type="button" className="text-button" onClick={() => goto("/login")}>
                  Sign in
                </button>
                <button type="button" className="solid-button" onClick={() => goto("/register")}>Create account</button>
                <button type="button" className="text-button" onClick={() => goto("/register-supplier")}>
                  Become a supplier
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="icon-button mobile-toggle"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            {isMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="mobile-panel" ref={mobileMenuRef}>
          <form className="mobile-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Search products..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <button type="submit">
              <Search size={16} aria-hidden="true" />
            </button>
          </form>

          <div className="mobile-nav">
            {navItems.map((item) => (
              <button key={item.label} type="button" onClick={item.onClick}>
                {item.label}
              </button>
            ))}
          </div>

          {user ? (
            <div className="mobile-account">
              <div className="mobile-account-summary">
                <span className="avatar" aria-hidden="true">{initials}</span>
                <div>
                  <p>{user?.name || "Smart Hardware user"}</p>
                  <span>{user?.email}</span>
                </div>
              </div>
              <button type="button" onClick={handleDashboardRedirect}>Go to dashboard</button>
              <button type="button" onClick={handleProfileRedirect}>View profile</button>
              {canDeleteAccount && (
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="danger"
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? "Deleting…" : "Delete account"}
                </button>
              )}
              <button type="button" onClick={logout} className="danger">
                Sign out
              </button>
            </div>
          ) : (
            <div className="mobile-auth">
              <button type="button" onClick={() => goto("/login")}>Sign in</button>
              <button type="button" onClick={() => goto("/register")}>
                Create customer account
              </button>
              <button type="button" onClick={() => goto("/register-supplier")}>Become a supplier</button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
