// src/context/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
// import PropTypes from "prop-types";
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Point to /api by default
const API = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api";
const ORIGIN = API.replace(/\/api$/, "");
const withAuth = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

const clearPersistedAuth = () => {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  } catch {}
  try {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
  } catch {}
};

// Normalize user object from server
const normalizeUser = (u) => {
  if (!u) return null;
  let avatar = "";
  if (u.avatar) {
    if (/^https?:\/\//i.test(u.avatar)) {
      avatar = u.avatar;
    } else if (u.avatar.startsWith("/")) {
      // e.g. "/uploads/abc.png" -> "http://localhost:5000/uploads/abc.png"
      avatar = `${ORIGIN}${u.avatar}`;
    } else {
      avatar = `${ORIGIN}/${u.avatar}`;
    }
  }
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    role: String(u.role || "user").toLowerCase(),
    permissions: Array.isArray(u.permissions)
      ? Array.from(
          new Set(
            u.permissions
              .map((p) => String(p || "").trim().toLowerCase())
              .filter(Boolean)
          )
        )
      : [],
    age: u.age ?? null,
    address: u.address ?? "",
    avatar,
  };
};

const readStore = (k) => {
  try {
    return localStorage.getItem(k) ?? sessionStorage.getItem(k);
  } catch {
    return sessionStorage.getItem(k);
  }
};

// Determine initial theme
const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem("theme") ?? sessionStorage.getItem("theme");
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {}
  return "light";
};

// AuthProvider component
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {  
    const raw = readStore("user");
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [token, setToken] = useState(() => readStore("token") || null);
  const [theme, setTheme] = useState(getInitialTheme);

  // apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); }
    catch { try { sessionStorage.setItem("theme", theme); } catch {} }
  }, [theme]);

  // persist session
  useEffect(() => {
    const write = (store) => {
      if (user) store.setItem("user", JSON.stringify(user));
      else store.removeItem("user");
      if (token) store.setItem("token", token);
      else store.removeItem("token");
    };
    try { write(localStorage); }
    catch { try { write(sessionStorage); } catch {} }
  }, [user, token]);

  // Validate token on load or when it changes
  useEffect(() => {
  if (!token || typeof fetch !== "function") return;

    let cancelled = false;
    const controller = new AbortController();

    // Validate current token by fetching user profile
    const validateSession = async () => {
      try {
        const res = await fetch(`${API}/users/me`, {
          headers: { ...withAuth(token) },
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("SESSION_EXPIRED");
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to validate session");
        }

        const data = await res.json();
        if (cancelled) return;
        const normalized = normalizeUser(data);
        setUser((prev) => {
          if (prev && JSON.stringify(prev) === JSON.stringify(normalized)) {
            return prev;
          }
          return normalized;
        });
      } catch (error) {
        if (cancelled || error.name === "AbortError") return;
        console.warn("Session validation failed:", error.message || error);
        clearPersistedAuth();
        setUser(null);
        setToken(null);
      }
    };

    validateSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);

  // Login with email and password
  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Login failed");
    const nu = normalizeUser(data.user);
    setUser(nu);
    setToken(data.token || null);
    return { user: nu, token: data.token || null };
  }, []);

  // Signup for regular user
  const signup = useCallback(async (payload) => {
    const res = await fetch(`${API}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Signup failed");
    // optionally auto-login:
    await login(payload.email, payload.password);
  }, [login]);

  // Register supplier (business account)
  const registerSupplier = useCallback(async (payload) => {
    const res = await fetch(`${API}/users/register-supplier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Signup failed");
    return login(payload.email, payload.password);
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearPersistedAuth();
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error("Not authenticated"); 
    const res = await fetch(`${API}/users/${user._id}`, { 
      method: "PUT",
      headers: { "Content-Type": "application/json", ...withAuth(token) },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Update failed");
    const updated = normalizeUser(data);
    setUser(updated);
    return updated;
  }, [user, token]);

  // Change user password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`${API}/users/${user._id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...withAuth(token) },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Password change failed");
    return data;
  }, [user, token]);


  // Upload or change avatar
  const uploadAvatar = useCallback(async (file) => {
    if (!user) throw new Error("Not authenticated");
    const fd = new FormData();
    fd.append("avatar", file);
    const res = await fetch(`${API}/users/${user._id}/avatar`, {
      method: "POST",
      headers: { ...withAuth(token) }, // don't set Content-Type for FormData
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Upload failed");
    const updated = normalizeUser(data.user || data);
    setUser(updated);
    return updated;
  }, [user, token]);

  // Delete avatar
  const deleteAvatar = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`${API}/users/${user._id}/avatar`, {
      method: "DELETE",
      headers: { ...withAuth(token) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Delete failed");
    const updated = normalizeUser(data.user || data);
    setUser(updated);
    return updated;
  }, [user, token]);

  const deleteAccount = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`${API}/users/me`, {
      method: "DELETE",
      headers: { ...withAuth(token) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Account deletion failed");
    clearPersistedAuth();
    setUser(null);
    setToken(null);
    return data;
  }, [user, token]);

  // Toggle between "light" and "dark" themes
  const toggleTheme = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);

  // Memoize context value to avoid unnecessary re-renders
  const value = useMemo(() => ({
      user, token, theme,
  login, signup, registerSupplier, logout,
      updateProfile, changePassword, uploadAvatar, deleteAvatar, deleteAccount,
      toggleTheme, setTheme
    }),
    [user, token, theme, login, signup, registerSupplier, logout, updateProfile, changePassword, uploadAvatar, deleteAvatar, deleteAccount, toggleTheme]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
