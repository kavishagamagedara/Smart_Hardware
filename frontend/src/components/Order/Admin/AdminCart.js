import React, { useContext } from 'react';
import './AdminCart.css';
import { useNavigate } from "react-router-dom";
import { AdminCartContext } from './AdminCartContext';

function AdminCart() {
  const { cartItems, removeFromCart, updateQuantity } = useContext(AdminCartContext);
  const navigate = useNavigate();

  const handleIncrease = (id) => {
    const item = cartItems.find(i => i.id === id);
    updateQuantity(id, item.quantity + 1);
  };

  const handleDecrease = (id) => {
    const item = cartItems.find(i => i.id === id);
    if (item.quantity > 1) updateQuantity(id, item.quantity - 1);
  };

  const handleInputChange = (id, value) => {
    const qty = parseInt(value) || 1;
    updateQuantity(id, qty);
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handlePlaceOrder = () => {
    if (cartItems.length === 0) {
      alert("No items in the cart to place order!");
      return;
    }

    // Normalize items for checkout (_id, price, quantity)
    const orderItems = cartItems.map(item => ({
      _id: item.id,              // ✅ renamed to _id
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      img: item.img
    }));

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
            <div className="cart-item" key={item.id}>
              <img src={item.img} alt={item.name} />
              <div className="item-details">
                <h3>{item.name}</h3>
                <p>Unit Price: ${item.price.toFixed(2)}</p>
                <div className="quantity">
                  <button onClick={() => handleDecrease(item.id)}>-</button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                    min="1"
                  />
                  <button onClick={() => handleIncrease(item.id)}>+</button>
                </div>
                <p>Total: ${(item.price * item.quantity).toFixed(2)}</p>
                <button className="remove" onClick={() => removeFromCart(item.id)}>Remove</button>
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
