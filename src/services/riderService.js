/**
 * MotoTrack Delivery Rider Staff Roster + login accounts.
 * Admins create rider users (role = rider). Riders cannot self-register.
 */
import { appStorage } from './storageAdapter';
import { supabaseManager } from './supabaseClient';
import { userService } from './userService';

const STORAGE_KEY = 'mototrack_riders_list';

export const RIDER_STATUSES = {
  AVAILABLE: 'Available',
  ON_DELIVERY: 'On Delivery',
  OFF_DUTY: 'Off Duty',
};

export const RIDER_ACCOUNT_STATUSES = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export const RIDER_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
];

export const DEFAULT_RIDERS = [
  {
    id: 'rider-juan',
    name: 'Juan Dela Cruz',
    shortName: 'Juan',
    phone: '09171234567',
    vehicleInfo: 'Yamaha NMAX 155',
    plateNumber: 'NMX-1001',
    avatar: RIDER_AVATAR_PRESETS[0],
    status: RIDER_STATUSES.AVAILABLE,
    accountStatus: RIDER_ACCOUNT_STATUSES.ACTIVE,
    role: 'Rider',
    email: '',
    username: '',
    userId: null,
    rating: 4.9,
    notes: '',
    totalEarnings: 0,
  },
  {
    id: 'rider-maria',
    name: 'Maria Santos',
    shortName: 'Maria',
    phone: '09181234567',
    vehicleInfo: 'Honda Click 160',
    plateNumber: 'HND-2044',
    avatar: RIDER_AVATAR_PRESETS[1],
    status: RIDER_STATUSES.AVAILABLE,
    accountStatus: RIDER_ACCOUNT_STATUSES.ACTIVE,
    role: 'Rider',
    email: '',
    username: '',
    userId: null,
    rating: 4.8,
    notes: '',
    totalEarnings: 0,
  },
  {
    id: 'rider-carlo',
    name: 'Carlo Reyes',
    shortName: 'Carlo',
    phone: '09191234567',
    vehicleInfo: 'Kawasaki Rouser 200',
    plateNumber: 'KAW-3310',
    avatar: RIDER_AVATAR_PRESETS[2],
    status: RIDER_STATUSES.AVAILABLE,
    accountStatus: RIDER_ACCOUNT_STATUSES.ACTIVE,
    role: 'Rider',
    email: '',
    username: '',
    userId: null,
    rating: 5.0,
    notes: '',
    totalEarnings: 0,
  },
];

function normalizeAccountStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'inactive' || s === 'disabled') return RIDER_ACCOUNT_STATUSES.INACTIVE;
  return RIDER_ACCOUNT_STATUSES.ACTIVE;
}

function normalizeRider(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName || row.short_name || (row.name ? String(row.name).split('(')[0].trim() : 'Rider'),
    phone: row.phone || '',
    vehicleInfo: row.vehicleInfo || row.vehicle_info || '',
    plateNumber: row.plateNumber || row.plate_number || '',
    avatar: row.avatar || RIDER_AVATAR_PRESETS[0],
    status: row.status || RIDER_STATUSES.AVAILABLE,
    accountStatus: normalizeAccountStatus(row.accountStatus || row.account_status),
    role: row.role || 'Rider',
    email: String(row.email || '').trim().toLowerCase(),
    username: String(row.username || '').trim().toLowerCase(),
    userId: row.userId || row.user_id || null,
    rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : 5.0,
    notes: row.notes || '',
    totalEarnings: Number(row.totalEarnings ?? row.total_earnings ?? 0) || 0,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function toDbRow(rider) {
  return {
    id: rider.id,
    name: rider.name,
    short_name: rider.shortName,
    phone: rider.phone,
    vehicle_info: rider.vehicleInfo,
    plate_number: rider.plateNumber,
    avatar: rider.avatar,
    status: rider.status,
    account_status: normalizeAccountStatus(rider.accountStatus),
    role: rider.role || 'Rider',
    email: rider.email || null,
    username: rider.username || null,
    user_id: rider.userId || null,
    rating: rider.rating,
    notes: rider.notes || '',
    total_earnings: Number(rider.totalEarnings || 0) || 0,
  };
}

function isInactiveRider(rider) {
  return normalizeAccountStatus(rider?.accountStatus) === RIDER_ACCOUNT_STATUSES.INACTIVE;
}

function getClientOrNull() {
  try {
    return supabaseManager.getClient() || null;
  } catch (_e) {
    return null;
  }
}

const riderListeners = new Set();
let riderRealtimeChannel = null;
let riderRealtimeTimer = null;

function notifyRiderListeners(list) {
  const payload = Array.isArray(list) ? list : riderService.getRiders();
  riderListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('[RiderService] listener error:', e);
    }
  });
}

function setupRiderRealtime() {
  if (riderRealtimeChannel) return;
  try {
    const client = getClientOrNull();
    if (!client) return;
    riderRealtimeChannel = client
      .channel('public:riders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, async () => {
        if (riderRealtimeTimer) clearTimeout(riderRealtimeTimer);
        riderRealtimeTimer = setTimeout(async () => {
          try {
            const fresh = await riderService.fetchRiders();
            notifyRiderListeners(fresh);
          } catch (_e) {
            notifyRiderListeners(riderService.getRiders());
          }
        }, 250);
      })
      .subscribe();
  } catch (e) {
    console.warn('[RiderService] realtime setup failed:', e);
  }
}

export const riderService = {
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    riderListeners.add(listener);
    setupRiderRealtime();
    return () => riderListeners.delete(listener);
  },

  getRiders() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeRider).filter(Boolean);
        }
      }
    } catch (e) {
      console.warn('[RiderService] getRiders local error:', e);
    }
    // Database is the source of truth — never invent demo riders from cache miss.
    return [];
  },

  saveRiders(list, { silent = false } = {}) {
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
      if (!silent) notifyRiderListeners(list);
    } catch (e) {
      console.warn('[RiderService] saveRiders error:', e);
    }
  },

  getRiderById(riderId) {
    if (!riderId) return null;
    return this.getRiders().find((r) => r.id === riderId) || null;
  },

  getRiderByUserId(userId) {
    if (!userId) return null;
    const id = String(userId);
    return (
      this.getRiders().find((r) => r.userId === id || r.user_id === id) || null
    );
  },

  getRiderByUsername(username) {
    const u = String(username || '').trim().toLowerCase();
    if (!u) return null;
    return (
      this.getRiders().find(
        (r) =>
          String(r.username || '').toLowerCase() === u ||
          String(r.email || '').toLowerCase() === u
      ) || null
    );
  },

  isLoginAllowed(rider) {
    return Boolean(rider) && !isInactiveRider(rider);
  },

  getAvailableRiders() {
    return this.getRiders().filter(
      (r) =>
        (r.status || '').toLowerCase() !== RIDER_STATUSES.OFF_DUTY.toLowerCase() &&
        !isInactiveRider(r)
    );
  },

  async requireClient() {
    const client = getClientOrNull();
    if (!client) {
      return {
        client: null,
        error: 'Database is not connected. Rider accounts must be saved in Supabase.',
      };
    }
    return { client, error: null };
  },

  async upsertRiderRow(rider) {
    const { client, error: clientError } = await this.requireClient();
    if (!client) return { success: false, error: clientError };
    const row = {
      ...toDbRow(rider),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client
      .from('riders')
      .upsert([row], { onConflict: 'id' })
      .select('*')
      .maybeSingle();
    if (error) {
      return { success: false, error: error.message || 'Could not save rider to the database.' };
    }
    return { success: true, rider: normalizeRider(data || rider) };
  },

  async findDbConflict({ riderId, email, username, excludeId = null }) {
    const { client } = await this.requireClient();
    if (!client) return null;
    const emailNorm = String(email || '').trim().toLowerCase();
    const userNorm = String(username || '').trim().toLowerCase();
    const idNorm = String(riderId || '').trim();
    const skipId = String(excludeId || '').trim();

    if (idNorm && idNorm !== skipId) {
      const { data } = await client.from('riders').select('id').eq('id', idNorm).maybeSingle();
      if (data?.id) return 'That Rider ID is already in use.';
    }
    if (userNorm) {
      let q = client.from('riders').select('id').ilike('username', userNorm);
      if (skipId) q = q.neq('id', skipId);
      const { data } = await q.maybeSingle();
      if (data?.id) return 'That username is already assigned to another rider.';
    }
    if (emailNorm) {
      let q = client.from('riders').select('id').ilike('email', emailNorm);
      if (skipId) q = q.neq('id', skipId);
      const { data } = await q.maybeSingle();
      if (data?.id) return 'That email is already assigned to another rider.';
    }
    return null;
  },

  /**
   * Optional one-time helper. Do not call from fetch — an empty DB must stay empty
   * after the admin deletes all riders.
   */
  async syncLocalRidersToDatabase(localList = null) {
    const { client, error: clientError } = await this.requireClient();
    if (!client) return { success: false, error: clientError, synced: 0 };

    const locals = (localList || this.getRiders()).map(normalizeRider).filter(Boolean);
    if (!locals.length) return { success: true, synced: 0 };

    const rows = locals.map((r) => ({
      ...toDbRow(r),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from('riders').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('[RiderService] syncLocalRidersToDatabase:', error.message || error);
      return { success: false, error: error.message || 'Could not sync riders to the database.', synced: 0 };
    }
    return { success: true, synced: rows.length };
  },

  async fetchRiders() {
    try {
      const { client, error: clientError } = await this.requireClient();
      if (!client) {
        console.warn('[RiderService] fetchRiders:', clientError);
        return this.getRiders();
      }

      const { data, error } = await client
        .from('riders')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[RiderService] fetchRiders note:', error.message || error);
        return this.getRiders();
      }

      // DB is source of truth — including an empty list after admin deletes everyone.
      const normalized = Array.isArray(data) ? data.map(normalizeRider).filter(Boolean) : [];
      this.saveRiders(normalized, { silent: true });
      return normalized;
    } catch (e) {
      console.warn('[RiderService] fetchRiders error:', e);
    }
    return this.getRiders();
  },

  async seedInitialRiders() {
    // Intentionally no longer auto-seeds. Admins create riders from the dashboard.
    return { success: true, seeded: 0 };
  },

  async addRider(riderData) {
    const list = this.getRiders();
    const cleanName = (riderData.name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Rider name is required' };
    }
    const phone = (riderData.phone || '').trim();
    if (!phone || phone.length < 8) {
      return { success: false, error: 'Valid rider phone is required' };
    }

    const email = String(riderData.email || '').trim().toLowerCase();
    const username = String(riderData.username || '').trim().toLowerCase();
    const password = String(riderData.password || '').trim();
    const accountStatus = normalizeAccountStatus(riderData.accountStatus || riderData.account_status);

    if (!email || !email.includes('@')) {
      return { success: false, error: 'A valid rider email is required for login.' };
    }
    if (!username || username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters.' };
    }
    if (!/^[a-z0-9._-]+$/i.test(username)) {
      return { success: false, error: 'Username may only contain letters, numbers, dots, dashes, and underscores.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Temporary password must be at least 6 characters.' };
    }

    const { client, error: clientError } = await this.requireClient();
    if (!client) return { success: false, error: clientError };

    const uniqueId = String(riderData.id || '').trim()
      || `rider-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    if (list.some((r) => String(r.id).toLowerCase() === uniqueId.toLowerCase())) {
      return { success: false, error: 'That Rider ID is already in use.' };
    }
    if (list.some((r) => String(r.username || '').toLowerCase() === username)) {
      return { success: false, error: 'That username is already assigned to another rider.' };
    }
    if (list.some((r) => String(r.email || '').toLowerCase() === email)) {
      return { success: false, error: 'That email is already assigned to another rider.' };
    }

    const dbConflict = await this.findDbConflict({ riderId: uniqueId, email, username });
    if (dbConflict) return { success: false, error: dbConflict };

    const userRes = await userService.createUser({
      name: cleanName,
      email,
      password,
      phone,
      address: 'MotoTrack Delivery Staff',
      role: 'rider',
      username,
      status: accountStatus === RIDER_ACCOUNT_STATUSES.INACTIVE ? 'inactive' : 'active',
    });
    if (!userRes.success) {
      return { success: false, error: userRes.error || 'Could not create the rider login account.' };
    }

    const newRider = normalizeRider({
      id: uniqueId,
      name: cleanName,
      shortName: riderData.shortName?.trim() || cleanName.split(' ')[0],
      phone,
      vehicleInfo: riderData.vehicleInfo?.trim() || riderData.vehicle_info?.trim() || '',
      plateNumber: riderData.plateNumber?.trim() || riderData.plate_number?.trim() || '',
      avatar:
        riderData.avatar?.trim() || RIDER_AVATAR_PRESETS[list.length % RIDER_AVATAR_PRESETS.length],
      status: riderData.status || RIDER_STATUSES.AVAILABLE,
      accountStatus,
      role: 'Rider',
      email,
      username,
      userId: userRes.user?.user_id || userRes.user?.id || null,
      rating: riderData.rating !== undefined ? Number(riderData.rating) : 5.0,
      notes: riderData.notes?.trim() || '',
      totalEarnings: Number(riderData.totalEarnings ?? riderData.total_earnings ?? 0) || 0,
      createdAt: new Date().toISOString(),
    });

    const saved = await this.upsertRiderRow(newRider);
    if (!saved.success) {
      return {
        success: false,
        error: saved.error || 'Rider login was created, but the rider profile could not be saved to the database.',
      };
    }

    const persisted = saved.rider || newRider;
    const updated = [persisted, ...list.filter((r) => r.id !== persisted.id)];
    this.saveRiders(updated);

    return { success: true, rider: persisted };
  },

  async updateRider(riderId, updateData) {
    const list = this.getRiders();
    const index = list.findIndex((r) => r.id === riderId);
    if (index === -1) return { success: false, error: 'Rider not found' };

    const { client, error: clientError } = await this.requireClient();
    if (!client) return { success: false, error: clientError };

    const existing = list[index];
    const nextEmail = String(updateData.email ?? existing.email ?? '').trim().toLowerCase();
    const nextUsername = String(updateData.username ?? existing.username ?? '').trim().toLowerCase();
    const nextAccount = normalizeAccountStatus(
      updateData.accountStatus ?? updateData.account_status ?? existing.accountStatus
    );
    const nextPassword = String(updateData.password || '').trim();

    if (nextEmail && list.some((r) => r.id !== riderId && String(r.email || '').toLowerCase() === nextEmail)) {
      return { success: false, error: 'That email is already assigned to another rider.' };
    }
    if (nextUsername && list.some((r) => r.id !== riderId && String(r.username || '').toLowerCase() === nextUsername)) {
      return { success: false, error: 'That username is already assigned to another rider.' };
    }

    const dbConflict = await this.findDbConflict({
      email: nextEmail,
      username: nextUsername,
      excludeId: riderId,
    });
    if (dbConflict) return { success: false, error: dbConflict };

    let userId = existing.userId || null;
    if (!userId && nextEmail && nextUsername && nextPassword) {
      const userRes = await userService.createUser({
        name: (updateData.name || existing.name || '').trim(),
        email: nextEmail,
        password: nextPassword,
        phone: (updateData.phone || existing.phone || '').trim(),
        address: 'MotoTrack Delivery Staff',
        role: 'rider',
        username: nextUsername,
        status: nextAccount === RIDER_ACCOUNT_STATUSES.INACTIVE ? 'inactive' : 'active',
      });
      if (!userRes.success) {
        return { success: false, error: userRes.error || 'Could not create the rider login account.' };
      }
      userId = userRes.user?.user_id || userRes.user?.id || null;
    } else if (userId) {
      const userUpdates = {
        name: updateData.name ?? existing.name,
        phone: updateData.phone ?? existing.phone,
        status: nextAccount === RIDER_ACCOUNT_STATUSES.INACTIVE ? 'inactive' : 'active',
        username: nextUsername,
        email: nextEmail,
      };
      if (nextPassword) userUpdates.password = nextPassword;
      const accountRes = await userService.updateRiderAccount(userId, userUpdates);
      if (!accountRes?.success) {
        return { success: false, error: accountRes?.error || 'Could not update the rider login account.' };
      }
    }

    const updatedRider = normalizeRider({
      ...existing,
      ...updateData,
      id: existing.id,
      shortName: updateData.shortName ?? updateData.short_name ?? existing.shortName,
      vehicleInfo: updateData.vehicleInfo ?? updateData.vehicle_info ?? existing.vehicleInfo,
      plateNumber: updateData.plateNumber ?? updateData.plate_number ?? existing.plateNumber,
      email: nextEmail,
      username: nextUsername,
      accountStatus: nextAccount,
      role: 'Rider',
      userId,
      updatedAt: new Date().toISOString(),
    });

    const saved = await this.upsertRiderRow(updatedRider);
    if (!saved.success) {
      return { success: false, error: saved.error || 'Could not update the rider in the database.' };
    }

    const persisted = saved.rider || updatedRider;
    list[index] = persisted;
    this.saveRiders(list);

    return { success: true, rider: persisted };
  },

  async setRiderStatus(riderId, status) {
    if (!riderId) return { success: false, error: 'No rider id' };
    return this.updateRider(riderId, { status });
  },

  async deleteRider(riderId) {
    const list = this.getRiders();
    const existing = list.find((r) => r.id === riderId);
    if (!existing) {
      return { success: false, error: 'Rider not found' };
    }

    const { client, error: clientError } = await this.requireClient();
    if (!client) return { success: false, error: clientError };

    const { error } = await client.from('riders').delete().eq('id', riderId);
    if (error) {
      return { success: false, error: error.message || 'Could not delete the rider from the database.' };
    }

    const next = list.filter((r) => r.id !== riderId);
    this.saveRiders(next);

    return { success: true };
  },

  /**
   * Credit shipping fee as rider earnings for a completed delivery.
   */
  async creditShippingEarning({
    riderId,
    riderName,
    orderId,
    deliveryId,
    amount,
    creditedBy = 'Admin',
    notes = '',
  }) {
    const earning = Math.max(0, Number(amount) || 0);
    if (earning <= 0) {
      return { success: true, amount: 0, skipped: true };
    }

    const row = {
      id: `re-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`,
      rider_id: riderId || null,
      order_id: orderId || null,
      delivery_id: deliveryId || null,
      rider_name: riderName || null,
      amount: earning,
      source: 'shipping_fee',
      notes: notes || `Shipping fee for order #${orderId}`,
      credited_by: creditedBy,
      created_at: new Date().toISOString(),
    };

    let updatedRider = null;
    if (riderId) {
      const list = this.getRiders();
      const idx = list.findIndex((r) => r.id === riderId);
      if (idx >= 0) {
        const nextTotal = Number(list[idx].totalEarnings || 0) + earning;
        list[idx] = { ...list[idx], totalEarnings: nextTotal, updatedAt: new Date().toISOString() };
        this.saveRiders(list);
        updatedRider = list[idx];
      }
    }

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('rider_earnings').insert([row]);
        if (riderId && updatedRider) {
          await client
            .from('riders')
            .update({
              total_earnings: Number(updatedRider.totalEarnings || 0),
              updated_at: new Date().toISOString(),
            })
            .eq('id', riderId);
        } else if (riderId) {
          // Increment in DB if local roster miss
          const { data } = await client.from('riders').select('total_earnings').eq('id', riderId).maybeSingle();
          const next = Number(data?.total_earnings || 0) + earning;
          await client
            .from('riders')
            .update({ total_earnings: next, updated_at: new Date().toISOString() })
            .eq('id', riderId);
        }
      }
    } catch (e) {
      console.warn('[RiderService] creditShippingEarning:', e);
    }

    return { success: true, amount: earning, rider: updatedRider, earning: row };
  },

  async getRiderEarnings(riderId, { limit = 50 } = {}) {
    if (!riderId) return [];
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('rider_earnings')
          .select('*')
          .eq('rider_id', riderId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!error && Array.isArray(data)) return data;
      }
    } catch (e) {
      console.warn('[RiderService] getRiderEarnings:', e);
    }
    return [];
  },
};
