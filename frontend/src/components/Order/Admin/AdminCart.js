import React, { useContext } from 'react';
import './AdminCart.css';
import { useNavigate } from "react-router-dom";
import { AdminCartContext } from './AdminCartContext';

function AdminCart() {
  const { cartItems, removeFromCart, updateQuantity } = useContext(AdminCartContext);
  const navigate = useNavigate();

  const handleIncrease = (productId) => {
    const item = cartItems.find(i => i.productId === productId);
    updateQuantity(productId, item.quantity + 1);
  };

  const handleDecrease = (productId) => {
    const item = cartItems.find(i => i.productId === productId);
    if (item.quantity > 1) updateQuantity(productId, item.quantity - 1);
  };

  const handleInputChange = (productId, value) => {
    const qty = parseInt(value) || 1;
    updateQuantity(productId, qty);
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handlePlaceOrder = () => {
  if (cartItems.length === 0) {
    alert("No items in the cart to place order!");
    return;
  }

  // Normalize items
  const orderItems = cartItems.map(item => ({
    productId: item.productId || item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    img: item.img,
    supplierId: item.supplierId, // 👈 must be here
  }));

  console.log("🛒 Cart Items before checkout:", cartItems);
  console.log("🛒 Normalized OrderItems to send:", orderItems);

  // Extra safeguard: check missing supplierIds
  const missing = orderItems.filter(i => !i.supplierId);
  if (missing.length > 0) {
    console.error("❌ Missing supplierId in:", missing);
    alert("Some items are missing supplierId. Please re-add products to cart.");
    return;
  }

  navigate("/AdminCheckout", {
    state: {
      items: orderItems,
      total: subtotal
    }
  });
};


  return (
    <div className="admin-cart-page">
      <div className="cart-container">
        <h2>Admin Supplier Cart</h2>

        {cartItems.length === 0 ? (
          <p>No items in the admin cart</p>
        ) : (
          cartItems.map(item => (
            <div className="cart-item" key={item.productId}>
              <img src={item.img} alt={item.name} />
              <div className="item-details">
                <h3>{item.name}</h3>
                <p>Unit Price: ${item.price.toFixed(2)}</p>
                <div className="quantity">
                  <button onClick={() => handleDecrease(item.productId)}>-</button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleInputChange(item.productId, e.target.value)}
                    min="1"
                  />
                  <button onClick={() => handleIncrease(item.productId)}>+</button>
                </div>
                <p>Total: ${(item.price * item.quantity).toFixed(2)}</p>
                <button className="remove" onClick={() => removeFromCart(item.productId)}>Remove</button>
              </div>
            </div>
          ))
        )}

        {cartItems.length > 0 && (
          <div className="cart-summary">
            <p>Subtotal: ${subtotal.toFixed(2)}</p>
            <h3>Grand Total: ${subtotal.toFixed(2)}</h3>
            <button className="place-order" onClick={handlePlaceOrder}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCart;
