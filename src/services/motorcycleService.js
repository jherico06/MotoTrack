// =========================================================================
// Motorcycle Fleet & Garage Service for MotoTrack
// Handles registering, editing, deleting, and syncing customer motorcycles
// with Supabase (public.customer_motorcycles) & local offline cache.
// =========================================================================

import { appStorage } from './storageAdapter.js';
import { supabaseManager } from './supabaseClient.js';

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

const DEFAULT_SEED_MOTORCYCLES = [
  {
    motorcycle_id: 'moto-seed-01',
    user_id: 'usr-rider-01',
    customer_id: 'cust-demo-01',
    brand: 'Yamaha',
    model: 'NMAX 155 Connected',
    year: 2023,
    plate_number: 'NM-4892',
    engine_cc: 155,
    color: 'Matte Dark Bluish Gray',
    odometer: '12,400 km',
    vin_number: 'MH3SG3320PJ01982',
    nickname: 'Blue Hornet (Daily Commuter)',
    photo_url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    is_primary: true,
    notes: 'Stage 1 CVT tuning, Pirelli Angel Scooter tires installed.',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    motorcycle_id: 'moto-seed-02',
    user_id: 'usr-rider-01',
    customer_id: 'cust-demo-01',
    brand: 'Kawasaki',
    model: 'Ninja ZX-6R 636',
    year: 2024,
    plate_number: 'ZX-6360',
    engine_cc: 636,
    color: 'KRT Lime Green / Ebony',
    odometer: '4,850 km',
    vin_number: 'JKAZX4J10PA04812',
    nickname: 'Green Goblin (Weekend Track)',
    photo_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    is_primary: false,
    notes: 'Akrapovič slip-on exhaust, Quickshifter calibrated for track days.',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

class MotorcycleService {
  constructor() {
    this.listeners = new Set();
    this.motorcycles = this._loadLocal();
    // Background sync on init
    this.syncFromSupabase();
  }

  _loadLocal() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_e) {}
    return [...DEFAULT_SEED_MOTORCYCLES];
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
    try {
      const client = supabaseManager.getClient();
      if (!client) return this.motorcycles;

      let query = client
        .from('customer_motorcycles')
        .select('*')
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

      if (!error && Array.isArray(data) && data.length > 0) {
        this._saveLocal(data);
        return data;
      }
    } catch (_e) {
      // Offline fallback is already active
    }
    return this.motorcycles;
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
        (userId && m.user_id === userId) ||
        (customerId && m.customer_id === customerId) ||
        (customerEmail && m.customer_email === customerEmail)
    );
    // If user has no bikes yet, fallback to all local bikes or seeds for demo purposes
    if (filtered.length === 0) {
      return [...this.motorcycles];
    }
    return filtered;
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

    // Default image if none provided
    let photoUrl = bikeData.photo_url || '';
    if (!photoUrl) {
      const matched = MOTORCYCLE_PHOTO_PRESETS.find(
        (p) => p.brand.toLowerCase() === brand.toLowerCase()
      );
      photoUrl = matched
        ? matched.url
        : 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80';
    }

    const newRecord = {
      motorcycle_id: newId,
      user_id: bikeData.user_id || 'usr-rider-01',
      customer_id: bikeData.customer_id || 'cust-demo-01',
      customer_email: (bikeData.customer_email || bikeData.email || '').trim().toLowerCase(),
      brand,
      model,
      year: bikeData.year ? parseInt(bikeData.year, 10) : new Date().getFullYear(),
      plate_number: plate,
      engine_cc: bikeData.engine_cc ? parseInt(bikeData.engine_cc, 10) : 150,
      color: (bikeData.color || 'Standard Metallic').trim(),
      odometer: (bikeData.odometer || '0 km').trim(),
      vin_number: (bikeData.vin_number || '').trim(),
      nickname: (bikeData.nickname || `${brand} ${model}`).trim(),
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
