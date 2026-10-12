/**
 * GPS delivery location sync — latest point per order.
 * Upserts every UPDATE_INTERVAL_MS while rider is actively delivering.
 * Subscribes via Supabase Realtime for admin/customer maps.
 */
import { supabaseManager } from '../../lib/supabase.js';
import { parseLatLng } from '../../utils/geo.js';
import { hashDeliveryToken } from '../../utils/deliveryToken.js';

/** Reasonable interval: avoid writing every second */
export const GPS_UPDATE_INTERVAL_MS = 8000;
/** Ignore tiny GPS jitter (meters approx via degree threshold ~5m) */
const MIN_MOVE_DEG = 0.000045;

function client() {
  return supabaseManager.getClient();
}

function newId() {
  return `dloc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRow(row) {
  if (!row) return null;
  const coords = parseLatLng(row.latitude, row.longitude);
  if (!coords) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    riderId: row.rider_id,
    latitude: coords.lat,
    longitude: coords.lng,
    accuracy: row.accuracy != null ? Number(row.accuracy) : null,
    heading: row.heading != null ? Number(row.heading) : null,
    speed: row.speed != null ? Number(row.speed) : null,
    updatedAt: row.updated_at || null,
  };
}

function shouldSkipWrite(prev, next) {
  if (!prev) return false;
  const dt = new Date(next.updated_at || 0).getTime() - new Date(prev.updated_at || 0).getTime();
  if (dt < GPS_UPDATE_INTERVAL_MS - 500) return true;
  const dLat = Math.abs(Number(next.latitude) - Number(prev.latitude));
  const dLng = Math.abs(Number(next.longitude) - Number(prev.longitude));
  if (dLat < MIN_MOVE_DEG && dLng < MIN_MOVE_DEG && dt < GPS_UPDATE_INTERVAL_MS * 2) {
    return true;
  }
  return false;
}

const lastWriteByOrder = new Map();

export const deliveryLocationService = {
  GPS_UPDATE_INTERVAL_MS,

  async getLatestForOrder(orderId) {
    if (!orderId) return null;
    const c = client();
    if (!c) return null;
    try {
      const { data, error } = await c
        .from('delivery_locations')
        .select('id, order_id, rider_id, latitude, longitude, accuracy, heading, speed, updated_at')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) {
        console.warn('[deliveryLocationService] getLatestForOrder:', error.message);
        return null;
      }
      return normalizeRow(data);
    } catch (e) {
      console.warn('[deliveryLocationService] getLatestForOrder:', e);
      return null;
    }
  },

  /**
   * Upsert latest GPS for an active delivery.
   * Debounces writes client-side; DB unique on order_id.
   */
  async upsertLocation({
    orderId,
    riderId,
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
    force = false,
    accessToken = null,
  }) {
    const coords = parseLatLng(latitude, longitude);
    if (!orderId || !coords) {
      return { success: false, error: 'orderId and valid coordinates required' };
    }
    if (!riderId && !accessToken) {
      return { success: false, error: 'riderId or accessToken required' };
    }

    const nowIso = new Date().toISOString();
    const payload = {
      order_id: orderId,
      rider_id: riderId,
      latitude: coords.lat,
      longitude: coords.lng,
      accuracy: accuracy != null && Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
      heading: heading != null && Number.isFinite(Number(heading)) ? Number(heading) : null,
      speed: speed != null && Number.isFinite(Number(speed)) ? Number(speed) : null,
      updated_at: nowIso,
    };

    const prev = lastWriteByOrder.get(orderId);
    if (!force && shouldSkipWrite(prev, payload)) {
      return { success: true, skipped: true, location: normalizeRow({ ...payload, id: prev?.id }) };
    }

    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    // Token dashboard (anon) — SECURITY DEFINER RPC
    if (accessToken) {
      try {
        const { data, error } = await c.rpc('rider_upsert_delivery_location', {
          p_token_hash: hashDeliveryToken(accessToken),
          p_order_id: orderId,
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_accuracy: payload.accuracy,
          p_heading: payload.heading,
          p_speed: payload.speed,
        });
        if (error) return { success: false, error: error.message };
        const row = data && typeof data === 'object' ? data : {};
        if (!row.success) return { success: false, error: row.error || 'GPS upsert failed' };
        const normalized = normalizeRow({
          id: row.id,
          order_id: row.order_id || orderId,
          rider_id: row.rider_id || riderId,
          latitude: row.latitude ?? coords.lat,
          longitude: row.longitude ?? coords.lng,
          accuracy: payload.accuracy,
          heading: payload.heading,
          speed: payload.speed,
          updated_at: row.updated_at || nowIso,
        });
        if (normalized) lastWriteByOrder.set(orderId, { ...payload, id: normalized.id });
        return { success: true, location: normalized };
      } catch (e) {
        return { success: false, error: e?.message || 'GPS upsert failed' };
      }
    }

    try {
      const existing = await this.getLatestForOrder(orderId);
      let row;
      if (existing?.id) {
        const { data, error } = await c
          .from('delivery_locations')
          .update(payload)
          .eq('order_id', orderId)
          .eq('rider_id', riderId)
          .select('id, order_id, rider_id, latitude, longitude, accuracy, heading, speed, updated_at')
          .maybeSingle();
        if (error) return { success: false, error: error.message };
        row = data;
      } else {
        const { data, error } = await c
          .from('delivery_locations')
          .insert([{ id: newId(), ...payload, created_at: nowIso }])
          .select('id, order_id, rider_id, latitude, longitude, accuracy, heading, speed, updated_at')
          .maybeSingle();
        if (error) {
          // Concurrent insert race → update
          if (String(error.message || '').toLowerCase().includes('duplicate')) {
            const retry = await c
              .from('delivery_locations')
              .update(payload)
              .eq('order_id', orderId)
              .eq('rider_id', riderId)
              .select(
                'id, order_id, rider_id, latitude, longitude, accuracy, heading, speed, updated_at'
              )
              .maybeSingle();
            if (retry.error) return { success: false, error: retry.error.message };
            row = retry.data;
          } else {
            return { success: false, error: error.message };
          }
        } else {
          row = data;
        }
      }

      const normalized = normalizeRow(row);
      if (normalized) lastWriteByOrder.set(orderId, { ...payload, id: normalized.id });
      return { success: true, location: normalized };
    } catch (e) {
      return { success: false, error: e?.message || 'Failed to upsert location' };
    }
  },

  /** Clear GPS row when delivery ends (delivered / cancelled / stopped). */
  async clearLocation(orderId, { riderId, accessToken } = {}) {
    if (!orderId) return { success: false, error: 'orderId required' };
    lastWriteByOrder.delete(orderId);
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    try {
      if (accessToken) {
        const { data, error } = await c.rpc('rider_clear_delivery_location', {
          p_token_hash: hashDeliveryToken(accessToken),
          p_order_id: orderId,
        });
        if (error) return { success: false, error: error.message };
        const row = data && typeof data === 'object' ? data : {};
        if (row.success === false) return { success: false, error: row.error || 'Clear failed' };
        return { success: true };
      }
      let q = c.from('delivery_locations').delete().eq('order_id', orderId);
      if (riderId) q = q.eq('rider_id', riderId);
      const { error } = await q;
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || 'Failed to clear location' };
    }
  },

  /**
   * Subscribe to location changes for a single order.
   * Returns unsubscribe fn. Cleans up channel on leave.
   */
  subscribeToOrder(orderId, onChange) {
    if (!orderId || typeof onChange !== 'function') return () => {};
    const c = client();
    if (!c) return () => {};

    const channelName = `delivery_loc:${orderId}:${Date.now()}`;
    const channel = c
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (payload.eventType === 'DELETE') {
            onChange(null, { event: 'DELETE' });
            return;
          }
          onChange(normalizeRow(row), { event: payload.eventType || 'UPDATE' });
        }
      )
      .subscribe();

    // Initial fetch
    this.getLatestForOrder(orderId).then((loc) => {
      if (loc) onChange(loc, { event: 'INITIAL' });
    });

    return () => {
      try {
        c.removeChannel(channel);
      } catch (_e) {}
    };
  },
};

export default deliveryLocationService;
