import { useEffect, useMemo, useState } from 'react';
import { productService } from '../../services/products/productService.js';
import { dataCache } from '../../services/cache/dataCache.js';
import { CacheKeys } from '../../services/cache/cacheKeys.js';

/**
 * Counts only saved catalog products that exist in the active product catalog,
 * keeping the web navbar badge consistent with WishlistPage.
 */
export function useWebSavedWishlistCount(wishlist, providedProducts = null) {
  const hasProvidedProducts = Array.isArray(providedProducts);
  const [loadedProducts, setLoadedProducts] = useState(() => {
    if (hasProvidedProducts) return [];
    const cached = dataCache.get(CacheKeys.productsList())?.value;
    return Array.isArray(cached) ? cached : [];
  });

  useEffect(() => {
    if (hasProvidedProducts) return undefined;
    let alive = true;
    productService
      .getProducts()
      .then((list) => {
        if (alive && Array.isArray(list)) {
          setLoadedProducts(list);
        }
      })
      .catch(() => {});

    const unsub = productService.subscribe((list) => {
      if (alive && Array.isArray(list)) {
        setLoadedProducts(list);
      }
    });

    return () => {
      alive = false;
      unsub?.();
    };
  }, [hasProvidedProducts]);

  const activeProducts = hasProvidedProducts ? providedProducts : loadedProducts;

  return useMemo(() => {
    if (!wishlist || typeof wishlist !== 'object') return 0;
    if (!Array.isArray(activeProducts) || activeProducts.length === 0) return 0;
    let count = 0;
    for (const product of activeProducts) {
      if (product?.id && wishlist[product.id]) {
        count += 1;
      }
    }
    return count;
  }, [activeProducts, wishlist]);
}

export default useWebSavedWishlistCount;

