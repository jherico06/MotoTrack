// ─── WISHLIST SERVICE (products + AI install customizations) ────────────────
import { appStorage } from '../system/storageAdapter.js';
import { productService } from './productService.js';
import { supabaseManager } from '../../lib/supabase.js';

const STORAGE_PREFIX = 'mototrack_wishlist_v2_';
const LEGACY_PREFIX = 'mototrack_wishlist_';

function newLocalId(prefix = 'wish') {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** sessionStorage cannot hold multi‑MB AI base64 previews — keep only remote/http URLs. */
function sanitizePreviewUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^data:/i.test(value)) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  return '';
}

function slimMotorcycle(moto) {
  if (!moto || typeof moto !== 'object') return null;
  return {
    motorcycle_id: moto.motorcycle_id || moto.motorcycleId || moto.id || null,
    brand: moto.brand || moto.motorcycle_brand || '',
    model: moto.model || moto.motorcycle_model || '',
    year: moto.year || moto.motorcycle_year || null,
    color: moto.color || moto.motorcycle_color || '',
    plate_number: moto.plate_number || moto.plateNumber || '',
    nickname: moto.nickname || '',
    // Never persist huge data: photo URLs into wishlist storage
    photo_url: sanitizePreviewUrl(moto.photo_url || moto.photoUrl || moto.image || ''),
  };
}

function slimItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    productId: it.productId || it.product_id || it.id || null,
    product_id: it.productId || it.product_id || it.id || null,
    name: it.name || it.product_name || 'Part',
    product_name: it.product_name || it.name || 'Part',
    brand: it.brand || it.product_brand || '',
    category: it.category || it.product_category || '',
    price: Number(it.price) || 0,
    quantity: Math.max(1, Number(it.quantity) || 1),
  }));
}

function normalizeCustomizationEntry(raw = {}) {
  const customizationId =
    raw.customizationId || raw.customization_id || null;
  const localId = raw.localId || null;
  const id = String(
    customizationId || localId || raw.id || newLocalId('ai')
  ).trim();
  if (!id) return null;

  const previewImageUrl = sanitizePreviewUrl(
    raw.previewImageUrl || raw.preview_image_url || ''
  );

  return {
    type: 'customization',
    id,
    customizationId: customizationId ? String(customizationId) : null,
    localId: localId || (!customizationId ? id : null),
    name: raw.name || raw.title || 'AI Installation Preview',
    title: raw.title || raw.name || 'AI Installation Preview',
    previewImageUrl,
    motorcycle: slimMotorcycle(raw.motorcycle),
    items: slimItems(raw.items),
    productIds: Array.isArray(raw.productIds)
      ? raw.productIds.map(String).filter(Boolean)
      : slimItems(raw.items)
          .map((it) => it.productId)
          .filter(Boolean)
          .map(String),
    notes: String(raw.notes || '').slice(0, 500),
    promptUsed: String(raw.promptUsed || raw.previewPrompt || '').slice(0, 300),
    savedAt: raw.savedAt || raw.created_at || new Date().toISOString(),
  };
}

class WishlistService {
  getStorageKey(userId) {
    return `${STORAGE_PREFIX}${userId || 'guest'}`;
  }

  getLegacyKey(userId) {
    return `${LEGACY_PREFIX}${userId || 'guest'}`;
  }

  /**
   * Load wishlist state: { productIds: string[], customizations: object[] }
   */
  getWishlistState(userId) {
    if (!userId) return { productIds: [], customizations: [] };

    try {
      const key = this.getStorageKey(userId);
      const raw = appStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            productIds: Array.isArray(parsed.productIds)
              ? parsed.productIds.map(String)
              : [],
            customizations: Array.isArray(parsed.customizations)
              ? parsed.customizations.map(normalizeCustomizationEntry).filter(Boolean)
              : [],
          };
        }
        if (Array.isArray(parsed)) {
          return this._fromMixedList(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load wishlist v2:', e);
    }

    // Migrate legacy product-ID array
    try {
      const legacyRaw = appStorage.getItem(this.getLegacyKey(userId));
      if (legacyRaw) {
        const ids = JSON.parse(legacyRaw);
        if (Array.isArray(ids)) {
          const state = {
            productIds: ids.map(String).filter(Boolean),
            customizations: [],
          };
          this.saveWishlistState(userId, state);
          return state;
        }
      }
    } catch (e) {
      console.warn('Failed to migrate legacy wishlist:', e);
    }

    return { productIds: [], customizations: [] };
  }

  _fromMixedList(list) {
    const productIds = [];
    const customizations = [];
    for (const entry of list) {
      if (typeof entry === 'string') {
        productIds.push(entry);
      } else if (
        entry?.type === 'customization' ||
        entry?.customizationId ||
        entry?.previewImageUrl
      ) {
        const c = normalizeCustomizationEntry(entry);
        if (c) customizations.push(c);
      } else if (entry?.type === 'product' || entry?.productId || entry?.id) {
        productIds.push(String(entry.productId || entry.id));
      }
    }
    return { productIds, customizations };
  }

  saveWishlistState(userId, state) {
    try {
      const key = this.getStorageKey(userId);
      const payload = {
        productIds: [...new Set((state.productIds || []).map(String).filter(Boolean))],
        customizations: (state.customizations || [])
          .map(normalizeCustomizationEntry)
          .filter(Boolean),
      };
      const json = JSON.stringify(payload);
      const ok = appStorage.setItem(key, json);
      appStorage.setItem(this.getLegacyKey(userId), JSON.stringify(payload.productIds));
      // Detect silent quota failure: sessionStorage kept stale empty payload
      try {
        const roundTrip = appStorage.getItem(key);
        if (roundTrip !== json) {
          console.warn(
            '[wishlist] storage write did not persist (likely quota). Keeping memory only.'
          );
          return { success: false, error: 'storage_quota', persisted: false };
        }
      } catch (_e) {
        /* ignore */
      }
      return { success: ok !== false, persisted: true };
    } catch (e) {
      console.warn('Failed to save wishlist:', e);
      return { success: false, error: e?.message || 'save_failed', persisted: false };
    }
  }

  getWishlistIds(userId) {
    return this.getWishlistState(userId).productIds;
  }

  saveWishlistIds(userId, ids) {
    const state = this.getWishlistState(userId);
    state.productIds = Array.isArray(ids) ? ids.map(String) : [];
    this.saveWishlistState(userId, state);
  }

  async getWishlistProducts(userId) {
    const ids = this.getWishlistIds(userId);
    const allProducts = await productService.getProducts();
    const map = new Map(allProducts.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  getWishlistCustomizations(userId) {
    return this.getWishlistState(userId).customizations;
  }

  isWishlisted(userId, productId) {
    return this.getWishlistIds(userId).includes(productId);
  }

  isCustomizationWishlisted(userId, customizationId) {
    if (!customizationId) return false;
    const id = String(customizationId);
    return this.getWishlistCustomizations(userId).some(
      (c) => c.id === id || c.customizationId === id
    );
  }

  toggleWishlist(userId, productId) {
    const state = this.getWishlistState(userId);
    let isAdded = false;
    if (state.productIds.includes(productId)) {
      state.productIds = state.productIds.filter((id) => id !== productId);
      isAdded = false;
    } else {
      state.productIds = [productId, ...state.productIds];
      isAdded = true;
    }
    this.saveWishlistState(userId, state);
    this._syncProductToRemote(userId, productId, isAdded);
    return { success: true, isAdded, count: this.getTotalCount(userId) };
  }

  addToWishlist(userId, productId) {
    const state = this.getWishlistState(userId);
    if (!state.productIds.includes(productId)) {
      state.productIds = [productId, ...state.productIds];
      this.saveWishlistState(userId, state);
      this._syncProductToRemote(userId, productId, true);
    }
    return { success: true, count: this.getTotalCount(userId) };
  }

  removeFromWishlist(userId, productId) {
    const state = this.getWishlistState(userId);
    state.productIds = state.productIds.filter((id) => id !== productId);
    this.saveWishlistState(userId, state);
    this._syncProductToRemote(userId, productId, false);
    return { success: true, count: this.getTotalCount(userId) };
  }

  /**
   * Save an AI install preview into the wishlist.
   * Requires a customizationId and/or a non-base64 preview URL (storage URL).
   */
  addCustomizationToWishlist(userId, customizationPayload = {}) {
    if (!userId) return { success: false, error: 'Sign in to save to wishlist.' };
    const entry = normalizeCustomizationEntry(customizationPayload);
    if (!entry) {
      return { success: false, error: 'Invalid customization payload.' };
    }
    if (!entry.customizationId && !entry.previewImageUrl) {
      return {
        success: false,
        error:
          'Could not save preview yet. Wait for the image to upload, then try again.',
      };
    }

    const state = this.getWishlistState(userId);
    const existingIdx = state.customizations.findIndex(
      (c) =>
        (entry.customizationId &&
          (c.customizationId === entry.customizationId || c.id === entry.customizationId)) ||
        c.id === entry.id
    );
    if (existingIdx >= 0) {
      state.customizations[existingIdx] = {
        ...state.customizations[existingIdx],
        ...entry,
        // Keep previous remote preview if new one was stripped (base64)
        previewImageUrl:
          entry.previewImageUrl || state.customizations[existingIdx].previewImageUrl || '',
        savedAt: state.customizations[existingIdx].savedAt || entry.savedAt,
      };
    } else {
      state.customizations = [entry, ...state.customizations];
    }

    for (const pid of entry.productIds || []) {
      if (pid && !state.productIds.includes(pid)) {
        state.productIds = [pid, ...state.productIds];
      }
    }

    const write = this.saveWishlistState(userId, state);
    this._syncCustomizationToRemote(userId, state.customizations[existingIdx >= 0 ? existingIdx : 0] || entry);
    return {
      success: true,
      entry: state.customizations[existingIdx >= 0 ? existingIdx : 0],
      alreadySaved: existingIdx >= 0,
      persisted: write?.persisted !== false,
      count: this.getTotalCount(userId),
    };
  }

  removeCustomizationFromWishlist(userId, customizationId) {
    const id = String(customizationId || '');
    const state = this.getWishlistState(userId);
    const target = state.customizations.find(
      (c) => c.id === id || c.customizationId === id
    );
    state.customizations = state.customizations.filter(
      (c) => c.id !== id && c.customizationId !== id
    );
    this.saveWishlistState(userId, state);
    if (target?.customizationId) {
      this._removeCustomizationRemote(userId, target.customizationId);
    }
    return { success: true, count: this.getTotalCount(userId) };
  }

  clearWishlist(userId) {
    this.saveWishlistState(userId, { productIds: [], customizations: [] });
    this._clearRemote(userId);
    return { success: true, count: 0 };
  }

  getTotalCount(userId) {
    const state = this.getWishlistState(userId);
    return state.productIds.length + state.customizations.length;
  }

  /**
   * Pull wishlist_items from Supabase and merge into local state.
   * Also fills missing preview URLs from customizations table.
   */
  async hydrateFromRemote(userId) {
    if (!userId || userId === 'guest') {
      return this.getWishlistState(userId);
    }
    try {
      const client = supabaseManager.getClient();
      if (!client) return this.getWishlistState(userId);

      const { data, error } = await client
        .from('wishlist_items')
        .select(
          'wishlist_item_id,item_type,product_id,customization_id,preview_image_url,title,snapshot,created_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !Array.isArray(data)) {
        if (error) console.warn('wishlist hydrate:', error.message || error);
        return this.getWishlistState(userId);
      }

      const local = this.getWishlistState(userId);
      const productIds = new Set(local.productIds || []);
      const byCustId = new Map(
        (local.customizations || [])
          .filter((c) => c.customizationId)
          .map((c) => [String(c.customizationId), c])
      );

      for (const row of data) {
        if (row.item_type === 'product' && row.product_id) {
          productIds.add(String(row.product_id));
        } else if (row.item_type === 'customization' && row.customization_id) {
          const cid = String(row.customization_id);
          const snap = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {};
          const existing = byCustId.get(cid);
          byCustId.set(
            cid,
            normalizeCustomizationEntry({
              ...(existing || {}),
              customizationId: cid,
              name: row.title || existing?.name || snap.name || 'AI Installation Preview',
              previewImageUrl:
                sanitizePreviewUrl(row.preview_image_url) ||
                existing?.previewImageUrl ||
                sanitizePreviewUrl(snap.previewImageUrl),
              motorcycle: snap.motorcycle || existing?.motorcycle,
              items: snap.items || existing?.items,
              productIds: snap.productIds || existing?.productIds,
              notes: snap.notes || existing?.notes,
              promptUsed: snap.promptUsed || existing?.promptUsed,
              savedAt: row.created_at || existing?.savedAt,
            })
          );
        }
      }

      // Fill missing preview URLs from customizations table
      const missingPreview = [...byCustId.values()].filter(
        (c) => c.customizationId && !c.previewImageUrl
      );
      if (missingPreview.length) {
        const ids = missingPreview.map((c) => c.customizationId);
        const { data: custRows } = await client
          .from('customizations')
          .select('customization_id,preview_image_url,name,motorcycle_brand,motorcycle_model')
          .in('customization_id', ids);
        for (const row of custRows || []) {
          const cur = byCustId.get(String(row.customization_id));
          if (!cur) continue;
          byCustId.set(
            String(row.customization_id),
            normalizeCustomizationEntry({
              ...cur,
              name: cur.name || row.name,
              previewImageUrl:
                sanitizePreviewUrl(row.preview_image_url) || cur.previewImageUrl,
              motorcycle: cur.motorcycle || {
                brand: row.motorcycle_brand,
                model: row.motorcycle_model,
              },
            })
          );
        }
      }

      const merged = {
        productIds: [...productIds],
        customizations: [...byCustId.values()],
      };
      this.saveWishlistState(userId, merged);
      return merged;
    } catch (e) {
      console.warn('wishlist hydrate exception:', e?.message || e);
      return this.getWishlistState(userId);
    }
  }

  async _syncProductToRemote(userId, productId, isAdded) {
    try {
      const client = supabaseManager.getClient();
      if (!client || !userId || !productId) return;
      await client
        .from('wishlist_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
      if (isAdded) {
        await client.from('wishlist_items').insert({
          wishlist_item_id: newLocalId('wish'),
          user_id: userId,
          item_type: 'product',
          product_id: productId,
        });
      }
    } catch (e) {
      console.warn('wishlist remote product sync:', e?.message || e);
    }
  }

  async _syncCustomizationToRemote(userId, entry) {
    try {
      const client = supabaseManager.getClient();
      if (!client || !userId || !entry?.customizationId) return;
      await client
        .from('wishlist_items')
        .delete()
        .eq('user_id', userId)
        .eq('customization_id', entry.customizationId);
      await client.from('wishlist_items').insert({
        wishlist_item_id: newLocalId('wish'),
        user_id: userId,
        item_type: 'customization',
        customization_id: entry.customizationId,
        preview_image_url: sanitizePreviewUrl(entry.previewImageUrl) || null,
        title: entry.name || entry.title || null,
        snapshot: {
          motorcycle: entry.motorcycle,
          items: entry.items,
          productIds: entry.productIds,
          notes: entry.notes,
          promptUsed: entry.promptUsed,
        },
      });
    } catch (e) {
      console.warn('wishlist remote customization sync:', e?.message || e);
    }
  }

  async _removeCustomizationRemote(userId, customizationId) {
    try {
      const client = supabaseManager.getClient();
      if (!client || !userId || !customizationId) return;
      await client
        .from('wishlist_items')
        .delete()
        .eq('user_id', userId)
        .eq('customization_id', customizationId);
    } catch (e) {
      console.warn('wishlist remote remove:', e?.message || e);
    }
  }

  async _clearRemote(userId) {
    try {
      const client = supabaseManager.getClient();
      if (!client || !userId) return;
      await client.from('wishlist_items').delete().eq('user_id', userId);
    } catch (e) {
      console.warn('wishlist remote clear:', e?.message || e);
    }
  }
}

export const wishlistService = new WishlistService();
export { normalizeCustomizationEntry, sanitizePreviewUrl };
