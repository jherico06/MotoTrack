import { supabaseManager } from '../../lib/supabase.js';
import { appStorage } from '../system/storageAdapter.js';

export const PROMO_TYPES = {
  FREE_SHIPPING: 'FREE_SHIPPING',
  PERCENT_OFF: 'PERCENT_OFF',
  FREE_INSTALLATION: 'FREE_INSTALLATION',
};

export const APPLIES_TO = {
  ALL_PRODUCTS: 'ALL_PRODUCTS',
  SELECTED_PRODUCTS: 'SELECTED_PRODUCTS',
};

const STORAGE_KEY = 'mototrack_promos_db_v2';
let promosFetchCache = null;
const PROMOS_FETCH_TTL_MS = 15000;

const DEFAULT_PROMOS = [
  {
    promo_id: 'prm-1',
    code: 'TRACK10',
    promoType: PROMO_TYPES.PERCENT_OFF,
    discountPercent: 10,
    description: '10% Off Superbike Parts',
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80',
    appliesTo: APPLIES_TO.ALL_PRODUCTS,
    productIds: [],
    startDate: null,
    endDate: null,
    usageLimit: null,
    usageCount: 0,
    minimumOrderAmount: null,
    isActive: true,
  },
  {
    promo_id: 'prm-freeship',
    code: 'FREESHIP',
    promoType: PROMO_TYPES.FREE_SHIPPING,
    discountPercent: 0,
    description: 'Free Shipping Promo',
    imageUrl: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80',
    appliesTo: APPLIES_TO.ALL_PRODUCTS,
    productIds: [],
    startDate: null,
    endDate: null,
    usageLimit: 100,
    usageCount: 0,
    minimumOrderAmount: null,
    isActive: true,
  },
];

function generatePromoId() {
  return `prm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function toIsoDateStart(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toIsoDateEnd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function parseDateOnly(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function formatValidityRange(startDate, endDate) {
  const fmt = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };
  const start = fmt(startDate);
  const end = fmt(endDate);
  if (start && end) return `${start} - ${end}`;
  if (start && !end) return `From ${start}`;
  if (!start && end) return `Until ${end}`;
  return 'No expiry';
}

function productIdOf(item) {
  return String(
    item?.product?.id ||
      item?.product?.product_id ||
      item?.product_id ||
      item?.id ||
      ''
  ).trim();
}

function lineSubtotal(item) {
  const qty = Number(item?.quantity || 1);
  const price = Number(item?.product?.price ?? item?.price ?? 0);
  return Math.max(0, price * qty);
}

function normalizePromo(row, productIds = []) {
  if (!row) return null;
  const promoType =
    row.promo_type ||
    row.promoType ||
    (String(row.description || '').toLowerCase().includes('free shipping')
      ? PROMO_TYPES.FREE_SHIPPING
      : PROMO_TYPES.PERCENT_OFF);
  const appliesTo = row.applies_to || row.appliesTo || APPLIES_TO.ALL_PRODUCTS;
  const ids = Array.isArray(productIds)
    ? productIds.map(String)
    : Array.isArray(row.productIds)
      ? row.productIds.map(String)
      : Array.isArray(row.product_ids)
        ? row.product_ids.map(String)
        : [];

  return {
    id: row.promo_id || row.id,
    promo_id: row.promo_id || row.id,
    code: String(row.code || '').toUpperCase(),
    promoType,
    discountPercent:
      promoType === PROMO_TYPES.FREE_SHIPPING || promoType === PROMO_TYPES.FREE_INSTALLATION
        ? 0
        : Math.min(100, Math.max(0, Number(row.discount_percent ?? row.discountPercent ?? 0))),
    description: row.description || '',
    imageUrl: row.image_url || row.imageUrl || row.banner_image || row.bannerImage || '',
    appliesTo,
    productIds: appliesTo === APPLIES_TO.SELECTED_PRODUCTS ? ids : [],
    startDate: row.start_date || row.startDate || null,
    endDate: row.end_date || row.endDate || null,
    usageLimit:
      row.usage_limit != null
        ? Number(row.usage_limit)
        : row.usageLimit != null
          ? Number(row.usageLimit)
          : null,
    usageCount: Number(row.used_count ?? row.usageCount ?? 0),
    minimumOrderAmount:
      row.minimum_order_amount != null
        ? Number(row.minimum_order_amount)
        : row.minimumOrderAmount != null
          ? Number(row.minimumOrderAmount)
          : null,
    isActive: row.is_active != null ? Boolean(row.is_active) : Boolean(row.isActive),
    status: row.status || (row.is_active || row.isActive ? 'active' : 'inactive'),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

function promoTypeLabel(type) {
  if (type === PROMO_TYPES.FREE_SHIPPING) return 'Free Shipping';
  if (type === PROMO_TYPES.FREE_INSTALLATION) return 'Free Installation';
  return 'Percentage Off';
}

function appliesToLabel(promo) {
  if (promo.appliesTo === APPLIES_TO.ALL_PRODUCTS) return 'All Products';
  const count = (promo.productIds || []).length;
  return count === 1 ? '1 Selected Product' : `${count} Selected Products`;
}

function discountLabel(promo) {
  if (promo.promoType === PROMO_TYPES.FREE_SHIPPING) return 'Free Shipping';
  if (promo.promoType === PROMO_TYPES.FREE_INSTALLATION) return 'Free Installation';
  return `${promo.discountPercent}% OFF`;
}

function invalidateCache() {
  promosFetchCache = null;
}

function persistLocal(list) {
  try {
    appStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

async function fetchPromoProductMap(client, promoIds) {
  if (!client || !promoIds?.length) return {};
  const { data, error } = await client
    .from('promo_products')
    .select('promo_id, product_id')
    .in('promo_id', promoIds);
  if (error) {
    console.warn('promo_products fetch:', error.message || error);
    return {};
  }
  const map = {};
  for (const row of data || []) {
    if (!map[row.promo_id]) map[row.promo_id] = [];
    map[row.promo_id].push(String(row.product_id));
  }
  return map;
}

async function syncPromoProducts(client, promoId, appliesTo, productIds) {
  if (!client || !promoId) return;
  await client.from('promo_products').delete().eq('promo_id', promoId);
  if (appliesTo !== APPLIES_TO.SELECTED_PRODUCTS) return;
  const unique = [...new Set((productIds || []).map(String).filter(Boolean))];
  if (!unique.length) return;
  const rows = unique.map((product_id) => ({ promo_id: promoId, product_id }));
  const { error } = await client.from('promo_products').insert(rows);
  if (error) console.warn('promo_products insert:', error.message || error);
}

function validateAdminPayload(payload, { existingCode = null, excludePromoId = null } = {}) {
  const errors = {};
  const code = String(payload.code || '').trim().toUpperCase();
  const promoType =
    payload.promoType ||
    payload.promo_type ||
    (payload.discountPercent != null || payload.discount_percent != null
      ? PROMO_TYPES.PERCENT_OFF
      : null);
  const appliesTo = payload.appliesTo || payload.applies_to || APPLIES_TO.ALL_PRODUCTS;
  const productIds = payload.productIds || payload.product_ids || [];
  const discountPercent = Number(payload.discountPercent ?? payload.discount_percent ?? 0);
  const startDate = payload.startDate || payload.start_date || null;
  const endDate = payload.endDate || payload.end_date || null;
  const usageLimitRaw = payload.usageLimit ?? payload.usage_limit;
  const minOrderRaw = payload.minimumOrderAmount ?? payload.minimum_order_amount;

  if (!code) errors.code = 'Promo code cannot be empty.';
  if (code && existingCode && code !== String(existingCode).toUpperCase() && excludePromoId) {
    // uniqueness handled by caller against list / DB
  }

  if (
    !promoType ||
    ![PROMO_TYPES.FREE_SHIPPING, PROMO_TYPES.PERCENT_OFF, PROMO_TYPES.FREE_INSTALLATION].includes(
      promoType
    )
  ) {
    errors.promoType = 'Promo type must be selected.';
  }

  if (promoType === PROMO_TYPES.PERCENT_OFF) {
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
      errors.discountPercent = 'Percentage discount is required and must be greater than 0.';
    } else if (discountPercent > 100) {
      errors.discountPercent = 'Percentage must be no more than 100.';
    }
  }

  // Free Installation is intended for specific catalog products
  const resolvedAppliesTo =
    promoType === PROMO_TYPES.FREE_INSTALLATION
      ? APPLIES_TO.SELECTED_PRODUCTS
      : appliesTo;
  if (
    promoType === PROMO_TYPES.FREE_INSTALLATION &&
    appliesTo !== APPLIES_TO.SELECTED_PRODUCTS &&
    (!productIds || productIds.length === 0)
  ) {
    errors.appliesTo = 'Free Installation promos must target selected products.';
  }

  if (
    (appliesTo === APPLIES_TO.SELECTED_PRODUCTS ||
      promoType === PROMO_TYPES.FREE_INSTALLATION) &&
    (!productIds || productIds.length === 0)
  ) {
    errors.productIds = 'Select at least one product for this promo.';
  }

  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s > e) {
      errors.endDate = 'Start date cannot be after the end date.';
    }
  }

  if (usageLimitRaw !== '' && usageLimitRaw != null && usageLimitRaw !== undefined) {
    const ul = Number(usageLimitRaw);
    if (!Number.isFinite(ul) || ul < 0) {
      errors.usageLimit = 'Usage limit cannot be negative.';
    }
  }

  if (minOrderRaw !== '' && minOrderRaw != null && minOrderRaw !== undefined) {
    const mo = Number(minOrderRaw);
    if (!Number.isFinite(mo) || mo < 0) {
      errors.minimumOrderAmount = 'Minimum order amount cannot be negative.';
    }
  }

  const imageUrl = String(
    payload.imageUrl || payload.image_url || payload.bannerImage || payload.banner_image || ''
  ).trim();

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      code,
      promoType,
      appliesTo: resolvedAppliesTo,
      productIds:
        resolvedAppliesTo === APPLIES_TO.SELECTED_PRODUCTS
          ? [...new Set(productIds.map(String))]
          : [],
      discountPercent:
        promoType === PROMO_TYPES.FREE_SHIPPING || promoType === PROMO_TYPES.FREE_INSTALLATION
          ? 0
          : discountPercent,
      description: String(payload.description || '').trim(),
      imageUrl,
      startDate: toIsoDateStart(startDate),
      endDate: toIsoDateEnd(endDate),
      usageLimit:
        usageLimitRaw === '' || usageLimitRaw == null || usageLimitRaw === undefined
          ? null
          : Number(usageLimitRaw),
      minimumOrderAmount:
        minOrderRaw === '' || minOrderRaw == null || minOrderRaw === undefined
          ? null
          : Number(minOrderRaw),
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    },
  };
}

function isWithinDateWindow(promo, now = new Date()) {
  if (promo.startDate) {
    const start = new Date(promo.startDate);
    if (!Number.isNaN(start.getTime()) && now < start) {
      return { ok: false, error: 'This promo is not active yet.' };
    }
  }
  if (promo.endDate) {
    const end = new Date(promo.endDate);
    if (!Number.isNaN(end.getTime()) && now > end) {
      return { ok: false, error: 'Promo code has expired.' };
    }
  }
  return { ok: true };
}

function eligibleCartItems(promo, cartItems = []) {
  const items = Array.isArray(cartItems) ? cartItems : [];
  if (promo.appliesTo === APPLIES_TO.ALL_PRODUCTS) return items;
  const allowed = new Set((promo.productIds || []).map(String));
  return items.filter((item) => allowed.has(productIdOf(item)));
}

function calculatePromoImpact(promo, cartItems = [], shippingFee = 0) {
  const eligible = eligibleCartItems(promo, cartItems);
  const eligibleSubtotal = eligible.reduce((sum, item) => sum + lineSubtotal(item), 0);
  const cartSubtotal = (cartItems || []).reduce((sum, item) => sum + lineSubtotal(item), 0);

  let productDiscount = 0;
  let shippingDiscount = 0;
  let freeShipping = false;

  let freeInstallation = false;

  if (promo.promoType === PROMO_TYPES.PERCENT_OFF) {
    const pct = Math.min(100, Math.max(0, Number(promo.discountPercent || 0)));
    productDiscount = (eligibleSubtotal * pct) / 100;
  } else if (promo.promoType === PROMO_TYPES.FREE_SHIPPING) {
    if (eligible.length > 0) {
      freeShipping = true;
      shippingDiscount = Math.max(0, Number(shippingFee || 0));
    }
  } else if (promo.promoType === PROMO_TYPES.FREE_INSTALLATION) {
    freeInstallation = eligible.length > 0;
  }

  return {
    eligibleItems: eligible,
    eligibleCount: eligible.length,
    eligibleSubtotal,
    cartSubtotal,
    productDiscount,
    shippingDiscount,
    freeShipping,
    freeInstallation,
    discountPercent:
      promo.promoType === PROMO_TYPES.PERCENT_OFF ? Number(promo.discountPercent || 0) : 0,
  };
}

export const promoService = {
  PROMO_TYPES,
  APPLIES_TO,
  promoTypeLabel,
  appliesToLabel,
  discountLabel,
  formatValidityRange,
  parseDateOnly,
  validateAdminPayload,
  calculatePromoImpact,
  eligibleCartItems,

  async getPromos({ force = false } = {}) {
    if (!force && promosFetchCache && Date.now() - promosFetchCache.at < PROMOS_FETCH_TTL_MS) {
      return promosFetchCache.data;
    }

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('promos')
          .select(
            'promo_id,code,discount_percent,description,image_url,is_active,status,usage_limit,used_count,start_date,end_date,promo_type,applies_to,minimum_order_amount,created_at,updated_at'
          )
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const map = await fetchPromoProductMap(
            client,
            data.map((p) => p.promo_id)
          );
          const normalized = data.map((item) => normalizePromo(item, map[item.promo_id] || []));
          persistLocal(normalized);
          promosFetchCache = { at: Date.now(), data: normalized };
          return normalized;
        }
        if (error) console.warn('Supabase promos fetch error:', error.message || error);
      }
    } catch (e) {
      console.warn('Supabase promos fetch note:', e);
    }

    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((p) => normalizePromo(p, p.productIds || []));
          promosFetchCache = { at: Date.now(), data: normalized };
          return normalized;
        }
      }
    } catch {
      /* ignore */
    }

    try {
      persistLocal(DEFAULT_PROMOS);
    } catch {
      /* ignore */
    }
    return DEFAULT_PROMOS.map((p) => normalizePromo(p, p.productIds));
  },

  async getPromoByCode(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return null;
    const list = await this.getPromos();
    return list.find((p) => p.code === clean) || null;
  },

  async getPromoById(promoId) {
    if (!promoId) return null;
    const list = await this.getPromos();
    return list.find((p) => p.promo_id === promoId || p.id === promoId) || null;
  },

  async addPromo(payload) {
    invalidateCache();
    const current = await this.getPromos({ force: true });
    const check = validateAdminPayload(payload);
    if (!check.valid) return { success: false, errors: check.errors };

    const dup = current.find((p) => p.code === check.normalized.code);
    if (dup) {
      return { success: false, errors: { code: 'Promo code must be unique.' } };
    }

    const promoId = generatePromoId();
    const n = check.normalized;
    const newPromo = normalizePromo(
      {
        promo_id: promoId,
        code: n.code,
        promo_type: n.promoType,
        discount_percent: n.discountPercent,
        description:
          n.description ||
          (n.promoType === PROMO_TYPES.FREE_SHIPPING
            ? 'Free Shipping Promo'
            : n.promoType === PROMO_TYPES.FREE_INSTALLATION
              ? 'Free Installation Promo'
              : `${n.discountPercent}% OFF`),
        image_url: n.imageUrl || null,
        applies_to: n.appliesTo,
        start_date: n.startDate || new Date().toISOString(),
        end_date: n.endDate,
        usage_limit: n.usageLimit,
        used_count: 0,
        minimum_order_amount: n.minimumOrderAmount,
        is_active: n.isActive,
        status: n.isActive ? 'active' : 'inactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      n.productIds
    );

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error } = await client.from('promos').upsert([
          {
            promo_id: promoId,
            code: newPromo.code,
            promo_type: newPromo.promoType,
            discount_percent: newPromo.discountPercent,
            description: newPromo.description,
            image_url: newPromo.imageUrl || null,
            applies_to: newPromo.appliesTo,
            start_date: newPromo.startDate || new Date().toISOString(),
            end_date: newPromo.endDate,
            usage_limit: newPromo.usageLimit,
            used_count: 0,
            minimum_order_amount: newPromo.minimumOrderAmount,
            is_active: newPromo.isActive,
            status: newPromo.isActive ? 'active' : 'inactive',
          },
        ]);
        if (error) {
          if (/unique|duplicate/i.test(error.message || '')) {
            return { success: false, errors: { code: 'Promo code must be unique.' } };
          }
          console.warn('Supabase promo insert error:', error.message || error);
        } else {
          await syncPromoProducts(client, promoId, newPromo.appliesTo, newPromo.productIds);
        }
      }
    } catch (e) {
      console.warn('Supabase promo insert note:', e);
    }

    const updated = [newPromo, ...current.filter((p) => p.code !== newPromo.code)];
    persistLocal(updated);
    promosFetchCache = { at: Date.now(), data: updated };
    return { success: true, promo: newPromo };
  },

  async updatePromo(promoIdOrCode, updates = {}) {
    const isStatusOnly =
      updates.isActive !== undefined &&
      Object.keys(updates).every((k) => ['isActive', 'is_active', 'status'].includes(k));

    // Status toggles: use cache when possible — avoid a full force-refetch + product sync.
    let current;
    if (isStatusOnly && promosFetchCache?.data?.length) {
      current = promosFetchCache.data;
    } else {
      invalidateCache();
      current = await this.getPromos({ force: true });
    }

    const existing = current.find(
      (p) =>
        p.promo_id === promoIdOrCode ||
        p.id === promoIdOrCode ||
        p.code === String(promoIdOrCode || '').toUpperCase()
    );
    if (!existing) return { success: false, error: 'Promo not found.' };

    if (isStatusOnly) {
      const isActive = Boolean(updates.isActive ?? updates.is_active);
      return this._persistStatusOnly(existing, isActive, current);
    }

    const mergedPayload = {
      code: updates.code ?? existing.code,
      description: updates.description ?? existing.description,
      imageUrl:
        updates.imageUrl !== undefined
          ? updates.imageUrl
          : updates.image_url !== undefined
            ? updates.image_url
            : existing.imageUrl,
      promoType: updates.promoType ?? updates.promo_type ?? existing.promoType,
      discountPercent:
        updates.discountPercent ?? updates.discount_percent ?? existing.discountPercent,
      appliesTo: updates.appliesTo ?? updates.applies_to ?? existing.appliesTo,
      productIds: updates.productIds ?? updates.product_ids ?? existing.productIds,
      startDate: updates.startDate ?? updates.start_date ?? existing.startDate,
      endDate: updates.endDate ?? updates.end_date ?? existing.endDate,
      usageLimit: updates.usageLimit ?? updates.usage_limit ?? existing.usageLimit,
      minimumOrderAmount:
        updates.minimumOrderAmount ??
        updates.minimum_order_amount ??
        existing.minimumOrderAmount,
      isActive:
        updates.isActive !== undefined
          ? updates.isActive
          : updates.is_active !== undefined
            ? updates.is_active
            : existing.isActive,
    };

    const check = validateAdminPayload(mergedPayload, {
      excludePromoId: existing.promo_id,
      existingCode: existing.code,
    });
    if (!check.valid) return { success: false, errors: check.errors };

    const dup = current.find(
      (p) => p.code === check.normalized.code && p.promo_id !== existing.promo_id
    );
    if (dup) {
      return { success: false, errors: { code: 'Promo code must be unique.' } };
    }

    const n = check.normalized;
    const next = normalizePromo(
      {
        ...existing,
        promo_id: existing.promo_id,
        code: n.code,
        promo_type: n.promoType,
        discount_percent: n.discountPercent,
        description:
          n.description ||
          (n.promoType === PROMO_TYPES.FREE_SHIPPING
            ? 'Free Shipping Promo'
            : n.promoType === PROMO_TYPES.FREE_INSTALLATION
              ? 'Free Installation Promo'
              : `${n.discountPercent}% OFF`),
        image_url: n.imageUrl !== undefined ? n.imageUrl : existing.imageUrl,
        applies_to: n.appliesTo,
        start_date: n.startDate || existing.startDate,
        end_date: n.endDate,
        usage_limit: n.usageLimit,
        used_count: existing.usageCount,
        minimum_order_amount: n.minimumOrderAmount,
        is_active: n.isActive,
        status: n.isActive ? 'active' : 'inactive',
        updated_at: new Date().toISOString(),
        created_at: existing.createdAt,
      },
      n.productIds
    );

    return this._persistUpdate(existing, next);
  },

  async _persistStatusOnly(existing, isActive, currentList) {
    const next = {
      ...existing,
      isActive,
      status: isActive ? 'active' : 'inactive',
      updatedAt: new Date().toISOString(),
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error } = await client
          .from('promos')
          .update({
            is_active: isActive,
            status: isActive ? 'active' : 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('promo_id', existing.promo_id);

        if (error) {
          console.warn('Supabase promo status update error:', error.message || error);
          return { success: false, error: error.message || 'Failed to update promo status.' };
        }
      }
    } catch (e) {
      console.warn('Supabase promo status update note:', e);
      return { success: false, error: e?.message || 'Failed to update promo status.' };
    }

    const base = Array.isArray(currentList) ? currentList : promosFetchCache?.data || [];
    const finalList = base.map((p) => (p.promo_id === existing.promo_id ? next : p));
    persistLocal(finalList);
    promosFetchCache = { at: Date.now(), data: finalList };
    return { success: true, promo: next };
  },

  async _persistUpdate(existing, next) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error } = await client
          .from('promos')
          .update({
            code: next.code,
            promo_type: next.promoType,
            discount_percent: next.discountPercent,
            description: next.description,
            image_url: next.imageUrl || null,
            applies_to: next.appliesTo,
            start_date: next.startDate || existing.startDate || new Date().toISOString(),
            end_date: next.endDate,
            usage_limit: next.usageLimit,
            minimum_order_amount: next.minimumOrderAmount,
            is_active: next.isActive,
            status: next.isActive ? 'active' : 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('promo_id', existing.promo_id);

        if (error) {
          if (/unique|duplicate/i.test(error.message || '')) {
            return { success: false, errors: { code: 'Promo code must be unique.' } };
          }
          console.warn('Supabase promo update error:', error.message || error);
        } else {
          await syncPromoProducts(client, existing.promo_id, next.appliesTo, next.productIds);
        }
      }
    } catch (e) {
      console.warn('Supabase promo update note:', e);
    }

    const cached = promosFetchCache?.data;
    const current = Array.isArray(cached) ? cached : await this.getPromos({ force: true });
    const updated = current.map((p) => (p.promo_id === existing.promo_id ? next : p));
    const ensured = updated.some((p) => p.promo_id === existing.promo_id)
      ? updated
      : [next, ...updated];
    const finalList = ensured.map((p) => (p.promo_id === existing.promo_id ? next : p));
    persistLocal(finalList);
    promosFetchCache = { at: Date.now(), data: finalList };
    return { success: true, promo: next };
  },

  async deletePromo(codeOrId) {
    invalidateCache();
    const clean = String(codeOrId || '').trim();
    const current = await this.getPromos({ force: true });
    const target = current.find(
      (p) => p.promo_id === clean || p.id === clean || p.code === clean.toUpperCase()
    );
    if (!target) return { success: false, error: 'Promo not found.' };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('promo_products').delete().eq('promo_id', target.promo_id);
        await client.from('promos').delete().eq('promo_id', target.promo_id);
      }
    } catch (e) {
      console.warn('Supabase promo delete note:', e);
    }

    const updated = current.filter((p) => p.promo_id !== target.promo_id);
    persistLocal(updated);
    promosFetchCache = { at: Date.now(), data: updated };
    return { success: true };
  },

  /**
   * Validate a promo for customer checkout / cart.
   * Pass cartItems for eligibility + minimum order checks.
   */
  async validatePromo(inputCode, { cartItems = [], shippingFee = 0 } = {}) {
    const clean = String(inputCode || '').trim().toUpperCase();
    if (!clean) {
      return { valid: false, discountPercent: 0, error: 'Please enter a promo code.' };
    }

    const promos = await this.getPromos({ force: true });
    const match = promos.find((p) => p.code === clean);

    if (!match) {
      return { valid: false, discountPercent: 0, error: 'Promo code is invalid.' };
    }

    if (!match.isActive) {
      return { valid: false, discountPercent: 0, error: 'Promo code is inactive.' };
    }

    const dateCheck = isWithinDateWindow(match);
    if (!dateCheck.ok) {
      return { valid: false, discountPercent: 0, error: dateCheck.error };
    }

    if (
      match.usageLimit != null &&
      Number.isFinite(Number(match.usageLimit)) &&
      Number(match.usageCount || 0) >= Number(match.usageLimit)
    ) {
      return { valid: false, discountPercent: 0, error: 'Promo usage limit has been reached.' };
    }

    const impact = calculatePromoImpact(match, cartItems, shippingFee);

    if ((cartItems || []).length > 0 && impact.eligibleCount === 0) {
      return {
        valid: false,
        discountPercent: 0,
        error: 'This promo does not apply to the products in your cart.',
      };
    }

    if (
      match.minimumOrderAmount != null &&
      Number(match.minimumOrderAmount) > 0 &&
      impact.cartSubtotal < Number(match.minimumOrderAmount)
    ) {
      return {
        valid: false,
        discountPercent: 0,
        error: `Minimum order of ₱${Number(match.minimumOrderAmount).toFixed(0)} required.`,
      };
    }

    const successMessage =
      match.promoType === PROMO_TYPES.FREE_SHIPPING
        ? match.appliesTo === APPLIES_TO.SELECTED_PRODUCTS
          ? 'Promo applied successfully. Free Shipping applied to eligible products.'
          : 'Promo applied successfully.'
        : match.promoType === PROMO_TYPES.FREE_INSTALLATION
          ? 'Promo applied successfully. Installation fee waived for eligible products.'
          : 'Promo applied successfully.';

    return {
      valid: true,
      promoId: match.promo_id,
      code: match.code,
      description: match.description,
      promoType: match.promoType,
      appliesTo: match.appliesTo,
      productIds: match.productIds || [],
      discountPercent: impact.discountPercent,
      productDiscount: impact.productDiscount,
      shippingDiscount: impact.shippingDiscount,
      isFreeShipping: impact.freeShipping,
      isFreeInstallation: impact.freeInstallation,
      eligibleCount: impact.eligibleCount,
      message: successMessage,
    };
  },

  /**
   * Increment usage_count only after a successful order.
   */
  async incrementUsage(promoId) {
    if (!promoId) return { success: false };
    invalidateCache();

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('promos')
          .select('used_count')
          .eq('promo_id', promoId)
          .maybeSingle();
        if (!error) {
          const next = Number(data?.used_count || 0) + 1;
          await client
            .from('promos')
            .update({ used_count: next, updated_at: new Date().toISOString() })
            .eq('promo_id', promoId);
        }
      }
    } catch (e) {
      console.warn('Promo usage increment note:', e);
    }

    const current = await this.getPromos({ force: true });
    const updated = current.map((p) =>
      p.promo_id === promoId ? { ...p, usageCount: Number(p.usageCount || 0) + 1 } : p
    );
    persistLocal(updated);
    promosFetchCache = { at: Date.now(), data: updated };
    return { success: true };
  },

  /**
   * Find an active FREE_SHIPPING promo that applies to the given cart items.
   * Used for automatic shipping waiver when admin activates free shipping.
   */
  async findApplicableFreeShipping(cartItems = [], shippingFee = 0) {
    const items = Array.isArray(cartItems) ? cartItems : [];
    if (items.length === 0) return null;

    const promos = await this.getPromos({ force: false });
    const freeShipPromos = (promos || []).filter(
      (p) => p.isActive && p.promoType === PROMO_TYPES.FREE_SHIPPING
    );

    for (const promo of freeShipPromos) {
      const result = await this.validatePromo(promo.code, {
        cartItems: items,
        shippingFee,
      });
      if (result.valid && result.isFreeShipping) {
        return result;
      }
    }
    return null;
  },

  /**
   * Whether a single product is covered by any active free-shipping promo.
   */
  async productHasActiveFreeShipping(productId) {
    const pid = String(productId || '').trim();
    if (!pid) return false;
    const fakeCart = [{ product: { id: pid, product_id: pid, price: 1 }, quantity: 1 }];
    const match = await this.findApplicableFreeShipping(fakeCart, 150);
    return Boolean(match);
  },

  /**
   * Find an active FREE_INSTALLATION promo for the given product IDs.
   * Used when booking AI install / customization services.
   */
  async findApplicableFreeInstallation(productIds = []) {
    const ids = [...new Set((productIds || []).map(String).filter(Boolean))];
    if (!ids.length) return null;

    const cartItems = ids.map((pid) => ({
      product: { id: pid, product_id: pid, price: 1 },
      quantity: 1,
    }));

    const promos = await this.getPromos({ force: false });
    const installPromos = (promos || []).filter(
      (p) => p.isActive && p.promoType === PROMO_TYPES.FREE_INSTALLATION
    );

    for (const promo of installPromos) {
      const dateCheck = isWithinDateWindow(promo);
      if (!dateCheck.ok) continue;
      if (
        promo.usageLimit != null &&
        Number.isFinite(Number(promo.usageLimit)) &&
        Number(promo.usageCount || 0) >= Number(promo.usageLimit)
      ) {
        continue;
      }
      const impact = calculatePromoImpact(promo, cartItems, 0);
      if (impact.freeInstallation && impact.eligibleCount > 0) {
        return {
          valid: true,
          promoId: promo.promo_id,
          code: promo.code,
          description: promo.description,
          promoType: promo.promoType,
          productIds: promo.productIds || [],
          isFreeInstallation: true,
          eligibleCount: impact.eligibleCount,
          message: 'Free installation applies to this product.',
        };
      }
    }
    return null;
  },

  async productHasActiveFreeInstallation(productId) {
    const pid = String(productId || '').trim();
    if (!pid) return false;
    const match = await this.findApplicableFreeInstallation([pid]);
    return Boolean(match?.isFreeInstallation);
  },
};
