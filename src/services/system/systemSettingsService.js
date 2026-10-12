import { appStorage } from './storageAdapter.js';
import { supabase } from '../../lib/supabase.js';
import { uploadProductImage } from '../../utils/productImageUpload.js';

export const DEFAULT_SYSTEM_SETTINGS = {
  // Store Identity & Branding
  storeName: 'MotoTrack',
  storeTagline: 'MOTORPARTS & ACCESSORIES',
  contactEmail: '',
  contactPhone: '',
  storeAddress: '',
  cityLocation: '',
  businessEmail: '',
  storeLogoUrl: '',
  currencyCode: 'PHP (₱)',
  currencySymbol: '₱',
  taxRate: 12,

  // Store hours & schedule (display aliases kept in sync with garage times)
  openTime: '08:00 AM',
  closeTime: '07:00 PM',
  operatingDays: 'Monday – Saturday',

  // Store & Business Configuration
  storeStatus: 'open',
  deliveryAvailable: true,
  pickupAvailable: true,
  minimumOrderAmount: 0,

  // Operational & Fulfillment Rules
  freeShippingEnabled: false,
  freeShippingThreshold: 3500,
  standardShippingFee: 100,
  deliveryLeadTimeDays: 3,
  autoFulfillOrders: false,
  maxCodAmount: 50000,
  lowStockThreshold: 5,
  defaultReorderLevel: 5,
  criticalStockLevel: 2,
  skuPrefix: 'MT-',
  enableBackorders: false,
  autoVerifyCodOrders: false,
  allowGuestCheckout: true,

  // Checkout & Payment Settings
  codEnabled: true,
  onlinePaymentEnabled: true,
  paymentVerificationRequired: true,
  allowCancellationHours: 24,

  // Pitstop Garage & Service Rules
  garageOpeningTime: '08:00 AM',
  garageClosingTime: '07:00 PM',
  serviceBookingEnabled: true,
  maxDailyAppointments: 24,
  maxConcurrentBookings: 4,
  serviceBayCount: 4,
  slotDurationMinutes: 90,
  slotsPerMechanic: 2,
  walkInAvailable: true,
  pmsEnabled: true,
  allowWeekendBookings: true,
  autoAssignMechanic: true,
  autoAssignMechanics: true,
  bookingApprovalRequired: false,
  serviceStatusWorkflow: 'Pending → Confirmed → In Service → Ready → Completed',
  downpaymentPercent: 20,
  requireDownpayment: true,
  /** Hours after booking is created before unpaid downpayment bookings auto-cancel */
  downpaymentDueHours: 1,
  laborRatePerHour: 350,

  // Alert & Notification Preferences
  enableOrderNotifications: true,
  enableOrderEmail: true,
  enableOrderSms: false,
  enableBookingReminder: true,
  reminderHoursBefore: 24,
  enablePaymentNotifications: true,
  enableStockAlerts: true,
  enableLowStockAlerts: true,
  enableSoundAlerts: true,
  alertOnLowStock: true,
  alertOnNewBooking: true,
  adminNotificationEmail: '',

  // Security & System Settings
  passwordMinLength: 8,
  requireStrongPassword: true,
  otpEnabled: true,
  sessionTimeoutMinutes: 60,
  loginProtection: true,
  adminAccessRestricted: false,
  auditLogging: true,
  autoBackup: true,
  dataRetentionDays: 365,

  // Maintenance & System Health
  isMaintenanceMode: false,
  maintenanceMode: false,
  maintenanceMessage: '',
  lastUpdated: new Date().toISOString(),
};

const STORAGE_KEY = 'mototrack_system_settings_v1';

class SystemSettingsService {
  constructor() {
    this.subscribers = new Set();
    this.settings = this.loadSettings();
    this.realtimeChannel = null;

    // 1. Cross-tab synchronization via browser storage events
    this.initCrossTabSync();

    // 2. Initial cloud fetch from Supabase to ensure customer & other user sync
    this.fetchRemoteSettings();

    // 3. Supabase Realtime subscription for instant multi-user push updates
    this.initRealtimeSubscription();
  }

  initCrossTabSync() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', (e) => {
        if (!e.key || e.key === STORAGE_KEY) {
          const reloaded = this.loadSettings();
          if (JSON.stringify(reloaded) !== JSON.stringify(this.settings)) {
            this.settings = reloaded;
            if (typeof document !== 'undefined' && this.settings.storeName) {
              document.title = `${this.settings.storeName}${this.settings.storeTagline ? ' - ' + this.settings.storeTagline : ''}`;
            }
            this.notify();
          }
        }
      });
    }
  }

  async initRealtimeSubscription() {
    if (!supabase || typeof supabase.channel !== 'function') return;
    try {
      if (this.realtimeChannel) {
        try {
          supabase.removeChannel(this.realtimeChannel);
        } catch (_e) {}
      }
      this.realtimeChannel = supabase
        .channel('public:system_settings:sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_settings' },
          () => {
            this.fetchRemoteSettings();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[systemSettingsService] Realtime subscription notice:', err?.message || err);
    }
  }

  async fetchRemoteSettings() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('system_settings').select('key, value');
      if (error || !Array.isArray(data) || data.length === 0) return;

      const map = {};
      data.forEach((row) => {
        if (row && row.key) {
          map[row.key] = row.value;
        }
      });

      let changed = false;
      const next = { ...this.settings };

      if (map.system_settings_payload) {
        try {
          const parsed = JSON.parse(map.system_settings_payload);
          Object.assign(next, parsed);
          changed = true;
        } catch (_e) {}
      }

      if (map.store_name && map.store_name !== next.storeName) {
        next.storeName = map.store_name;
        changed = true;
      }
      if (map.store_tagline !== undefined && map.store_tagline !== next.storeTagline) {
        next.storeTagline = map.store_tagline;
        changed = true;
      }
      if (map.store_logo_url !== undefined && map.store_logo_url !== next.storeLogoUrl) {
        next.storeLogoUrl = map.store_logo_url;
        changed = true;
      }

      if (changed) {
        this.settings = next;
        appStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        if (typeof document !== 'undefined' && this.settings.storeName) {
          document.title = `${this.settings.storeName}${this.settings.storeTagline ? ' - ' + this.settings.storeTagline : ''}`;
        }
        this.notify();
      }
    } catch (err) {
      console.warn('[systemSettingsService] fetchRemoteSettings error:', err?.message || err);
    }
  }

  async syncToSupabase(settings) {
    if (!supabase) return;
    try {
      let finalLogoUrl = settings.storeLogoUrl || '';

      // If logo is a data URI, upload it to Supabase Storage so all devices can render it
      if (finalLogoUrl && String(finalLogoUrl).startsWith('data:')) {
        try {
          const upRes = await uploadProductImage(finalLogoUrl, { folder: 'brand' });
          if (upRes.success && upRes.url) {
            finalLogoUrl = upRes.url;
            this.settings.storeLogoUrl = finalLogoUrl;
            appStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            this.notify();
          }
        } catch (_e) {}
      }

      const rows = [
        {
          key: 'store_name',
          value: String(settings.storeName || 'MotoTrack'),
          updated_at: new Date().toISOString(),
        },
        {
          key: 'store_tagline',
          value: String(settings.storeTagline || ''),
          updated_at: new Date().toISOString(),
        },
        {
          key: 'store_logo_url',
          value: String(finalLogoUrl || ''),
          updated_at: new Date().toISOString(),
        },
        {
          key: 'system_settings_payload',
          value: JSON.stringify({ ...settings, storeLogoUrl: finalLogoUrl }),
          updated_at: new Date().toISOString(),
        },
      ];

      await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
    } catch (err) {
      console.warn('[systemSettingsService] Failed to sync settings to Supabase:', err?.message || err);
    }
  }

  loadSettings() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Strip out any legacy mocked values (keep real branding defaults intact)
        const mockTagline = 'Premier Performance Motorcycle Parts & Certified Pitstop Service Center';
        const mockAddresses = [
          '108 Katipunan Ave, Quezon City, Metro Manila, Philippines',
          '108 Katipunan Ave, Quezon City, Metro Manila',
          'KM 14 West Service Rd, Sun Valley',
          'KM 14 West Service Rd, Sun Valley, Parañaque, Metro Manila',
          'KM 14 West Service Rd, Sun Valley, Paranaque, Metro Manila',
        ];
        const mockPhone = '+63 (02) 8876-5432';
        const mockEmail = 'support@mototrack.ph';
        const mockStore = 'MotoTrack Performance & Pitstop Garage';
        const mockCities = ['Parañaque, Metro Manila', 'Paranaque, Metro Manila'];

        if (parsed.storeTagline === mockTagline) {
          parsed.storeTagline = 'MOTORPARTS & ACCESSORIES';
        }
        if (mockAddresses.some((a) => String(parsed.storeAddress || '').trim() === a)) {
          parsed.storeAddress = '';
        }
        if (mockCities.some((c) => String(parsed.cityLocation || '').trim() === c)) {
          parsed.cityLocation = '';
        }
        if (parsed.contactPhone === mockPhone) parsed.contactPhone = '';
        if (parsed.contactEmail === mockEmail) parsed.contactEmail = '';
        if (parsed.storeName === mockStore) parsed.storeName = 'MotoTrack';

        const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...parsed };
        // Keep duplicated maintenance / mechanic flags in sync for legacy callers
        merged.maintenanceMode = merged.maintenanceMode || merged.isMaintenanceMode || false;
        merged.isMaintenanceMode = merged.maintenanceMode;
        merged.autoAssignMechanics = merged.autoAssignMechanics ?? merged.autoAssignMechanic ?? true;
        merged.autoAssignMechanic = merged.autoAssignMechanics;
        merged.openTime = merged.openTime || merged.garageOpeningTime || '08:00 AM';
        merged.closeTime = merged.closeTime || merged.garageClosingTime || '07:00 PM';
        merged.garageOpeningTime = merged.openTime;
        merged.garageClosingTime = merged.closeTime;
        // Downpayment due starts at booking time; product default is 1 hour.
        const dueHrs = Number(merged.downpaymentDueHours);
        if (!Number.isFinite(dueHrs) || dueHrs <= 0) {
          merged.downpaymentDueHours = 1;
        }
        return merged;
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
      const next = {
        ...this.settings,
        ...partial,
        lastUpdated: new Date().toISOString(),
      };
      // Keep legacy alias pairs in sync so every consumer reads the same value
      if (partial.openTime !== undefined) next.garageOpeningTime = partial.openTime;
      if (partial.garageOpeningTime !== undefined) next.openTime = partial.garageOpeningTime;
      if (partial.closeTime !== undefined) next.garageClosingTime = partial.closeTime;
      if (partial.garageClosingTime !== undefined) next.closeTime = partial.garageClosingTime;
      if (partial.maintenanceMode !== undefined) next.isMaintenanceMode = partial.maintenanceMode;
      if (partial.isMaintenanceMode !== undefined) next.maintenanceMode = partial.isMaintenanceMode;
      if (partial.autoAssignMechanics !== undefined) next.autoAssignMechanic = partial.autoAssignMechanics;
      if (partial.autoAssignMechanic !== undefined) next.autoAssignMechanics = partial.autoAssignMechanic;
      this.settings = next;
      appStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      if (typeof document !== 'undefined' && this.settings.storeName) {
        document.title = `${this.settings.storeName}${this.settings.storeTagline ? ' - ' + this.settings.storeTagline : ''}`;
      }
      this.notify();

      // Trigger cloud sync to Supabase so customers and other users immediately receive updates
      this.syncToSupabase(this.settings);

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
      if (typeof document !== 'undefined') {
        document.title = 'MotoTrack';
      }
      this.notify();
      this.syncToSupabase(this.settings);
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
