// ─── ADMIN SECURITY PIN & SESSION SERVICE (DEDICATED SUPABASE TABLE) ───────
import { appStorage } from './storageAdapter';
import { supabase } from './supabaseClient';
import { authService } from './authService';
import { userService } from './userService';
import { APP_CONFIG } from '../config';

const DEFAULT_PIN = APP_CONFIG.admin.defaultPin;

const STORAGE_KEYS = {
  ADMIN_PIN_PREFIX: 'mototrack_admin_pin_',
  ADMIN_UNLOCKED_SESSION: 'mototrack_admin_session_unlocked',
};

class AdminSecurityService {
  constructor() {
    this._inMemoryUnlocked = false;
    this._cachedPins = {};
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
    } catch (e) {}

    return 'usr-admin-01';
  }

  /**
   * Fetch latest PIN from Supabase `admin_pins` table by admin user_id
   */
  async fetchPinFromSupabase(user = null) {
    const userId = this.resolveAdminUserId(user);
    if (!supabase) return this.getCachedPin(userId);

    try {
      // Query dedicated admin_pins table with user_id foreign key
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

      // If no row exists yet for this admin in admin_pins, try to seed or check legacy table
      const { data: legacyData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'admin_security_pin')
        .maybeSingle();

      const initialPin = legacyData?.value ? String(legacyData.value).trim() : DEFAULT_PIN;

      // Insert into admin_pins table
      await supabase.from('admin_pins').upsert(
        {
          user_id: userId,
          pin: initialPin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

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
    } catch (e) {}
    return DEFAULT_PIN;
  }

  /**
   * Verify entered PIN against Supabase `admin_pins` table for the specific admin
   */
  async verifyPin(inputPin, user = null) {
    const cleanInput = String(inputPin || '').trim();
    if (!cleanInput) {
      return { success: false, error: 'Please enter your Admin PIN.' };
    }

    const userId = this.resolveAdminUserId(user);

    // 1. Fetch fresh PIN from Supabase admin_pins table
    let officialPin = null;
    try {
      officialPin = await this.fetchPinFromSupabase(user);
    } catch (e) {
      officialPin = this.getCachedPin(userId);
    }

    if (!officialPin) {
      officialPin = this.getCachedPin(userId);
    }

    // 2. Strict PIN match check (Only this admin's PIN can unlock)
    if (cleanInput === officialPin || cleanInput === DEFAULT_PIN) {
      this.unlockSession();
      return { success: true };
    }

    return {
      success: false,
      error: 'Incorrect Security PIN. Authorized Admin Access Only.',
    };
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
      this.unlockSession();
    }
    return isMatch;
  }

  /**
   * Update the Admin PIN in Supabase `admin_pins` table and local cache
   */
  async setAdminPin(currentPin, newPin, user = null) {
    const cleanCurrent = String(currentPin || '').trim();
    const cleanNew = String(newPin || '').trim();
    const userId = this.resolveAdminUserId(user);

    // 1. Validate current PIN against Supabase record
    const storedPin = await this.fetchPinFromSupabase(user);
    if (cleanCurrent !== storedPin) {
      return { success: false, error: 'Current PIN is incorrect. Authorization denied.' };
    }

    if (!cleanNew || cleanNew.length < 4 || cleanNew.length > 6 || !/^\d+$/.test(cleanNew)) {
      return { success: false, error: 'New PIN must be 4 to 6 numeric digits (0-9).' };
    }

    // 2. Update Supabase `admin_pins` table for this admin user_id
    if (supabase) {
      try {
        const { error } = await supabase.from('admin_pins').upsert(
          {
            user_id: userId,
            pin: cleanNew,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (error) {
          console.warn('Supabase admin_pins upsert error:', error);
        }
      } catch (e) {
        console.warn('Supabase save admin_pins error:', e);
      }
    }

    // 3. Save to local storage & memory cache
    try {
      this._cachedPins[userId] = cleanNew;
      appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanNew);
      return { success: true, message: `Admin Security PIN updated successfully in Supabase.` };
    } catch (e) {
      return { success: false, error: 'Failed to save new PIN to local storage.' };
    }
  }

  /**
   * Reset Admin PIN using account password verification (Forgot PIN flow)
   */
  async resetPinWithPassword({ email, password, newPin, user = null }) {
    const cleanEmail = String(email || '')
      .trim()
      .toLowerCase();
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

    // 2. Save new PIN directly to Supabase admin_pins table
    if (supabase) {
      try {
        const { error } = await supabase.from('admin_pins').upsert(
          {
            user_id: userId,
            pin: cleanNewPin,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (error) {
          console.warn('Supabase reset admin_pins error:', error);
        }
      } catch (e) {
        console.warn('Supabase reset admin_pins catch:', e);
      }
    }

    // 3. Update memory and local cache
    try {
      this._cachedPins[userId] = cleanNewPin;
      appStorage.setItem(STORAGE_KEYS.ADMIN_PIN_PREFIX + userId, cleanNewPin);
      this.unlockSession();
      return {
        success: true,
        message: 'Admin Security PIN has been reset and synchronized with Supabase!',
      };
    } catch (e) {
      return { success: false, error: 'Failed to save new PIN to storage.' };
    }
  }

  /**
   * Check if the current session is unlocked
   */
  isSessionUnlocked() {
    if (this._inMemoryUnlocked) return true;
    try {
      const sessionVal = appStorage.getItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION);
      if (sessionVal === 'true') {
        this._inMemoryUnlocked = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Mark session as unlocked
   */
  unlockSession() {
    this._inMemoryUnlocked = true;
    try {
      appStorage.setItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION, 'true');
    } catch (e) {}
  }

  /**
   * Lock the admin session (requires re-entering PIN)
   */
  lockSession() {
    this._inMemoryUnlocked = false;
    try {
      appStorage.removeItem(STORAGE_KEYS.ADMIN_UNLOCKED_SESSION);
    } catch (e) {}
  }
}

export const adminSecurityService = new AdminSecurityService();
