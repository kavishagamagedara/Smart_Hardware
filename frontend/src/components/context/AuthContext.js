// src/context/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// ✅ Point to /api by default
const API = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
// ✅ Files like /uploads/* live at the server origin (not under /api)
const ORIGIN = API.replace(/\/api$/, "");

// Build headers only when we actually have a token
const withAuth = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

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
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
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
    return nu;
  }, []);

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

  const logout = useCallback(() => { setUser(null); setToken(null); }, []);

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

  const toggleTheme = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);

  const value = useMemo(() => ({
      user, token, theme,
      login, signup, logout,
      updateProfile, changePassword, uploadAvatar,
      toggleTheme, setTheme
    }),
    [user, token, theme, login, signup, logout, updateProfile, changePassword, uploadAvatar, toggleTheme]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
