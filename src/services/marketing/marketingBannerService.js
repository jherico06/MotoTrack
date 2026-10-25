import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase.js';
import { appStorage } from '../system/storageAdapter.js';
import { authService } from '../auth/authService.js';
import { uploadProductImage } from '../../utils/productImageUpload.js';
import { APP_CONFIG } from '../../config';

const STORAGE_KEY = '@mototrack_marketing_banner';

export const FALLBACK_BANNER = {
  id: 'hero-main',
  title: 'Everything Your Ride Needs',
  subtitle: 'Ride More Worry Less',
  description: 'Quality motorcycle parts, accessories, and professional service — all in one place.',
  image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1600&q=80',
};

function getApiBaseUrl() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_CUSTOMIZE_API_URL || APP_CONFIG?.customizeApiUrl || ''
  ).trim();
  if (fromEnv && fromEnv.startsWith('https://')) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return `${proto}//${window.location.hostname}:8787`;
    }
    return 'http://127.0.0.1:8787';
  }
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://127.0.0.1:8787';
}

class MarketingBannerService {
  constructor() {
    this.banner = this.loadFromStorage();
    this.listeners = new Set();
    this.isFetching = false;
    this.hasLoadedFromCloud = false;

    // Fetch initial from cloud
    this.fetchBanner().catch(() => {});
  }

  loadFromStorage() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.title) {
          return {
            id: parsed.id || 'hero-main',
            title: String(parsed.title || ''),
            subtitle: String(parsed.subtitle || ''),
            description: String(parsed.description || ''),
            image: String(parsed.image || ''),
          };
        }
      }
    } catch (_err) {
      // ignore
    }
    return { ...FALLBACK_BANNER };
  }

  saveToStorage(data) {
    try {
      if (data) {
        appStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            id: data.id || 'hero-main',
            title: data.title || '',
            subtitle: data.subtitle || '',
            description: data.description || '',
            image: data.image || '',
          })
        );
      }
    } catch (_err) {
      // ignore
    }
  }

  getBanner() {
    return { ...this.banner };
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const current = this.getBanner();
    this.listeners.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.warn('[marketingBannerService] subscriber error:', err);
      }
    });
  }

  /**
   * Fetches the hero marketing banner from backend API and/or Supabase database.
   */
  async fetchBanner() {
    if (this.isFetching) return { success: true, banner: this.getBanner() };
    this.isFetching = true;

    try {
      // 1. Try backend API endpoint first
      const base = getApiBaseUrl();
      let cloudBanner = null;

      try {
        const res = await fetch(`${base}/api/banner`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.banner) {
            cloudBanner = json.banner;
          }
        }
      } catch (_apiErr) {
        // Fall back to direct Supabase query
      }

      // 2. Direct Supabase query fallback if API not reachable
      if (!cloudBanner && supabase) {
        const { data, error } = await supabase
          .from('marketing_banners')
          .select('id, title, subtitle, description, image')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          cloudBanner = data;
        }
      }

      if (cloudBanner) {
        // Strictly filter to the 5 allowed fields
        this.banner = {
          id: cloudBanner.id || 'hero-main',
          title: cloudBanner.title || '',
          subtitle: cloudBanner.subtitle || '',
          description: cloudBanner.description || '',
          image: cloudBanner.image || '',
        };
        this.saveToStorage(this.banner);
        this.hasLoadedFromCloud = true;
        this.notify();
        return { success: true, banner: this.getBanner() };
      }

      return { success: true, banner: this.getBanner() };
    } catch (err) {
      console.warn('[marketingBannerService] fetch exception:', err);
      return { success: false, error: err.message, banner: this.getBanner() };
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Upload an image file or data URI to persistent storage.
   */
  async uploadBannerImage(imageUriOrFile) {
    const raw = String(imageUriOrFile || '').trim();
    if (!raw) return { success: false, error: 'No image provided' };

    // If already a remote URL, no need to re-upload
    if (/^https?:\/\//i.test(raw)) {
      return { success: true, url: raw };
    }

    const adminUser = authService.getCurrentUser?.() || null;
    const adminId = adminUser?.user_id || adminUser?.id || '';

    // If it's a browser File / Blob
    if (typeof File !== 'undefined' && imageUriOrFile instanceof File) {
      try {
        const base = getApiBaseUrl();
        const formData = new FormData();
        formData.append('image', imageUriOrFile);

        const res = await fetch(`${base}/api/banner/upload`, {
          method: 'POST',
          headers: {
            'X-Admin-User-Id': String(adminId),
          },
          body: formData,
        });

        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success && json.url) {
          return { success: true, url: json.url };
        }
      } catch (_e) {
        // Fall back to client storage upload
      }
    }

    // Client-side storage upload (via uploadProductImage in Supabase bucket)
    const uploadRes = await uploadProductImage(raw, {
      folder: 'banners',
      fileName: `banners/hero-banner-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.jpg`,
    });

    if (uploadRes.success && uploadRes.url) {
      return { success: true, url: uploadRes.url };
    }

    return {
      success: false,
      error: uploadRes.error || 'Failed to upload banner image to storage.',
    };
  }

  /**
   * Update the marketing banner with strictly the 5 fields.
   */
  async updateBanner({ id = 'hero-main', title, subtitle, description, image }) {
    const cleanTitle = String(title || '').trim();
    const cleanSubtitle = String(subtitle || '').trim();
    const cleanDesc = String(description || '').trim();
    let cleanImage = String(image || '').trim();

    // Client-side validation
    if (!cleanTitle) {
      return { success: false, error: 'Banner title cannot be empty.' };
    }
    if (!cleanSubtitle) {
      return { success: false, error: 'Banner subtitle cannot be empty.' };
    }
    if (!cleanDesc) {
      return { success: false, error: 'Banner description cannot be empty.' };
    }
    if (!cleanImage) {
      return { success: false, error: 'Banner image cannot be empty.' };
    }

    // If image is a local base64/data URI, upload it first
    if (cleanImage.startsWith('data:')) {
      const uploadRes = await this.uploadBannerImage(cleanImage);
      if (!uploadRes.success || !uploadRes.url) {
        return { success: false, error: uploadRes.error || 'Failed to upload image.' };
      }
      cleanImage = uploadRes.url;
    }

    const payload = {
      id: id || 'hero-main',
      title: cleanTitle,
      subtitle: cleanSubtitle,
      description: cleanDesc,
      image: cleanImage,
    };

    const adminUser = authService.getCurrentUser?.() || null;
    const adminId = adminUser?.user_id || adminUser?.id || '';

    let saved = false;
    let serverError = null;

    // 1. Try backend endpoint with admin auth header
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/banner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Admin-User-Id': String(adminId),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.banner) {
        payload.id = json.banner.id;
        payload.title = json.banner.title;
        payload.subtitle = json.banner.subtitle;
        payload.description = json.banner.description;
        payload.image = json.banner.image;
        saved = true;
      } else if (!res.ok) {
        serverError = json.error || `Server returned ${res.status}`;
      }
    } catch (_apiErr) {
      // Fall through to direct Supabase client
    }

    // 2. Direct Supabase upsert fallback
    if (!saved && supabase) {
      try {
        const { data, error } = await supabase
          .from('marketing_banners')
          .upsert(payload, { onConflict: 'id' })
          .select('id, title, subtitle, description, image')
          .single();

        if (!error && data) {
          payload.id = data.id;
          payload.title = data.title;
          payload.subtitle = data.subtitle;
          payload.description = data.description;
          payload.image = data.image;
          saved = true;
        } else if (error) {
          serverError = error.message;
        }
      } catch (dbErr) {
        serverError = dbErr?.message;
      }
    }

    if (!saved) {
      return {
        success: false,
        error: serverError || 'Failed to persist banner to database.',
      };
    }

    // Update memory and local storage
    this.banner = payload;
    this.saveToStorage(this.banner);
    this.notify();

    return {
      success: true,
      banner: this.getBanner(),
    };
  }
}

export const marketingBannerService = new MarketingBannerService();
export default marketingBannerService;
