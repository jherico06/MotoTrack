import React, { createContext, useContext, useState, useMemo } from 'react';
import { promoService } from '../services/promoService';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoId, setAppliedPromoId] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState({ text: '', isError: false });
  const [toastMessage, setToastMessage] = useState('');

  const shippingRate = 150;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const addToCart = (product, qty = 1) => {
    const stock = Number(product?.stock);
    const maxStock = Number.isFinite(stock) ? Math.max(0, stock) : Infinity;
    if (maxStock <= 0) {
      showToast(`"${product.name?.slice(0, 20) || 'Item'}..." is out of stock`);
      return;
    }

    let capped = false;
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + qty, maxStock);
        if (nextQty === existing.quantity) {
          capped = true;
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: nextQty, product: { ...item.product, ...product } }
            : item
        );
      }
      return [...prevCart, { product, quantity: Math.min(qty, maxStock) }];
    });

    if (capped) {
      showToast(`Only ${maxStock} unit(s) available for this item`);
    } else {
      showToast(`Added "${product.name.slice(0, 20)}..." to bag!`);
    }
  };

  const updateCartQuantity = (productId, delta) => {
    let cappedAt = null;
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id !== productId) return item;
          const stock = Number(item.product?.stock);
          const maxStock = Number.isFinite(stock) ? Math.max(0, stock) : Infinity;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > maxStock) {
            cappedAt = maxStock;
            return { ...item, quantity: maxStock };
          }
          return { ...item, quantity: newQty };
        })
        .filter(Boolean)
    );
    if (cappedAt !== null) {
      showToast(`Only ${cappedAt} unit(s) available for this item`);
    }
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setIsFreeShipping(false);
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

  const shippingFee = useMemo(() => {
    if (cart.length === 0) return 0;
    return isFreeShipping ? 0 : shippingRate;
  }, [cart.length, isFreeShipping]);

  const cartTotal = useMemo(() => {
    const total = cartSubtotal - discountAmount + shippingFee;
    return total > 0 ? total : 0;
  }, [cartSubtotal, discountAmount, shippingFee]);

  const applyPromo = async (codeToApply) => {
    const code = (codeToApply || promoCode).trim();
    if (!code) {
      setPromoFeedback({ text: 'Please enter a voucher code', isError: true });
      return { success: false };
    }
    const result = await promoService.validatePromo(code);
    if (result.valid) {
      setDiscountPercent(result.discountPercent);
      const freeShip = result.description?.toLowerCase().includes('free shipping');
      setIsFreeShipping(freeShip);
      setAppliedPromoId(result.promoId || null);
      
      const benefitText = [
        result.discountPercent > 0 ? `${result.discountPercent}% OFF` : '',
        freeShip ? 'Free Shipping' : ''
      ].filter(Boolean).join(' + ');

      setPromoFeedback({
        text: `✅ Promo "${result.code}" applied! (${benefitText})`,
        isError: false,
      });
      showToast(`Applied ${result.code}!`);
      return { success: true, discountPercent: result.discountPercent, promoId: result.promoId, isFreeShipping: freeShip };
    } else {
      setDiscountPercent(0);
      setIsFreeShipping(false);
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
    shippingFee,
    isFreeShipping,
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
