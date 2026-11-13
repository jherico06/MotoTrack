/**
 * Shop parts compatibility — brand + model only.
 * Reuses customer_motorcycles + product_compatibility + motorcycle_models.
 * Does NOT guess fitment from free-text or Universal labels.
 */
import { supabaseManager } from '../../lib/supabase.js';
import { motorcycleService } from './motorcycleService.js';
import { dataCache } from '../cache/dataCache.js';
import { CacheKeys, CACHE_TTL } from '../cache/cacheKeys.js';

function client() {
  return supabaseManager.getClient();
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function brandEquals(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function modelEquals(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function bikeLabel(bike) {
  if (!bike) return '';
  return [bike.brand, bike.model].filter(Boolean).join(' ').trim();
}

function invalidateCompatCaches(productId) {
  dataCache.invalidate(CacheKeys.productCompatibilityAll());
  dataCache.invalidate(CacheKeys.motorcycleModels());
  if (productId) dataCache.invalidate(CacheKeys.productCompatibility(productId));
}

export const COMPAT_STATUS = Object.freeze({
  COMPATIBLE: 'compatible',
  INCOMPATIBLE: 'incompatible',
  UNAVAILABLE: 'unavailable',
  NO_BIKE: 'no_bike',
  UNIVERSAL: 'universal',
});

export const compatibilityService = {
  COMPAT_STATUS,

  bikeLabel,

  /** Active (primary) garage motorcycle for the signed-in customer. */
  async getActiveMotorcycle(userId) {
    if (!userId) return null;
    try {
      await motorcycleService.syncFromSupabase?.(userId);
    } catch (_e) {}
    const primary = motorcycleService.getPrimaryMotorcycle?.(userId);
    if (primary?.brand && primary?.model) return primary;
    const list = motorcycleService.getMotorcycles?.(userId) || [];
    return list.find((m) => m.brand && m.model) || null;
  },

  async listCustomerMotorcycles(userId) {
    if (!userId) return [];
    try {
      await motorcycleService.syncFromSupabase?.(userId);
    } catch (_e) {}
    return (motorcycleService.getMotorcycles?.(userId) || []).filter((m) => m.brand && m.model);
  },

  /**
   * Simple garage entry: brand + model only (no year/VIN/cc).
   * Reuses customer_motorcycles; plate is a required DB column so we store a placeholder.
   */
  async addSimpleMotorcycle({ userId, customerId, customerEmail, brand, model, nickname, setActive = true }) {
    const b = String(brand || '').trim();
    const m = String(model || '').trim();
    if (!userId) return { success: false, error: 'Please sign in first.' };
    if (!b || !m) return { success: false, error: 'Brand and model are required.' };

    const result = await motorcycleService.addMotorcycle({
      user_id: userId,
      customer_id: customerId || userId,
      customer_email: customerEmail || '',
      brand: b,
      model: m,
      nickname: nickname || `${b} ${m}`,
      plate_number: `N/A-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      is_primary: Boolean(setActive),
      notes: 'Added for parts compatibility',
    });

    if (!result?.success) {
      return { success: false, error: result?.error || 'Could not save motorcycle.' };
    }

    const moto = result.motorcycle;
    if (moto?.motorcycle_id && setActive) {
      try {
        await motorcycleService.setPrimaryMotorcycle(moto.motorcycle_id, userId);
      } catch (_e) {}
    }
    dataCache.invalidate(CacheKeys.customerMotorcycles(userId));
    return { success: true, motorcycle: moto, warning: result.warning };
  },

  async setActiveMotorcycle(motorcycleId, userId) {
    if (!motorcycleId || !userId) return { success: false, error: 'Missing motorcycle or user' };
    await motorcycleService.setPrimaryMotorcycle(motorcycleId, userId);
    dataCache.invalidate(CacheKeys.customerMotorcycles(userId));
    return { success: true };
  },

  // ── Admin motorcycle models catalog ────────────────────────────────────
  async getMotorcycleModels({ activeOnly = true, force = false } = {}) {
    return dataCache.fetch(
      CacheKeys.motorcycleModels(),
      async () => {
        const c = client();
        if (!c) return [];
        let q = c
          .from('motorcycle_models')
          .select('model_id, brand, model, is_active, created_at, updated_at')
          .order('brand', { ascending: true })
          .order('model', { ascending: true });
        if (activeOnly) q = q.eq('is_active', true);
        const { data, error } = await q;
        if (error) {
          console.warn('[compatibility] models fetch:', error.message);
          return [];
        }
        return data || [];
      },
      { ttlMs: CACHE_TTL.MOTORCYCLE_MODELS_MS, force, swr: !force }
    );
  },

  async addMotorcycleModel({ brand, model }) {
    const b = String(brand || '').trim();
    const m = String(model || '').trim();
    if (!b || !m) return { success: false, error: 'Brand and model are required.' };
    const c = client();
    if (!c) return { success: false, error: 'Database unavailable' };
    const row = {
      model_id: newId('mm'),
      brand: b,
      model: m,
      is_active: true,
    };
    const { data, error } = await c.from('motorcycle_models').insert([row]).select().maybeSingle();
    if (error) {
      if (String(error.message || '').toLowerCase().includes('unique') || error.code === '23505') {
        return { success: false, error: 'That brand and model already exists.' };
      }
      return { success: false, error: error.message };
    }
    invalidateCompatCaches();
    return { success: true, model: data || row };
  },

  async updateMotorcycleModel(modelId, patch = {}) {
    if (!modelId) return { success: false, error: 'Missing modelId' };
    const c = client();
    if (!c) return { success: false, error: 'Database unavailable' };
    const updates = { updated_at: new Date().toISOString() };
    if (patch.brand != null) updates.brand = String(patch.brand).trim();
    if (patch.model != null) updates.model = String(patch.model).trim();
    if (patch.is_active != null) updates.is_active = Boolean(patch.is_active);
    const { error } = await c.from('motorcycle_models').update(updates).eq('model_id', modelId);
    if (error) return { success: false, error: error.message };
    invalidateCompatCaches();
    return { success: true };
  },

  async deleteMotorcycleModel(modelId) {
    if (!modelId) return { success: false, error: 'Missing modelId' };
    const c = client();
    if (!c) return { success: false, error: 'Database unavailable' };
    // Soft-delete preferred so existing product_compatibility rows stay readable
    const { error } = await c
      .from('motorcycle_models')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('model_id', modelId);
    if (error) return { success: false, error: error.message };
    invalidateCompatCaches();
    return { success: true };
  },

  // ── Product compatibility matrix (one fetch for the whole shop) ────────
  async getAllCompatibilityRows({ force = false } = {}) {
    return dataCache.fetch(
      CacheKeys.productCompatibilityAll(),
      async () => {
        const c = client();
        if (!c) return [];
        const { data, error } = await c
          .from('product_compatibility')
          .select('compatibility_id, product_id, brand, model, model_id, year_from, year_to, year_exact, notes');
        if (error) {
          console.warn('[compatibility] rows fetch:', error.message);
          return [];
        }
        return data || [];
      },
      { ttlMs: CACHE_TTL.PRODUCT_COMPAT_MS, force, swr: !force }
    );
  },

  /** Map productId → rows[] */
  async getCompatibilityMap({ force = false } = {}) {
    const rows = await this.getAllCompatibilityRows({ force });
    const map = new Map();
    for (const row of rows || []) {
      const pid = row.product_id;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(row);
    }
    return map;
  },

  async getCompatibilityForProduct(productId, { force = false } = {}) {
    if (!productId) return [];
    const map = await this.getCompatibilityMap({ force });
    return map.get(productId) || [];
  },

  /**
   * Shop status — never assumes compatible when no structured rows exist.
   * @returns {'compatible'|'incompatible'|'unavailable'|'no_bike'}
   */
  getCompatStatus(productId, bike, compatMap) {
    if (!bike?.brand || !bike?.model) return COMPAT_STATUS.NO_BIKE;
    const rows = compatMap instanceof Map ? compatMap.get(productId) || [] : [];
    if (!rows.length) return COMPAT_STATUS.UNAVAILABLE;
    const hit = rows.some(
      (r) =>
        norm(r.brand) === 'universal' ||
        norm(r.model) === 'all models' ||
        (brandEquals(r.brand, bike.brand) && modelEquals(r.model, bike.model))
    );
    return hit ? COMPAT_STATUS.COMPATIBLE : COMPAT_STATUS.INCOMPATIBLE;
  },

  formatCompatMessage(status, bike) {
    const label = bikeLabel(bike) || 'your motorcycle';
    switch (status) {
      case COMPAT_STATUS.COMPATIBLE:
        return `✓ Compatible with your ${label}`;
      case COMPAT_STATUS.INCOMPATIBLE:
        return `✗ Not compatible with your ${label}`;
      case COMPAT_STATUS.UNAVAILABLE:
        return 'Compatibility information unavailable';
      case COMPAT_STATUS.NO_BIKE:
      default:
        return 'Select your motorcycle to check part compatibility.';
    }
  },

  /**
   * Synchronously or semi-synchronously check compatibility for a single product and motorcycle.
   * Handles pre-annotated product objects, structured fitment arrays,
   * cached rows from dataCache, an optional compatMap, or legacy fitment strings.
   * @param {Object|string} product
   * @param {Object} bike
   * @param {Map} [compatMap]
   * @returns {'compatible'|'incompatible'|'unavailable'|'no_bike'|'universal'}
   */
  checkCompatibility(product, bike, compatMap) {
    if (!bike?.brand || !bike?.model) return COMPAT_STATUS.NO_BIKE;
    if (!product) return COMPAT_STATUS.UNAVAILABLE;

    // 1. If product is just an ID string
    const pid = typeof product === 'string' ? product : (product.id || product.product_id);

    // 2. If product object already has a verified compatStatus (from annotateProducts or prior check)
    if (product && typeof product === 'object' && product.compatStatus) {
      if (Object.values(COMPAT_STATUS).includes(product.compatStatus)) {
        return product.compatStatus;
      }
    }

    // 3. Check for explicit universal fitment flags
    if (
      product &&
      typeof product === 'object' &&
      (product.is_universal === true ||
        product.universal === true ||
        norm(product.type) === 'universal' ||
        norm(product.compatibility) === 'universal' ||
        norm(product.compatibility) === 'all models')
    ) {
      return COMPAT_STATUS.COMPATIBLE;
    }

    // 4. Check compatMap if supplied or cached in dataCache
    let map = compatMap;
    if (!map) {
      try {
        const cached = dataCache.get(CacheKeys.productCompatibilityAll());
        if (cached?.value && Array.isArray(cached.value)) {
          const rows = cached.value.filter((r) => r.product_id === pid);
          if (rows.length > 0) {
            const hit = rows.some(
              (r) =>
                norm(r.brand) === 'universal' ||
                norm(r.model) === 'all models' ||
                (brandEquals(r.brand, bike.brand) && modelEquals(r.model, bike.model))
            );
            return hit ? COMPAT_STATUS.COMPATIBLE : COMPAT_STATUS.INCOMPATIBLE;
          }
        }
      } catch (_e) {}
    } else if (map instanceof Map) {
      return this.getCompatStatus(pid, bike, map);
    }

    // 5. Check structured compatibility rows attached directly on product
    const directRows =
      product.product_compatibility ||
      product.compatibility_rows ||
      product.compatible_models;

    if (Array.isArray(directRows) && directRows.length > 0) {
      const hit = directRows.some((r) => {
        if (typeof r === 'string') {
          const rLower = norm(r);
          return (
            rLower === 'universal' ||
            rLower === 'all models' ||
            (rLower.includes(norm(bike.brand)) && rLower.includes(norm(bike.model)))
          );
        }
        return (
          norm(r?.brand) === 'universal' ||
          norm(r?.model) === 'all models' ||
          (brandEquals(r?.brand, bike.brand) && modelEquals(r?.model, bike.model))
        );
      });
      return hit ? COMPAT_STATUS.COMPATIBLE : COMPAT_STATUS.INCOMPATIBLE;
    }

    // 6. Check textual compatibility string (e.g. "Honda ADV 160, Click 125")
    if (typeof product.compatibility === 'string' && product.compatibility.trim()) {
      const raw = norm(product.compatibility);
      if (raw === 'universal' || raw === 'all models' || raw === 'all') {
        return COMPAT_STATUS.COMPATIBLE;
      }
      const bNorm = norm(bike.brand);
      const mNorm = norm(bike.model);
      if (raw.includes(mNorm) || (bNorm && raw.includes(bNorm) && raw.includes(mNorm))) {
        return COMPAT_STATUS.COMPATIBLE;
      }
      return COMPAT_STATUS.INCOMPATIBLE;
    }

    return COMPAT_STATUS.UNAVAILABLE;
  },

  /** Annotate a product list in memory (no per-product network calls). */
  annotateProducts(products = [], bike, compatMap) {
    return (products || []).map((p) => {
      const pid = p.id || p.product_id;
      const status = this.getCompatStatus(pid, bike, compatMap);
      return {
        ...p,
        compatStatus: status,
        compatMessage: this.formatCompatMessage(status, bike),
      };
    });
  },

  /**
   * Replace structured fitment rows for a product from selected catalog models.
   * Admin only — never AI.
   */
  async setProductCompatibleModels(productId, selectedModels = []) {
    if (!productId) return { success: false, error: 'Missing productId' };
    const c = client();
    if (!c) return { success: false, error: 'Database unavailable' };

    await c.from('product_compatibility').delete().eq('product_id', productId);

    const rows = (selectedModels || [])
      .filter((m) => m && (m.brand || m.model))
      .map((m) => ({
        compatibility_id: newId('pc'),
        product_id: productId,
        brand: String(m.brand || '').trim(),
        model: String(m.model || '').trim(),
        model_id: m.model_id || m.modelId || null,
        year_from: null,
        year_to: null,
        year_exact: null,
        notes: null,
      }))
      .filter((r) => r.brand && r.model);

    if (rows.length) {
      const { error } = await c.from('product_compatibility').insert(rows);
      if (error) return { success: false, error: error.message };
    }

    invalidateCompatCaches(productId);
    return { success: true, rows };
  },
};

export function checkCompatibility(product, bike, compatMap) {
  return compatibilityService.checkCompatibility(product, bike, compatMap);
}

export { bikeLabel };

export default compatibilityService;
