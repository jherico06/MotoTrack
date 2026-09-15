import { supabaseManager } from './supabaseClient';
import { appStorage } from './storageAdapter';

const STORAGE_KEY = 'mototrack_suppliers_db_cache';
const listeners = new Set();
let realtimeChannel = null;

export const SUPPLIER_CATEGORY_PRESETS = [
  'Exhaust & Performance',
  'Brakes & Hydraulics',
  'Suspension & Steering',
  'Chains & Sprockets',
  'ECU & Fuel Tuning',
  'Engine & Performance',
  'Engine Oils & Fluids',
  'Tires & Wheels',
  'Bodywork & Fairings',
  'Electrical & Ignition',
];

function notifyListeners(suppliers) {
  listeners.forEach((fn) => {
    try {
      fn(suppliers);
    } catch (e) {
      console.warn('Error in supplier listener:', e);
    }
  });
}

function setupRealtimeSubscription() {
  if (realtimeChannel) return;
  try {
    const client = supabaseManager.getClient();
    if (!client) return;

    realtimeChannel = client
      .channel('public:suppliers_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, async () => {
        const fresh = await supplierService.fetchSuppliers();
        notifyListeners(fresh);
      })
      .subscribe();
  } catch (e) {
    console.warn('Suppliers realtime subscription setup failed:', e);
  }
}

/**
 * Normalizes a supplier record coming from Supabase database.
 * If extended columns (email, categories, lead_time, etc.) were encoded into address JSON,
 * this function gracefully unpacks them.
 */
function normalizeSupplier(item) {
  if (!item || typeof item !== 'object') return null;

  let address = item.address || '';
  let email = item.email || '';
  let categories = item.categories || '';
  let lead_time = item.lead_time || '3-5 Days';
  let rating = item.rating ? String(item.rating) : '5.0';
  let status = item.status || 'Active';
  let notes = item.notes || '';

  // Check if address was packed as JSON metadata
  if (
    address &&
    typeof address === 'string' &&
    address.trim().startsWith('{') &&
    address.trim().endsWith('}')
  ) {
    try {
      const meta = JSON.parse(address.trim());
      if (meta && typeof meta === 'object') {
        address = meta.address || '';
        if (!email && meta.email) email = meta.email;
        if (!categories && meta.categories) categories = meta.categories;
        if (!item.lead_time && meta.lead_time) lead_time = meta.lead_time;
        if (!item.rating && meta.rating) rating = String(meta.rating);
        if (!item.status && meta.status) status = meta.status;
        if (!notes && meta.notes) notes = meta.notes;
      }
    } catch (_e) {
      // Keep address as string
    }
  }

  const id = item.supplier_id || item.id || `sup-${Date.now()}`;

  return {
    id,
    supplier_id: id,
    name: item.name || 'Unnamed Supplier',
    contact_person: item.contact_person || '',
    phone: item.phone || '',
    address,
    email,
    categories: categories || 'General Spare Parts',
    lead_time: lead_time || '3-5 Days',
    rating: rating || '5.0',
    status: status || 'Active',
    notes,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || item.created_at || new Date().toISOString(),
  };
}

export const supplierService = {
  /**
   * Subscribe to real-time supplier updates from the database
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      listeners.add(listener);
      setupRealtimeSubscription();
      return () => listeners.delete(listener);
    }
    return () => {};
  },

  /**
   * Synchronously returns cached suppliers from the database (never mock data).
   */
  getSuppliers() {
    try {
      const saved = appStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse suppliers from local cache:', e);
    }
    return [];
  },

  /**
   * Saves database suppliers to local cache and notifies UI listeners.
   */
  saveCache(suppliers) {
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
      notifyListeners(suppliers);
    } catch (e) {
      console.warn('Failed to save suppliers cache:', e);
    }
  },

  /**
   * Primary source of truth: Fetches all suppliers directly from the Supabase database.
   */
  async fetchSuppliers() {
    try {
      const client = supabaseManager.getClient();
      if (!client) {
        console.warn('Supabase client is not connected.');
        return this.getSuppliers();
      }

      const { data, error } = await client
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error querying Supabase suppliers table:', error.message);
        return this.getSuppliers();
      }

      if (Array.isArray(data)) {
        const normalized = data.map(normalizeSupplier).filter(Boolean);
        this.saveCache(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Exception during fetchSuppliers:', err);
    }

    return this.getSuppliers();
  },

  /**
   * Adds a new supplier directly into the Supabase database.
   */
  async addSupplier(data) {
    const cleanName = (data.name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Supplier company name is required.' };
    }

    const client = supabaseManager.getClient();
    if (!client) {
      return {
        success: false,
        error: 'Database is not connected. Please verify Supabase settings.',
      };
    }

    const newId =
      data.supplier_id ||
      `sup-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // Try inserting with dedicated schema columns first
    const extendedPayload = {
      supplier_id: newId,
      name: cleanName,
      contact_person: (data.contact_person || '').trim(),
      phone: (data.phone || '').trim(),
      address: (data.address || '').trim(),
      email: (data.email || '').trim(),
      categories: (data.categories || '').trim() || 'General Spare Parts',
      lead_time: (data.lead_time || '').trim() || '3-5 Days',
      rating: parseFloat(data.rating || '5.0') || 5.0,
      status: data.status || 'Active',
      notes: (data.notes || '').trim(),
    };

    let insertError = null;
    try {
      const res = await client.from('suppliers').insert([extendedPayload]).select();
      if (res.error) {
        insertError = res.error;
      } else {
        const fresh = await this.fetchSuppliers();
        return {
          success: true,
          supplier: normalizeSupplier(res.data?.[0] || extendedPayload),
          list: fresh,
        };
      }
    } catch (e) {
      insertError = e;
    }

    // Fallback to core columns with packed address JSON if extended columns don't exist yet
    if (insertError) {
      try {
        const corePayload = {
          supplier_id: newId,
          name: cleanName,
          contact_person: (data.contact_person || '').trim(),
          phone: (data.phone || '').trim(),
          address: JSON.stringify({
            address: (data.address || '').trim(),
            email: (data.email || '').trim(),
            categories: (data.categories || '').trim() || 'General Spare Parts',
            lead_time: (data.lead_time || '').trim() || '3-5 Days',
            rating: String(data.rating || '5.0'),
            status: data.status || 'Active',
            notes: (data.notes || '').trim(),
          }),
        };

        const res2 = await client.from('suppliers').insert([corePayload]).select();
        if (res2.error) {
          return { success: false, error: res2.error.message };
        }

        const fresh = await this.fetchSuppliers();
        return {
          success: true,
          supplier: normalizeSupplier(res2.data?.[0] || corePayload),
          list: fresh,
        };
      } catch (err2) {
        return { success: false, error: err2.message || 'Database insert failed' };
      }
    }

    return { success: false, error: 'Database insert failed' };
  },

  /**
   * Updates an existing supplier directly in the Supabase database.
   */
  async updateSupplier(supplierId, updateData) {
    const client = supabaseManager.getClient();
    if (!client) {
      return { success: false, error: 'Database is not connected.' };
    }

    const cleanName = (updateData.name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Supplier company name is required.' };
    }

    // Try updating with dedicated columns
    const extendedPayload = {
      name: cleanName,
      contact_person: (updateData.contact_person || '').trim(),
      phone: (updateData.phone || '').trim(),
      address: (updateData.address || '').trim(),
      email: (updateData.email || '').trim(),
      categories: (updateData.categories || '').trim() || 'General Spare Parts',
      lead_time: (updateData.lead_time || '').trim() || '3-5 Days',
      rating: parseFloat(updateData.rating || '5.0') || 5.0,
      status: updateData.status || 'Active',
      notes: (updateData.notes || '').trim(),
      updated_at: new Date().toISOString(),
    };

    let updateError = null;
    try {
      const res = await client
        .from('suppliers')
        .update(extendedPayload)
        .eq('supplier_id', supplierId)
        .select();

      if (res.error) {
        updateError = res.error;
      } else {
        const fresh = await this.fetchSuppliers();
        return {
          success: true,
          supplier: normalizeSupplier(res.data?.[0] || extendedPayload),
          list: fresh,
        };
      }
    } catch (e) {
      updateError = e;
    }

    // Fallback to core columns if extended columns do not exist
    if (updateError) {
      try {
        const corePayload = {
          name: cleanName,
          contact_person: (updateData.contact_person || '').trim(),
          phone: (updateData.phone || '').trim(),
          address: JSON.stringify({
            address: (updateData.address || '').trim(),
            email: (updateData.email || '').trim(),
            categories: (updateData.categories || '').trim() || 'General Spare Parts',
            lead_time: (updateData.lead_time || '').trim() || '3-5 Days',
            rating: String(updateData.rating || '5.0'),
            status: updateData.status || 'Active',
            notes: (updateData.notes || '').trim(),
          }),
          updated_at: new Date().toISOString(),
        };

        const res2 = await client
          .from('suppliers')
          .update(corePayload)
          .eq('supplier_id', supplierId)
          .select();

        if (res2.error) {
          return { success: false, error: res2.error.message };
        }

        const fresh = await this.fetchSuppliers();
        return {
          success: true,
          supplier: normalizeSupplier(res2.data?.[0] || corePayload),
          list: fresh,
        };
      } catch (err2) {
        return { success: false, error: err2.message || 'Database update failed' };
      }
    }

    return { success: false, error: 'Database update failed' };
  },

  /**
   * Deletes a supplier directly from the Supabase database.
   */
  async deleteSupplier(supplierId) {
    const client = supabaseManager.getClient();
    if (!client) {
      return { success: false, error: 'Database is not connected.' };
    }

    try {
      const { error } = await client
        .from('suppliers')
        .delete()
        .eq('supplier_id', supplierId);

      if (error) {
        return { success: false, error: error.message };
      }

      await this.fetchSuppliers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Database delete failed' };
    }
  },
};
