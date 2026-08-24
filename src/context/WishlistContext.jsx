import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { wishlistService } from '../services/wishlistService';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { currentUser } = useAuth();
  const [wishlist, setWishlist] = useState({});

  const syncWishlist = (userId) => {
    const ids = wishlistService.getWishlistIds(userId || 'guest');
    const map = {};
    ids.forEach((id) => {
      map[id] = true;
    });
    setWishlist(map);
  };

  useEffect(() => {
    syncWishlist(currentUser?.id || 'guest');
  }, [currentUser]);

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

  const clearWishlist = () => {
    wishlistService.clearWishlist(currentUser?.id || 'guest');
    setWishlist({});
  };

  const isWishlisted = (productId) => Boolean(wishlist[productId]);

  const wishlistCount = useMemo(() => {
    return Object.values(wishlist).filter(Boolean).length;
  }, [wishlist]);

  const value = {
    wishlist,
    wishlistCount,
    toggleWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    isWishlisted,
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
