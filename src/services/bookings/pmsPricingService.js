/**
 * PMS / Repair fixed-rate pricing service.
 * Loads CC categories + service prices from Supabase when available,
 * falls back to the in-app catalog defaults. Always re-quotes server-side.
 */

import { supabaseManager } from '../../lib/supabase.js';
import { dataCache } from '../cache/dataCache.js';
import {
  DEFAULT_CC_CATEGORIES,
  DEFAULT_PMS_SERVICES,
  CATALOG_CATEGORIES,
  buildPmsCatalogForCategory,
  groupPmsCatalog,
  quotePmsBooking,
  quotePmsBookingServices,
  resolveCcCategory,
  parseEngineCc,
  validateCcCategoryRanges,
  enrichServiceMeta,
  normalizeCatalogCategory,
  UNSUPPORTED_CC_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  ESTIMATE_DISCLAIMER,
} from '../../utils/pmsCcPricing.js';

const CACHE_KEY = 'pms_cc_pricing_catalog_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

function mapCategoryRow(row) {
  return {
    id: row.id,
    name: row.name,
    minCc: Number(row.min_cc),
    maxCc: row.max_cc == null ? null : Number(row.max_cc),
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
  };
}

function mapServiceRows(services, prices, { includeInactive = false } = {}) {
  const byService = new Map();
  (services || []).forEach((s) => {
    byService.set(
      s.id,
      enrichServiceMeta({
        id: s.id,
        name: s.name,
        sortOrder: Number(s.sort_order || 0),
        isActive: s.is_active !== false,
        group: s.service_group || s.group,
        description: s.description,
        icon: s.icon,
        catalogCategory: normalizeCatalogCategory(s.catalog_category ?? s.catalogCategory),
        prices: {},
      })
    );
  });
  (prices || []).forEach((p) => {
    const svc = byService.get(p.service_id);
    if (!svc) return;
    if (p.is_available === false || p.price_php == null) {
      svc.prices[p.category_id] = null;
    } else {
      svc.prices[p.category_id] = Number(p.price_php);
    }
  });
  return [...byService.values()]
    .filter((s) => (includeInactive ? true : s.isActive !== false))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const pmsPricingService = {
  UNSUPPORTED_CC_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  ESTIMATE_DISCLAIMER,
  CATALOG_CATEGORIES,

  getDefaultCatalog() {
    return {
      categories: DEFAULT_CC_CATEGORIES.map((c) => ({ ...c })),
      services: DEFAULT_PMS_SERVICES.map((s) => ({
        ...s,
        catalogCategory: normalizeCatalogCategory(s.catalogCategory),
        prices: { ...s.prices },
        isActive: true,
      })),
      source: 'defaults',
    };
  },

  async loadCatalog({ forceRefresh = false, includeInactive = false } = {}) {
    const cacheKey = includeInactive ? `${CACHE_KEY}_all` : CACHE_KEY;
    if (!forceRefresh) {
      const cached = dataCache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const client = supabaseManager.getClient?.() || supabaseManager.client;
      if (!client) throw new Error('No supabase client');

      let svcQuery = client.from('pms_services').select('*').order('sort_order');
      if (!includeInactive) {
        svcQuery = svcQuery.eq('is_active', true);
      }

      const [catRes, svcRes, priceRes] = await Promise.all([
        client.from('cc_categories').select('*').eq('is_active', true).order('sort_order'),
        svcQuery,
        client.from('pms_service_prices').select('*'),
      ]);

      if (catRes.error || svcRes.error || priceRes.error) {
        throw catRes.error || svcRes.error || priceRes.error;
      }

      const categories = (catRes.data || []).map(mapCategoryRow);
      const services = mapServiceRows(svcRes.data, priceRes.data, { includeInactive });
      const rangeCheck = validateCcCategoryRanges(categories);
      if (!rangeCheck.ok) {
        console.warn('[pmsPricingService] CC range overlap:', rangeCheck.error);
      }

      if (!categories.length || !services.length) {
        const fallback = this.getDefaultCatalog();
        dataCache.set(cacheKey, fallback, CACHE_TTL_MS);
        return fallback;
      }

      const catalog = { categories, services, source: 'supabase' };
      dataCache.set(cacheKey, catalog, CACHE_TTL_MS);
      return catalog;
    } catch (_e) {
      const fallback = this.getDefaultCatalog();
      dataCache.set(cacheKey, fallback, CACHE_TTL_MS);
      return fallback;
    }
  },

  async resolveCategoryForCc(engineCc) {
    const catalog = await this.loadCatalog();
    return resolveCcCategory(engineCc, catalog.categories);
  },

  async getCatalogForMotorcycle(engineCc) {
    const catalog = await this.loadCatalog();
    const resolved = resolveCcCategory(engineCc, catalog.categories);
    if (!resolved.category) {
      return {
        ok: false,
        engineCc: resolved.engineCc,
        category: null,
        services: [],
        message:
          resolved.reason === 'invalid_cc'
            ? 'A valid motorcycle engine displacement (CC) is required.'
            : UNSUPPORTED_CC_MESSAGE,
        code: resolved.reason || 'unsupported_cc',
      };
    }
    const services = buildPmsCatalogForCategory(resolved.category.id, catalog.services);
    return {
      ok: true,
      engineCc: resolved.engineCc,
      category: resolved.category,
      services,
      groups: groupPmsCatalog(services),
      message: null,
      code: null,
    };
  },

  /**
   * Authoritative quote used when creating/approving PMS bookings.
   * Ignores client-submitted prices.
   */
  async quoteBooking({ engineCc, serviceId, clientPrice } = {}) {
    const catalog = await this.loadCatalog();
    return quotePmsBooking({
      engineCc,
      serviceId,
      clientPrice,
      categories: catalog.categories,
      services: catalog.services,
    });
  },

  /** Multi-service authoritative quote (deduped, server-side rates only). */
  async quoteBookingServices({
    engineCc,
    serviceIds = [],
    partsEstimate = 0,
    additionalFeesEstimate = 0,
  } = {}) {
    const catalog = await this.loadCatalog();
    return quotePmsBookingServices({
      engineCc,
      serviceIds,
      partsEstimate,
      additionalFeesEstimate,
      categories: catalog.categories,
      services: catalog.services,
    });
  },

  invalidateCache() {
    try {
      dataCache.invalidate(CACHE_KEY);
      dataCache.invalidate(`${CACHE_KEY}_all`);
      dataCache.invalidate('pms_cc_pricing_catalog_v1');
    } catch (_e) {}
  },

  slugifyServiceId(name) {
    const base = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `pms-${base || 'service'}-${Date.now().toString(36)}`;
  },

  /**
   * Normalize a form price: null / '' / 'na' / 'n/a' => Price not configured.
   * Otherwise a non-negative number.
   */
  normalizePriceInput(value) {
    if (value == null) return { ok: true, price: null, available: false };
    const raw = String(value).trim();
    if (!raw || /^(n\/?a|not\s*available|price\s*not\s*configured|-)$/i.test(raw)) {
      return { ok: true, price: null, available: false };
    }
    const n = Number(raw.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'Price must be a valid non-negative number or leave unconfigured.' };
    }
    return { ok: true, price: Math.round(n * 100) / 100, available: true };
  },

  /**
   * Create a new fixed-rate service with per-CC prices and PMS|Repair category.
   */
  async createFixedRateService({
    name,
    description,
    catalogCategory = CATALOG_CATEGORIES.PMS,
    pricesByCategory = {},
    sortOrder,
  } = {}) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return { success: false, error: 'Service description is required.' };
    const category = normalizeCatalogCategory(catalogCategory);

    const catalog = await this.loadCatalog({ includeInactive: true });
    const categories = catalog.categories?.length ? catalog.categories : DEFAULT_CC_CATEGORIES;
    const nextSort =
      Number.isFinite(Number(sortOrder)) && Number(sortOrder) > 0
        ? Number(sortOrder)
        : Math.max(0, ...(catalog.services || []).map((s) => Number(s.sortOrder || 0))) + 1;

    const priceRows = [];
    for (const cat of categories) {
      const input = pricesByCategory[cat.id];
      const normalized = this.normalizePriceInput(input);
      if (!normalized.ok) {
        return { success: false, error: `${cat.name}: ${normalized.error}` };
      }
      priceRows.push({
        category_id: cat.id,
        price_php: normalized.available ? normalized.price : null,
        is_available: normalized.available,
      });
    }

    const serviceId = this.slugifyServiceId(cleanName);
    const client = supabaseManager.getClient?.() || supabaseManager.client;
    if (!client) {
      return { success: false, error: 'Database is unavailable. Could not save the fixed rate.' };
    }

    const insertRow = {
      id: serviceId,
      name: cleanName,
      sort_order: nextSort,
      is_active: true,
      catalog_category: category,
    };
    if (description != null && String(description).trim()) {
      insertRow.description = String(description).trim();
    }

    const { error: svcErr } = await client.from('pms_services').insert([insertRow]);
    if (svcErr) {
      return { success: false, error: svcErr.message || 'Could not create service.' };
    }

    const { error: priceErr } = await client.from('pms_service_prices').insert(
      priceRows.map((row) => ({
        service_id: serviceId,
        category_id: row.category_id,
        price_php: row.price_php,
        is_available: row.is_available,
      }))
    );
    if (priceErr) {
      try {
        await client.from('pms_services').delete().eq('id', serviceId);
      } catch (_e) {}
      return { success: false, error: priceErr.message || 'Could not save CC category prices.' };
    }

    this.invalidateCache();
    const refreshed = await this.loadCatalog({ forceRefresh: true, includeInactive: true });
    const created = (refreshed.services || []).find((s) => s.id === serviceId) || {
      id: serviceId,
      name: cleanName,
      sortOrder: nextSort,
      catalogCategory: category,
      prices: Object.fromEntries(
        priceRows.map((r) => [r.category_id, r.is_available ? r.price_php : null])
      ),
    };

    return { success: true, service: created, catalog: refreshed };
  },

  /**
   * Update an existing fixed-rate service name, category, description, and/or per-CC prices.
   */
  async updateFixedRateService(
    serviceId,
    { name, description, catalogCategory, pricesByCategory, isActive } = {}
  ) {
    const id = String(serviceId || '').trim();
    if (!id) return { success: false, error: 'Service id is required.' };

    const client = supabaseManager.getClient?.() || supabaseManager.client;
    if (!client) {
      return { success: false, error: 'Database is unavailable. Could not update the fixed rate.' };
    }

    const cleanName = name != null ? String(name).trim() : null;
    if (cleanName !== null && !cleanName) {
      return { success: false, error: 'Service description is required.' };
    }

    const patch = { updated_at: new Date().toISOString() };
    if (cleanName) patch.name = cleanName;
    if (description !== undefined) {
      patch.description = description == null ? null : String(description).trim();
    }
    if (catalogCategory !== undefined) {
      patch.catalog_category = normalizeCatalogCategory(catalogCategory);
    }
    if (isActive !== undefined) {
      patch.is_active = !!isActive;
    }

    if (Object.keys(patch).length > 1) {
      const { error } = await client.from('pms_services').update(patch).eq('id', id);
      if (error) return { success: false, error: error.message || 'Could not update service.' };
    }

    if (pricesByCategory && typeof pricesByCategory === 'object') {
      const catalog = await this.loadCatalog({ includeInactive: true });
      const categories = catalog.categories?.length ? catalog.categories : DEFAULT_CC_CATEGORIES;
      for (const cat of categories) {
        if (!(cat.id in pricesByCategory)) continue;
        const normalized = this.normalizePriceInput(pricesByCategory[cat.id]);
        if (!normalized.ok) {
          return { success: false, error: `${cat.name}: ${normalized.error}` };
        }
        const { error } = await client.from('pms_service_prices').upsert(
          [
            {
              service_id: id,
              category_id: cat.id,
              price_php: normalized.available ? normalized.price : null,
              is_available: normalized.available,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'service_id,category_id' }
        );
        if (error) {
          return { success: false, error: error.message || `Could not update price for ${cat.name}.` };
        }
      }
    }

    this.invalidateCache();
    const refreshed = await this.loadCatalog({ forceRefresh: true, includeInactive: true });
    const updated = (refreshed.services || []).find((s) => s.id === id) || null;
    return { success: true, service: updated, catalog: refreshed };
  },

  /** Soft-deactivate (archive) a service so it cannot be booked. */
  async setServiceActive(serviceId, isActive) {
    return this.updateFixedRateService(serviceId, { isActive: !!isActive });
  },

  /**
   * Update CC tier ranges (min/max). Validates non-overlap before writing.
   * updates: [{ id, name?, minCc, maxCc }]
   */
  async updateCcCategoryRanges(updates = []) {
    const list = Array.isArray(updates) ? updates : [];
    if (!list.length) return { success: false, error: 'No CC category updates provided.' };

    const catalog = await this.loadCatalog({ includeInactive: true, forceRefresh: true });
    const byId = new Map((catalog.categories || []).map((c) => [c.id, { ...c }]));

    for (const u of list) {
      const id = String(u.id || '').trim();
      if (!id || !byId.has(id)) {
        return { success: false, error: `Unknown CC category "${id}".` };
      }
      const current = byId.get(id);
      byId.set(id, {
        ...current,
        name: u.name != null ? String(u.name).trim() : current.name,
        minCc: u.minCc !== undefined ? Number(u.minCc) : current.minCc,
        maxCc: u.maxCc !== undefined ? (u.maxCc == null || u.maxCc === '' ? null : Number(u.maxCc)) : current.maxCc,
      });
    }

    const nextCategories = [...byId.values()];
    const rangeCheck = validateCcCategoryRanges(nextCategories);
    if (!rangeCheck.ok) {
      return { success: false, error: rangeCheck.error };
    }

    const client = supabaseManager.getClient?.() || supabaseManager.client;
    if (!client) {
      return { success: false, error: 'Database is unavailable. Could not update CC ranges.' };
    }

    for (const u of list) {
      const id = String(u.id || '').trim();
      const row = byId.get(id);
      const { error } = await client
        .from('cc_categories')
        .update({
          name: row.name,
          min_cc: row.minCc,
          max_cc: row.maxCc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) {
        return { success: false, error: error.message || `Could not update ${row.name}.` };
      }
    }

    this.invalidateCache();
    const refreshed = await this.loadCatalog({ forceRefresh: true, includeInactive: true });
    return { success: true, catalog: refreshed, categories: refreshed.categories };
  },

  parseEngineCc,
  validateCcCategoryRanges,
  normalizeCatalogCategory,
};

export default pmsPricingService;
