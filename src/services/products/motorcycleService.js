// =========================================================================
// Motorcycle Fleet & Garage Service for MotoTrack
// Handles registering, editing, deleting, and syncing customer motorcycles
// with Supabase (public.customer_motorcycles) & local offline cache.
// =========================================================================

import { appStorage } from '../system/storageAdapter.js';
import { supabaseManager } from '../../lib/supabase.js';

const STORAGE_KEY = 'mototrack_customer_motorcycles';

export const MOTORCYCLE_BRANDS = [
  'Yamaha',
  'Honda',
  'Kawasaki',
  'Suzuki',
  'Ducati',
  'BMW Motorrad',
  'KTM',
  'Triumph',
  'Aprilia',
  'Harley-Davidson',
  'Vespa',
  'Kymco',
];

export const MOTORCYCLE_PHOTO_PRESETS = [
  {
    id: 'preset-yamaha',
    brand: 'Yamaha',
    label: 'Yamaha Sport / Maxi-Scooter',
    url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'preset-kawasaki',
    brand: 'Kawasaki',
    label: 'Kawasaki Ninja / Sport',
    url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'preset-honda',
    brand: 'Honda',
    label: 'Honda Naked / Streetfighter',
    url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'preset-ducati',
    brand: 'Ducati',
    label: 'Ducati Panigale / Racing Red',
    url: 'https://images.unsplash.com/photo-1558980664-769d59546b3d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'preset-adventure',
    brand: 'BMW Motorrad',
    label: 'BMW Adventure / Dual Sport',
    url: 'https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=800&q=80',
  },
];

class MotorcycleService {
  constructor() {
    this.listeners = new Set();
    this.motorcycles = this._loadLocal();
    this._syncPromise = null;
    // Note: Do not run unrestricted sync on init. Sync only when an authenticated user context is provided.
  }

  _loadLocal() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Exclude any synthetic seed motorcycles so only real user-registered bikes exist
          return parsed.filter((p) => !String(p.motorcycle_id || '').startsWith('moto-seed-'));
        }
      }
    } catch (_e) { }
    return [];
  }

  _saveLocal(list) {
    this.motorcycles = list;
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_e) { }
    this._notify();
  }

  _notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.motorcycles);
      } catch (_e) { }
    });
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => { };
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async syncFromSupabase(userOrUserId, customerEmail, options = {}) {
    let uid = '';
    let email = '';
    let cid = '';
    let allowAll = false;

    if (userOrUserId && typeof userOrUserId === 'object') {
      const u = userOrUserId;
      uid = u.id || u.user_id || '';
      cid = u.customer_id || u.customerId || '';
      email = u.email || u.customer_email || '';
      allowAll = Boolean(options?.allowAll || u.allowAll);
    } else {
      uid = userOrUserId || '';
      email = customerEmail || '';
      cid = options?.customerId || '';
      allowAll = Boolean(options?.allowAll);
    }

    const cleanUid = uid ? String(uid).trim() : '';
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanCid = cid ? String(cid).trim() : '';

    if (!cleanUid && !cleanEmail && !cleanCid && !allowAll) {
      return [];
    }

    if (this._syncPromise) return this._syncPromise;

    this._syncPromise = (async () => {
      try {
        const client = supabaseManager.getClient();
        if (!client) return this.motorcycles;

        let query = client
          .from('customer_motorcycles')
          .select(
            'motorcycle_id,user_id,customer_id,customer_email,brand,model,year,plate_number,engine_cc,color,odometer,vin_number,nickname,is_primary,notes,created_at,updated_at,photo_url'
          )
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false });

        if (!allowAll) {
          const orClauses = [];
          if (cleanUid) {
            orClauses.push(`user_id.eq.${cleanUid}`);
            orClauses.push(`customer_id.eq.${cleanUid}`);
          }
          if (cleanCid && cleanCid !== cleanUid) {
            orClauses.push(`customer_id.eq.${cleanCid}`);
            orClauses.push(`user_id.eq.${cleanCid}`);
          }
          if (cleanEmail) {
            orClauses.push(`customer_email.ilike.${cleanEmail}`);
          }
          if (orClauses.length > 1) {
            query = query.or(orClauses.join(','));
          } else if (orClauses.length === 1) {
            const single = orClauses[0];
            const [col, op, val] = single.split('.');
            if (op === 'ilike') query = query.ilike(col, val);
            else query = query.eq(col, val);
          }
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          let nextList = [];
          if (cleanUid || cleanEmail || cleanCid) {
            const others = this.motorcycles.filter((m) => {
              if (cleanUid && (m.user_id === cleanUid || m.customer_id === cleanUid)) return false;
              if (cleanCid && (m.customer_id === cleanCid || m.user_id === cleanCid)) return false;
              if (cleanEmail && String(m.customer_email || '').trim().toLowerCase() === cleanEmail) return false;
              return true;
            });
            nextList = [...others, ...data];
          } else {
            nextList = data;
          }

          this._saveLocal(nextList);
          return data;
        }
      } catch (_e) {
        // Offline fallback is already active
      } finally {
        this._syncPromise = null;
      }
      return this.motorcycles;
    })();

    return this._syncPromise;
  }

  /**
   * Get list of motorcycles for the current user/customer
   */
  getMotorcycles(userOrUserId, customerId, customerEmail) {
    let cleanUid = '';
    let cleanCid = '';
    let cleanEmail = '';

    if (userOrUserId && typeof userOrUserId === 'object') {
      const u = userOrUserId;
      cleanUid = String(u.id || u.user_id || '').trim();
      cleanCid = String(u.customer_id || u.customerId || '').trim();
      cleanEmail = String(u.email || u.customer_email || '').trim().toLowerCase();
    } else {
      cleanUid = userOrUserId ? String(userOrUserId).trim() : '';
      cleanCid = customerId ? String(customerId).trim() : '';
      cleanEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : '';
    }

    if (!cleanUid && !cleanCid && !cleanEmail) {
      return [];
    }

    return this.motorcycles.filter((m) => {
      if (String(m.motorcycle_id || '').startsWith('moto-seed-')) return false;
      const mEmail = String(m.customer_email || '').trim().toLowerCase();
      if (cleanUid && (m.user_id === cleanUid || m.customer_id === cleanUid)) return true;
      if (cleanCid && (m.customer_id === cleanCid || m.user_id === cleanCid)) return true;
      if (cleanEmail && mEmail === cleanEmail) return true;
      return false;
    });
  }

  /**
   * Get all motorcycles across all customers (admin only)
   */
  getAllMotorcycles() {
    return [...this.motorcycles];
  }

  getMotorcycleById(id) {
    return this.motorcycles.find((m) => m.motorcycle_id === id) || null;
  }

  getPrimaryMotorcycle(userOrUserId, customerId, customerEmail) {
    const list = this.getMotorcycles(userOrUserId, customerId, customerEmail);
    return list.find((m) => m.is_primary) || list[0] || null;
  }

  /**
   * Add a new motorcycle
   */
  async addMotorcycle(bikeData) {
    const newId = 'moto-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const isFirstBike = this.motorcycles.length === 0;

    const brand = (bikeData.brand || 'Yamaha').trim();
    const model = (bikeData.model || '').trim();
    const plate = (bikeData.plate_number || bikeData.plate || '').trim().toUpperCase();

    // Photo URL: only use user-provided photo; do NOT auto-assign preset or AI photo
    let photoUrl = (bikeData.photo_url || '').trim() || null;
    if (photoUrl && String(photoUrl).startsWith('data:')) {
      try {
        const { resolveImageForDatabase } = await import('../../utils/productImageUpload.js');
        const resolved = await resolveImageForDatabase(photoUrl, {
          folder: 'motorcycles',
          orderId: newId,
          fileName: `motorcycles/${newId}-${Date.now()}.jpg`,
        });
        if (resolved.url) photoUrl = resolved.url;
      } catch (_e) {
        // keep original if upload fails
      }
    }

    const newRecord = {
      motorcycle_id: newId,
      user_id: bikeData.user_id || 'usr-rider-01',
      customer_id: bikeData.customer_id || 'cust-demo-01',
      customer_email: (bikeData.customer_email || bikeData.email || '').trim().toLowerCase(),
      brand,
      model,
      year: bikeData.year ? parseInt(bikeData.year, 10) : null,
      plate_number: plate,
      engine_cc: bikeData.engine_cc ? parseInt(bikeData.engine_cc, 10) : null,
      color: (bikeData.color || '').trim(),
      odometer: (bikeData.odometer || '').trim(),
      vin_number: (bikeData.vin_number || '').trim(),
      nickname: (bikeData.nickname || '').trim(),
      photo_url: photoUrl,
      is_primary: isFirstBike || Boolean(bikeData.is_primary),
      notes: (bikeData.notes || '').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If new bike is set as primary, unmark others
    let updatedList = [...this.motorcycles];
    if (newRecord.is_primary) {
      updatedList = updatedList.map((b) => ({ ...b, is_primary: false }));
    }
    updatedList.unshift(newRecord);
    this._saveLocal(updatedList);

    // Sync to Supabase table: customer_motorcycles
    try {
      const client = supabaseManager.getClient();
      if (client) {
        if (newRecord.is_primary && (newRecord.user_id || newRecord.customer_email)) {
          const matchCol = newRecord.customer_email ? 'customer_email' : 'user_id';
          const matchVal = newRecord.customer_email || newRecord.user_id;
          await client
            .from('customer_motorcycles')
            .update({ is_primary: false })
            .eq(matchCol, matchVal);
        }

        const { data, error } = await client.from('customer_motorcycles').insert([newRecord]);
        if (error) {
          console.warn('[MotorcycleService] Supabase insert warning:', error.message);
          return { success: true, warning: error.message, motorcycle: newRecord };
        } else {
          console.log('[MotorcycleService] Successfully stored motorcycle in Supabase:', newRecord.motorcycle_id);
        }
      }
    } catch (_e) {
      console.warn('Could not insert motorcycle to Supabase, stored locally:', _e);
    }

    return { success: true, motorcycle: newRecord };
  }

  /**
   * Update an existing motorcycle
   */
  async updateMotorcycle(motorcycleId, updateData) {
    const existingIndex = this.motorcycles.findIndex((m) => m.motorcycle_id === motorcycleId);
    if (existingIndex === -1) {
      return { success: false, error: 'Motorcycle not found' };
    }

    const existing = this.motorcycles[existingIndex];
    const isNowPrimary = updateData.is_primary !== undefined ? Boolean(updateData.is_primary) : existing.is_primary;

    let nextPhoto = updateData.photo_url !== undefined ? updateData.photo_url : existing.photo_url;
    if (nextPhoto && String(nextPhoto).startsWith('data:')) {
      try {
        const { resolveImageForDatabase } = await import('../../utils/productImageUpload.js');
        const resolved = await resolveImageForDatabase(nextPhoto, {
          folder: 'motorcycles',
          orderId: motorcycleId,
          fileName: `motorcycles/${motorcycleId}-${Date.now()}.jpg`,
        });
        if (resolved.url) nextPhoto = resolved.url;
      } catch (_e) { }
    }

    const updatedRecord = {
      ...existing,
      ...updateData,
      motorcycle_id: motorcycleId, // ensure id doesn't change
      brand: updateData.brand ? updateData.brand.trim() : existing.brand,
      model: updateData.model ? updateData.model.trim() : existing.model,
      plate_number: updateData.plate_number
        ? updateData.plate_number.trim().toUpperCase()
        : existing.plate_number,
      year: updateData.year ? parseInt(updateData.year, 10) : existing.year,
      engine_cc: updateData.engine_cc ? parseInt(updateData.engine_cc, 10) : existing.engine_cc,
      photo_url: nextPhoto,
      is_primary: isNowPrimary,
      updated_at: new Date().toISOString(),
    };

    let updatedList = [...this.motorcycles];
    if (isNowPrimary) {
      updatedList = updatedList.map((b) =>
        b.motorcycle_id === motorcycleId ? updatedRecord : { ...b, is_primary: false }
      );
    } else {
      updatedList[existingIndex] = updatedRecord;
    }

    this._saveLocal(updatedList);

    // Sync to Supabase
    try {
      const client = supabaseManager.getClient();
      if (client) {
        if (isNowPrimary && (updatedRecord.user_id || updatedRecord.customer_email)) {
          const matchCol = updatedRecord.customer_email ? 'customer_email' : 'user_id';
          const matchVal = updatedRecord.customer_email || updatedRecord.user_id;
          await client
            .from('customer_motorcycles')
            .update({ is_primary: false })
            .eq(matchCol, matchVal);
        }
        const { error } = await client
          .from('customer_motorcycles')
          .update(updatedRecord)
          .eq('motorcycle_id', motorcycleId);
        if (error) {
          console.warn('[MotorcycleService] Supabase update warning:', error.message);
        } else {
          console.log('[MotorcycleService] Successfully updated motorcycle in Supabase:', motorcycleId);
        }
      }
    } catch (_e) {
      console.warn('Could not update motorcycle on Supabase, updated locally.');
    }

    return { success: true, motorcycle: updatedRecord };
  }

  /**
   * Delete a motorcycle
   */
  async deleteMotorcycle(motorcycleId) {
    const existing = this.motorcycles.find((m) => m.motorcycle_id === motorcycleId);
    if (!existing) {
      return { success: false, error: 'Motorcycle not found' };
    }

    let updatedList = this.motorcycles.filter((m) => m.motorcycle_id !== motorcycleId);

    // If deleted bike was primary and other bikes exist, make the first one primary
    if (existing.is_primary && updatedList.length > 0) {
      updatedList[0] = { ...updatedList[0], is_primary: true };
    }

    this._saveLocal(updatedList);

    // Sync to Supabase
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error } = await client.from('customer_motorcycles').delete().eq('motorcycle_id', motorcycleId);
        if (error) {
          console.warn('[MotorcycleService] Supabase delete warning:', error.message);
        } else {
          console.log('[MotorcycleService] Successfully deleted motorcycle from Supabase:', motorcycleId);
        }
        if (existing.is_primary && updatedList.length > 0) {
          await client
            .from('customer_motorcycles')
            .update({ is_primary: true })
            .eq('motorcycle_id', updatedList[0].motorcycle_id);
        }
      }
    } catch (_e) {
      console.warn('Could not delete motorcycle on Supabase, deleted locally.');
    }

    return { success: true };
  }

  /**
   * Set a motorcycle as the customer's primary ride
   */
  async setPrimaryMotorcycle(motorcycleId, userId) {
    const updatedList = this.motorcycles.map((m) => ({
      ...m,
      is_primary: m.motorcycle_id === motorcycleId,
    }));
    this._saveLocal(updatedList);

    try {
      const client = supabaseManager.getClient();
      if (client) {
        if (userId) {
          await client
            .from('customer_motorcycles')
            .update({ is_primary: false })
            .eq('user_id', userId);
        }
        await client
          .from('customer_motorcycles')
          .update({ is_primary: true })
          .eq('motorcycle_id', motorcycleId);
      }
    } catch (_e) { }

    return { success: true };
  }
}

export const motorcycleService = new MotorcycleService();
export default motorcycleService;
