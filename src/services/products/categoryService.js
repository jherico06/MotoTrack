import { supabase } from '../../lib/supabase.js';
import { appStorage } from '../system/storageAdapter.js';

const STORAGE_KEY = 'mototrack_categories_catalog_v2';
const TTL_MS = 30000; // 30 seconds TTL cache (prevents usage burn)

// Seeded database fallback (only used if Supabase is offline and local cache is empty)
export const DB_SEEDED_CATEGORIES = [
  { category_id: 'cat-01', name: 'Drivetrain', icon: 'gear-wide-connected', description: 'Chains, sprockets and drive components' },
  { category_id: 'cat-02', name: 'Tires', icon: 'circle', description: 'Racing and street tire sets' },
  { category_id: 'cat-03', name: 'Accessories', icon: 'bag-fill', description: 'Bags, mounts and rider accessories' },
  { category_id: 'cat-04', name: 'Exhaust', icon: 'fire', description: 'Titanium & carbon high-performance exhaust systems' },
  { category_id: 'cat-05', name: 'Brakes', icon: 'disc', description: 'Calipers, rotors and racing pads' },
  { category_id: 'cat-06', name: 'Engine', icon: 'gear-fill', description: 'Fuel, ignition and engine management' },
  { category_id: 'cat-07', name: 'Suspension', icon: 'tools', description: 'Forks, shocks and geometry parts' },
  { category_id: 'cat-08', name: 'Maintenance', icon: 'wrench-adjustable', description: 'Oils, filters and service consumables' },
];

/**
 * Intelligent icon resolver based on category name or alias
 */
export function resolveCategoryIcon(name, customIcon) {
  if (customIcon && typeof customIcon === 'string' && customIcon.trim()) {
    return customIcon.trim();
  }
  const n = String(name || '').toLowerCase();
  if (n.includes('helmet') || n.includes('rider gear') || n.includes('apparel')) return 'shield-shaded';
  if (n.includes('tire') || n.includes('wheel') || n.includes('rim')) return 'circle';
  if (n.includes('brake') || n.includes('rotor') || n.includes('caliper') || n.includes('pad')) return 'disc';
  if (n.includes('engine') || n.includes('piston') || n.includes('motor') || n.includes('cylinder')) return 'gear-fill';
  if (n.includes('elect') || n.includes('battery') || n.includes('light') || n.includes('spark')) return 'lightning-charge-fill';
  if (n.includes('oil') || n.includes('lubricant') || n.includes('fluid') || n.includes('coolant')) return 'droplet-fill';
  if (n.includes('exhaust') || n.includes('muffler') || n.includes('pipe') || n.includes('header')) return 'fire';
  if (n.includes('suspension') || n.includes('shock') || n.includes('fork') || n.includes('damper')) return 'tools';
  if (n.includes('drivetrain') || n.includes('chain') || n.includes('sprocket') || n.includes('drive') || n.includes('trans')) return 'gear-wide-connected';
  if (n.includes('fuel') || n.includes('pump') || n.includes('carb') || n.includes('injector')) return 'fuel-pump-fill';
  if (n.includes('maintenance') || n.includes('service') || n.includes('tool') || n.includes('repair')) return 'wrench-adjustable';
  if (n.includes('body') || n.includes('fairing') || n.includes('windshield')) return 'shield-shaded';
  if (n.includes('access') || n.includes('bag') || n.includes('mount') || n.includes('luggage')) return 'bag-fill';
  return 'box-seam';
}

function parseIconFromDescription(desc, name) {
  if (desc && typeof desc === 'string') {
    const match = desc.match(/<!--icon:([^>]+)-->/);
    if (match?.[1]) return match[1].trim();
  }
  return resolveCategoryIcon(name);
}

function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  return desc.replace(/<!--icon:[^>]+-->/g, '').trim();
}

class CategoryService {
  constructor() {
    this._listeners = new Set();
    this._cache = null;
    this._cacheAt = 0;
    this._inflight = null;
  }

  /**
   * Register a subscriber listener. Returns unsubscribe function.
   */
  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notify(data) {
    this._listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.warn('[categoryService] Listener error:', err);
      }
    });
  }

  _loadFromStorage() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_e) {}
    return null;
  }

  _saveToStorage(data, { silent = false } = {}) {
    this._cache = data;
    this._cacheAt = Date.now();
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_e) {}
    if (!silent) {
      this._notify(data);
    }
  }

  /**
   * Return cached categories synchronously for instant UI initialization.
   */
  getCachedCategories() {
    if (this._cache && this._cache.length > 0) return this._cache;
    const local = this._loadFromStorage();
    if (local && local.length > 0) {
      this._cache = local;
      return local;
    }
    return [...DB_SEEDED_CATEGORIES];
  }

  /**
   * Fetch all categories dynamically with TTL caching and in-flight deduplication.
   * Conforms to prevent-usage-burn: remote LIST cache writes are silent.
   */
  async getCategories({ force = false } = {}) {
    if (!force && this._cache && Date.now() - this._cacheAt < TTL_MS) {
      return this._cache;
    }

    if (!force && this._inflight) {
      return this._inflight;
    }

    this._inflight = (async () => {
      let remoteCategories = null;

      if (supabase) {
        try {
          // Select only valid columns that exist in public.categories
          const { data, error } = await supabase
            .from('categories')
            .select('category_id, name, description, created_at, updated_at')
            .order('name', { ascending: true });

          if (!error && Array.isArray(data) && data.length > 0) {
            remoteCategories = data;
          }
        } catch (e) {
          console.warn('[categoryService] Supabase fetch categories failed:', e);
        }
      }

      let resultList;
      if (remoteCategories && remoteCategories.length > 0) {
        // Purely map from database rows — no hardcoded dummy categories injected
        resultList = remoteCategories.map((remote) => ({
          category_id: remote.category_id,
          name: remote.name,
          description: cleanDescription(remote.description),
          icon: parseIconFromDescription(remote.description, remote.name),
          image: '',
          created_at: remote.created_at,
          updated_at: remote.updated_at,
        }));
      } else {
        // Fallback to local storage or seeded database categories if offline
        const local = this._loadFromStorage();
        resultList = local && local.length > 0 ? local : [...DB_SEEDED_CATEGORIES];
      }

      // Silent write to cache as mandated by prevent-usage-burn
      this._saveToStorage(resultList, { silent: true });
      return resultList;
    })();

    try {
      return await this._inflight;
    } finally {
      this._inflight = null;
    }
  }

  /**
   * Add a new category (Admin Action).
   * Persists to Supabase, updates local storage, and notifies all subscribers.
   */
  async addCategory({ name, description = '', icon = '' }) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return { success: false, error: 'Category name is required' };
    }

    const current = await this.getCategories();
    const existing = current.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      return {
        success: false,
        error: `Category "${trimmedName}" already exists`,
        category: existing,
      };
    }

    // Generate safe unique category ID
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const categoryId = `cat-${slug || Date.now()}`;
    const resolvedIcon = icon || resolveCategoryIcon(trimmedName);

    const newCategory = {
      category_id: categoryId,
      name: trimmedName,
      description: String(description || '').trim(),
      icon: resolvedIcon,
      image: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Attempt database insert if Supabase available
    let dbSuccess = false;
    if (supabase) {
      try {
        const descPayload = resolvedIcon
          ? `${newCategory.description} <!--icon:${resolvedIcon}-->`.trim()
          : newCategory.description;

        const { error } = await supabase.from('categories').insert([
          {
            category_id: newCategory.category_id,
            name: newCategory.name,
            description: descPayload,
          },
        ]);
        if (!error) {
          dbSuccess = true;
        } else {
          console.warn('[categoryService] Supabase insert warning:', error);
        }
      } catch (e) {
        console.warn('[categoryService] Supabase insert exception:', e);
      }
    }

    // 2. Update memory and local cache, and NOTIFY subscribers of mutation
    const updatedList = [...current, newCategory];
    this._saveToStorage(updatedList, { silent: false });

    return {
      success: true,
      category: newCategory,
      syncedWithDatabase: dbSuccess,
    };
  }

  /**
   * Get category by name (case-insensitive)
   */
  async getCategoryByName(name) {
    if (!name) return null;
    const cats = await this.getCategories();
    return (
      cats.find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase()) ||
      null
    );
  }

  /**
   * Invalidate local cache and force refresh
   */
  invalidateCache() {
    this._cache = null;
    this._cacheAt = 0;
  }
}

export const categoryService = new CategoryService();
