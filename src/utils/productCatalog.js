/**
 * Catalog display helpers — only show stars and % off from real customer data / admin compare-at.
 */

/** Leftover default from the old admin "add product" form. */
const PLACEHOLDER_COMPARE_AT = 42500;

/**
 * Compare-at / "was" price the shopper should see.
 * Returns undefined when the value is missing, not a markdown, or the old ₱42,500 form default.
 */
export function sanitizeCompareAtPrice(oldPrice, sellingPrice) {
  const oldVal = Number(oldPrice);
  const price = Number(sellingPrice) || 0;
  if (!oldVal || !Number.isFinite(oldVal) || oldVal <= price) return undefined;
  if (oldVal === PLACEHOLDER_COMPARE_AT && price < 30000) return undefined;
  const pctOff = ((oldVal - price) / oldVal) * 100;
  // 90%+ off against a 5-digit "was" price is the leftover placeholder, not a real promo
  if (pctOff >= 90 && oldVal >= 10000) return undefined;
  return oldVal;
}

export function productHasCustomerRatings(product, reviewListCount = null) {
  if (reviewListCount != null) {
    return Number(reviewListCount) > 0;
  }
  return Number(product?.reviews) > 0 && Number(product?.rating) > 0;
}

export function getRatedScore(product) {
  if (!productHasCustomerRatings(product)) return 0;
  return Number(product.rating) || 0;
}
