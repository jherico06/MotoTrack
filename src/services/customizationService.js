// =========================================================================
// MotoTrack Customization Service
// Source of truth: Supabase (products, inventory, product_compatibility,
// customizations). n8n is invoked only via Supabase Edge Functions so
// webhook secrets and AI keys never ship in the client bundle.
// =========================================================================

import { appStorage } from './storageAdapter.js';
import { supabaseManager } from './supabaseClient.js';
import { productService } from './productService.js';
import { MOTORCYCLE_CATALOG, matchesCustomizationCategory, getVehicleType, describePartForAi } from '../data/motorcycleCatalog.js';
import { formatPhp } from '../utils/currency.js';
import { geminiService } from './geminiService.js';
import { motorcycleService } from './motorcycleService.js';

const LOCAL_KEY = 'mototrack_customizations';
const LISTENERS = new Set();

function notify() {
  const snapshot = getLocalCustomizations();
  LISTENERS.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (_e) {}
  });
}

function getClient() {
  return supabaseManager.getClient();
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBike(bike = {}) {
  const brand = String(bike.brand || bike.motorcycle_brand || '').trim();
  const model = String(bike.model || bike.motorcycle_model || '').trim();
  return {
    motorcycleId: bike.motorcycle_id || bike.motorcycleId || bike.id || null,
    brand,
    model,
    year: bike.year != null ? Number(bike.year) : bike.motorcycle_year != null ? Number(bike.motorcycle_year) : null,
    photoUrl: bike.photo_url || bike.photoUrl || bike.image || bike.motorcycle_photo_url || null,
    nickname: bike.nickname || null,
    color: bike.color || bike.motorcycle_color || null,
    engineCc: bike.engine_cc || bike.engineCc || null,
    vehicleType: bike.category || bike.vehicleType || bike.motorcycle_type || getVehicleType(brand, model),
  };
}

function yearMatches(row, year) {
  if (year == null || Number.isNaN(Number(year))) return true;
  const y = Number(year);
  if (row.year_exact != null) return Number(row.year_exact) === y;
  const from = row.year_from != null ? Number(row.year_from) : null;
  const to = row.year_to != null ? Number(row.year_to) : null;
  if (from != null && y < from) return false;
  if (to != null && y > to) return false;
  return true;
}

function brandMatches(rowBrand, bikeBrand) {
  const a = String(rowBrand || '').toLowerCase();
  const b = String(bikeBrand || '').toLowerCase();
  if (!a || !b) return false;
  if (a === 'universal') return true;
  return a === b || a.includes(b) || b.includes(a);
}

function modelMatches(rowModel, bikeModel) {
  const a = String(rowModel || '').toLowerCase();
  const b = String(bikeModel || '').toLowerCase();
  if (!a || !b) return false;
  if (a === 'all models' || a === 'universal' || a.includes('compatible models')) return true;
  return a === b || a.includes(b) || b.includes(a);
}

function getLocalCustomizations() {
  try {
    const raw = appStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function saveLocalCustomizations(list) {
  appStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  notify();
}

function upsertLocal(customization) {
  const list = getLocalCustomizations();
  const idx = list.findIndex((c) => c.id === customization.id || c.customization_id === customization.customization_id);
  if (idx >= 0) list[idx] = customization;
  else list.unshift(customization);
  saveLocalCustomizations(list);
  return customization;
}

function removeLocal(id) {
  const list = getLocalCustomizations().filter(
    (c) => c.id !== id && c.customization_id !== id
  );
  saveLocalCustomizations(list);
}

function mapCustomizationRow(row, items = []) {
  if (!row) return null;
  const mappedItems = (items || []).map((it) => ({
    id: it.item_id,
    item_id: it.item_id,
    productId: it.product_id,
    product_id: it.product_id,
    quantity: Number(it.quantity) || 1,
    price: Number(it.price) || 0,
    name: it.product_name,
    brand: it.product_brand,
    category: it.product_category,
    size: it.size_label || '',
    color: it.color_label || '',
  }));
  const total = mappedItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1), 0);
  return {
    id: row.customization_id,
    customization_id: row.customization_id,
    customerId: row.customer_id,
    userId: row.user_id,
    motorcycleId: row.motorcycle_id,
    motorcycle: {
      motorcycle_id: row.motorcycle_id,
      brand: row.motorcycle_brand,
      model: row.motorcycle_model,
      year: row.motorcycle_year,
      photo_url: row.motorcycle_photo_url || null,
      color: row.motorcycle_color || null,
      category: row.motorcycle_type || null,
      vehicleType: row.motorcycle_type || getVehicleType(row.motorcycle_brand, row.motorcycle_model),
    },
    name: row.name,
    status: row.status,
    totalPrice: Number(row.total_price) || total,
    total_price: Number(row.total_price) || total,
    previewImageUrl: row.preview_image_url,
    preview_image_url: row.preview_image_url,
    previewPrompt: row.preview_prompt,
    compatibilityChecked: !!row.compatibility_checked,
    compatibilityOk: row.compatibility_ok,
    notes: row.notes,
    items: mappedItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const customizationService = {
  subscribe(fn) {
    LISTENERS.add(fn);
    return () => LISTENERS.delete(fn);
  },

  formatMoney(amount) {
    return formatPhp(amount);
  },

  getMotorcycleCatalog() {
    return MOTORCYCLE_CATALOG;
  },

  // ── Motorcycles API (catalog + garage) ─────────────────────────────────
  async getMotorcycles({ customerId, userId } = {}) {
    const catalog = MOTORCYCLE_CATALOG.flatMap((brandEntry) =>
      brandEntry.models.flatMap((m) =>
        m.years.map((year) => ({
          id: `catalog-${brandEntry.brand}-${m.model}-${year}`.replace(/\s+/g, '-').toLowerCase(),
          brand: brandEntry.brand,
          model: m.model,
          year,
          category: m.category,
          source: 'catalog',
        }))
      )
    );

    let garage = [];
    try {
      const client = getClient();
      if (client) {
        let q = client
          .from('customer_motorcycles')
          .select(
            'motorcycle_id,user_id,customer_id,customer_email,brand,model,year,plate_number,engine_cc,color,odometer,nickname,is_primary,photo_url,created_at'
          )
          .order('created_at', { ascending: false });
        if (userId) q = q.eq('user_id', userId);
        else if (customerId) q = q.eq('customer_id', customerId);
        const { data } = await q.limit(100);
        garage = (data || []).map((b) => ({
          id: b.motorcycle_id,
          motorcycle_id: b.motorcycle_id,
          brand: b.brand,
          model: b.model,
          year: b.year,
          photo_url: b.photo_url,
          nickname: b.nickname,
          color: b.color,
          engine_cc: b.engine_cc,
          source: 'garage',
          is_primary: b.is_primary,
        }));
      }
    } catch (_e) {}

    return { garage, catalog, brands: MOTORCYCLE_CATALOG.map((b) => b.brand) };
  },

  async getMotorcycleById(id) {
    if (!id) return null;
    const client = getClient();
    if (client && !String(id).startsWith('catalog-')) {
      const { data } = await client.from('customer_motorcycles').select('*').eq('motorcycle_id', id).maybeSingle();
      if (data) return { ...data, id: data.motorcycle_id, source: 'garage' };
    }
    const all = await this.getMotorcycles();
    return all.catalog.find((m) => m.id === id) || all.garage.find((m) => m.id === id) || null;
  },

  // ── Compatibility (DB only — never AI) ─────────────────────────────────
  async getProductCompatibilityRows(productIds = []) {
    const client = getClient();
    if (!client || !productIds.length) return [];
    const { data, error } = await client
      .from('product_compatibility')
      .select('compatibility_id,product_id,brand,model,year_from,year_to,year_exact,notes')
      .in('product_id', productIds);
    if (error) {
      console.warn('[customization] compatibility fetch:', error.message);
      return [];
    }
    return data || [];
  },

  isProductCompatibleWithBike(compatRows, productId, bike, product = null) {
    const rows = (compatRows || []).filter((r) => r.product_id === productId);
    const hit = rows.find(
      (r) =>
        brandMatches(r.brand, bike.brand) &&
        modelMatches(r.model, bike.model) &&
        yearMatches(r, bike.year)
    );
    if (hit) {
      return { compatible: true, match: hit };
    }

    // Free-text fallback from products.compatibility (Universal / brand mention)
    const text = String(product?.compatibility || '').toLowerCase();
    if (text) {
      if (text.includes('universal')) {
        return { compatible: true, match: { source: 'text-universal' } };
      }
      const brand = String(bike.brand || '').toLowerCase();
      const model = String(bike.model || '').toLowerCase();
      if (brand && text.includes(brand) && (!model || text.includes(model.split(' ')[0]))) {
        return { compatible: true, match: { source: 'text-brand' } };
      }
    }

    // No structured row and no usable free-text → not marked compatible
    return {
      compatible: false,
      reason: 'This product is not marked as compatible with your selected motorcycle.',
    };
  },

  async checkCompatibility({ customerId, motorcycleId, motorcycle, productIds = [] }) {
    const bike =
      normalizeBike(motorcycle) ||
      normalizeBike(motorcycleId ? await this.getMotorcycleById(motorcycleId) : null);

    if (!bike?.brand || !bike?.model) {
      return {
        compatible: false,
        items: [],
        errors: [{ code: 'invalid_motorcycle', message: 'Please select a valid motorcycle.' }],
      };
    }

    const ids = [...new Set((productIds || []).filter(Boolean))];
    if (!ids.length) {
      return { compatible: true, items: [], errors: [], motorcycle: bike };
    }

    // Prefer edge/n8n automation when available; fall back to local DB check
    try {
      const client = getClient();
      if (client) {
        const { data, error } = await client.functions.invoke('customization-compatibility', {
          body: {
            customerId: customerId || null,
            motorcycleId: motorcycleId || bike.motorcycleId,
            motorcycle: bike,
            productIds: ids,
          },
        });
        if (!error && data && typeof data.compatible === 'boolean') {
          return data;
        }
      }
    } catch (_e) {}

    const products = await productService.getProducts();
    const byId = new Map((products || []).map((p) => [p.id || p.product_id, p]));
    const compatRows = await this.getProductCompatibilityRows(ids);
    const items = [];
    const errors = [];

    for (const pid of ids) {
      const product = byId.get(pid);
      if (!product) {
        items.push({ productId: pid, compatible: false, reason: 'Product not found.' });
        errors.push({ productId: pid, code: 'invalid_product', message: 'Product not found.' });
        continue;
      }
      const result = this.isProductCompatibleWithBike(compatRows, pid, bike, product);
      items.push({
        productId: pid,
        productName: product.name,
        brand: product.brand,
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0,
        compatible: result.compatible,
        reason: result.reason || null,
      });
      if (!result.compatible) {
        errors.push({
          productId: pid,
          code: 'incompatible',
          message: result.reason,
        });
      }
    }

    return {
      compatible: errors.length === 0,
      items,
      errors,
      motorcycle: bike,
    };
  },

  /**
   * Browse customization catalog for a motorcycle.
   * By default returns ALL matching-category products with a compatibility flag
   * so customers can see parts that exist but are not yet fitment-tagged.
   */
  async getCompatibleProducts(motorcycle, { category = 'All', search = '', compatibleOnly = false } = {}) {
    const bike = normalizeBike(motorcycle);
    if (!bike.brand || !bike.model) return [];

    const products = await productService.getProducts();
    const ids = (products || []).map((p) => p.id || p.product_id).filter(Boolean);
    const compatRows = await this.getProductCompatibilityRows(ids);
    const q = String(search || '').toLowerCase().trim();

    const mapped = (products || [])
      .filter((p) => {
        if (p.status && String(p.status).toLowerCase() === 'inactive') return false;
        if (!matchesCustomizationCategory(p.category, category, p.name)) return false;
        if (q) {
          const hay = `${p.name || ''} ${p.brand || ''} ${p.category || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((p) => {
        const pid = p.id || p.product_id;
        const check = this.isProductCompatibleWithBike(compatRows, pid, bike, p);
        return {
          ...p,
          id: pid,
          product_id: pid,
          compatible: check.compatible,
          compatibilityReason: check.reason || null,
          inStock: (Number(p.stock) || 0) > 0,
        };
      })
      .sort((a, b) => {
        if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    if (compatibleOnly) {
      return mapped.filter((p) => p.compatible);
    }
    return mapped;
  },

  calculateTotal(items = []) {
    return (items || []).reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
  },

  /**
   * Build an install-focused Gemini prompt: same registered motorcycle + selected parts installed.
   */
  buildAiPrompt({ motorcycle, selectedParts = [] }) {
    const bike = normalizeBike(motorcycle);
    const vehicleType = bike.vehicleType || getVehicleType(bike.brand, bike.model);
    const bikeLabel = [bike.year, bike.brand, bike.model].filter(Boolean).join(' ');
    const colorPhrase = bike.color ? ` Color/fairing: ${bike.color}.` : '';
    const nick = bike.nickname ? ` Nickname: "${bike.nickname}".` : '';

    const typeLock =
      vehicleType === 'Scooter'
        ? 'Body type MUST remain an automatic scooter / maxi-scooter (step-through). Never a superbike.'
        : vehicleType === 'Underbone'
          ? 'Body type MUST remain underbone / cub-style. Never a superbike.'
          : `Body type MUST remain ${vehicleType}.`;

    const installLines =
      selectedParts.length > 0
        ? selectedParts
            .map((p, i) => {
              const pname = p.name || p.product_name || 'part';
              const pbrand = p.brand || p.product_brand || '';
              const visual = describePartForAi(p);
              return `${i + 1}. INSTALL onto the motorcycle: ${pbrand ? `${pbrand} ` : ''}${pname} — ${visual}`;
            })
            .join('\n')
        : '1. Keep stock OEM parts only.';

    return [
      `REGISTERED MOTORCYCLE (must stay identical): ${bikeLabel}.`,
      `Vehicle type: ${vehicleType}. ${typeLock}${colorPhrase}${nick}`,
      'TASK: Show THIS same motorcycle with the selected store products physically installed on it.',
      'Rules:',
      '- Keep the exact same brand, model, year identity, silhouette, headlight shape, seat, and proportions.',
      '- Do NOT replace the motorcycle with a different model.',
      '- Do NOT generate a car or unrelated vehicle.',
      '- The selected products must look installed/mounted on the bike (not floating, not shown as separate product shots).',
      '- Only change appearance where those installed parts belong.',
      'SELECTED PRODUCTS TO INSTALL:',
      installLines,
      'Output: one photorealistic 3/4-front studio photo of the customized registered motorcycle.',
    ].join('\n');
  },

  buildPreviewImageUrl(prompt, referencePhotoUrl) {
    const cleanPrompt = String(prompt || '')
      .replace(/[^\w\s,.\-/()]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);
    const seed = Math.floor(100000 + Math.random() * 900000);
    let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1280&height=960&nologo=true&seed=${seed}&model=flux&enhance=true`;

    // Image-to-image only works with publicly reachable http(s) reference photos
    const ref = String(referencePhotoUrl || '').trim();
    if (/^https?:\/\//i.test(ref) && !ref.startsWith('data:')) {
      url += `&image=${encodeURIComponent(ref)}`;
    }
    return url;
  },

  // ── CRUD ───────────────────────────────────────────────────────────────
  async listCustomizations({ customerId, userId, admin = false } = {}) {
    const client = getClient();
    if (client) {
      try {
        let q = client
          .from('customizations')
          .select(
            'customization_id,customer_id,user_id,motorcycle_id,motorcycle_brand,motorcycle_model,motorcycle_year,motorcycle_color,motorcycle_type,name,status,total_price,notes,compatibility_checked,compatibility_ok,created_at,updated_at,preview_image_url,motorcycle_photo_url'
          )
          .order('created_at', { ascending: false });
        if (!admin) {
          if (userId) q = q.eq('user_id', userId);
          else if (customerId) q = q.eq('customer_id', customerId);
        }
        const { data, error } = await q.limit(admin ? 200 : 50);
        if (!error && data) {
          const ids = data.map((r) => r.customization_id);
          let itemsByCust = {};
          if (ids.length) {
            const { data: items } = await client
              .from('customization_items')
              .select(
                'item_id,customization_id,product_id,quantity,price,product_name,product_brand,product_category,size_label,color_label'
              )
              .in('customization_id', ids);
            (items || []).forEach((it) => {
              if (!itemsByCust[it.customization_id]) itemsByCust[it.customization_id] = [];
              itemsByCust[it.customization_id].push(it);
            });
          }
          const mapped = data.map((row) => mapCustomizationRow(row, itemsByCust[row.customization_id] || []));
          if (!admin) saveLocalCustomizations(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[customization] list:', err?.message || err);
      }
    }

    let local = getLocalCustomizations();
    if (!admin) {
      if (userId) local = local.filter((c) => c.userId === userId || c.user_id === userId);
      else if (customerId) local = local.filter((c) => c.customerId === customerId || c.customer_id === customerId);
    }
    return local;
  },

  async getCustomization(id) {
    if (!id) return null;
    const client = getClient();
    if (client) {
      const { data, error } = await client
        .from('customizations')
        .select(
          'customization_id,customer_id,user_id,motorcycle_id,motorcycle_brand,motorcycle_model,motorcycle_year,motorcycle_color,motorcycle_type,name,status,total_price,notes,compatibility_checked,compatibility_ok,created_at,updated_at,preview_image_url,motorcycle_photo_url,preview_prompt'
        )
        .eq('customization_id', id)
        .maybeSingle();
      if (!error && data) {
        const { data: items } = await client
          .from('customization_items')
          .select(
            'item_id,customization_id,product_id,quantity,price,product_name,product_brand,product_category,size_label,color_label'
          )
          .eq('customization_id', id);
        return mapCustomizationRow(data, items || []);
      }
    }
    return getLocalCustomizations().find((c) => c.id === id || c.customization_id === id) || null;
  },

  async createCustomization({
    customerId,
    userId,
    motorcycle,
    name,
    items = [],
    status = 'draft',
    notes = '',
  }) {
    const bike = normalizeBike(motorcycle);
    if (!bike.brand || !bike.model) {
      return { success: false, error: 'Please select a motorcycle brand, model, and year.' };
    }
    if (!items.length) {
      return { success: false, error: 'Select at least one motorcycle part.' };
    }

    const productIds = items.map((it) => it.productId || it.product_id || it.id).filter(Boolean);
    const compat = await this.checkCompatibility({
      customerId,
      motorcycleId: bike.motorcycleId,
      motorcycle: bike,
      productIds,
    });
    if (!compat.compatible) {
      return {
        success: false,
        error: 'One or more selected products are not compatible with your motorcycle.',
        compatibility: compat,
      };
    }

    const liveProducts = await productService.getProducts();
    const byId = new Map((liveProducts || []).map((p) => [p.id || p.product_id, p]));
    const normalizedItems = [];
    for (const raw of items) {
      const pid = raw.productId || raw.product_id || raw.id;
      const live = byId.get(pid);
      if (!live) {
        return { success: false, error: `Product ${pid} no longer exists.` };
      }
      if (live.status && String(live.status).toLowerCase() === 'inactive') {
        return { success: false, error: `"${live.name}" is not available.` };
      }
      const qty = Math.max(1, Number(raw.quantity) || 1);
      const price = Number(live.price) || 0;
      normalizedItems.push({
        product_id: pid,
        quantity: qty,
        price,
        product_name: live.name,
        product_brand: live.brand,
        product_category: live.category,
        size_label: raw.size || raw.size_label || '',
        color_label: raw.color || raw.color_label || '',
      });
    }

    const total = this.calculateTotal(normalizedItems);
    const customizationId = newId('custz');
    let motoPhoto = bike.photoUrl || null;
    if (motoPhoto && String(motoPhoto).startsWith('data:')) {
      try {
        const { resolveImageForDatabase } = await import('../utils/productImageUpload');
        const resolved = await resolveImageForDatabase(motoPhoto, {
          folder: 'motorcycles',
          orderId: customizationId,
          fileName: `motorcycles/custz-${customizationId}.jpg`,
        });
        if (resolved.url) motoPhoto = resolved.url;
      } catch (_e) {}
    }
    let previewUrl = previewImageUrl || null;
    if (previewUrl && String(previewUrl).startsWith('data:')) {
      try {
        const { resolveImageForDatabase } = await import('../utils/productImageUpload');
        const resolved = await resolveImageForDatabase(previewUrl, {
          folder: 'customization-previews',
          orderId: customizationId,
          fileName: `customization-previews/${customizationId}.jpg`,
        });
        if (resolved.url) previewUrl = resolved.url;
      } catch (_e) {}
    }
    const row = {
      customization_id: customizationId,
      customer_id: customerId || null,
      user_id: userId || null,
      motorcycle_id: bike.motorcycleId,
      motorcycle_brand: bike.brand,
      motorcycle_model: bike.model,
      motorcycle_year: bike.year,
      motorcycle_photo_url: motoPhoto,
      motorcycle_color: bike.color || null,
      motorcycle_type: bike.vehicleType || getVehicleType(bike.brand, bike.model),
      name: name || `${bike.brand} ${bike.model} Setup`,
      status,
      total_price: total,
      compatibility_checked: true,
      compatibility_ok: true,
      notes: notes || null,
      preview_image_url: previewUrl || null,
    };

    const client = getClient();
    if (client) {
      const { error } = await client.from('customizations').insert(row);
      if (error) {
        console.warn('[customization] create:', error.message);
      } else {
        const itemRows = normalizedItems.map((it) => ({
          item_id: newId('czi'),
          customization_id: customizationId,
          ...it,
        }));
        const { error: itemErr } = await client.from('customization_items').insert(itemRows);
        if (itemErr) console.warn('[customization] items:', itemErr.message);
        const saved = await this.getCustomization(customizationId);
        if (saved) {
          upsertLocal(saved);
          return { success: true, customization: saved };
        }
      }
    }

    const local = mapCustomizationRow(row, normalizedItems.map((it, i) => ({
      item_id: newId('czi'),
      customization_id: customizationId,
      ...it,
    })));
    upsertLocal(local);
    return { success: true, customization: local };
  },

  async updateCustomization(id, { name, items, motorcycle, status, notes, previewImageUrl, previewPrompt } = {}) {
    const existing = await this.getCustomization(id);
    if (!existing) return { success: false, error: 'Customization not found.' };

    const bike = motorcycle ? normalizeBike(motorcycle) : normalizeBike(existing.motorcycle);
    let normalizedItems = existing.items || [];
    let total = existing.totalPrice;

    if (Array.isArray(items)) {
      if (!items.length) return { success: false, error: 'Select at least one motorcycle part.' };
      const productIds = items.map((it) => it.productId || it.product_id || it.id).filter(Boolean);
      const compat = await this.checkCompatibility({
        motorcycleId: bike.motorcycleId,
        motorcycle: bike,
        productIds,
      });
      if (!compat.compatible) {
        return {
          success: false,
          error: 'One or more selected products are not compatible with your motorcycle.',
          compatibility: compat,
        };
      }
      const liveProducts = await productService.getProducts();
      const byId = new Map((liveProducts || []).map((p) => [p.id || p.product_id, p]));
      normalizedItems = [];
      for (const raw of items) {
        const pid = raw.productId || raw.product_id || raw.id;
        const live = byId.get(pid);
        if (!live) return { success: false, error: `Product ${pid} no longer exists.` };
        normalizedItems.push({
          product_id: pid,
          quantity: Math.max(1, Number(raw.quantity) || 1),
          price: Number(live.price) || 0,
          product_name: live.name,
          product_brand: live.brand,
          product_category: live.category,
          size_label: raw.size || '',
          color_label: raw.color || '',
        });
      }
      total = this.calculateTotal(normalizedItems);
    }

    const patch = {
      motorcycle_id: bike.motorcycleId,
      motorcycle_brand: bike.brand,
      motorcycle_model: bike.model,
      motorcycle_year: bike.year,
      motorcycle_photo_url: bike.photoUrl || existing.motorcycle?.photo_url || null,
      motorcycle_color: bike.color || existing.motorcycle?.color || null,
      motorcycle_type: bike.vehicleType || getVehicleType(bike.brand, bike.model),
      name: name != null ? name : existing.name,
      status: status || existing.status,
      total_price: total,
      notes: notes != null ? notes : existing.notes,
      compatibility_checked: true,
      compatibility_ok: true,
      updated_at: new Date().toISOString(),
    };
    if (patch.motorcycle_photo_url && String(patch.motorcycle_photo_url).startsWith('data:')) {
      try {
        const { resolveImageForDatabase } = await import('../utils/productImageUpload');
        const resolved = await resolveImageForDatabase(patch.motorcycle_photo_url, {
          folder: 'motorcycles',
          orderId: id,
          fileName: `motorcycles/custz-${id}.jpg`,
        });
        if (resolved.url) patch.motorcycle_photo_url = resolved.url;
      } catch (_e) {}
    }
    if (previewImageUrl !== undefined) {
      let nextPreview = previewImageUrl;
      if (nextPreview && String(nextPreview).startsWith('data:')) {
        try {
          const { resolveImageForDatabase } = await import('../utils/productImageUpload');
          const resolved = await resolveImageForDatabase(nextPreview, {
            folder: 'customization-previews',
            orderId: id,
            fileName: `customization-previews/${id}.jpg`,
          });
          if (resolved.url) nextPreview = resolved.url;
        } catch (_e) {}
      }
      patch.preview_image_url = nextPreview;
    }
    if (previewPrompt !== undefined) patch.preview_prompt = previewPrompt;

    const client = getClient();
    if (client) {
      const { error } = await client.from('customizations').update(patch).eq('customization_id', id);
      if (error) console.warn('[customization] update:', error.message);
      if (Array.isArray(items)) {
        await client.from('customization_items').delete().eq('customization_id', id);
        const itemRows = normalizedItems.map((it) => ({
          item_id: newId('czi'),
          customization_id: id,
          ...it,
        }));
        await client.from('customization_items').insert(itemRows);
      }
    }

    const saved = await this.getCustomization(id);
    const fallback = saved || {
      ...existing,
      ...mapCustomizationRow({ ...existing, ...patch, customization_id: id }, normalizedItems.map((it) => ({
        item_id: newId('czi'),
        customization_id: id,
        ...it,
      }))),
    };
    upsertLocal(fallback);
    return { success: true, customization: fallback };
  },

  async deleteCustomization(id) {
    const client = getClient();
    if (client) {
      await client.from('customization_items').delete().eq('customization_id', id);
      const { error } = await client.from('customizations').delete().eq('customization_id', id);
      if (error) console.warn('[customization] delete:', error.message);
    }
    removeLocal(id);
    return { success: true };
  },

  // ── AI Preview: install selected products onto the registered motorcycle ─
  async generatePreview(customizationId, { onProgress } = {}) {
    const customization = await this.getCustomization(customizationId);
    if (!customization) {
      return { success: false, error: 'Customization not found. Save your build first.' };
    }

    if (!customization.items?.length) {
      return { success: false, error: 'Select products to install on your motorcycle first.' };
    }

    const productIds = (customization.items || []).map((it) => it.productId || it.product_id);

    // Prefer live registered garage motorcycle (same model + photo)
    let registeredBike = null;
    const motoId = customization.motorcycleId || customization.motorcycle?.motorcycle_id;
    if (motoId && !String(motoId).startsWith('catalog-')) {
      try {
        registeredBike = motorcycleService.getMotorcycleById(motoId) || null;
      } catch (_e) {
        registeredBike = null;
      }
    }

    const motorcycle = {
      ...(customization.motorcycle || {}),
      ...(registeredBike || {}),
      brand: registeredBike?.brand || customization.motorcycle?.brand,
      model: registeredBike?.model || customization.motorcycle?.model,
      year: registeredBike?.year || customization.motorcycle?.year,
      color: registeredBike?.color || customization.motorcycle?.color,
      photo_url: registeredBike?.photo_url || customization.motorcycle?.photo_url || null,
      motorcycle_id: registeredBike?.motorcycle_id || motoId || null,
      nickname: registeredBike?.nickname || null,
      engine_cc: registeredBike?.engine_cc || null,
      category: getVehicleType(
        registeredBike?.brand || customization.motorcycle?.brand,
        registeredBike?.model || customization.motorcycle?.model
      ),
    };

    const referencePhoto = motorcycle.photo_url || null;
    if (!referencePhoto) {
      return {
        success: false,
        error:
          'Select your registered motorcycle from My Garage with a photo. Gemini needs that photo to install the selected parts on the same bike.',
      };
    }
    if (!motorcycle.brand || !motorcycle.model) {
      return {
        success: false,
        error: 'Registered motorcycle brand and model are required for an accurate preview.',
      };
    }

    const compat = await this.checkCompatibility({
      customerId: customization.customerId,
      motorcycleId: motorcycle.motorcycle_id,
      motorcycle,
      productIds,
    });
    if (!compat.compatible) {
      return {
        success: false,
        error: 'Cannot generate preview: some parts are incompatible with your motorcycle.',
        compatibility: compat,
      };
    }

    // Persist registered bike identity onto the customization for later reloads
    await this.updateCustomization(customizationId, {
      motorcycle,
      status: customization.status || 'saved',
    });

    const prompt = this.buildAiPrompt({
      motorcycle,
      selectedParts: customization.items,
    });

    if (typeof onProgress === 'function') {
      onProgress({
        percentage: 15,
        message: `Installing selected parts onto your ${motorcycle.brand} ${motorcycle.model}...`,
      });
    }

    // Primary: Google Gemini edits the registered motorcycle photo
    try {
      if (!geminiService.hasApiKey()) {
        return {
          success: false,
          error:
            'Gemini API key is required. Add EXPO_PUBLIC_GEMINI_API_KEY in .env so parts can be installed on your registered motorcycle photo.',
        };
      }

      if (typeof onProgress === 'function') {
        onProgress({
          percentage: 40,
          message: `Gemini is installing ${customization.items.length} part(s) on your registered ${motorcycle.brand} ${motorcycle.model}...`,
        });
      }

      const geminiResult = await geminiService.generateMotorcyclePreviewImage({
        prompt,
        referencePhotoUri: referencePhoto,
        motorcycle,
        selectedParts: customization.items,
        requireReferencePhoto: true,
        timeoutMs: 90000,
      });

      if (geminiResult?.success && geminiResult.previewImageUrl) {
        await this.updateCustomization(customizationId, {
          previewImageUrl: geminiResult.previewImageUrl,
          previewPrompt: prompt,
          status: 'previewed',
          motorcycle,
        });
        if (typeof onProgress === 'function') {
          onProgress({ percentage: 100, message: 'Preview ready — parts installed on your motorcycle' });
        }
        const refreshed = await this.getCustomization(customizationId);
        return {
          success: true,
          previewImageUrl: geminiResult.previewImageUrl,
          promptUsed: prompt,
          customization: refreshed,
          source: 'gemini',
          poweredBy: geminiResult.poweredBy,
          usedReferencePhoto: true,
        };
      }

      return {
        success: false,
        error:
          geminiResult?.error ||
          'Unable to generate the preview right now. Your customization has not been lost.',
      };
    } catch (err) {
      console.warn('[customization] Gemini preview failed:', err?.message || err);
      return {
        success: false,
        error:
          'Unable to generate the preview right now. Your customization has not been lost.',
      };
    }
  },

  // ── Stock + live price validation before cart ──────────────────────────
  async validateForCart(customizationId) {
    const customization = await this.getCustomization(customizationId);
    if (!customization) {
      return { ok: false, error: 'Customization not found.', items: [] };
    }

    const productIds = (customization.items || []).map((it) => it.productId || it.product_id);
    const compat = await this.checkCompatibility({
      customerId: customization.customerId,
      motorcycleId: customization.motorcycleId,
      motorcycle: customization.motorcycle,
      productIds,
    });
    if (!compat.compatible) {
      return {
        ok: false,
        error: 'Some selected products are not compatible with your motorcycle.',
        compatibility: compat,
        items: [],
      };
    }

    const liveProducts = await productService.getProducts();
    const byId = new Map((liveProducts || []).map((p) => [p.id || p.product_id, p]));
    const cartReady = [];
    const problems = [];

    for (const line of customization.items || []) {
      const pid = line.productId || line.product_id;
      const live = byId.get(pid);
      if (!live) {
        problems.push({ productId: pid, message: 'Product no longer exists.' });
        continue;
      }
      if (live.status && String(live.status).toLowerCase() === 'inactive') {
        problems.push({ productId: pid, message: `"${live.name}" is inactive.` });
        continue;
      }
      const stock = Number(live.stock) || 0;
      const qty = Number(line.quantity) || 1;
      if (stock < qty) {
        problems.push({
          productId: pid,
          message: `"${live.name}" is currently out of stock.`,
        });
        continue;
      }
      cartReady.push({
        product: {
          ...live,
          id: pid,
          product_id: pid,
          price: Number(live.price) || 0,
          selectedSize: line.size || '',
        },
        quantity: qty,
        size: line.size || '',
        livePrice: Number(live.price) || 0,
      });
    }

    if (problems.length) {
      const outOfStock = problems.some((p) => /out of stock/i.test(p.message));
      return {
        ok: false,
        error: outOfStock
          ? 'Some selected products are currently out of stock.'
          : problems[0].message,
        problems,
        items: cartReady,
      };
    }

    return { ok: true, items: cartReady, customization };
  },

  async addToCart(customizationId, addToCartFn) {
    const validation = await this.validateForCart(customizationId);
    if (!validation.ok) {
      return { success: false, error: validation.error, problems: validation.problems };
    }
    if (typeof addToCartFn !== 'function') {
      return { success: false, error: 'Cart is not available.' };
    }

    const added = [];
    for (const line of validation.items) {
      const result = addToCartFn(line.product, line.quantity, { size: line.size || undefined });
      if (result?.success === false) {
        return {
          success: false,
          error: result.soldOut || result.needsSize
            ? 'Some selected products are currently out of stock.'
            : 'Could not add all parts to cart.',
          partial: added,
        };
      }
      added.push(line.product.id);
    }

    await this.updateCustomization(customizationId, { status: 'in_cart' });
    return {
      success: true,
      addedCount: added.length,
      total: this.calculateTotal(
        validation.items.map((l) => ({ price: l.livePrice, quantity: l.quantity }))
      ),
    };
  },

  // Admin listing helper
  async listAllForAdmin() {
    return this.listCustomizations({ admin: true });
  },

  /**
   * Upsert structured fitment rows for a product (admin / catalog tools).
   * AI must never call this — compatibility is database-owned.
   */
  async setProductCompatibility(productId, rows = []) {
    if (!productId) return { success: false, error: 'Missing productId' };
    const client = getClient();
    if (!client) return { success: false, error: 'Database unavailable' };

    await client.from('product_compatibility').delete().eq('product_id', productId);
    if (!rows.length) return { success: true, rows: [] };

    const payload = rows.map((r) => ({
      compatibility_id: newId('pc'),
      product_id: productId,
      brand: String(r.brand || '').trim(),
      model: String(r.model || '').trim(),
      year_from: r.year_from ?? r.yearFrom ?? null,
      year_to: r.year_to ?? r.yearTo ?? null,
      year_exact: r.year_exact ?? r.yearExact ?? null,
      notes: r.notes || null,
    }));
    const { error } = await client.from('product_compatibility').insert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true, rows: payload };
  },
};

export default customizationService;
