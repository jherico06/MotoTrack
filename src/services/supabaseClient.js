import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { appStorage } from './storageAdapter.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/index.js';

// User's configured Supabase project credentials (JWT Anon Key for PostgREST & Auth)
// Defaults come from the central config (.env EXPO_PUBLIC_*); the Admin Dashboard
// can still override them at runtime via the Supabase Connection Manager.
export const DEFAULT_SUPABASE_URL = SUPABASE_URL;
export const DEFAULT_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
export const LEGACY_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

const STORAGE_KEYS = {
  SUPABASE_URL: 'mototrack_supabase_url',
  SUPABASE_ANON_KEY: 'mototrack_supabase_anon_key',
};

function sanitizeSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_SUPABASE_URL || '';
  let clean = url.trim();
  if (!clean) return '';
  // Auto-correct .supabase.com typos to .supabase.co
  clean = clean.replace(/\.supabase\.com(\/|$)/i, '.supabase.co$1');
  // Remove /rest/v1 or trailing slashes
  clean = clean.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  // If only project ID was entered (e.g. valid slug)
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.includes('.')) {
      clean = 'https://' + clean;
    } else {
      clean = `https://${clean}.supabase.co`;
    }
  }
  return clean;
}

function sanitizeAnonKey(key) {
  if (!key || typeof key !== 'string') return DEFAULT_SUPABASE_ANON_KEY || '';
  const clean = key.trim();
  if (!clean || clean.startsWith('sb_secret_') || clean.startsWith('sb_publishable_') || clean.length < 20) {
    return DEFAULT_SUPABASE_ANON_KEY || '';
  }
  return clean;
}

class SupabaseManager {
  constructor() {
    this.client = null;
    this.initClient();
  }

  getCredentials() {
    try {
      const rawUrl = appStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
      const url = sanitizeSupabaseUrl(rawUrl);
      const rawKey = appStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;
      const key = sanitizeAnonKey(rawKey);
      return { url, key };
    } catch (_e) {
      return { url: DEFAULT_SUPABASE_URL || '', key: DEFAULT_SUPABASE_ANON_KEY || '' };
    }
  }

  saveCredentials(url, key) {
    try {
      const cleanUrl = sanitizeSupabaseUrl(url);
      const cleanKey = sanitizeAnonKey(key);
      appStorage.setItem(STORAGE_KEYS.SUPABASE_URL, cleanUrl);
      appStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, cleanKey);
      this.initClient();
      return { success: true, url: cleanUrl, key: cleanKey };
    } catch (_e) {
      return { success: false, url: DEFAULT_SUPABASE_URL || '', key: DEFAULT_SUPABASE_ANON_KEY || '' };
    }
  }

  resetToDefaults() {
    try {
      appStorage.setItem(STORAGE_KEYS.SUPABASE_URL, DEFAULT_SUPABASE_URL || '');
      appStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY || '');
      this.initClient();
      return { url: DEFAULT_SUPABASE_URL || '', key: DEFAULT_SUPABASE_ANON_KEY || '' };
    } catch (_e) {
      return { url: DEFAULT_SUPABASE_URL || '', key: DEFAULT_SUPABASE_ANON_KEY || '' };
    }
  }

  initClient() {
    const { url, key } = this.getCredentials();
    if (!url || !key) {
      this.client = null;
      return;
    }
    try {
      let authStorage = AsyncStorage;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        authStorage = window.sessionStorage;
      }
      
      this.client = createClient(url, key, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === 'web',
          multiTab: false, // CRITICAL: Stop Supabase from broadcasting logins to other tabs
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
            'Supabase credentials not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.',
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
