/**
 * Lightweight checks for shop compatibility status (no Universal guessing).
 * Run: node scripts/test-parts-compatibility.mjs
 */

const COMPAT_STATUS = {
  COMPATIBLE: 'compatible',
  INCOMPATIBLE: 'incompatible',
  UNAVAILABLE: 'unavailable',
  NO_BIKE: 'no_bike',
};

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function brandEquals(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function modelEquals(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function getCompatStatus(productId, bike, compatMap) {
  if (!bike?.brand || !bike?.model) return COMPAT_STATUS.NO_BIKE;
  const rows = compatMap instanceof Map ? compatMap.get(productId) || [] : [];
  if (!rows.length) return COMPAT_STATUS.UNAVAILABLE;
  const hit = rows.some(
    (r) => brandEquals(r.brand, bike.brand) && modelEquals(r.model, bike.model)
  );
  return hit ? COMPAT_STATUS.COMPATIBLE : COMPAT_STATUS.INCOMPATIBLE;
}

function formatCompatMessage(status, bike) {
  const label = [bike?.brand, bike?.model].filter(Boolean).join(' ').trim() || 'your motorcycle';
  switch (status) {
    case COMPAT_STATUS.COMPATIBLE:
      return `✓ Compatible with your ${label}`;
    case COMPAT_STATUS.INCOMPATIBLE:
      return `✗ Not compatible with your ${label}`;
    case COMPAT_STATUS.UNAVAILABLE:
      return 'Compatibility information unavailable';
    default:
      return 'Select your motorcycle to check part compatibility.';
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const map = new Map();
map.set('p1', [{ product_id: 'p1', brand: 'Honda', model: 'Click 125' }]);
map.set('p2', [{ product_id: 'p2', brand: 'Yamaha', model: 'NMAX' }]);

const bike = { brand: 'Honda', model: 'Click 125' };

assert(getCompatStatus('p1', bike, map) === COMPAT_STATUS.COMPATIBLE, 'p1 compatible');
assert(getCompatStatus('p2', bike, map) === COMPAT_STATUS.INCOMPATIBLE, 'p2 incompatible');
assert(getCompatStatus('p3', bike, map) === COMPAT_STATUS.UNAVAILABLE, 'p3 unavailable');
assert(getCompatStatus('p1', null, map) === COMPAT_STATUS.NO_BIKE, 'no bike');
assert(
  formatCompatMessage(COMPAT_STATUS.COMPATIBLE, bike).includes('Honda Click 125'),
  'label'
);
assert(
  formatCompatMessage(COMPAT_STATUS.UNAVAILABLE, bike) ===
    'Compatibility information unavailable',
  'unavailable copy'
);

console.log('OK: parts compatibility status checks passed');
