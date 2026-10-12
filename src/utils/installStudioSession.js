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

  const payload = {
    ...sessionData,
    updatedAt: Date.now(),
  };

  // Always keep in memory
  MEMORY_SESSION.set(key, payload);

  // Try persisting to storage (gracefully handle quota limits for large base64 strings)
  try {
    appStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    // If base64 image exceeds web sessionStorage quota (typically 5MB),
    // save a lightweight version to storage while memory retains full image.
    try {
      const light = { ...payload };
      if (typeof light.resultUri === 'string' && light.resultUri.length > 500000) {
        delete light.resultUri;
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
