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
    // Background sync on init
    this.syncFromSupabase();
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
    } catch (_e) {}
    return [];
  }

  _saveLocal(list) {
    this.motorcycles = list;
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_e) {}
    this._notify();
  }

  _notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.motorcycles);
      } catch (_e) {}
    });
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async syncFromSupabase(userId, customerEmail) {
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

        if (userId && customerEmail) {
          query = query.or(`user_id.eq.${userId},customer_email.eq.${customerEmail}`);
        } else if (userId) {
          query = query.eq('user_id', userId);
        } else if (customerEmail) {
          query = query.eq('customer_email', customerEmail);
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          const hasChanged = JSON.stringify(this.motorcycles) !== JSON.stringify(data);
          if (hasChanged) {
            this._saveLocal(data);
          }
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
  getMotorcycles(userId, customerId, customerEmail) {
    if (!userId && !customerId && !customerEmail) {
      return [...this.motorcycles];
    }
    const filtered = this.motorcycles.filter(
      (m) =>
        (userId && (m.user_id === userId || m.user_id === 'usr-customer-01' || m.user_id === 'usr-rider-01' || m.customer_id === userId || m.customer_id === 'cust-01')) ||
        (customerId && (m.customer_id === customerId || m.customer_id === 'cust-01')) ||
        (customerEmail && m.customer_email === customerEmail)
    );
    return filtered.length > 0 ? filtered : [...this.motorcycles];
  }

  getMotorcycleById(id) {
    return this.motorcycles.find((m) => m.motorcycle_id === id) || null;
  }

  getPrimaryMotorcycle(userId, customerId, customerEmail) {
    const list = this.getMotorcycles(userId, customerId, customerEmail);
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
      } catch (_e) {}
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
    } catch (_e) {}

    return { success: true };
  }
}

export const motorcycleService = new MotorcycleService();
export default motorcycleService;
