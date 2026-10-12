/**
 * Driving-route helpers for live delivery maps.
 * Uses the public OSRM demo for road-following polylines (store → customer).
 */

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 */

const routeCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(from, to) {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

function isValidPoint(p) {
  return (
    p &&
    Number.isFinite(Number(p.lat)) &&
    Number.isFinite(Number(p.lng)) &&
    Math.abs(Number(p.lat)) <= 90 &&
    Math.abs(Number(p.lng)) <= 180
  );
}

/**
 * Fetch a road-following driving route between two coordinates (OSRM).
 * Returns null when the provider is unavailable — callers should still show pins.
 *
 * @param {LatLng} from
 * @param {LatLng} to
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<LatLng[] | null>}
 */
export async function fetchDrivingRoute(from, to, opts = {}) {
  if (!isValidPoint(from) || !isValidPoint(to)) return null;

  const a = { lat: Number(from.lat), lng: Number(from.lng) };
  const b = { lat: Number(to.lat), lng: Number(to.lng) };

  // Same point — no route needed
  if (Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6) {
    return [a];
  }

  const key = cacheKey(a, b);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.path;
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}` +
      `?overview=full&geometries=geojson&steps=false`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: opts.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.code !== 'Ok' || !data?.routes?.[0]?.geometry?.coordinates?.length) {
      return null;
    }

    const path = data.routes[0].geometry.coordinates
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
      .filter((p) => isValidPoint(p));

    if (path.length < 2) return null;

    routeCache.set(key, { path, at: Date.now() });
    return path;
  } catch (err) {
    if (err?.name === 'AbortError') return null;
    console.warn('[deliveryRouting] OSRM route failed:', err?.message || err);
    return null;
  }
}

export const ROUTING_PROVIDERS = Object.freeze({
  NONE: 'none',
  OSRM: 'osrm',
  OPEN_ROUTE_SERVICE: 'ors',
});

export default { fetchDrivingRoute, ROUTING_PROVIDERS };
