import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── WEB STORAGE STRATEGY ────────────────────────────────────────────────────
// On web we use sessionStorage (tab-scoped) instead of localStorage (shared
// across all tabs).  This allows a user to open a new tab and sign in with a
// different account without the previous session bleeding over.
// Mobile (AsyncStorage) is unaffected.

class UniversalStorage {
  constructor() {
    this.memoryStore = new Map();
    this.getItem = this.getItem.bind(this);
    this.setItem = this.setItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.clear = this.clear.bind(this);
    this.isWebStorageAvailable = this.isWebStorageAvailable.bind(this);
    
    // Clean up old localStorage so old shared sessions don't linger
    this._cleanupOldLocalStorage();
    
    this.initNativeStorage();
  }

  _cleanupOldLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('mototrack_current_session');
        window.localStorage.removeItem('mototrack_supabase_url');
        window.localStorage.removeItem('mototrack_supabase_anon_key');
        // Clear Supabase's default localStorage keys (they start with sb-)
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            window.localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      // Ignore errors if localStorage is restricted
    }
  }

  // Returns the sessionStorage object when running in a browser, or null otherwise.
  _webStorage() {
    try {
      if (
        typeof window !== 'undefined' &&
        typeof window.sessionStorage !== 'undefined' &&
        window.sessionStorage !== null
      ) {
        return window.sessionStorage;
      }
    } catch (_e) {}
    return null;
  }

  isWebStorageAvailable() {
    return this._webStorage() !== null;
  }

  async initNativeStorage() {
    if (!this.isWebStorageAvailable() && AsyncStorage) {
      try {
        const keys = await AsyncStorage.getAllKeys();
        if (keys && keys.length > 0) {
          const pairs = await AsyncStorage.multiGet(keys);
          for (const [k, v] of pairs) {
            if (v !== null) {
              this.memoryStore.set(k, v);
            }
          }
        }
      } catch (e) {
        console.warn('AsyncStorage init error:', e);
      }
    }
  }

  getItem(key) {
    try {
      const webStore = this._webStorage();
      if (webStore) {
        const val = webStore.getItem(key);
        if (val !== null) return val;
      }
      return this.memoryStore.has(key) ? this.memoryStore.get(key) : null;
    } catch (e) {
      return this.memoryStore.has(key) ? this.memoryStore.get(key) : null;
    }
  }

  setItem(key, value) {
    try {
      const strVal = String(value);
      this.memoryStore.set(key, strVal);
      const webStore = this._webStorage();
      if (webStore) {
        webStore.setItem(key, strVal);
      } else if (AsyncStorage) {
        AsyncStorage.setItem(key, strVal).catch(() => {});
      }
      return true;
    } catch (e) {
      this.memoryStore.set(key, String(value));
      return true;
    }
  }

  removeItem(key) {
    try {
      this.memoryStore.delete(key);
      const webStore = this._webStorage();
      if (webStore) {
        webStore.removeItem(key);
      } else if (AsyncStorage) {
        AsyncStorage.removeItem(key).catch(() => {});
      }
      return true;
    } catch (e) {
      this.memoryStore.delete(key);
      return true;
    }
  }

  clear() {
    try {
      this.memoryStore.clear();
      const webStore = this._webStorage();
      if (webStore) {
        webStore.clear();
      } else if (AsyncStorage) {
        AsyncStorage.clear().catch(() => {});
      }
    } catch (e) {
      this.memoryStore.clear();
    }
  }
}

export const appStorage = new UniversalStorage();
export const storageAdapter = appStorage;
export default appStorage;
