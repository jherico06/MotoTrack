/**
 * Product size helpers — tires/rims support { label, price, stock? } entries.
 * Legacy string sizes remain supported and inherit the product base price.
 */

export const SIZE_REQUIRED_CATEGORIES = ['Tires & Wheels', 'Tires'];

export const DEFAULT_TIRE_SIZES = [
  '90/90-17',
  '100/80-17',
  '110/70-17',
  '120/70ZR17',
  '140/70-17',
  '150/70-17',
  '160/60ZR17',
  '180/55ZR17',
  '190/55ZR17',
  '200/55ZR17',
];

export const DEFAULT_RIM_SIZES = ['17x3.5', '17x4.5', '17x5.5', '17x6.0'];

function toEntry(raw, fallbackPrice = 0) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const label = raw.trim();
    if (!label) return null;
    return { label, price: Number(fallbackPrice) || 0, stock: null };
  }
  if (typeof raw === 'object') {
    const label = String(raw.label ?? raw.size ?? raw.name ?? '').trim();
    if (!label) return null;
    const priceRaw = raw.price ?? raw.amount ?? fallbackPrice;
    const price = Number(priceRaw);
    const hasStock =
      raw.stock !== undefined &&
      raw.stock !== null &&
      raw.stock !== '' &&
      Number.isFinite(Number(raw.stock));
    return {
      label,
      price: Number.isFinite(price) ? price : Number(fallbackPrice) || 0,
      stock: hasStock ? Math.max(0, Number(raw.stock)) : null,
    };
  }
  return null;
}

function parseSizeEntries(raw, fallbackPrice = 0) {
  if (Array.isArray(raw)) {
    return raw.map((item) => toEntry(item, fallbackPrice)).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseSizeEntries(parsed, fallbackPrice);
      }
    } catch (_e) {
      // comma / newline separated labels
    }
    return trimmed
      .split(/[\n,|]+/)
      .map((s) => toEntry(s, fallbackPrice))
      .filter(Boolean);
  }
  return [];
}

/**
 * Normalized size rows: [{ label, price, stock }]
 * stock = null means inherit product-level stock
 */
export function normalizeProductSizes(product) {
  if (!product || typeof product !== 'object') return [];
  const base = Number(product.price ?? product.base_price ?? 0) || 0;
  return parseSizeEntries(product.sizes ?? product.size_options ?? product.sizeOptions, base);
}

/**
 * Persistable size payload for Supabase / local storage.
 */
export function serializeProductSizes(sizes, fallbackPrice = 0) {
  if (!Array.isArray(sizes)) return [];
  const base = Number(fallbackPrice) || 0;
  const seen = new Set();
  const out = [];
  for (const raw of sizes) {
    const entry = toEntry(raw, base);
    if (!entry) continue;
    const key = entry.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = { label: entry.label, price: Number(entry.price) || 0 };
    if (entry.stock !== null && entry.stock !== undefined) {
      row.stock = Math.max(0, Number(entry.stock) || 0);
    }
    out.push(row);
  }
  return out;
}

/**
 * Block save when a draft row has price/stock but no size label, or duplicate labels.
 * @returns {string[]} human-readable issues (empty = ok)
 */
export function validateSizeDrafts(sizes) {
  if (!Array.isArray(sizes)) return [];
  const issues = [];
  const seen = new Set();
  sizes.forEach((raw, index) => {
    const label = String(raw?.label ?? raw?.size ?? raw?.name ?? '').trim();
    const hasPrice =
      raw?.price !== undefined &&
      raw?.price !== null &&
      String(raw.price).trim() !== '' &&
      Number(raw.price) > 0;
    const hasStock =
      raw?.stock !== undefined &&
      raw?.stock !== null &&
      String(raw.stock).trim() !== '';
    const rowNum = index + 1;
    if (!label && (hasPrice || hasStock)) {
      issues.push(
        `Size row ${rowNum} has a price or stock but no size name — name it before saving.`
      );
      return;
    }
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) {
      issues.push(`Duplicate size "${label}" — each size needs a unique name.`);
    }
    seen.add(key);
  });
  return issues;
}

export function categoryNeedsSizes(category = '') {
  const c = String(category || '').toLowerCase();
  return SIZE_REQUIRED_CATEGORIES.some((cat) => c === cat.toLowerCase());
}

export function productNameSuggestsSized(name = '') {
  const n = String(name || '').toLowerCase();
  return /\b(tire|tyre|rim|wheel)\b/.test(n);
}

/**
 * Whether the shopper must pick a size before checkout/cart.
 * Only when the product has explicitly configured sizes — no automatic defaults.
 */
export function productNeedsSizes(product) {
  if (!product || typeof product !== 'object') return false;
  return normalizeProductSizes(product).length > 0;
}

/**
 * Size entries with prices from the product only (admin-configured).
 * @returns {{ label: string, price: number, stock: number|null }[]}
 */
export function getProductSizeEntries(product) {
  if (!product || typeof product !== 'object') return [];
  return normalizeProductSizes(product);
}

/**
 * Labels only (backward compatible).
 */
export function getProductSizeOptions(product) {
  return getProductSizeEntries(product).map((e) => e.label);
}

/**
 * Available units for a size. Uses size.stock when set; otherwise product.stock.
 */
export function getSizeStock(product, sizeLabel) {
  if (!product) return 0;
  const productStock = Number(product.stock);
  const fallback = Number.isFinite(productStock) ? Math.max(0, productStock) : 0;
  const label = String(sizeLabel || '').trim();
  if (!label) return fallback;
  const match = getProductSizeEntries(product).find(
    (e) => e.label.toLowerCase() === label.toLowerCase()
  );
  if (!match) return fallback;
  if (match.stock !== null && match.stock !== undefined) {
    return Math.max(0, Number(match.stock) || 0);
  }
  return fallback;
}

export function isSizeSoldOut(product, sizeLabel) {
  return getSizeStock(product, sizeLabel) <= 0;
}

export function isProductSoldOut(product) {
  if (!product) return true;
  if (productNeedsSizes(product)) {
    const entries = getProductSizeEntries(product);
    if (entries.length === 0) return Number(product.stock) <= 0;
    return entries.every((e) => isSizeSoldOut(product, e.label));
  }
  return Number(product.stock) <= 0;
}

/**
 * Selling price for a selected size (falls back to product.price).
 */
export function getSizePrice(product, sizeLabel) {
  if (!product) return 0;
  const label = String(sizeLabel || '').trim();
  if (!label) return Number(product.price) || 0;
  const match = getProductSizeEntries(product).find(
    (e) => e.label.toLowerCase() === label.toLowerCase()
  );
  if (match && Number.isFinite(Number(match.price))) return Number(match.price);
  return Number(product.price) || 0;
}

/**
 * Clone product with selectedSize and price locked to that size.
 */
export function withSelectedSize(product, sizeLabel) {
  if (!product) return product;
  const label = String(sizeLabel || '').trim();
  if (!label) return { ...product };
  const price = getSizePrice(product, label);
  return {
    ...product,
    selectedSize: label,
    price,
    basePrice: Number(product.basePrice ?? product.price) || price,
  };
}

export function cartLineKey(productId, size = '') {
  return `${productId || ''}::${size || ''}`;
}

export function formatSizePriceLabel(entry) {
  if (!entry) return '';
  const price = Number(entry.price) || 0;
  return `${entry.label} · ₱${price.toLocaleString()}`;
}

export default {
  SIZE_REQUIRED_CATEGORIES,
  DEFAULT_TIRE_SIZES,
  DEFAULT_RIM_SIZES,
  normalizeProductSizes,
  serializeProductSizes,
  validateSizeDrafts,
  categoryNeedsSizes,
  productNeedsSizes,
  getProductSizeEntries,
  getProductSizeOptions,
  getSizeStock,
  isSizeSoldOut,
  isProductSoldOut,
  getSizePrice,
  withSelectedSize,
  cartLineKey,
  formatSizePriceLabel,
};
