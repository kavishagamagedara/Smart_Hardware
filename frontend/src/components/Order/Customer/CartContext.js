// src/Components/Order/Customer/CartContext.js
import React, { createContext, useState } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Add product to cart
  const addToCart = (product) => {
  setCartItems((prevItems) => {
    const existing = prevItems.find(item => item.productId === product._id);
    if (existing) {
      return prevItems.map(item =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    }
    return [
      ...prevItems,
      {
        productId: product._id,   // ✅ always store real MongoDB _id
        name: product.name,
        price: product.price,
        img: `http://localhost:5000${product.imageUrl}`,
        quantity: 1
      }
    ];
  });
};


  // Remove one item
  const removeFromCart = (id) => {
    setCartItems(prevItems => prevItems.filter(item => item.productId !== id));
  };

  // Remove multiple selected items
  const removeMultipleFromCart = (ids) => {
    setCartItems(prevItems => prevItems.filter(item => !ids.includes(item.productId)));
  };

  // Update quantity
  const updateQuantity = (id, quantity) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.productId === id ? { ...item, quantity } : item
      )
    );
  };

  // Clear cart
  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        removeMultipleFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
