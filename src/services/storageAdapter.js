// ─── UNIVERSAL CROSS-PLATFORM STORAGE ADAPTER (WEB / IOS / ANDROID) ───────────
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class UniversalStorage {
  constructor() {
    this.memoryStore = new Map();
    this.initNativeStorage();
  }

  isWebStorageAvailable() {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.localStorage !== 'undefined' &&
        window.localStorage !== null
      );
    } catch (e) {
      return false;
    }
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
      if (this.isWebStorageAvailable()) {
        const val = window.localStorage.getItem(key);
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
      if (this.isWebStorageAvailable()) {
        window.localStorage.setItem(key, strVal);
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
      if (this.isWebStorageAvailable()) {
        window.localStorage.removeItem(key);
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
      if (this.isWebStorageAvailable()) {
        window.localStorage.clear();
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
