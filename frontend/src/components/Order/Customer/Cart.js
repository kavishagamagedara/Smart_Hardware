import React, { useContext, useState } from 'react';
import './Cart.css';
import { useNavigate } from "react-router-dom";
import { CartContext } from './CartContext';

function Cart() {
  const { cartItems, removeFromCart, updateQuantity } = useContext(CartContext);
  const [selectedItems, setSelectedItems] = useState([]);
  const navigate = useNavigate();

  const handleIncrease = (id) => {
    const item = cartItems.find(i => i.id === id);
    updateQuantity(id, item.quantity + 1);
  };

  const handleDecrease = (id) => {
    const item = cartItems.find(i => i.id === id);
    if (item.quantity > 1) {
      updateQuantity(id, item.quantity - 1);
    }
  };

  const handleInputChange = (id, value) => {
    const qty = parseInt(value) || 1;
    updateQuantity(id, qty);
  };

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === cartItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map(item => item.id));
    }
  };

  const subtotal = cartItems
    .filter(item => selectedItems.includes(item.id))
    .reduce((acc, item) => acc + item.price * item.quantity, 0);

  /*const handlePayNow = (item) => {
    navigate("/Checkout", { state: { selectedItems: [item] } });
  };*/

  return (
    <div className="cart-page">
      <h2>Shopping Cart</h2>

      {cartItems.length === 0 ? <p>Your cart is empty</p> : (
        <>
          <div className="select-all">
            <input
              type="checkbox"
              checked={selectedItems.length === cartItems.length && cartItems.length > 0}
              onChange={handleSelectAll}
            />
            <label>Select All</label>
          </div>

          {cartItems.map(item => (
            <div className="cart-item" key={item.id}>
              <input
                type="checkbox"
                checked={selectedItems.includes(item.id)}
                onChange={() => handleSelectItem(item.id)}
              />
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
          ))}
        </>
      )}

      {cartItems.length > 0 && (
        <div className="cart-summary">
          <p>Subtotal (selected): ${subtotal.toFixed(2)}</p>
          <h3>Grand Total: ${subtotal.toFixed(2)}</h3>
          <button
            className="Checkout"
            disabled={selectedItems.length === 0}
            onClick={() =>
              navigate("/Checkout", {
                state: {
                  selectedItems: cartItems.filter(item =>
                    selectedItems.includes(item.id)
                  )
                }
              })
            }
          >
            Proceed to Checkout ({selectedItems.length})
          </button>
        </div>
      )}
    </div>
  );
}

export default Cart;
