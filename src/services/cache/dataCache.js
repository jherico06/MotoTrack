/**
 * MotoTrack centralized in-memory cache layer.
 * UI → Data Service → Cache → Supabase
 *
 * Does NOT cache: passwords, auth tokens, payment secrets, private credentials.
 * Payment confirmation / pickup authorization must re-verify authoritative state.
 */

import { CACHE_TTL } from './cacheKeys.js';

const isDev =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

const store = new Map();
const pending = new Map();

function log(tag, key, extra = '') {
  if (!isDev) return;
  // Never log secrets — keys only
  const safeKey = String(key || '').replace(/(token|secret|password|credential)=[^&\s]+/gi, '$1=[redacted]');
  console.log(`[${tag}] ${safeKey}${extra ? ` ${extra}` : ''}`);
}

function now() {
  return Date.now();
}

/**
 * @param {string} key
 * @returns {{ value: any, expiresAt: number, staleAt?: number } | null}
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) {
    log('CACHE MISS', key);
    return null;
  }
  if (entry.expiresAt && entry.expiresAt < now()) {
    store.delete(key);
    log('CACHE MISS', key, '(expired)');
    return null;
  }
  log('CACHE HIT', key);
  return entry;
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlMs]
 */
export function cacheSet(key, value, ttlMs = CACHE_TTL.BOOKING_DETAIL_MS) {
  const expiresAt = ttlMs > 0 ? now() + ttlMs : 0;
  store.set(key, { value, expiresAt, setAt: now() });
  log('CACHE SET', key, `ttl=${ttlMs}`);
  return value;
}

/**
 * Soft-stale get: returns value even if past TTL when within stale window (SWR).
 * Caller should trigger background refresh when `isStale`.
 */
export function cacheGetStale(key, { staleWindowMs = 5 * 60 * 1000 } = {}) {
  const entry = store.get(key);
  if (!entry) {
    log('CACHE MISS', key);
    return { hit: false, value: null, isStale: false };
  }
  const expired = entry.expiresAt && entry.expiresAt < now();
  if (expired && entry.expiresAt + staleWindowMs < now()) {
    store.delete(key);
    log('CACHE MISS', key, '(stale-expired)');
    return { hit: false, value: null, isStale: false };
  }
  log('CACHE HIT', key, expired ? '(stale)' : '');
  return { hit: true, value: entry.value, isStale: !!expired };
}

export function cacheInvalidate(key) {
  if (store.has(key)) {
    store.delete(key);
    log('CACHE INVALIDATE', key);
  }
  pending.delete(key);
}

/** Invalidate exact keys and/or prefix matches */
export function cacheInvalidateMany(keysOrPrefixes = []) {
  const list = Array.isArray(keysOrPrefixes) ? keysOrPrefixes : [keysOrPrefixes];
  for (const key of list) {
    if (!key) continue;
    if (key.endsWith('*')) {
      const prefix = key.slice(0, -1);
      for (const k of [...store.keys()]) {
        if (k.startsWith(prefix)) cacheInvalidate(k);
      }
    } else {
      cacheInvalidate(key);
    }
  }
}

export function cacheClear() {
  store.clear();
  pending.clear();
  if (isDev) console.log('[CACHE CLEAR]');
}

/**
 * Request deduplication: concurrent callers share one in-flight promise.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {{ ttlMs?: number, force?: boolean, swr?: boolean, onUpdate?: (v:T)=>void }} [opts]
 * @returns {Promise<T>}
 */
export async function cacheFetch(key, fetcher, opts = {}) {
  const { ttlMs = CACHE_TTL.BOOKING_DETAIL_MS, force = false, swr = false, onUpdate } = opts;

  if (!force) {
    if (swr) {
      const soft = cacheGetStale(key);
      if (soft.hit) {
        if (soft.isStale) {
          // background refresh
          void (async () => {
            try {
              if (pending.has(key)) return;
              const p = fetcher();
              pending.set(key, p);
              const fresh = await p;
              pending.delete(key);
              cacheSet(key, fresh, ttlMs);
              onUpdate?.(fresh);
              log('SUPABASE FETCH', key, '(swr refresh)');
            } catch (_e) {
              pending.delete(key);
            }
          })();
        }
        return soft.value;
      }
    } else {
      const hit = cacheGet(key);
      if (hit) return hit.value;
    }
  }

  if (pending.has(key)) {
    log('REQUEST DEDUPED', key);
    return pending.get(key);
  }

  log('SUPABASE FETCH', key);
  const promise = (async () => {
    try {
      const data = await fetcher();
      cacheSet(key, data, ttlMs);
      return data;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, promise);
  return promise;
}

/**
 * After mutation: write returned record into cache and invalidate related keys.
 */
export function cacheAfterMutation({ setEntries = [], invalidate = [] } = {}) {
  for (const { key, value, ttlMs } of setEntries) {
    if (key) cacheSet(key, value, ttlMs);
  }
  cacheInvalidateMany(invalidate);
}

export function cacheStats() {
  return { size: store.size, pending: pending.size };
}

export const dataCache = {
  get: cacheGet,
  set: cacheSet,
  getStale: cacheGetStale,
  invalidate: cacheInvalidate,
  invalidateMany: cacheInvalidateMany,
  clear: cacheClear,
  fetch: cacheFetch,
  afterMutation: cacheAfterMutation,
  stats: cacheStats,
};

export default dataCache;
