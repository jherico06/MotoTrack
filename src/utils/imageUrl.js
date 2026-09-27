/**
 * Build resized Supabase Storage image URLs for list thumbnails.
 * Falls back to the original URL when transformation is unavailable.
 */

const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/';

/**
 * @param {string} url
 * @param {{ width?: number, height?: number, quality?: number, resize?: 'cover'|'contain'|'fill' }} opts
 */
export function getOptimizedImageUrl(url, opts = {}) {
  const raw = String(url || '').trim();
  if (!raw || raw.startsWith('data:')) return raw;

  const width = Math.max(48, Number(opts.width) || 400);
  const height = opts.height != null ? Math.max(48, Number(opts.height)) : undefined;
  const quality = Math.min(100, Math.max(20, Number(opts.quality) || 70));
  const resize = opts.resize || 'cover';

  // Already a transform URL — leave alone
  if (raw.includes('/storage/v1/render/image/')) return raw;

  const markerIdx = raw.indexOf(SUPABASE_STORAGE_MARKER);
  if (markerIdx === -1) {
    // Unsplash / external CDN — append width when possible
    if (/images\.unsplash\.com/i.test(raw)) {
      try {
        const u = new URL(raw);
        u.searchParams.set('w', String(width));
        u.searchParams.set('q', String(Math.min(80, quality)));
        u.searchParams.set('auto', 'format');
        return u.toString();
      } catch (_e) {
        return raw;
      }
    }
    return raw;
  }

  try {
    const origin = raw.slice(0, markerIdx);
    const pathAndQuery = raw.slice(markerIdx + SUPABASE_STORAGE_MARKER.length);
    const pathOnly = pathAndQuery.split('?')[0];
    const params = new URLSearchParams();
    params.set('width', String(width));
    if (height) params.set('height', String(height));
    params.set('resize', resize);
    params.set('quality', String(quality));
    return `${origin}/storage/v1/render/image/public/${pathOnly}?${params.toString()}`;
  } catch (_e) {
    return raw;
  }
}

export function getProductCardImageUrl(url) {
  return getOptimizedImageUrl(url, { width: 360, quality: 65, resize: 'cover' });
}

export function getProductDetailImageUrl(url) {
  return getOptimizedImageUrl(url, { width: 900, quality: 75, resize: 'contain' });
}

export default {
  getOptimizedImageUrl,
  getProductCardImageUrl,
  getProductDetailImageUrl,
};
