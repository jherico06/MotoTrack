import React, { createContext, useContext, useState, useMemo } from 'react';
import { promoService } from '../services/promoService';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoId, setAppliedPromoId] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoFeedback, setPromoFeedback] = useState({ text: '', isError: false });
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const addToCart = (product, qty = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prevCart, { product, quantity: qty }];
    });
    showToast(`Added "${product.name.slice(0, 20)}..." to bag!`);
  };

  const updateCartQuantity = (productId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setPromoCode('');
    setAppliedPromoId(null);
    setPromoFeedback({ text: '', isError: false });
  };

  const cartItemCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (cartSubtotal * discountPercent) / 100;
  }, [cartSubtotal, discountPercent]);

  const cartTotal = useMemo(() => {
    const total = cartSubtotal - discountAmount;
    return total > 0 ? total : 0;
  }, [cartSubtotal, discountAmount]);

  const applyPromo = async (codeToApply) => {
    const code = (codeToApply || promoCode).trim();
    if (!code) {
      setPromoFeedback({ text: 'Please enter a voucher code', isError: true });
      return { success: false };
    }
    const result = await promoService.validatePromo(code);
    if (result.valid) {
      setDiscountPercent(result.discountPercent);
      setAppliedPromoId(result.promoId || null);
      setPromoFeedback({
        text: `✅ Promo "${result.code}" applied! (${result.discountPercent}% OFF)`,
        isError: false,
      });
      showToast(`Saved ${result.discountPercent}% with ${result.code}!`);
      return { success: true, discountPercent: result.discountPercent, promoId: result.promoId };
    } else {
      setDiscountPercent(0);
      setAppliedPromoId(null);
      setPromoFeedback({ text: `❌ ${result.message || result.error || 'Invalid code'}`, isError: true });
      return { success: false, message: result.message || result.error };
    }
  };

  const value = {
    cart,
    setCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartItemCount,
    cartSubtotal,
    discountPercent,
    discountAmount,
    cartTotal,
    promoCode,
    setPromoCode,
    appliedPromoId,
    applyPromo,
    promoFeedback,
    setPromoFeedback,
    toastMessage,
    showToast,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
