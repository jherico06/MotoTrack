/** Shared inventory threshold helpers — no service imports (avoids cycles). */

export function resolveReorderLevel(product, fallback = 5) {
  const raw =
    product?.reorder_level ??
    product?.reorderLevel ??
    product?.inventory?.reorder_level;
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function isLowStock(product, fallbackThreshold = 5) {
  const stock = Number(product?.stock ?? product?.stock_quantity ?? 0);
  const threshold = resolveReorderLevel(product, fallbackThreshold);
  return stock > 0 && stock <= threshold;
}

export function isOutOfStock(product) {
  return Number(product?.stock ?? product?.stock_quantity ?? 0) <= 0;
}

function isInheritedStock(entry) {
  return entry == null || entry.stock === null || entry.stock === undefined;
}

/**
 * Build a Map<label, qty> from restock delta rows.
 * @param {Array<{ label?: string, quantity?: number, addQty?: number }>|null|undefined} deltas
 * @returns {Map<string, number>}
 */
export function buildRestockDeltaMap(deltas) {
  const deltaMap = new Map();
  if (!Array.isArray(deltas)) return deltaMap;
  deltas.forEach((row) => {
    const label = String(row?.label || '').trim();
    const add = Number(row?.quantity ?? row?.addQty ?? 0);
    if (!label || !Number.isFinite(add) || add <= 0) return;
    deltaMap.set(label, (deltaMap.get(label) || 0) + add);
  });
  return deltaMap;
}

/**
 * Apply size restock deltas without inflating shared (inherited) stock pools.
 *
 * - Shared pool (any size has stock null): leave per-size stocks unchanged;
 *   product-level stock absorbs +qty. Only rewrite sizes if new labels appear.
 * - Explicit pool (every size has numeric stock): apply deltas per label;
 *   product stock should become sum(size.stock) via +qty (not absolute set).
 *
 * @param {{ label: string, price?: number, stock?: number|null }[]} existingSizes
 * @param {Map<string, number>} deltaMap
 * @param {number} fallbackPrice
 * @returns {{ nextSizes: Array|undefined, qtyFromSizes: number, sharedPool: boolean, productStockFromSizes: number|null }}
 */
export function applySizeRestockDeltas(existingSizes, deltaMap, fallbackPrice = 0) {
  const empty = {
    nextSizes: undefined,
    qtyFromSizes: 0,
    sharedPool: false,
    productStockFromSizes: null,
  };
  if (!(deltaMap instanceof Map) || deltaMap.size === 0) return empty;
  if (!Array.isArray(existingSizes) || existingSizes.length === 0) return empty;

  const qtyFromSizes = Array.from(deltaMap.values()).reduce((a, b) => a + b, 0);
  const basePrice = Number(fallbackPrice) || 0;
  const sharedPool = existingSizes.some(isInheritedStock);

  if (sharedPool) {
    const known = new Set(existingSizes.map((s) => s.label));
    const newLabels = [];
    deltaMap.forEach((_add, label) => {
      if (!known.has(label)) newLabels.push(label);
    });
    // No per-size stock mutation — keep inherit / existing explicit values as-is.
    // Only rewrite size JSON when introducing new labels.
    if (newLabels.length === 0) {
      return {
        nextSizes: undefined,
        qtyFromSizes,
        sharedPool: true,
        productStockFromSizes: null,
      };
    }
    const nextSizes = existingSizes.map((s) => ({
      label: s.label,
      price: Number(s.price) || basePrice,
      stock: isInheritedStock(s) ? null : Math.max(0, Number(s.stock) || 0),
    }));
    newLabels.forEach((label) => {
      nextSizes.push({ label, price: basePrice, stock: null });
    });
    return {
      nextSizes,
      qtyFromSizes,
      sharedPool: true,
      productStockFromSizes: null,
    };
  }

  const nextSizes = existingSizes.map((s) => {
    const add = deltaMap.get(s.label) || 0;
    const prev = Number(s.stock || 0);
    return {
      label: s.label,
      price: Number(s.price) || basePrice,
      stock: Math.max(0, prev + add),
    };
  });
  deltaMap.forEach((add, label) => {
    if (!nextSizes.some((s) => s.label === label)) {
      nextSizes.push({
        label,
        price: basePrice,
        stock: Math.max(0, add),
      });
    }
  });
  const productStockFromSizes = nextSizes.reduce(
    (sum, s) => sum + (Number(s.stock) || 0),
    0
  );
  return {
    nextSizes,
    qtyFromSizes,
    sharedPool: false,
    productStockFromSizes,
  };
}

/**
 * Apply color restock deltas with the same shared-pool vs explicit rules as sizes.
 *
 * @param {{ label: string, hex?: string, image?: string, stock?: number|null }[]} existingColors
 * @param {Map<string, number>} deltaMap
 * @returns {{ nextColors: Array|undefined, qtyFromColors: number, sharedPool: boolean }}
 */
export function applyColorRestockDeltas(existingColors, deltaMap) {
  const empty = { nextColors: undefined, qtyFromColors: 0, sharedPool: false };
  if (!(deltaMap instanceof Map) || deltaMap.size === 0) return empty;
  if (!Array.isArray(existingColors) || existingColors.length === 0) return empty;

  const qtyFromColors = Array.from(deltaMap.values()).reduce((a, b) => a + b, 0);
  const sharedPool = existingColors.some(isInheritedStock);

  if (sharedPool) {
    const known = new Set(existingColors.map((c) => c.label));
    const newLabels = [];
    deltaMap.forEach((_add, label) => {
      if (!known.has(label)) newLabels.push(label);
    });
    if (newLabels.length === 0) {
      return { nextColors: undefined, qtyFromColors, sharedPool: true };
    }
    const nextColors = existingColors.map((c) => ({
      label: c.label,
      ...(c.hex ? { hex: c.hex } : {}),
      ...(c.image ? { image: c.image } : {}),
      stock: isInheritedStock(c) ? null : Math.max(0, Number(c.stock) || 0),
    }));
    newLabels.forEach((label) => {
      nextColors.push({ label, stock: null });
    });
    return { nextColors, qtyFromColors, sharedPool: true };
  }

  const nextColors = existingColors.map((c) => {
    const add = deltaMap.get(c.label) || 0;
    const prev = Number(c.stock || 0);
    return {
      label: c.label,
      ...(c.hex ? { hex: c.hex } : {}),
      ...(c.image ? { image: c.image } : {}),
      stock: Math.max(0, prev + add),
    };
  });
  deltaMap.forEach((add, label) => {
    if (!nextColors.some((c) => c.label === label)) {
      nextColors.push({ label, stock: Math.max(0, add) });
    }
  });
  return { nextColors, qtyFromColors, sharedPool: false };
}
