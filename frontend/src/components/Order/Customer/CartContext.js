import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../context/AuthContext";

export const CartContext = createContext();

const CART_STORAGE_PREFIX = "smart_hardware_cart:";
const ORIGIN = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const storageAvailable = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const buildStorageKey = (userId) => {
  if (!userId) return `${CART_STORAGE_PREFIX}guest`;
  return `${CART_STORAGE_PREFIX}user_${userId}`;
};

const normalizeQuantity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return Math.max(1, Math.floor(numeric));
};

const sanitizeCartItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const map = new Map();
  items.forEach((raw) => {
    if (!raw || typeof raw !== "object") return;
    const productId = raw.productId || raw._id || raw.id;
    if (!productId) return;
    const quantity = normalizeQuantity(raw.quantity);
    const price = Number.isFinite(Number(raw.price)) ? Number(raw.price) : 0;
    const entry = {
      ...raw,
      productId,
      name: raw.name || raw.productName || "Product",
      price,
      quantity,
    };
    if (map.has(productId)) {
      map.set(productId, { ...map.get(productId), ...entry });
    } else {
      map.set(productId, entry);
    }
  });
  return Array.from(map.values());
};

const readCartFromStorage = (key) => {
  if (!storageAvailable() || !key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeCartItems(parsed);
  } catch (error) {
    console.warn("Failed to read cart from storage", error);
    return [];
  }
};

const writeCartToStorage = (key, items) => {
  if (!storageAvailable() || !key) return;
  try {
    if (!items || items.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(items));
    }
  } catch (error) {
    console.warn("Failed to persist cart", error);
  }
};

const clearOtherUserCarts = (currentUserId) => {
  if (!storageAvailable()) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(CART_STORAGE_PREFIX)) {
        const currentUserKey = buildStorageKey(currentUserId);
        const guestKey = buildStorageKey(null);
        // Remove any cart that doesn't belong to current user or guest
        if (key !== currentUserKey && key !== guestKey) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear other user carts", error);
  }
};

// Clear ALL cart data from localStorage - use for complete reset
const clearAllCarts = () => {
  if (!storageAvailable()) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(CART_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear all carts", error);
  }
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?._id || null;

  // Do not read token once at module load time; read it on-demand so that
  // the CartContext reacts to logins that happen after the app mounted.
  const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  const guestKey = useMemo(() => (storageAvailable() ? buildStorageKey(null) : null), []);
  const userKey = useMemo(
    () => (storageAvailable() && userId ? buildStorageKey(userId) : null),
    [userId]
  );
  const storageKey = userKey || guestKey;

  const [cartItems, setCartItems] = useState(() => []);

  const [isInitialized, setIsInitialized] = useState(false);

  // Start with null so the first effect run will load the current storageKey
  const previousKeyRef = useRef(null);
  const cartSnapshotRef = useRef(cartItems);

  // (removed forced clear on mount) initial load is handled by the storageKey effect

  useEffect(() => {
    cartSnapshotRef.current = cartItems;
  }, [cartItems]);

  useEffect(() => {
    if (!storageAvailable() || !storageKey) return;

    const prevKey = previousKeyRef.current;
    if (prevKey === storageKey) return;

    previousKeyRef.current = storageKey;

    // Always clear the cart immediately when switching storage keys
    setCartItems([]);
    cartSnapshotRef.current = [];

    // Clean up any stale carts from other users to prevent cross-contamination
    if (userId) {
      clearOtherUserCarts(userId);
    }

    // Load only the cart for the current storage key - no merging to ensure isolation
    const items = readCartFromStorage(storageKey);
    setCartItems(items);
    cartSnapshotRef.current = items;
    setIsInitialized(true);
    // If user is logged in, try to fetch server-side cart and prefer server copy
    (async () => {
      try {
        if (userId) {
          const tokenNow = getToken();
          if (!tokenNow) return;
          const res = await fetch(`${ORIGIN}/api/carts`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${tokenNow}` },
          });
          if (res.ok) {
            const json = await res.json();
            const serverItems = sanitizeCartItems(json.items || []);
            if (serverItems && serverItems.length > 0) {
              setCartItems(serverItems);
              cartSnapshotRef.current = serverItems;
              writeCartToStorage(storageKey, serverItems);
            } else {
               // If server cart is empty but local storage has items, push local items to server
               const localItems = readCartFromStorage(storageKey);
               if (localItems && localItems.length > 0) {
                 try {
                   await fetch(`${ORIGIN}/api/carts`, {
                     method: 'PUT',
                     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenNow}` },
                     body: JSON.stringify({ items: localItems }),
                   });
                 } catch (err) {
                   console.warn('Failed to push local cart to server on login', err);
                 }
               }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to sync cart from server', err);
      }
    })();
  }, [storageKey, userKey, guestKey, userId]);

  useEffect(() => {
    if (!storageAvailable() || !storageKey || !isInitialized) return;
    writeCartToStorage(storageKey, cartItems);

    // debounce server sync for logged-in users
    let t;
    if (userId) {
      t = setTimeout(async () => {
        try {
          const tokenNow = getToken();
          if (!tokenNow) return;
          await fetch(`${ORIGIN}/api/carts`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenNow}`,
            },
            body: JSON.stringify({ items: cartItems }),
          });
        } catch (err) {
          console.warn('Failed to sync cart to server', err);
        }
      }, 700);
    }
    return () => clearTimeout(t);
  }, [cartItems, storageKey, isInitialized]);

  const clearServerCart = async () => {
    try {
      if (!userId) return;
      const tokenNow = getToken();
      if (!tokenNow) return;
      await fetch(`${ORIGIN}/api/carts`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenNow}` } });
    } catch (err) {
      console.warn('Failed to clear server cart', err);
    }
  };

  useEffect(() => {
    if (user) return;
    if (!storageAvailable()) return;
    previousKeyRef.current = guestKey;
    const guestItems = readCartFromStorage(guestKey);
    setCartItems(guestItems);
    setIsInitialized(true);
  }, [user, guestKey]);

  // Clear cart when user changes (logout/login with different user)
  const previousUserIdRef = useRef(userId);
  useEffect(() => {
    const prevUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    
    // Handle user state changes with aggressive cart clearing
    if (prevUserId !== userId) {
      console.log(`[CartContext] User changed: ${prevUserId} -> ${userId}. Clearing cart.`);
      
      // User changed - immediately clear cart and all storage to prevent cross-contamination
      setCartItems([]);
      cartSnapshotRef.current = [];
      
      // More aggressive clearing when switching between actual users (not just logout)
      if (prevUserId !== null && userId !== null && prevUserId !== userId) {
        // Different user logged in - clear all carts to ensure complete isolation
        console.log(`[CartContext] Different user login detected. Clearing all carts.`);
        clearAllCarts();
      } else if (userId) {
        // Normal user login - just clear other user carts
        console.log(`[CartContext] User login detected. Clearing other user carts.`);
        clearOtherUserCarts(userId);
      }
      
      // If user logged out (became null), clear guest cart too
      if (userId === null && prevUserId !== null) {
        console.log(`[CartContext] User logout detected. Clearing guest cart.`);
        if (storageAvailable() && guestKey) {
          writeCartToStorage(guestKey, []);
        }
      }
    }
  }, [userId, guestKey]);

  const normalizeProduct = useCallback((product, quantity = 1) => {
    if (!product) return null;
    const productId = product.productId || product._id || product.id;
    if (!productId) return null;

    const price = Number(product.price ?? product.unitPrice ?? 0);
    const image = product.img || product.imageUrl || "";
    const img =
      typeof image === "string" && image
        ? image.startsWith("http")
          ? image
          : `${ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`
        : "";

    return {
      productId,
      name: product.name || product.productName || "Product",
      price,
      img,
      quantity: normalizeQuantity(quantity),
    };
  }, []);

  const addToCart = useCallback(
    (product, qty = 1) => {
      const entry = normalizeProduct(product, qty);
      if (!entry) return;
      setCartItems((prev) => {
        const existing = prev.find((item) => item.productId === entry.productId);
        if (existing) {
          return prev.map((item) =>
            item.productId === entry.productId
              ? { ...item, quantity: normalizeQuantity(item.quantity + entry.quantity) }
              : item
          );
        }
        return [...prev, entry];
      });
    },
    [normalizeProduct]
  );

  const removeFromCart = useCallback((id) => {
    if (!id) return;
    setCartItems((prev) => prev.filter((item) => item.productId !== id));
  }, []);

  const removeMultipleFromCart = useCallback((ids = []) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const lookup = new Set(ids);
    setCartItems((prev) => prev.filter((item) => !lookup.has(item.productId)));
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    if (!id) return;
    const normalized = normalizeQuantity(quantity);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setCartItems((prev) => prev.filter((item) => item.productId !== id));
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === id ? { ...item, quantity: normalized } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const cartState = useMemo(
    () => ({
      cartItems,
      totalItems: cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      subtotal: cartItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      ),
    }),
    [cartItems]
  );

  const contextValue = useMemo(
    () => ({
      cartItems,
      cartState,
      addToCart,
      removeFromCart,
      removeMultipleFromCart,
      updateQuantity,
      clearCart,
      clearServerCart,
    }),
    [cartItems, cartState, addToCart, removeFromCart, removeMultipleFromCart, updateQuantity, clearCart]
  );

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>;
};
