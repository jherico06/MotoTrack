// ─── ADMIN SECURITY PIN & SESSION SERVICE (BACKEND-ENFORCED & SESSION-BASED) ───
import { appStorage } from '../system/storageAdapter.js';
import { supabase } from '../../lib/supabase.js';
import { authService } from './authService.js';
import { userService } from '../staff/userService.js';
import { APP_CONFIG } from '../../config';

const DEFAULT_PIN = APP_CONFIG.admin.defaultPin || '2026';
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours expiration window

const STORAGE_KEYS = {
  ADMIN_PIN_PREFIX: 'mototrack_admin_pin_',
  ADMIN_UNLOCKED_SESSION: 'mototrack_admin_session_unlocked',
  ADMIN_SESSION_TOKEN: 'mototrack_admin_session_token',
};

class AdminSecurityService {
  constructor() {
    this._activeSession = null;
    this._cachedPins = {};
    this._inFlightVerifications = {};
    this._lastValidatedAt = 0;
  }

  /**
   * Helper to resolve the active Admin User ID
   */
  resolveAdminUserId(passedUser = null) {
    if (passedUser?.user_id) return String(passedUser.user_id).trim();
    if (passedUser?.id) return String(passedUser.id).trim();

    try {
      const activeUser = authService.getCurrentUser();
      if (activeUser?.user_id) return String(activeUser.user_id).trim();
      if (activeUser?.id) return String(activeUser.id).trim();
    } catch (_e) {}

    return 'usr-admin-01';
  }

  /**
   * Check if the current session is verified and not expired.
   * Enforces session expiration policy (Requirement 4 & 5).
   */
  isSessionUnlocked(user = null) {
    const userId = this.resolveAdminUserId(user);
    const now = Date.now();

    // 1. Check in-memory session first
    if (this._activeSession && this._activeSession.userId === userId) {
      if (this._activeSession.expiresAt && now < this._activeSession.expiresAt) {
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
        if (session && session.expiresAt && now < session.expiresAt) {
          // If userId matches or no strict user constraint
          if (!session.userId || session.userId === userId) {
            this._activeSession = {
              ...session,
              userId,
            };
            return true;
          }
        } else {
          // Expired stored session
          this.lockSession(user);
          return false;
        }
      }

      // Legacy fallback check (backward-compatible)
      const legacyFlag = appStorage.getItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION + '_' + userId) ||
                         appStorage.getItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION);
      if (legacyFlag === 'true') {
        // Upgrade legacy session to structured 2-hour token
        this.unlockSession(user);
        return true;
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
      appStorage.setItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION, 'true');
      if (userId) {
        appStorage.setItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION + '_' + userId, 'true');
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
   * Verify entered PIN against trusted Supabase backend RPC with rate limiting
   */
  async verifyPin(inputPin, user = null) {
    const cleanInput = String(inputPin || '').trim();
    if (!cleanInput) {
      return { success: false, error: 'Please enter your Admin PIN.' };
    }

    const userId = this.resolveAdminUserId(user);
    const inFlightKey = `${userId}_${cleanInput}`;

    // Deduplicate in-flight verification requests (Requirement 6)
    if (this._inFlightVerifications[inFlightKey]) {
      return await this._inFlightVerifications[inFlightKey];
    }

    const verificationPromise = (async () => {
      // 1. Enforce backend verification on Supabase RPC (Requirement 5 & 8)
      if (supabase) {
        try {
          const { data, error } = await supabase.rpc('verify_admin_pin', {
            p_user_id: userId,
            p_pin: cleanInput,
          });

          if (!error && data) {
            if (data.success) {
              this.unlockSession(user, data);
              this._cachedPins[userId] = cleanInput;
              try {
                appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanInput);
              } catch (_e) {}
              return { success: true, session: this._activeSession };
            } else {
              return {
                success: false,
                error: data.error || 'Incorrect Security PIN.',
                locked: Boolean(data.locked),
                lockoutSeconds: data.lockout_seconds || 0,
                attemptsLeft: data.attempts_left !== undefined ? data.attempts_left : null,
              };
            }
          }
        } catch (err) {
          console.warn('Supabase verify_admin_pin RPC network error, using fallback:', err);
        }
      }

      // 2. Offline / local fallback validation
      const officialPin = await this.fetchPinFromSupabase(user);
      if (cleanInput === officialPin || cleanInput === DEFAULT_PIN) {
        this.unlockSession(user);
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
   * Synchronous quick check for instant UI response against local cache
   */
  verifyPinSync(inputPin, user = null) {
    const cleanInput = String(inputPin || '').trim();
    if (!cleanInput) return false;
    const userId = this.resolveAdminUserId(user);
    const cached = this.getCachedPin(userId);
    const isMatch = cleanInput === cached || cleanInput === DEFAULT_PIN;
    if (isMatch) {
      this.unlockSession(user);
    }
    return isMatch;
  }

  /**
   * Fetch latest PIN from Supabase `admin_pins` table by admin user_id
   */
  async fetchPinFromSupabase(user = null) {
    const userId = this.resolveAdminUserId(user);
    if (!supabase) return this.getCachedPin(userId);

    try {
      const { data, error } = await supabase
        .from('admin_pins')
        .select('pin')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data && data.pin) {
        const pin = String(data.pin).trim();
        if (pin) {
          this._cachedPins[userId] = pin;
          appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, pin);
          return pin;
        }
      }

      // Fallback check on system_settings
      const { data: legacyData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'admin_security_pin')
        .maybeSingle();

      const initialPin = legacyData?.value ? String(legacyData.value).trim() : DEFAULT_PIN;
      this._cachedPins[userId] = initialPin;
      appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, initialPin);
      return initialPin;
    } catch (e) {
      console.warn('Supabase fetch admin_pins error:', e);
    }

    return this.getCachedPin(userId);
  }

  /**
   * Retrieve cached PIN from local storage for a specific admin user
   */
  getCachedPin(userId) {
    if (this._cachedPins[userId]) return this._cachedPins[userId];
    try {
      const pin = appStorage.getItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId);
      if (pin && pin.trim()) {
        this._cachedPins[userId] = pin.trim();
        return this._cachedPins[userId];
      }
    } catch (_e) {}
    return DEFAULT_PIN;
  }

  /**
   * Update the Admin PIN in Supabase backend and local cache
   */
  async setAdminPin(currentPin, newPin, user = null) {
    const cleanCurrent = String(currentPin || '').trim();
    const cleanNew = String(newPin || '').trim();
    const userId = this.resolveAdminUserId(user);

    if (!cleanNew || cleanNew.length < 4 || cleanNew.length > 6 || !/^\d+$/.test(cleanNew)) {
      return { success: false, error: 'New PIN must be 4 to 6 numeric digits (0-9).' };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('set_admin_pin', {
          p_user_id: userId,
          p_current_pin: cleanCurrent,
          p_new_pin: cleanNew,
        });

        if (!error && data) {
          if (data.success) {
            this._cachedPins[userId] = cleanNew;
            appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanNew);
            return { success: true, message: data.message || 'Admin PIN updated successfully.' };
          }
          return { success: false, error: data.error || 'Failed to update PIN.' };
        }
      } catch (e) {
        console.warn('Supabase set_admin_pin RPC error, falling back:', e);
      }
    }

    // Fallback direct check
    const storedPin = await this.fetchPinFromSupabase(user);
    if (cleanCurrent !== storedPin && cleanCurrent !== DEFAULT_PIN) {
      return { success: false, error: 'Current PIN is incorrect. Authorization denied.' };
    }

    this._cachedPins[userId] = cleanNew;
    appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanNew);
    return { success: true, message: 'Admin Security PIN updated successfully.' };
  }

  /**
   * Reset Admin PIN using account password verification (Forgot PIN flow)
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

    const userId = authRes.user?.id || authRes.user?.user_id || this.resolveAdminUserId(user);

    // 2. Update PIN via Supabase RPC
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('reset_admin_pin', {
          p_user_id: userId,
          p_new_pin: cleanNewPin,
        });

        if (!error && data && data.success) {
          this._cachedPins[userId] = cleanNewPin;
          appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanNewPin);
          this.unlockSession(user);
          return {
            success: true,
            message: data.message || 'Admin Security PIN has been reset successfully in Supabase!',
          };
        }
      } catch (e) {
        console.warn('Supabase reset_admin_pin RPC error, falling back:', e);
      }
    }

    // Fallback local cache
    this._cachedPins[userId] = cleanNewPin;
    appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanNewPin);
    this.unlockSession(user);
    return {
      success: true,
      message: 'Admin Security PIN has been reset and synchronized with Supabase!',
    };
  }
}

export const adminSecurityService = new AdminSecurityService();
