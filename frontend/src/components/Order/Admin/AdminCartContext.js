import React, { createContext, useEffect, useState, useRef } from "react";

export const AdminCartContext = createContext();

const STORAGE_KEY = "adminCartItems";
const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const ADMIN_CART_ENDPOINT = `${API_ROOT}/api/admin-carts`;

export const AdminCartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => {
        const quantity = Number(item?.quantity ?? 1);
        return {
          ...item,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        };
      });
    } catch (error) {
      console.error("Failed to restore admin cart", error);
      return [];
    }
  });

  const previousCartRef = useRef(cartItems);

  const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!cartItems || cartItems.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
      }
    } catch (error) {
      console.error("Failed to persist admin cart", error);
    }
  }, [cartItems]);

  // On mount, if logged in, try to sync with server cart
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = getToken();
        if (!token) return;
        // Read local-first to avoid overwriting supplier metadata (supplierId) which
        // the shared `/api/carts` endpoint does not preserve. If local data exists,
        // keep it. Only fall back to server items when local storage is empty.
        const local = (() => {
          try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
          } catch (e) {
            return [];
          }
        })();

  const res = await fetch(ADMIN_CART_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
  const json = await res.json();
  const serverItems = Array.isArray(json.items) ? json.items : [];
        if (!mounted) return;

        if (Array.isArray(local) && local.length > 0) {
          // Prefer local storage (preserves supplierId). Do not overwrite with server items.
          // Optionally we could merge server data, but the server cart schema drops supplierId
          // so merging can cause data loss — keep local as the source of truth here.
          setCartItems(local);
        } else if (serverItems && serverItems.length > 0) {
          // Only use server items if local is empty (first time or client cleared)
          setCartItems(serverItems);
        }
      } catch (err) {
        console.warn('AdminCart: failed to sync from server', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // NOTE: We intentionally do not sync Admin cart to the shared `/api/carts` endpoint
  // on every change because that endpoint (customer cart) doesn't persist supplierId or
  // other supplier-related metadata. Admin cart is persisted to localStorage only to
  // preserve supplier references across refreshes.
  // However, to match the customer cart behavior (persist to DB and clear DB on order),
  // we will sync to the server when token is available but ensure supplierId is passed
  // through so the backend can persist it (backend CartModel now stores supplierId).
  useEffect(() => {
    if (!cartItems || !Array.isArray(cartItems)) return;
    const token = getToken();
    if (!token) return;
    const changed = JSON.stringify(previousCartRef.current) !== JSON.stringify(cartItems);
    if (!changed) return;
    const t = setTimeout(async () => {
      try {
        // Send items as plain JS objects; backend will sanitize and persist supplierId
        await fetch(ADMIN_CART_ENDPOINT, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: cartItems }),
        });
        previousCartRef.current = cartItems;
      } catch (err) {
        console.warn('AdminCart: failed to sync to server', err);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [cartItems]);

  // Immediate server sync helper (used after mutating state) to avoid race conditions
  const syncServerCartImmediate = async (items) => {
    try {
      const token = getToken();
      if (!token) return;
      await fetch(ADMIN_CART_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
      });
      previousCartRef.current = items;
    } catch (err) {
      console.warn('AdminCart: immediate sync failed', err);
    }
  };

  const addToCart = (item) => {
    const incomingQty = Number(item?.quantity ?? 1);
    const safeQty = Number.isFinite(incomingQty) && incomingQty > 0 ? incomingQty : 1;
    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      const next = existing
        ? prev.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + safeQty } : i))
        : [
            ...prev,
            {
              ...item,
              quantity: safeQty,
            },
          ];
      // fire-and-forget immediate sync
      syncServerCartImmediate(next);
      return next;
    });
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      syncServerCartImmediate(next);
      return next;
    });
  };

  const updateQuantity = (productId, quantity) => {
    const nextQty = Number(quantity);
    setCartItems((prev) => {
      const next = prev.map((i) =>
        i.productId === productId
          ? {
              ...i,
              quantity: Number.isFinite(nextQty) && nextQty > 0 ? nextQty : 1,
              supplierId: i.supplierId,
            }
          : i
      );
      syncServerCartImmediate(next);
      return next;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    // clear on server as well
    (async () => {
      try {
        await clearServerCart();
      } catch (err) {
        console.warn('AdminCart: failed to clear server cart during clearCart', err);
      }
    })();
  };

  const clearServerCart = async () => {
    try {
      const token = getToken();
      if (!token) return;
      await fetch(ADMIN_CART_ENDPOINT, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.warn('AdminCart: failed to clear server cart', err);
    }
  };

  return (
    <AdminCartContext.Provider
      value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, clearServerCart }}
    >
      {children}
    </AdminCartContext.Provider>
  );
};
