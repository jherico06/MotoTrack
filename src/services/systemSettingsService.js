import { appStorage } from './storageAdapter';

export const DEFAULT_SYSTEM_SETTINGS = {
  // Store Identity & Branding
  storeName: 'MotoTrack Performance & Pitstop Garage',
  storeTagline: 'Premier Performance Motorcycle Parts & Certified Pitstop Service Center',
  contactEmail: 'support@mototrack.ph',
  contactPhone: '+63 (02) 8876-5432',
  storeAddress: '108 Katipunan Ave, Quezon City, Metro Manila, Philippines',
  currencyCode: 'PHP',
  currencySymbol: '₱',
  taxRate: 12,

  // Operational & Fulfillment Rules
  freeShippingThreshold: 3500,
  maxCodAmount: 50000,
  lowStockThreshold: 5,
  autoVerifyCodOrders: false,
  allowGuestCheckout: true,

  // Pitstop Garage & Service Rules
  garageOpeningTime: '08:00 AM',
  garageClosingTime: '07:00 PM',
  maxDailyAppointments: 24,
  allowWeekendBookings: true,
  autoAssignMechanic: true,

  // Alert & Notification Preferences
  enableOrderNotifications: true,
  enableLowStockAlerts: true,
  enableSoundAlerts: true,

  // Maintenance & System Health
  isMaintenanceMode: false,
  maintenanceMessage:
    'We are performing scheduled system upgrades on our catalog and pit bay scheduler. We will be back online shortly!',
  lastUpdated: new Date().toISOString(),
};

const STORAGE_KEY = 'mototrack_system_settings_v1';

class SystemSettingsService {
  constructor() {
    this.subscribers = new Set();
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SYSTEM_SETTINGS, ...parsed };
      }
    } catch (_e) {
      // Fall back to defaults
    }
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }

  getSettings() {
    return { ...this.settings };
  }

  saveSettings(partial) {
    try {
      this.settings = {
        ...this.settings,
        ...partial,
        lastUpdated: new Date().toISOString(),
      };
      appStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notify();
      return { success: true, settings: this.settings };
    } catch (err) {
      console.error('Failed to save system settings:', err);
      return { success: false, error: err.message };
    }
  }

  resetToDefaults() {
    try {
      this.settings = {
        ...DEFAULT_SYSTEM_SETTINGS,
        lastUpdated: new Date().toISOString(),
      };
      appStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notify();
      return { success: true, settings: this.settings };
    } catch (err) {
      console.error('Failed to reset system settings:', err);
      return { success: false, error: err.message };
    }
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb(this.settings);
      } catch (err) {
        console.error('Error notifying system settings subscriber:', err);
      }
    });
  }

  clearSystemCache() {
    try {
      // Clear non-critical caches while preserving primary auth, orders, and products
      const safeCacheKeys = [
        'mototrack_admin_filter_cache',
        'mototrack_garage_cache',
        'mototrack_temp_customizer',
      ];
      safeCacheKeys.forEach((key) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
          }
        } catch (_e) {}
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const systemSettingsService = new SystemSettingsService();
