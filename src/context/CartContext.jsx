import React, { createContext, useContext, useState, useMemo, useRef, useEffect } from 'react';
import { promoService, PROMO_TYPES } from '../services/products/promoService.js';
import { cartLineKey, isSizeSoldOut, productNeedsSizes, withSelectedSize } from '../utils/productSizes.js';

const CartContext = createContext(null);

function lineKeyOf(item) {
  return cartLineKey(item.product?.id, item.size || item.product?.selectedSize || '');
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [selectedLineKeys, setSelectedLineKeys] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoId, setAppliedPromoId] = useState(null);
  const [appliedPromoMeta, setAppliedPromoMeta] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [productDiscountAmount, setProductDiscountAmount] = useState(0);
  const [promoFreeShipping, setPromoFreeShipping] = useState(false);
  const [autoFreeShipping, setAutoFreeShipping] = useState(false);
  const [autoFreeShippingPromoId, setAutoFreeShippingPromoId] = useState(null);
  const [promoFeedback, setPromoFeedback] = useState({ text: '', isError: false });
  const [toastMessage, setToastMessage] = useState('');

  const shippingRate = 150;
  const selectionInitializedRef = useRef(false);
  const revalidateTimerRef = useRef(null);
  const isFreeShipping = promoFreeShipping || autoFreeShipping;

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

  const clearPromoState = (feedback = { text: '', isError: false }) => {
    setDiscountPercent(0);
    setProductDiscountAmount(0);
    setPromoFreeShipping(false);
    setAppliedPromoId(null);
    setAppliedPromoMeta(null);
    setPromoCode('');
    setPromoFeedback(feedback);
  };

  const applyValidatedResult = (result, code) => {
    setPromoCode(result.code || code);
    setDiscountPercent(result.discountPercent || 0);
    setProductDiscountAmount(Number(result.productDiscount || 0));
    setPromoFreeShipping(Boolean(result.isFreeShipping));
    setAppliedPromoId(result.promoId || null);
    setAppliedPromoMeta({
      code: result.code,
      promoType: result.promoType,
      discountPercent: result.discountPercent || 0,
      productIds: result.productIds || [],
      appliesTo: result.appliesTo,
      message: result.message,
    });

    const successText =
      result.message ||
      (result.promoType === PROMO_TYPES.FREE_SHIPPING
        ? '✓ Free Shipping Applied'
        : `✓ ${result.discountPercent}% Discount Applied`);

    setPromoFeedback({ text: successText, isError: false });
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
    if (options.compatWarning) {
      showToast(options.compatWarning);
    } else {
      showToast(`Added "${String(product.name || 'Item').slice(0, 18)}${sizeLabel}..." to bag!`);
    }
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
    setAutoFreeShipping(false);
    setAutoFreeShippingPromoId(null);
    clearPromoState({ text: '', isError: false });
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

  // Discount only on eligible selected items (stored amount from last validation,
  // recomputed when selection / meta changes for display consistency)
  const selectedDiscountAmount = useMemo(() => {
    if (!appliedPromoMeta || !appliedPromoId) return 0;
    if (appliedPromoMeta.promoType === PROMO_TYPES.FREE_SHIPPING) return 0;
    const pct = Number(appliedPromoMeta.discountPercent || discountPercent || 0);
    if (pct <= 0) return 0;

    const allProducts = appliedPromoMeta.appliesTo === 'ALL_PRODUCTS';
    const allowed = new Set((appliedPromoMeta.productIds || []).map(String));
    const eligibleSubtotal = selectedCartItems.reduce((sum, item) => {
      const pid = String(item.product?.id || item.product?.product_id || '');
      if (!allProducts && !allowed.has(pid)) return sum;
      return sum + Number(item.product?.price || 0) * Number(item.quantity || 1);
    }, 0);
    return (eligibleSubtotal * pct) / 100;
  }, [selectedCartItems, appliedPromoMeta, appliedPromoId, discountPercent]);

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
    setAutoFreeShipping(false);
    setAutoFreeShippingPromoId(null);
    clearPromoState({ text: '', isError: false });
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
    if (!appliedPromoMeta || !appliedPromoId) return 0;
    if (appliedPromoMeta.promoType === PROMO_TYPES.FREE_SHIPPING) return 0;
    const pct = Number(appliedPromoMeta.discountPercent || discountPercent || 0);
    if (pct <= 0) return 0;
    const allProducts = appliedPromoMeta.appliesTo === 'ALL_PRODUCTS';
    const allowed = new Set((appliedPromoMeta.productIds || []).map(String));
    const eligibleSubtotal = cart.reduce((sum, item) => {
      const pid = String(item.product?.id || item.product?.product_id || '');
      if (!allProducts && !allowed.has(pid)) return sum;
      return sum + Number(item.product?.price || 0) * Number(item.quantity || 1);
    }, 0);
    return (eligibleSubtotal * pct) / 100;
  }, [cart, appliedPromoMeta, appliedPromoId, discountPercent]);

  const shippingFee = useMemo(() => {
    if (cart.length === 0) return 0;
    return isFreeShipping ? 0 : shippingRate;
  }, [cart.length, isFreeShipping]);

  const cartTotal = useMemo(() => {
    const total = cartSubtotal - discountAmount + shippingFee;
    return total > 0 ? total : 0;
  }, [cartSubtotal, discountAmount, shippingFee]);

  const applyPromo = async (codeToApply, itemsOverride = null) => {
    const code = (codeToApply || promoCode).trim();
    if (!code) {
      setPromoFeedback({ text: 'Please enter a promo code.', isError: true });
      return { success: false };
    }

    const items = itemsOverride || selectedCartItems;
    const ship =
      items.length === 0 ? 0 : shippingRate;

    const result = await promoService.validatePromo(code, {
      cartItems: items,
      shippingFee: ship,
    });

    if (result.valid) {
      // Prevent stacking the same promo: always replace previous application
      applyValidatedResult(result, code);
      showToast(`Applied ${result.code}!`);
      return {
        success: true,
        discountPercent: result.discountPercent,
        promoId: result.promoId,
        isFreeShipping: result.isFreeShipping,
        productDiscount: result.productDiscount,
      };
    }

    clearPromoState({
      text: result.error || 'Promo code is invalid.',
      isError: true,
    });
    return { success: false, message: result.error };
  };

  // Recalculate manual promo + auto free-shipping whenever cart/selection changes
  useEffect(() => {
    if (revalidateTimerRef.current) clearTimeout(revalidateTimerRef.current);
    revalidateTimerRef.current = setTimeout(async () => {
      const items = selectedCartItems;

      if (items.length === 0) {
        setAutoFreeShipping(false);
        setAutoFreeShippingPromoId(null);
        if (appliedPromoId || promoCode) {
          clearPromoState({ text: '', isError: false });
        }
        return;
      }

      // Revalidate manually entered promo (percent or free-ship code)
      if (appliedPromoId && promoCode) {
        const result = await promoService.validatePromo(promoCode, {
          cartItems: items,
          shippingFee: shippingRate,
        });
        if (result.valid) {
          applyValidatedResult(result, promoCode);
        } else {
          clearPromoState({
            text: result.error || 'Promo no longer applies to your cart.',
            isError: true,
          });
        }
      }

      // Auto-apply active FREE_SHIPPING promos for eligible products (no code required)
      try {
        const freeShip = await promoService.findApplicableFreeShipping(items, shippingRate);
        if (freeShip) {
          setAutoFreeShipping(true);
          setAutoFreeShippingPromoId(freeShip.promoId || null);
          if (!promoCode) {
            setPromoFeedback({
              text: '✓ Free Shipping Applied',
              isError: false,
            });
          } else if (appliedPromoMeta?.promoType === PROMO_TYPES.PERCENT_OFF) {
            setPromoFeedback({
              text: `✓ ${appliedPromoMeta.discountPercent}% Discount + Free Shipping Applied`,
              isError: false,
            });
          }
        } else {
          setAutoFreeShipping(false);
          setAutoFreeShippingPromoId(null);
        }
      } catch (e) {
        console.warn('Auto free-shipping check failed:', e);
      }
    }, 250);

    return () => {
      if (revalidateTimerRef.current) clearTimeout(revalidateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedLineKeys]);

  const effectivePromoId =
    appliedPromoId || (autoFreeShipping ? autoFreeShippingPromoId : null);

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
    productDiscountAmount,
    shippingFee,
    shippingRate,
    isFreeShipping,
    autoFreeShipping,
    cartTotal,
    promoCode,
    setPromoCode,
    appliedPromoId: effectivePromoId,
    appliedPromoMeta,
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
