import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { appStorage } from '../services/system/storageAdapter.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/index.js';

// Credentials come ONLY from EXPO_PUBLIC_* env (bundled at build time).
// Admin UI must never display, edit, or persist these values.
export const DEFAULT_SUPABASE_URL = SUPABASE_URL;
export const DEFAULT_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
export const LEGACY_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

const STORAGE_KEYS = {
  SUPABASE_URL: 'mototrack_supabase_url',
  SUPABASE_ANON_KEY: 'mototrack_supabase_anon_key',
};

function clearPersistedCredentials() {
  try {
    appStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
    appStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
  } catch (_e) {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
      window.localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
    }
  } catch (_e) {}
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
      window.sessionStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
    }
  } catch (_e) {}
}

function resolveEnvCredentials() {
  const url = String(DEFAULT_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(DEFAULT_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key || key.startsWith('sb_secret_')) {
    return { url: '', key: '' };
  }
  return { url, key };
}

class SupabaseManager {
  constructor() {
    this.client = null;
    clearPersistedCredentials();
    this.initClient();
  }

  /** Connection status only — never returns URL or anon key to callers. */
  getCredentials() {
    const { url, key } = resolveEnvCredentials();
    return {
      configured: Boolean(url && key),
      url: '',
      key: '',
    };
  }

  /** Disabled — credentials are env-only and must not be set from the UI. */
  saveCredentials() {
    clearPersistedCredentials();
    this.initClient();
    return { success: false, url: '', key: '', error: 'Credential editing is disabled' };
  }

  /** Disabled — no runtime credential restore from UI. */
  resetToDefaults() {
    clearPersistedCredentials();
    this.initClient();
    return { url: '', key: '' };
  }

  initClient() {
    clearPersistedCredentials();
    const { url, key } = resolveEnvCredentials();
    if (!url || !key) {
      this.client = null;
      return;
    }
    try {
      // Web must use localStorage so the PKCE code verifier survives the
      // Google redirect. sessionStorage is lost if the return navigation
      // is treated as a new browsing context.
      let authStorage = AsyncStorage;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        authStorage = window.localStorage;
      }

      this.client = createClient(url, key, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === 'web',
          flowType: 'pkce',
        },
      });
    } catch (e) {
      console.warn('Failed to init Supabase client:', e);
      this.client = null;
    }
  }

  getClient() {
    if (!this.client) {
      this.initClient();
    }
    return this.client;
  }

  async testConnection() {
    try {
      const client = this.getClient();
      if (!client) {
        return {
          connected: false,
          message:
            'Supabase credentials not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the server/build environment.',
        };
      }

      const [prodsRes, usersRes, catsRes] = await Promise.all([
        client.from('products').select('product_id').limit(1),
        client.from('users').select('user_id').limit(1),
        client.from('categories').select('category_id').limit(1),
      ]);

      if (prodsRes.error || usersRes.error || catsRes.error) {
        const err = prodsRes.error || usersRes.error || catsRes.error;
        return { connected: false, message: err.message };
      }

      return {
        connected: true,
        message: 'Successfully connected to Supabase project! All ER tables live and synced.',
      };
    } catch (e) {
      return { connected: false, message: e.message || 'Connection error' };
    }
  }
}

export const supabaseManager = new SupabaseManager();
export const supabase = new Proxy(
  {},
  {
    get(target, prop) {
      const client = supabaseManager.getClient();
      if (!client) return undefined;
      const val = client[prop];
      if (typeof val === 'function') {
        return val.bind(client);
      }
      return val;
    },
  }
);
