// ─── ADMIN SECURITY PIN & SESSION SERVICE (BACKEND-ENFORCED & SESSION-BASED) ───
import { appStorage } from '../system/storageAdapter.js';
import { supabase } from '../../lib/supabase.js';
import { userService } from '../staff/userService.js';
import { hashPassword } from '../../utils/hash.js';
import { APP_CONFIG } from '../../config';
// NOTE: do not import authService at top level — authService imports this module
// (lockSession). Resolve it lazily inside resolveAdminUserId to avoid a require cycle.

const DEFAULT_PIN = APP_CONFIG.admin.defaultPin || '2026';
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours expiration window
const PIN_STATUS_TTL_MS = 30 * 1000; // 30s TTL for remote PIN status fetch

const STORAGE_KEYS = {
  ADMIN_PIN_META_PREFIX: 'mototrack_admin_pin_meta_',
  ADMIN_PIN_PREFIX: 'mototrack_admin_pin_',
  ADMIN_PIN_GLOBAL: 'mototrack_admin_pin_active',
  ADMIN_PIN_UPDATED_AT: 'mototrack_admin_pin_updated_at',
  ADMIN_UNLOCKED_SESSION: 'mototrack_admin_session_unlocked',
  ADMIN_SESSION_TOKEN: 'mototrack_admin_session_token',
};

function readPersistentItem(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const fromLocal = window.localStorage.getItem(key);
      if (fromLocal !== null && fromLocal !== undefined && String(fromLocal).trim() !== '') {
        return String(fromLocal).trim();
      }
    }
  } catch (_e) {}
  try {
    const fromApp = appStorage.getItem(key);
    if (fromApp !== null && fromApp !== undefined && String(fromApp).trim() !== '') {
      return String(fromApp).trim();
    }
  } catch (_e) {}
  return null;
}

function writePersistentItem(key, value) {
  const str = String(value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, str);
    }
  } catch (_e) {}
  try {
    appStorage.setItem(key, str);
  } catch (_e) {}
}

function removePersistentItem(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (_e) {}
  try {
    appStorage.removeItem(key);
  } catch (_e) {}
}

class AdminSecurityService {
  constructor() {
    this._activeSession = null;
    this._cachedMeta = {};
    this._offlinePinHashes = {};
    this._inFlightVerifications = {};
    this._inFlightStatusFetch = {};
    this._statusFetchAt = {};
    this._lastValidatedAt = 0;
    this._scrubLegacyPlaintextPins();
  }

  /**
   * Remove any legacy plaintext PIN keys from localStorage / appStorage
   * and convert them into non-sensitive metadata + hashed offline verifier.
   */
  _scrubLegacyPlaintextPins() {
    try {
      const legacyGlobal = readPersistentItem(STORAGE_KEYS.ADMIN_PIN_GLOBAL);
      const legacyAdmin = readPersistentItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + 'usr-admin-01');
      const legacyPin = legacyGlobal || legacyAdmin;
      if (legacyPin && /^\d{4,6}$/.test(legacyPin)) {
        this._savePinMetaLocally('usr-admin-01', {
          isDefaultPin: legacyPin === DEFAULT_PIN,
          pinLength: legacyPin.length,
          updatedAt: readPersistentItem(STORAGE_KEYS.ADMIN_PIN_UPDATED_AT) || new Date().toISOString(),
        });
        this._offlinePinHashes['usr-admin-01'] = hashPassword(legacyPin, 'usr-admin-01');
      }
      removePersistentItem(STORAGE_KEYS.ADMIN_PIN_GLOBAL);
      removePersistentItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + 'usr-admin-01');
    } catch (_e) {}
  }

  /**
   * Helper to resolve the active Admin User ID
   */
  resolveAdminUserId(passedUser = null) {
    if (passedUser?.user_id) return String(passedUser.user_id).trim();
    if (passedUser?.id) return String(passedUser.id).trim();

    try {
      // Lazy require breaks authService ↔ adminSecurityService cycle
      const { authService } = require('./authService.js');
      const activeUser = authService?.getCurrentUser?.();
      if (activeUser?.user_id) return String(activeUser.user_id).trim();
      if (activeUser?.id) return String(activeUser.id).trim();
    } catch (_e) {}

    return 'usr-admin-01';
  }

  /**
   * Persist only non-sensitive PIN metadata (isDefaultPin, pinLength, updatedAt)
   * and an in-memory salted SHA-256 hash for offline fallback. Never store plaintext PINs.
   */
  _savePinMetaLocally(userId, { isDefaultPin, pinLength, updatedAt } = {}, rawPinForOfflineHash = null) {
    const resolvedId = userId || 'usr-admin-01';
    const meta = {
      isDefaultPin: Boolean(isDefaultPin),
      pinLength: Number(pinLength) >= 4 && Number(pinLength) <= 6 ? Number(pinLength) : 4,
      defaultPin: DEFAULT_PIN,
      updatedAt: updatedAt || new Date().toISOString(),
    };

    this._cachedMeta[resolvedId] = meta;
    writePersistentItem(STORAGE_KEYS.ADMIN_PIN_META_PREFIX + resolvedId, JSON.stringify(meta));
    writePersistentItem(STORAGE_KEYS.ADMIN_PIN_UPDATED_AT, meta.updatedAt);

    // Ensure no legacy plaintext PIN remains in storage
    removePersistentItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + resolvedId);
    removePersistentItem(STORAGE_KEYS.ADMIN_PIN_GLOBAL);

    if (rawPinForOfflineHash && /^\d{4,6}$/.test(String(rawPinForOfflineHash).trim())) {
      const clean = String(rawPinForOfflineHash).trim();
      this._offlinePinHashes[resolvedId] = hashPassword(clean, resolvedId);
    }
  }

  _readStoredMeta(userId) {
    const resolvedId = userId || 'usr-admin-01';
    if (this._cachedMeta[resolvedId]) {
      return this._cachedMeta[resolvedId];
    }

    const raw =
      readPersistentItem(STORAGE_KEYS.ADMIN_PIN_META_PREFIX + resolvedId) ||
      readPersistentItem(STORAGE_KEYS.ADMIN_PIN_META_PREFIX + 'usr-admin-01');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const meta = {
            isDefaultPin: Boolean(parsed.isDefaultPin),
            pinLength: Number(parsed.pinLength) >= 4 && Number(parsed.pinLength) <= 6 ? Number(parsed.pinLength) : 4,
            defaultPin: DEFAULT_PIN,
            updatedAt: parsed.updatedAt || null,
          };
          this._cachedMeta[resolvedId] = meta;
          return meta;
        }
      } catch (_e) {}
    }

    return null;
  }

  /**
   * Return the active admin session token if the session is currently unlocked and unexpired
   */
  getSessionToken(user = null) {
    if (!this.isSessionUnlocked(user)) return null;
    return this._activeSession?.sessionToken || null;
  }

  /**
   * Check if the current session is verified and not expired.
   * Enforces strict session token & 2-hour expiration policy (no legacy boolean flag bypass).
   */
  isSessionUnlocked(user = null) {
    const userId = this.resolveAdminUserId(user);
    const now = Date.now();

    // 1. Check in-memory session first
    if (this._activeSession && this._activeSession.userId === userId) {
      if (
        this._activeSession.sessionToken &&
        this._activeSession.expiresAt &&
        now < this._activeSession.expiresAt
      ) {
        return true;
      }
      // Session expired in memory
      this.lockSession(user);
      return false;
    }

    // 2. Check persistent session token in storage
    try {
      const storedJson =
        appStorage.getItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN + '_' + userId) ||
        appStorage.getItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN);

      if (storedJson) {
        const session = JSON.parse(storedJson);
        if (
          session &&
          session.sessionToken &&
          session.expiresAt &&
          now < Number(session.expiresAt) &&
          (!session.userId || session.userId === userId)
        ) {
          this._activeSession = {
            ...session,
            userId,
          };
          return true;
        }
        this.lockSession(user);
        return false;
      }
    } catch (_e) {}

    return false;
  }

  /**
   * Mark session as unlocked with a clear expiration policy and token
   */
  unlockSession(user = null, backendData = null) {
    const userId = this.resolveAdminUserId(user);
    const now = Date.now();
    const expiresAt = backendData?.expires_at
      ? Number(backendData.expires_at)
      : now + SESSION_DURATION_MS;

    const sessionToken =
      backendData?.session_token ||
      `sec_adm_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

    this._activeSession = {
      sessionToken,
      userId,
      unlockedAt: now,
      expiresAt,
    };

    try {
      const serialized = JSON.stringify(this._activeSession);
      appStorage.setItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN + '_' + userId, serialized);
      appStorage.setItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN, serialized);
      appStorage.removeItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION);
      if (userId) {
        appStorage.removeItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION + '_' + userId);
      }
    } catch (_e) {}
  }

  /**
   * Lock the admin session (requires re-entering PIN)
   */
  lockSession(user = null) {
    const userId = this.resolveAdminUserId(user);
    const prevToken = this._activeSession?.sessionToken;
    this._activeSession = null;

    try {
      appStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN);
      appStorage.removeItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION);
      if (userId) {
        appStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN + '_' + userId);
        appStorage.removeItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION + '_' + userId);
      }
    } catch (_e) {}

    // Invalidate session on Supabase backend asynchronously
    if (supabase && userId) {
      try {
        supabase
          .rpc('lock_admin_session', {
            p_user_id: userId,
            p_session_token: prevToken || null,
          })
          .then(
            () => {},
            () => {}
          );
      } catch (_e) {}
    }
  }

  /**
   * Verify entered PIN against trusted Supabase backend RPC.
   * Strictly enforces server-side 30s lockouts and never bypasses a locked or rejected response.
   */
  async verifyPin(inputPin, user = null) {
    const cleanInput = String(inputPin || '').trim();
    if (!cleanInput) {
      return { success: false, error: 'Please enter your Admin PIN.' };
    }

    const userId = this.resolveAdminUserId(user);
    const inFlightKey = `${userId}_${cleanInput}`;

    if (this._inFlightVerifications[inFlightKey]) {
      return await this._inFlightVerifications[inFlightKey];
    }

    const verificationPromise = (async () => {
      // 1. Authoritative backend verification on Supabase RPC
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('verify_admin_pin', {
            p_user_id: userId,
            p_pin: cleanInput,
          });

          if (!error && data) {
            if (data.success) {
              this.unlockSession(user, data);
              this._savePinMetaLocally(
                userId,
                {
                  isDefaultPin:
                    data.is_default_pin !== undefined
                      ? Boolean(data.is_default_pin)
                      : cleanInput === DEFAULT_PIN,
                  pinLength: data.pin_length || cleanInput.length,
                  updatedAt: new Date().toISOString(),
                },
                cleanInput
              );
              this._statusFetchAt[userId] = Date.now();
              return { success: true, session: this._activeSession };
            }

            // Strictly respect server rejection & 30-second lockout (no client-side bypass)
            return {
              success: false,
              error: data.error || 'Incorrect Security PIN.',
              locked: Boolean(data.locked),
              lockoutSeconds: data.lockout_seconds || 0,
              attemptsLeft: data.attempts_left !== undefined ? data.attempts_left : null,
            };
          }
        } catch (err) {
          console.warn('Supabase verify_admin_pin RPC network error, using offline verifier:', err);
        }
      }

      // 2. Offline-only fallback (when Supabase is unreachable)
      const expectedHash =
        this._offlinePinHashes[userId] ||
        this._offlinePinHashes['usr-admin-01'] ||
        hashPassword(DEFAULT_PIN, userId);
      const inputHash = hashPassword(cleanInput, userId);
      const fallbackHash = hashPassword(cleanInput, 'usr-admin-01');

      if (inputHash === expectedHash || fallbackHash === expectedHash) {
        this.unlockSession(user);
        this._savePinMetaLocally(
          userId,
          {
            isDefaultPin: cleanInput === DEFAULT_PIN,
            pinLength: cleanInput.length,
            updatedAt: new Date().toISOString(),
          },
          cleanInput
        );
        return { success: true, session: this._activeSession };
      }

      return {
        success: false,
        error: 'Incorrect Security PIN. Authorized Admin Access Only.',
      };
    })();

    this._inFlightVerifications[inFlightKey] = verificationPromise;
    try {
      return await verificationPromise;
    } finally {
      delete this._inFlightVerifications[inFlightKey];
    }
  }

  /**
   * Synchronous quick check against in-memory hashed PIN verifier (never exposes plaintext).
   */
  verifyPinSync(inputPin, user = null) {
    const cleanInput = String(inputPin || '').trim();
    if (!cleanInput) return false;
    const userId = this.resolveAdminUserId(user);
    const expectedHash =
      this._offlinePinHashes[userId] ||
      this._offlinePinHashes['usr-admin-01'] ||
      (this.getPinMetadata(user).isDefaultPin ? hashPassword(DEFAULT_PIN, userId) : null);
    if (!expectedHash) return false;
    const isMatch =
      hashPassword(cleanInput, userId) === expectedHash ||
      hashPassword(cleanInput, 'usr-admin-01') === expectedHash;
    if (isMatch) {
      this.unlockSession(user);
    }
    return isMatch;
  }

  /**
   * Fetch non-sensitive PIN status metadata (`is_default`, `pin_length`, `updated_at`)
   * from `get_admin_pin_status` RPC with 30s TTL & in-flight deduplication.
   */
  async fetchPinStatusFromSupabase(user = null, { force = false } = {}) {
    const userId = this.resolveAdminUserId(user);
    const existingMeta = this._readStoredMeta(userId);

    if (!supabase) {
      return (
        existingMeta || {
          isDefaultPin: true,
          pinLength: DEFAULT_PIN.length,
          defaultPin: DEFAULT_PIN,
          updatedAt: null,
        }
      );
    }

    const now = Date.now();
    if (
      !force &&
      this._statusFetchAt[userId] &&
      now - this._statusFetchAt[userId] < PIN_STATUS_TTL_MS &&
      existingMeta
    ) {
      return existingMeta;
    }

    if (!force && this._inFlightStatusFetch[userId]) {
      return await this._inFlightStatusFetch[userId];
    }

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_admin_pin_status', {
          p_user_id: userId,
        });

        if (!error && data && data.success) {
          const syncedMeta = {
            isDefaultPin: Boolean(data.is_default),
            pinLength: Number(data.pin_length) || 4,
            defaultPin: DEFAULT_PIN,
            updatedAt: data.updated_at || existingMeta?.updatedAt || null,
          };
          this._savePinMetaLocally(userId, syncedMeta);
          this._statusFetchAt[userId] = Date.now();
          return syncedMeta;
        }
      } catch (e) {
        console.warn('Supabase get_admin_pin_status RPC note:', e);
      }

      this._statusFetchAt[userId] = Date.now();
      return (
        existingMeta || {
          isDefaultPin: true,
          pinLength: DEFAULT_PIN.length,
          defaultPin: DEFAULT_PIN,
          updatedAt: null,
        }
      );
    })();

    this._inFlightStatusFetch[userId] = fetchPromise;
    try {
      return await fetchPromise;
    } finally {
      delete this._inFlightStatusFetch[userId];
    }
  }

  /**
   * Synchronous metadata about the current Admin Security PIN (for UI indicators & slot count)
   */
  getPinMetadata(user = null) {
    const userId = this.resolveAdminUserId(user);
    const stored = this._readStoredMeta(userId);
    if (stored) return stored;
    const updatedAt = readPersistentItem(STORAGE_KEYS.ADMIN_PIN_UPDATED_AT);
    return {
      isDefaultPin: true,
      pinLength: DEFAULT_PIN.length || 4,
      defaultPin: DEFAULT_PIN,
      updatedAt: updatedAt || null,
    };
  }

  /**
   * Async status check that syncs with Supabase first, then returns PIN metadata
   */
  async getPinStatus(user = null, { force = false } = {}) {
    return await this.fetchPinStatusFromSupabase(user, { force });
  }

  /**
   * Update the Admin PIN via the `set_admin_pin` RPC.
   * Strictly requires the current active PIN and never falls back to `reset_admin_pin`.
   */
  async setAdminPin(currentPin, newPin, user = null) {
    const cleanCurrent = String(currentPin || '').trim();
    const cleanNew = String(newPin || '').trim();
    const userId = this.resolveAdminUserId(user);

    if (!cleanCurrent) {
      return { success: false, error: 'Please enter your current Admin PIN.' };
    }

    if (!cleanNew || cleanNew.length < 4 || cleanNew.length > 6 || !/^\d+$/.test(cleanNew)) {
      return { success: false, error: 'New PIN must be 4 to 6 numeric digits (0-9).' };
    }

    if (cleanNew === cleanCurrent) {
      return { success: false, error: 'New PIN cannot be the same as your current PIN.' };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('set_admin_pin', {
          p_user_id: userId,
          p_current_pin: cleanCurrent,
          p_new_pin: cleanNew,
        });

        if (error) {
          return {
            success: false,
            error: error.message || 'Could not update Admin Security PIN.',
          };
        }

        if (!data?.success) {
          return {
            success: false,
            error: data?.error || 'Current Admin PIN is incorrect. Authorization denied.',
          };
        }

        this._savePinMetaLocally(
          userId,
          {
            isDefaultPin: cleanNew === DEFAULT_PIN,
            pinLength: cleanNew.length,
            updatedAt: data.updated_at || new Date().toISOString(),
          },
          cleanNew
        );
        this._statusFetchAt[userId] = Date.now();

        return {
          success: true,
          isDefaultPin: cleanNew === DEFAULT_PIN,
          pinLength: cleanNew.length,
          message: data.message || 'Admin Security PIN updated successfully.',
        };
      } catch (e) {
        console.warn('Supabase set_admin_pin error:', e);
        return {
          success: false,
          error: e?.message || 'Network error while updating Admin Security PIN.',
        };
      }
    }

    // Offline-only verification & update
    if (!this.verifyPinSync(cleanCurrent, user)) {
      return {
        success: false,
        error: 'Current Admin PIN is incorrect. Authorization denied.',
      };
    }

    this._savePinMetaLocally(
      userId,
      {
        isDefaultPin: cleanNew === DEFAULT_PIN,
        pinLength: cleanNew.length,
        updatedAt: new Date().toISOString(),
      },
      cleanNew
    );

    return {
      success: true,
      isDefaultPin: cleanNew === DEFAULT_PIN,
      pinLength: cleanNew.length,
      message: 'Admin Security PIN updated successfully.',
    };
  }

  /**
   * Reset Admin PIN using account password verification (Forgot PIN flow).
   * Passes the verified password hash to `reset_admin_pin` RPC and enforces lockout limits.
   */
  async resetPinWithPassword({ email, password, newPin, user = null }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanNewPin = String(newPin || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Please enter your admin account email and password.' };
    }

    if (!cleanNewPin || cleanNewPin.length < 4 || cleanNewPin.length > 6 || !/^\d+$/.test(cleanNewPin)) {
      return { success: false, error: 'New PIN must be 4 to 6 numeric digits (0-9).' };
    }

    // 1. Authenticate admin user credentials with Supabase / userService
    const authRes = await userService.authenticate(cleanEmail, cleanPassword, 'admin');
    if (!authRes.success) {
      return {
        success: false,
        error: authRes.error || 'Incorrect admin password. Identity verification failed.',
      };
    }

    const userId = authRes.user?.user_id || authRes.user?.id || this.resolveAdminUserId(user);
    const verifiedEmail = String(authRes.user?.email || cleanEmail).trim().toLowerCase();
    const passwordHash = hashPassword(cleanPassword, verifiedEmail);

    // 2. Update PIN via Supabase RPC with server-side password hash check
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('reset_admin_pin', {
          p_user_id: userId,
          p_new_pin: cleanNewPin,
          p_password_hash: passwordHash,
        });

        if (error) {
          return {
            success: false,
            error: error.message || 'Could not reset Admin PIN on the server.',
          };
        }

        if (!data?.success) {
          return {
            success: false,
            locked: Boolean(data?.locked),
            lockoutSeconds: data?.lockout_seconds || 0,
            error: data?.error || 'Password verification failed. Cannot reset Security PIN.',
          };
        }

        this._savePinMetaLocally(
          userId,
          {
            isDefaultPin: cleanNewPin === DEFAULT_PIN,
            pinLength: cleanNewPin.length,
            updatedAt: data.updated_at || new Date().toISOString(),
          },
          cleanNewPin
        );
        this._statusFetchAt[userId] = Date.now();
        this.unlockSession(user);

        return {
          success: true,
          isDefaultPin: cleanNewPin === DEFAULT_PIN,
          pinLength: cleanNewPin.length,
          message: data.message || 'Admin Security PIN has been reset successfully in Supabase!',
        };
      } catch (e) {
        console.warn('Supabase reset_admin_pin RPC error:', e);
        return {
          success: false,
          error: e?.message || 'Network error while resetting Admin Security PIN.',
        };
      }
    }

    this._savePinMetaLocally(
      userId,
      {
        isDefaultPin: cleanNewPin === DEFAULT_PIN,
        pinLength: cleanNewPin.length,
        updatedAt: new Date().toISOString(),
      },
      cleanNewPin
    );
    this.unlockSession(user);

    return {
      success: true,
      isDefaultPin: cleanNewPin === DEFAULT_PIN,
      pinLength: cleanNewPin.length,
      message: 'Admin Security PIN has been reset and synchronized!',
    };
  }
}

export const adminSecurityService = new AdminSecurityService();
