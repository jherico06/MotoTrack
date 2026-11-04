/**
 * Canonical order identifiers for delivery QR validation.
 * Comparisons are exact after normalization — never an accidental substring match.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ORDER_RE = /^ORD-(ON|POS|TEL)-\d{4}-\d+$/i;
const GENERAL_ORDER_RE = /^ORD-[A-Za-z0-9_-]+$/i;
const LEGACY_ORDER_RE = /^ord-\d{6,}-\d+/i;
const TRACKING_RE = /^(MOTO-TRK-[A-Za-z0-9]+|MT[A-Za-z0-9]+(PH)?)$/i;
const NUMERIC_ORDER_RE = /^\d{4,}$/;

export function normalizeOrderIdentifier(value) {
  let s = String(value ?? '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '');
  if (!s) return '';
  if (UUID_RE.test(s)) return s.toLowerCase();
  if (/^ord-/i.test(s)) {
    return s.toUpperCase();
  }
  return s;
}

export function classifyOrderIdentifier(value) {
  const n = normalizeOrderIdentifier(value);
  if (!n) return 'empty';
  if (UUID_RE.test(n)) return 'uuid';
  if (PUBLIC_ORDER_RE.test(n)) return 'public';
  if (GENERAL_ORDER_RE.test(n) || LEGACY_ORDER_RE.test(n)) return 'order_id';
  if (TRACKING_RE.test(n)) return 'tracking';
  if (NUMERIC_ORDER_RE.test(n)) return 'numeric';
  if (n.length >= 3 && /^[A-Za-z0-9_-]+$/.test(n)) return 'order_id';
  return 'unknown';
}

export function sameOrderIdentifier(a, b) {
  const left = normalizeOrderIdentifier(a);
  const right = normalizeOrderIdentifier(b);
  if (!left || !right) return false;
  if (left.toLowerCase() === right.toLowerCase()) return true;
  // If numeric or clean digits match
  const leftDigits = left.replace(/\D/g, '');
  const rightDigits = right.replace(/\D/g, '');
  if (leftDigits && rightDigits) {
    if (leftDigits === rightDigits) return true;
    if (leftDigits.length >= 4 && rightDigits.length >= 4) {
      if (leftDigits.endsWith(rightDigits) || rightDigits.endsWith(leftDigits)) {
        return true;
      }
    }
  }
  return false;
}

function readOrderField(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return (
    obj.orderId ||
    obj.order_id ||
    obj.orderNumber ||
    obj.order_number ||
    obj.order ||
    obj.trackingNumber ||
    obj.tracking_number ||
    obj.reference ||
    obj.id ||
    ''
  );
}

function readTokenField(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return obj.token || obj.confirmationToken || obj.confirmToken || obj.confirmation_token || '';
}

/**
 * Parse a packing-label QR, order barcode, order ID, or deep link.
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
      if (token || (orderId && known !== 'empty')) {
        return {
          token,
          orderId: known === 'empty' ? '' : orderId,
          kind: 'json',
        };
      }
    } catch (_e) {
      /* fall through */
    }
  }

  if (/^(https?:\/\/|exp:\/\/|mototrack:\/\/)/i.test(text) || /[?&]token=/i.test(text) || /[?&](order|orderId|order_id)=/i.test(text)) {
    try {
      const href = /^(https?:\/\/|exp:\/\/|mototrack:\/\/)/i.test(text)
        ? text
        : `https://mototrack.local/${text.startsWith('?') ? text : `?${text}`}`;
      // Convert exp:// to http:// so standard URL parser succeeds
      const parseableHref = href.replace(/^exp:\/\//i, 'http://').replace(/^mototrack:\/\//i, 'http://');
      const url = new URL(parseableHref);
      const token = String(url.searchParams.get('token') || '').trim();
      let orderId = normalizeOrderIdentifier(
        url.searchParams.get('orderId') ||
        url.searchParams.get('order_id') ||
        url.searchParams.get('order') ||
        url.searchParams.get('id') ||
        ''
      );
      if (!orderId && url.pathname) {
        const match = url.pathname.match(/(ORD-[A-Za-z0-9_-]+|MOTO-TRK-[A-Za-z0-9]+|MT[A-Za-z0-9]+(PH)?)/i);
        if (match) {
          orderId = normalizeOrderIdentifier(match[1]);
        }
      }
      const known = classifyOrderIdentifier(orderId);
      if (token || (orderId && known !== 'empty')) {
        return {
          token,
          orderId: known === 'empty' ? '' : orderId,
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
  if (kind !== 'empty' && kind !== 'unknown') {
    return { token: '', orderId: normalizeOrderIdentifier(text), kind: 'order_id' };
  }

  const clean = normalizeOrderIdentifier(text);
  if (clean && clean.length >= 3 && /^[A-Za-z0-9_-]+$/.test(clean)) {
    return { token: '', orderId: clean, kind: 'order_id' };
  }

  return { token: '', orderId: '', kind: 'invalid' };
}

export default {
  normalizeOrderIdentifier,
  classifyOrderIdentifier,
  sameOrderIdentifier,
  parseDeliveryQrPayload,
};
