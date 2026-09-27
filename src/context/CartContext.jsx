import React, { createContext, useContext, useState, useMemo, useRef, useEffect } from 'react';
import { promoService } from '../services/promoService';
import { cartLineKey, isSizeSoldOut, productNeedsSizes, withSelectedSize } from '../utils/productSizes';

const CartContext = createContext(null);

function lineKeyOf(item) {
  return cartLineKey(item.product?.id, item.size || item.product?.selectedSize || '');
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [selectedLineKeys, setSelectedLineKeys] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoId, setAppliedPromoId] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState({ text: '', isError: false });
  const [toastMessage, setToastMessage] = useState('');

  const shippingRate = 150;
  const selectionInitializedRef = useRef(false);

  // Initialize selection when cart first gets items
  useEffect(() => {
    if (!selectionInitializedRef.current && cart.length > 0) {
      setSelectedLineKeys(cart.map((item) => lineKeyOf(item)));
      selectionInitializedRef.current = true;
    }
  }, [cart]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const addToCart = (product, qty = 1, options = {}) => {
    const size =
      options.size != null
        ? String(options.size).trim()
        : String(product?.selectedSize || '').trim();

    if (productNeedsSizes(product) && !size) {
      showToast('Please select a size first');
      return { success: false, needsSize: true };
    }

    if (size && isSizeSoldOut(product, size)) {
      showToast(`Size ${size} is sold out`);
      return { success: false, soldOut: true };
    }

    const stock = Number(product?.stock);
    const maxStock = Number.isFinite(stock) ? Math.max(0, stock) : Infinity;
    if (maxStock <= 0) {
      showToast(`"${product.name?.slice(0, 20) || 'Item'}..." is out of stock`);
      return { success: false };
    }

    const lineProduct = size ? withSelectedSize(product, size) : { ...product };
    const key = cartLineKey(product.id || product.product_id, size);

    let capped = false;
    setCart((prevCart) => {
      const existing = prevCart.find((item) => lineKeyOf(item) === key);
      if (existing) {
        const nextQty = Math.min(existing.quantity + qty, maxStock);
        if (nextQty === existing.quantity) {
          capped = true;
          return prevCart;
        }
        return prevCart.map((item) =>
          lineKeyOf(item) === key
            ? {
                ...item,
                quantity: nextQty,
                size,
                product: { ...item.product, ...lineProduct },
              }
            : item
        );
      }
      return [
        ...prevCart,
        {
          product: lineProduct,
          quantity: Math.min(qty, maxStock),
          size,
          lineKey: key,
        },
      ];
    });

    // Auto-select the newly added / modified item
    setSelectedLineKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));

    if (capped) {
      showToast(`Only ${maxStock} unit(s) available for this item`);
      return { success: false, capped: true };
    }
    const sizeLabel = size ? ` (${size})` : '';
    showToast(`Added "${String(product.name || 'Item').slice(0, 18)}${sizeLabel}..." to bag!`);
    return { success: true };
  };

  const updateCartQuantity = (productId, delta, size = '') => {
    const key = cartLineKey(productId, size);
    let cappedAt = null;
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (lineKeyOf(item) !== key) return item;
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

  const removeFromCart = (productId, size = '') => {
    const key = cartLineKey(productId, size);
    setCart((prevCart) => prevCart.filter((item) => lineKeyOf(item) !== key));
    setSelectedLineKeys((prev) => prev.filter((k) => k !== key));
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
    setSelectedLineKeys([]);
    setDiscountPercent(0);
    setIsFreeShipping(false);
    setPromoCode('');
    setAppliedPromoId(null);
    setPromoFeedback({ text: '', isError: false });
  };

  // Selection controls
  const toggleSelectItem = (productId, size = '') => {
    const key = cartLineKey(productId, size);
    setSelectedLineKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllItems = () => {
    setSelectedLineKeys(cart.map((item) => lineKeyOf(item)));
  };

  const deselectAllItems = () => {
    setSelectedLineKeys([]);
  };

  const toggleSelectAll = () => {
    const allKeys = cart.map((item) => lineKeyOf(item));
    const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedLineKeys.includes(k));
    if (allSelected) {
      setSelectedLineKeys([]);
    } else {
      setSelectedLineKeys(allKeys);
    }
  };

  const isItemSelected = (productId, size = '') => {
    const key = cartLineKey(productId, size);
    return selectedLineKeys.includes(key);
  };

  const isAllSelected = useMemo(() => {
    if (cart.length === 0) return false;
    return cart.every((item) => selectedLineKeys.includes(lineKeyOf(item)));
  }, [cart, selectedLineKeys]);

  const selectedCartItems = useMemo(() => {
    return cart.filter((item) => selectedLineKeys.includes(lineKeyOf(item)));
  }, [cart, selectedLineKeys]);

  const selectedCartItemCount = useMemo(() => {
    return selectedCartItems.reduce((total, item) => total + item.quantity, 0);
  }, [selectedCartItems]);

  const selectedCartSubtotal = useMemo(() => {
    return selectedCartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [selectedCartItems]);

  const selectedDiscountAmount = useMemo(() => {
    return (selectedCartSubtotal * discountPercent) / 100;
  }, [selectedCartSubtotal, discountPercent]);

  const selectedShippingFee = useMemo(() => {
    if (selectedCartItems.length === 0) return 0;
    return isFreeShipping ? 0 : shippingRate;
  }, [selectedCartItems.length, isFreeShipping]);

  const selectedCartTotal = useMemo(() => {
    if (selectedCartItems.length === 0) return 0;
    const total = selectedCartSubtotal - selectedDiscountAmount + selectedShippingFee;
    return total > 0 ? total : 0;
  }, [selectedCartItems.length, selectedCartSubtotal, selectedDiscountAmount, selectedShippingFee]);

  // Remove only selected items from cart (e.g. after successful selective checkout)
  const removeSelectedFromCart = () => {
    setCart((prevCart) => prevCart.filter((item) => !selectedLineKeys.includes(lineKeyOf(item))));
    setSelectedLineKeys([]);
    showToast('Checked out items removed from cart');
  };

  // Whole cart totals (backward compatibility)
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
        freeShip ? 'Free Shipping' : '',
      ]
        .filter(Boolean)
        .join(' + ');

      setPromoFeedback({
        text: `✅ Promo "${result.code}" applied! (${benefitText})`,
        isError: false,
      });
      showToast(`Applied ${result.code}!`);
      return {
        success: true,
        discountPercent: result.discountPercent,
        promoId: result.promoId,
        isFreeShipping: freeShip,
      };
    }

    setDiscountPercent(0);
    setIsFreeShipping(false);
    setAppliedPromoId(null);
    setPromoFeedback({
      text: `❌ ${result.message || result.error || 'Invalid code'}`,
      isError: true,
    });
    return { success: false, message: result.message || result.error };
  };

  const value = {
    cart,
    setCart,
    selectedLineKeys,
    setSelectedLineKeys,
    selectedCartItems,
    selectedCartItemCount,
    selectedCartSubtotal,
    selectedDiscountAmount,
    selectedShippingFee,
    selectedCartTotal,
    isAllSelected,
    isItemSelected,
    toggleSelectItem,
    selectAllItems,
    deselectAllItems,
    toggleSelectAll,
    removeSelectedFromCart,
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
