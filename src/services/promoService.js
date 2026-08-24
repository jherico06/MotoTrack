import { supabaseManager } from './supabaseClient';
import { appStorage } from './storageAdapter';

const DEFAULT_PROMOS = [
  { promo_id: 'prm-1', code: 'TRACK10', discountPercent: 10, description: '10% Off Superbike Parts', isActive: true },
  { promo_id: 'prm-2', code: 'VIP20', discountPercent: 20, description: '20% VIP Rider Voucher', isActive: true },
  { promo_id: 'prm-3', code: 'FLASH50', discountPercent: 50, description: '50% Flash Sale Super Discount', isActive: true },
  { promo_id: 'prm-4', code: 'MOTO10', discountPercent: 10, description: '10% Trackday Discount', isActive: true },
];

const STORAGE_KEY = 'mototrack_promos_db';

export const promoService = {
  /**
   * Fetch all promo codes directly from Supabase
   */
  async getPromos() {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('promos')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const normalized = data.map((item) => ({
            id: item.promo_id || item.id,
            promo_id: item.promo_id || item.id,
            code: (item.code || '').toUpperCase(),
            discountPercent: Number(item.discount_percent || 10),
            description: item.description || '',
            isActive: Boolean(item.is_active ?? true),
          }));
          appStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Supabase promos fetch note:', e);
    }

    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROMOS));
    } catch (e) {}
    return DEFAULT_PROMOS;
  },

  /**
   * Create a new promo code in Supabase
   */
  async addPromo({ code, discountPercent, description, isActive = true }) {
    const cleanCode = code.trim().toUpperCase();
    const percent = Math.min(100, Math.max(1, Number(discountPercent)));
    const promoId = 'prm-' + Date.now();

    const newPromo = {
      id: promoId,
      promo_id: promoId,
      code: cleanCode,
      discountPercent: percent,
      description: description || `${percent}% Off Order Voucher`,
      isActive: Boolean(isActive),
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('promos').upsert([
          {
            promo_id: promoId,
            code: cleanCode,
            discount_percent: percent,
            description: newPromo.description,
            is_active: newPromo.isActive,
            status: 'active',
          },
        ]);
      }
    } catch (e) {
      console.warn('Supabase promo insert note:', e);
    }

    const current = await this.getPromos();
    const updated = [newPromo, ...current.filter((p) => p.code !== cleanCode)];
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    return { success: true, promo: newPromo };
  },

  /**
   * Update discount percentage or status of an existing promo in Supabase
   */
  async updatePromo(code, updates) {
    const cleanCode = code.trim().toUpperCase();

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const payload = {};
        if (updates.discountPercent !== undefined) {
          payload.discount_percent = Math.min(100, Math.max(1, Number(updates.discountPercent)));
        }
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;

        await client.from('promos').update(payload).eq('code', cleanCode);
      }
    } catch (e) {
      console.warn('Supabase promo update note:', e);
    }

    const current = await this.getPromos();
    const updated = current.map((p) =>
      p.code === cleanCode ? { ...p, ...updates } : p
    );
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    return { success: true, promo: updated.find((p) => p.code === cleanCode) };
  },

  /**
   * Delete a promo code from Supabase
   */
  async deletePromo(code) {
    const cleanCode = code.trim().toUpperCase();

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('promos').delete().eq('code', cleanCode);
      }
    } catch (e) {
      console.warn('Supabase promo delete note:', e);
    }

    const current = await this.getPromos();
    const updated = current.filter((p) => p.code !== cleanCode);
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    return { success: true };
  },

  /**
   * Validate a promo code entered in checkout
   */
  async validatePromo(inputCode) {
    const clean = (inputCode || '').trim().toUpperCase();
    if (!clean) return { valid: false, discountPercent: 0, error: 'Please enter a coupon code' };

    const promos = await this.getPromos();
    const match = promos.find((p) => p.code === clean);

    if (!match) {
      return { valid: false, discountPercent: 0, error: `Coupon "${clean}" is invalid.` };
    }

    if (!match.isActive) {
      return { valid: false, discountPercent: 0, error: `Coupon "${clean}" has expired or is inactive.` };
    }

    return {
      valid: true,
      discountPercent: match.discountPercent,
      description: match.description,
      code: match.code,
    };
  },
};
