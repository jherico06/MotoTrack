import { appStorage } from '../services/system/storageAdapter.js';

const MEMORY_SESSION = new Map();
const SESSION_KEY_PREFIX = 'mototrack_ai_studio_session_';

function getStorageKey(userId) {
  const cleanId = String(userId || 'guest').trim();
  return `${SESSION_KEY_PREFIX}${cleanId}`;
}

/**
 * Retrieves the cached install studio session for the given user.
 * Prioritizes in-memory session (fast, unlimited size), then falls back to appStorage.
 */
export function getInstallStudioSession(userId) {
  const key = getStorageKey(userId);

  // 1. In-memory check
  if (MEMORY_SESSION.has(key)) {
    return MEMORY_SESSION.get(key);
  }

  // 2. Persistent storage check
  try {
    const raw = appStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        MEMORY_SESSION.set(key, parsed);
        return parsed;
      }
    }
  } catch (_e) {
    // ignore parse errors
  }

  return null;
}

/**
 * Saves the current install studio session.
 * Stores in memory immediately, and persists to appStorage when possible.
 */
export function saveInstallStudioSession(userId, sessionData) {
  if (!sessionData) return;
  const key = getStorageKey(userId);

  let cleanSelected = undefined;
  if (Array.isArray(sessionData.selectedProducts)) {
    const seen = new Set();
    cleanSelected = [];
    for (const item of sessionData.selectedProducts) {
      if (!item) continue;
      const pid = String(item.product_id ?? item.id ?? '').trim();
      if (pid && seen.has(pid)) continue;
      if (pid) seen.add(pid);
      cleanSelected.push(item);
      if (cleanSelected.length >= 3) break;
    }
  }

  const payload = {
    ...sessionData,
    ...(cleanSelected !== undefined ? { selectedProducts: cleanSelected } : {}),
    updatedAt: Date.now(),
  };

  // Always keep in memory
  MEMORY_SESSION.set(key, payload);

  // Try persisting to storage (gracefully handle quota limits for large base64 strings)
  try {
    const storageCopy = { ...payload };
    // Never write multi-MB data: URIs into web sessionStorage
    if (typeof storageCopy.resultUri === 'string' && storageCopy.resultUri.startsWith('data:')) {
      delete storageCopy.resultUri;
    }
    if (typeof storageCopy.partUri === 'string' && storageCopy.partUri.startsWith('data:') && storageCopy.partUri.length > 250000) {
      delete storageCopy.partUri;
    }
    appStorage.setItem(key, JSON.stringify(storageCopy));
  } catch (_err) {
    // Fallback lightweight snapshot while memory store retains full objects
    try {
      const light = { ...payload };
      delete light.resultUri;
      delete light.partUri;
      delete light.bikeOverrideUri;
      if (Array.isArray(light.selectedProducts)) {
        light.selectedProducts = light.selectedProducts.map(({ raw: _raw, ...rest }) => rest);
      }
      appStorage.setItem(key, JSON.stringify(light));
    } catch (_fallbackErr) {
      // Memory store still has it
    }
  }
}

/**
 * Clears the studio session for a user (e.g. when clicking "Start New Preview").
 */
export function clearInstallStudioSession(userId) {
  const key = getStorageKey(userId);
  MEMORY_SESSION.delete(key);
  try {
    appStorage.removeItem(key);
  } catch (_e) {}
}
