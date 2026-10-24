import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { wishlistService } from '../services/products/wishlistService.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { currentUser } = useAuth();
  const [wishlist, setWishlist] = useState({});
  const [customizations, setCustomizations] = useState([]);

  const applyState = useCallback((state) => {
    const map = {};
    (state?.productIds || []).forEach((id) => {
      map[id] = true;
    });
    setWishlist(map);
    setCustomizations(state?.customizations || []);
  }, []);

  const syncWishlist = useCallback(
    async (userId) => {
      const uid = userId || currentUser?.id || 'guest';
      // Local first for instant UI
      applyState(wishlistService.getWishlistState(uid));
      // Then merge remote (AI installs survive refresh / new tabs)
      if (uid && uid !== 'guest') {
        try {
          const remote = await wishlistService.hydrateFromRemote(uid);
          applyState(remote);
        } catch (e) {
          console.warn('[WishlistContext] hydrate failed:', e?.message || e);
        }
      }
    },
    [applyState, currentUser?.id]
  );

  useEffect(() => {
    syncWishlist(currentUser?.id || 'guest');
  }, [currentUser?.id, syncWishlist]);

  const toggleWishlist = (productId) => {
    const res = wishlistService.toggleWishlist(currentUser?.id || 'guest', productId);
    setWishlist((prev) => ({
      ...prev,
      [productId]: res.isAdded,
    }));
    return res;
  };

  const addToWishlist = (productId) => {
    wishlistService.addToWishlist(currentUser?.id || 'guest', productId);
    setWishlist((prev) => ({
      ...prev,
      [productId]: true,
    }));
  };

  const removeFromWishlist = (productId) => {
    wishlistService.removeFromWishlist(currentUser?.id || 'guest', productId);
    setWishlist((prev) => ({
      ...prev,
      [productId]: false,
    }));
  };

  const addCustomizationToWishlist = (payload) => {
    const uid = currentUser?.id || 'guest';
    const res = wishlistService.addCustomizationToWishlist(uid, payload);
    if (res?.success) {
      applyState(wishlistService.getWishlistState(uid));
    }
    return res;
  };

  const removeCustomizationFromWishlist = (customizationId) => {
    const uid = currentUser?.id || 'guest';
    const res = wishlistService.removeCustomizationFromWishlist(uid, customizationId);
    applyState(wishlistService.getWishlistState(uid));
    return res;
  };

  const clearWishlist = () => {
    wishlistService.clearWishlist(currentUser?.id || 'guest');
    setWishlist({});
    setCustomizations([]);
  };

  const isWishlisted = (productId) => Boolean(wishlist[productId]);

  const isCustomizationWishlisted = (customizationId) =>
    wishlistService.isCustomizationWishlisted(
      currentUser?.id || 'guest',
      customizationId
    );

  const wishlistCount = useMemo(() => {
    const productCount = Object.values(wishlist).filter(Boolean).length;
    return productCount + (customizations?.length || 0);
  }, [wishlist, customizations]);

  const value = {
    wishlist,
    customizations,
    wishlistCount,
    toggleWishlist,
    addToWishlist,
    removeFromWishlist,
    addCustomizationToWishlist,
    removeCustomizationFromWishlist,
    clearWishlist,
    isWishlisted,
    isCustomizationWishlisted,
    syncWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return ctx;
}
