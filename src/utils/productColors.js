/**
 * Product color helpers — { label, hex?, image?, stock? }
 * Selecting a color can swap the displayed product image.
 */

function toColorEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const label = raw.trim();
    if (!label) return null;
    return { label, hex: '', image: '', stock: null };
  }
  if (typeof raw === 'object') {
    const label = String(raw.label ?? raw.name ?? raw.color ?? '').trim();
    if (!label) return null;
    const hasStock =
      raw.stock !== undefined &&
      raw.stock !== null &&
      raw.stock !== '' &&
      Number.isFinite(Number(raw.stock));
    return {
      label,
      hex: String(raw.hex ?? raw.colorHex ?? '').trim(),
      image: String(raw.image ?? raw.imageUrl ?? raw.image_url ?? '').trim(),
      stock: hasStock ? Math.max(0, Number(raw.stock)) : null,
    };
  }
  return null;
}

function parseColorEntries(raw) {
  if (Array.isArray(raw)) {
    return raw.map(toColorEntry).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parseColorEntries(parsed);
    } catch (_e) {
      // comma-separated labels
    }
    return trimmed
      .split(/[\n,|]+/)
      .map((s) => toColorEntry(s))
      .filter(Boolean);
  }
  return [];
}

export function normalizeProductColors(product) {
  if (!product || typeof product !== 'object') return [];
  return parseColorEntries(product.colors ?? product.color_options ?? product.colorOptions);
}

export function serializeProductColors(colors) {
  if (!Array.isArray(colors)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of colors) {
    const entry = toColorEntry(raw);
    if (!entry) continue;
    const key = entry.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = { label: entry.label };
    if (entry.hex) row.hex = entry.hex;
    if (entry.image) row.image = entry.image;
    if (entry.stock !== null && entry.stock !== undefined) {
      row.stock = Math.max(0, Number(entry.stock) || 0);
    }
    out.push(row);
  }
  return out;
}

/**
 * Block save when a draft row has photo/hex/stock but no name, or duplicate names.
 * @returns {string[]} human-readable issues (empty = ok)
 */
export function validateColorDrafts(colors) {
  if (!Array.isArray(colors)) return [];
  const issues = [];
  const seen = new Set();
  colors.forEach((raw, index) => {
    const label = String(raw?.label ?? raw?.name ?? raw?.color ?? '').trim();
    const image = String(raw?.image ?? raw?.imageUrl ?? '').trim();
    const hex = String(raw?.hex ?? '').trim();
    const hasStock =
      raw?.stock !== undefined &&
      raw?.stock !== null &&
      String(raw.stock).trim() !== '';
    const rowNum = index + 1;
    if (!label && (image || hex || hasStock)) {
      issues.push(
        image
          ? `Color row ${rowNum} has a photo but no name — name it or remove the photo before saving.`
          : `Color row ${rowNum} has details but no name — enter a color name before saving.`
      );
      return;
    }
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) {
      issues.push(`Duplicate color name "${label}" — each color needs a unique name.`);
    }
    seen.add(key);
  });
  return issues;
}

export function productHasColors(product) {
  return normalizeProductColors(product).length > 0;
}

export function getProductColorEntries(product) {
  return normalizeProductColors(product);
}

export function findColorEntry(product, colorLabel) {
  const label = String(colorLabel || '').trim().toLowerCase();
  if (!label) return null;
  return getProductColorEntries(product).find((c) => c.label.toLowerCase() === label) || null;
}

export function isColorSoldOut(product, colorLabel) {
  const entry = findColorEntry(product, colorLabel);
  if (entry && entry.stock !== null && entry.stock !== undefined) {
    return Number(entry.stock) <= 0;
  }
  const stock = Number(product?.stock);
  return Number.isFinite(stock) ? stock <= 0 : false;
}

/**
 * Image to show for the selected color (falls back to product.image).
 */
export function getColorImage(product, colorLabel) {
  const entry = findColorEntry(product, colorLabel);
  if (entry?.image) return entry.image;
  return product?.image || '';
}

/**
 * Apply selected color onto a product clone (image swap + selectedColor).
 */
export function withSelectedColor(product, colorLabel) {
  if (!product) return product;
  const label = String(colorLabel || '').trim();
  if (!label) return { ...product };
  const entry = findColorEntry(product, label);
  const image = entry?.image || product.image;
  return {
    ...product,
    selectedColor: label,
    image,
    baseImage: product.baseImage || product.image,
  };
}

export default {
  normalizeProductColors,
  serializeProductColors,
  validateColorDrafts,
  productHasColors,
  getProductColorEntries,
  findColorEntry,
  isColorSoldOut,
  getColorImage,
  withSelectedColor,
};
