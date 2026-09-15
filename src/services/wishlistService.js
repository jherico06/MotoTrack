// ─── WISHLIST SERVICE (SUPABASE + LOCAL STORAGE PERSISTENCE) ────────────────
import { appStorage } from './storageAdapter';
import { productService } from './productService';

const STORAGE_PREFIX = 'mototrack_wishlist_';

class WishlistService {
  getStorageKey(userId) {
    return `${STORAGE_PREFIX}${userId || 'guest'}`;
  }

  /**
   * Get set of wishlisted product IDs for user
   */
  getWishlistIds(userId) {
    if (!userId) return []; // If not logged in, no wishlist items are shown
    
    try {
      const key = this.getStorageKey(userId);
      const raw = appStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('Failed to load wishlist IDs:', e);
    }
    // Return empty array for new users instead of demo items
    return [];
  }

  /**
   * Save wishlist product IDs
   */
  saveWishlistIds(userId, ids) {
    try {
      const key = this.getStorageKey(userId);
      appStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {
      console.warn('Failed to save wishlist IDs:', e);
    }
  }

  /**
   * Get full product objects currently in user's wishlist
   */
  async getWishlistProducts(userId) {
    const ids = this.getWishlistIds(userId);
    const allProducts = await productService.getProducts();
    const map = new Map(allProducts.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  /**
   * Check if a product ID is in user wishlist
   */
  isWishlisted(userId, productId) {
    const ids = this.getWishlistIds(userId);
    return ids.includes(productId);
  }

  /**
   * Toggle a product in wishlist (add if missing, remove if present)
   */
  toggleWishlist(userId, productId) {
    const ids = this.getWishlistIds(userId);
    let updated;
    let isAdded = false;

    if (ids.includes(productId)) {
      updated = ids.filter((id) => id !== productId);
      isAdded = false;
    } else {
      updated = [productId, ...ids];
      isAdded = true;
    }

    this.saveWishlistIds(userId, updated);
    return { success: true, isAdded, count: updated.length };
  }

  /**
   * Add a product ID to wishlist
   */
  addToWishlist(userId, productId) {
    const ids = this.getWishlistIds(userId);
    if (!ids.includes(productId)) {
      const updated = [productId, ...ids];
      this.saveWishlistIds(userId, updated);
      return { success: true, count: updated.length };
    }
    return { success: true, count: ids.length };
  }

  /**
   * Remove a product ID from wishlist
   */
  removeFromWishlist(userId, productId) {
    const ids = this.getWishlistIds(userId);
    const updated = ids.filter((id) => id !== productId);
    this.saveWishlistIds(userId, updated);
    return { success: true, count: updated.length };
  }

  /**
   * Clear all wishlist items for user
   */
  clearWishlist(userId) {
    this.saveWishlistIds(userId, []);
    return { success: true, count: 0 };
  }
}

export const wishlistService = new WishlistService();
