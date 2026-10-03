/**
 * Shop parts compatibility — brand + model only.
 * Reuses customer_motorcycles + product_compatibility + motorcycle_models.
 * Does NOT guess fitment from free-text or Universal labels.
 */
import { supabaseManager } from './supabaseClient.js';
import { motorcycleService } from './motorcycleService.js';
import { dataCache } from './cache/dataCache.js';
import { CacheKeys, CACHE_TTL } from './cache/cacheKeys.js';

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
      (r) => brandEquals(r.brand, bike.brand) && modelEquals(r.model, bike.model)
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

export default compatibilityService;
