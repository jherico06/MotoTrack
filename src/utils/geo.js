/**
 * Geocoding + Google Maps helpers for rider navigation.
 * Photon is used because it allows browser CORS (Nominatim often does not).
 */

export const STORE_LOCATION = {
  name: "D'Blockchain Motorparts and Accessories",
  address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
  plusCode: '6Q44+MPQ, Naga, 6037 Cebu',
  lat: 10.20663,
  lng: 123.75675,
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=10.20663,123.75675',
};

export function areaFromAddress(address) {
  const parts = String(address || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  return parts[0] || 'Unspecified area';
}

export function parseLatLng(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

export function googleMapsNavigateUrl(lat, lng, address = '') {
  const coords = parseLatLng(lat, lng);
  if (coords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
  }
  const q = encodeURIComponent(String(address || '').trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

export function googleMapsViewUrl(lat, lng, address = '') {
  const coords = parseLatLng(lat, lng);
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address || '').trim())}`;
}

export function mapsEmbedUrl(lat, lng, address = '') {
  const coords = parseLatLng(lat, lng);
  const q = coords ? `${coords.lat},${coords.lng}` : String(address || '').trim();
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

export async function geocodeAddress(address) {
  const raw = String(address || '').trim();
  if (!raw) return null;

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const candidates = [
    raw,
    parts.slice(1).join(', '),
    parts.slice(-2).join(', '),
    parts.slice(-1)[0],
  ].filter((c) => c && c.length >= 3);

  const uniqueQueries = Array.from(new Set(candidates)).map((c) =>
    /philippines/i.test(c) ? c : `${c}, Philippines`
  );

  for (const q of uniqueQueries) {
    try {
      const photon = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (photon.ok) {
        const data = await photon.json();
        const [lng, lat] = data?.features?.[0]?.geometry?.coordinates || [];
        const parsed = parseLatLng(lat, lng);
        if (parsed) return parsed;
      }
    } catch (_e) {}

    try {
      const nominatim = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (nominatim.ok) {
        const rows = await nominatim.json();
        const parsed = parseLatLng(rows?.[0]?.lat, rows?.[0]?.lon);
        if (parsed) return parsed;
      }
    } catch (_e) {}
  }

  return null;
}

export default {
  areaFromAddress,
  parseLatLng,
  googleMapsNavigateUrl,
  googleMapsViewUrl,
  mapsEmbedUrl,
  geocodeAddress,
};
