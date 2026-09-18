/**
 * Cryptographically secure delivery confirmation tokens.
 * Plaintext is shown once to the admin (QR/link); only the SHA-256 hash is stored.
 * Tokens do not time-expire — they stay valid until used, delivered, or invalidated.
 */
import { sha256Hex, PASSWORD_HASH_PREFIX } from './hash';
import Constants from 'expo-constants';

/** @deprecated Tokens no longer time-expire; kept for API compatibility. */
export const DELIVERY_TOKEN_TTL_HOURS = null;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export function generateSecureToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashDeliveryToken(plainToken) {
  return sha256Hex(String(plainToken || '').trim().toLowerCase());
}

export function storedTokenHash(plainToken) {
  return `${PASSWORD_HASH_PREFIX}${hashDeliveryToken(plainToken)}`;
}

export function normalizeTokenHash(storedOrHex) {
  const s = String(storedOrHex || '').trim().toLowerCase();
  if (s.startsWith(PASSWORD_HASH_PREFIX)) return s.slice(PASSWORD_HASH_PREFIX.length);
  return s;
}

/** Tokens do not time-expire; always returns null. */
export function tokenExpiresAt() {
  return null;
}

function envPublicAppUrl() {
  try {
    const env = typeof process !== 'undefined' && process.env ? process.env : {};
    return String(env.EXPO_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  } catch (_e) {
    return '';
  }
}

function hostnameOf(value) {
  if (!value) return '';
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).hostname.toLowerCase();
  } catch (_e) {}
  return String(value)
    .replace(/^exp:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .split(':')[0]
    .toLowerCase();
}

export function isPhoneUnreachableHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (LOOPBACK_HOSTS.has(host) || host.endsWith('.localhost')) return true;
  if (host === 'mototrack.app' || host === 'www.mototrack.app') return true;
  return false;
}

export function confirmUrlNeedsPhoneRewrite(url) {
  try {
    return isPhoneUnreachableHost(new URL(String(url || '')).hostname);
  } catch (_e) {
    return true;
  }
}

function pickPrivateIpv4(candidates) {
  const list = (candidates || []).filter(Boolean);
  const isPrivate = (ip) =>
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip) && !ip.startsWith('127.');
  return list.find(isPrivate) || null;
}

function expoLanHostPort() {
  try {
    const raw =
      Constants?.expoConfig?.hostUri ||
      Constants?.expoGoConfig?.debuggerHost ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.linkingUri ||
      '';
    const hostPort = String(raw)
      .replace(/^exp:\/\//i, '')
      .split('/')[0]
      .split('?')[0];
    const host = hostnameOf(hostPort.includes('://') ? hostPort : `http://${hostPort}`);
    if (!host || isPhoneUnreachableHost(host)) return '';
    return hostPort.includes(':') ? hostPort : host;
  } catch (_e) {
    return '';
  }
}

function currentPagePort() {
  if (typeof window === 'undefined' || !window.location) return '8081';
  return window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
}

function originFromHostPort(hostPort) {
  if (!hostPort) return '';
  const protocol =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'https:' : 'http:';
  const normalized = hostPort.includes('://') ? hostPort : `${protocol}//${hostPort}`;
  try {
    const u = new URL(normalized);
    if (!u.port && typeof window !== 'undefined' && window.location?.port) {
      u.port = window.location.port;
    }
    if (isPhoneUnreachableHost(u.hostname)) return '';
    return u.origin;
  } catch (_e) {
    return '';
  }
}

function syncPhoneReachableOrigin(explicitBaseUrl) {
  const fromArg = String(explicitBaseUrl || '').trim().replace(/\/$/, '');
  if (fromArg && !isPhoneUnreachableHost(hostnameOf(fromArg))) return fromArg;

  const fromEnv = envPublicAppUrl();
  if (fromEnv && !isPhoneUnreachableHost(hostnameOf(fromEnv))) return fromEnv;

  if (typeof window !== 'undefined' && window.location?.origin) {
    if (!isPhoneUnreachableHost(window.location.hostname)) {
      const path = window.location.pathname || '/';
      return `${window.location.origin}${path === '/' ? '' : path.replace(/\/$/, '')}`;
    }
  }

  const expoHost = originFromHostPort(expoLanHostPort());
  if (expoHost) return expoHost;

  return '';
}

function discoverLanIpv4() {
  if (typeof RTCPeerConnection === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const found = new Set();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        pc.close();
      } catch (_e) {}
      resolve(pickPrivateIpv4([...found]));
    };

    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch (_e) {
      resolve(null);
      return;
    }

    try {
      pc.createDataChannel('mototrack-lan');
    } catch (_e) {}

    pc.onicecandidate = (event) => {
      if (!event?.candidate) {
        finish();
        return;
      }
      const match = String(event.candidate.candidate || '').match(
        /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/
      );
      if (match?.[1] && !match[1].startsWith('127.') && !match[1].startsWith('169.254.')) {
        found.add(match[1]);
        if (pickPrivateIpv4([...found])) finish();
      }
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish());

    setTimeout(finish, 1600);
  });
}

export async function resolvePhoneReachableOrigin(explicitBaseUrl) {
  const sync = syncPhoneReachableOrigin(explicitBaseUrl);
  if (sync) return sync;

  const lanIp = await discoverLanIpv4();
  if (lanIp) {
    const port = currentPagePort();
    const origin = originFromHostPort(port && port !== '80' ? `${lanIp}:${port}` : lanIp);
    if (origin) return origin;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://mototrack.app';
}

export function tokenFromConfirmUrl(url) {
  try {
    return String(new URL(String(url || '')).searchParams.get('token') || '').trim();
  } catch (_e) {
    const match = String(url || '').match(/[?&]token=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
  }
}

export function buildDeliveryConfirmUrl(plainToken, baseUrl) {
  const token = String(plainToken || '').trim();
  if (!token) return '';
  let origin = syncPhoneReachableOrigin(baseUrl);
  if (!origin) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      origin = window.location.origin;
    } else {
      origin = 'https://mototrack.app';
    }
  }
  const sep = origin.includes('?') ? '&' : '?';
  try {
    if (typeof URL !== 'undefined' && /^https?:\/\//i.test(origin)) {
      const u = new URL(origin.includes('?') ? origin.split('?')[0] : origin);
      u.searchParams.set('screen', 'confirm-delivery');
      u.searchParams.set('token', token);
      return u.toString();
    }
  } catch (_e) {}
  return `${origin}${sep}screen=confirm-delivery&token=${encodeURIComponent(token)}`;
}

export async function makePhoneReachableConfirmBundle(plainToken, existingUrl) {
  const token = String(plainToken || tokenFromConfirmUrl(existingUrl) || '').trim();
  if (!token) {
    return {
      token: '',
      confirmUrl: existingUrl || '',
      qrImageUrl: existingUrl ? qrImageUrlForLink(existingUrl) : '',
      phoneReachable: false,
    };
  }
  const origin = await resolvePhoneReachableOrigin();
  const confirmUrl = buildDeliveryConfirmUrl(token, origin);
  return {
    token,
    confirmUrl,
    qrImageUrl: qrImageUrlForLink(confirmUrl),
    phoneReachable: !confirmUrlNeedsPhoneRewrite(confirmUrl),
  };
}

export function qrImageUrlForLink(link, size = 220) {
  const data = encodeURIComponent(String(link || ''));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}&margin=8`;
}

export default {
  DELIVERY_TOKEN_TTL_HOURS,
  generateSecureToken,
  hashDeliveryToken,
  storedTokenHash,
  normalizeTokenHash,
  tokenExpiresAt,
  buildDeliveryConfirmUrl,
  qrImageUrlForLink,
  confirmUrlNeedsPhoneRewrite,
  makePhoneReachableConfirmBundle,
  resolvePhoneReachableOrigin,
};
