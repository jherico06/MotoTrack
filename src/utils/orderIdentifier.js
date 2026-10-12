/**
 * Canonical order identifiers for delivery QR validation.
 * Comparisons are exact after normalization — never a substring match.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ORDER_RE = /^ORD-(ON|POS|TEL)-\d{4}-\d{5}$/i;
const LEGACY_ORDER_RE = /^ord-\d{10,}-\d{4,}$/i;

export function normalizeOrderIdentifier(value) {
  let s = String(value ?? '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '');
  if (!s) return '';
  if (UUID_RE.test(s)) return s.toLowerCase();
  if (PUBLIC_ORDER_RE.test(s)) return s.toUpperCase();
  if (LEGACY_ORDER_RE.test(s)) return s.toLowerCase();
  return s;
}

export function classifyOrderIdentifier(value) {
  const n = normalizeOrderIdentifier(value);
  if (!n) return 'empty';
  if (UUID_RE.test(n)) return 'uuid';
  if (PUBLIC_ORDER_RE.test(n)) return 'public';
  if (LEGACY_ORDER_RE.test(n)) return 'legacy';
  return 'unknown';
}

export function sameOrderIdentifier(a, b) {
  const left = normalizeOrderIdentifier(a);
  const right = normalizeOrderIdentifier(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

function readOrderField(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return (
    obj.orderId ||
    obj.order_id ||
    obj.orderNumber ||
    obj.order_number ||
    obj.reference ||
    ''
  );
}

function readTokenField(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return obj.token || obj.confirmationToken || obj.confirmToken || obj.confirmation_token || '';
}

/**
 * Parse a packing-label QR.
 * Returns { token, orderId, kind } where kind is url | json | token | order_id | invalid | empty.
 * Token plaintext is a secret — callers must not write it to production logs.
 */
export function parseDeliveryQrPayload(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { token: '', orderId: '', kind: 'empty' };

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      const token = String(readTokenField(obj) || '').trim();
      const orderId = normalizeOrderIdentifier(readOrderField(obj));
      const known = classifyOrderIdentifier(orderId);
      if (token || (orderId && known !== 'unknown' && known !== 'empty')) {
        return {
          token,
          orderId: known === 'unknown' || known === 'empty' ? '' : orderId,
          kind: 'json',
        };
      }
    } catch (_e) {
      /* fall through */
    }
  }

  if (/^https?:\/\//i.test(text) || /[?&]token=/i.test(text) || /[?&](order|orderId|order_id)=/i.test(text)) {
    try {
      const href = /^https?:\/\//i.test(text)
        ? text
        : `https://mototrack.local/${text.startsWith('?') ? text : `?${text}`}`;
      const url = new URL(href);
      const token = String(url.searchParams.get('token') || '').trim();
      const orderId = normalizeOrderIdentifier(
        url.searchParams.get('orderId') ||
          url.searchParams.get('order_id') ||
          url.searchParams.get('order') ||
          ''
      );
      const known = classifyOrderIdentifier(orderId);
      if (token || (orderId && known !== 'unknown' && known !== 'empty')) {
        return {
          token,
          orderId: known === 'unknown' || known === 'empty' ? '' : orderId,
          kind: 'url',
        };
      }
    } catch (_e) {
      /* fall through */
    }
  }

  if (/^[a-f0-9]{32,128}$/i.test(text)) {
    return { token: text.toLowerCase(), orderId: '', kind: 'token' };
  }

  const kind = classifyOrderIdentifier(text);
  if (kind === 'public' || kind === 'legacy' || kind === 'uuid') {
    return { token: '', orderId: normalizeOrderIdentifier(text), kind: 'order_id' };
  }

  return { token: '', orderId: '', kind: 'invalid' };
}

export default {
  normalizeOrderIdentifier,
  classifyOrderIdentifier,
  sameOrderIdentifier,
  parseDeliveryQrPayload,
};
