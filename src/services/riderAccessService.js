/**
 * Temporary rider dashboard access (no rider accounts).
 * Admin shares a hashed link; the public page loads only that rider's jobs.
 */
import { appStorage } from './storageAdapter';
import { supabaseManager } from './supabaseClient';
import { notificationService } from './notificationService';
import {
  generateSecureToken,
  hashDeliveryToken,
  tokenFromConfirmUrl,
  qrImageUrlForLink,
  resolvePhoneReachableOrigin,
  confirmUrlNeedsPhoneRewrite,
} from '../utils/deliveryToken';
import { geocodeAddress, parseLatLng } from '../utils/geo';

const STORAGE_KEY = 'mototrack_rider_access_cache';
export const RIDER_ACCESS_TTL_HOURS = 48;

export function riderAccessKey({ riderId, riderName, riderContact } = {}) {
  const id = String(riderId || '').trim();
  if (id) return `id:${id}`;
  const name = String(riderName || '')
    .trim()
    .toLowerCase();
  const phone = String(riderContact || '').replace(/\D/g, '');
  return `adhoc:${name}|${phone}`;
}

function getCache() {
  try {
    const raw = appStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_e) {}
  return {};
}

function saveCache(map) {
  try {
    appStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
  } catch (_e) {}
}

export function getCachedRiderAccessToken(key) {
  const entry = getCache()[key];
  return entry?.token || null;
}

function cacheRiderAccessToken(key, token, expiresAt) {
  if (!key || !token) return;
  const map = getCache();
  map[key] = { token, expiresAt: expiresAt || null, cached_at: new Date().toISOString() };
  saveCache(map);
}

export function buildRiderRunUrl(plainToken, baseUrl) {
  const token = String(plainToken || '').trim();
  if (!token) return '';
  let origin = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!origin) {
    origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://mototrack.app';
  }
  try {
    if (typeof URL !== 'undefined' && /^https?:\/\//i.test(origin)) {
      const u = new URL(origin.includes('?') ? origin.split('?')[0] : origin);
      u.searchParams.set('screen', 'rider-run');
      u.searchParams.set('token', token);
      return u.toString();
    }
  } catch (_e) {}
  const sep = origin.includes('?') ? '&' : '?';
  return `${origin}${sep}screen=rider-run&token=${encodeURIComponent(token)}`;
}

export async function makePhoneReachableRiderBundle(plainToken, existingUrl) {
  const token = String(plainToken || tokenFromConfirmUrl(existingUrl) || '').trim();
  if (!token) {
    return {
      token: '',
      dashboardUrl: existingUrl || '',
      qrImageUrl: existingUrl ? qrImageUrlForLink(existingUrl) : '',
      phoneReachable: false,
      expiresAt: null,
    };
  }
  const origin = await resolvePhoneReachableOrigin();
  const dashboardUrl = buildRiderRunUrl(token, origin);
  return {
    token,
    dashboardUrl,
    qrImageUrl: qrImageUrlForLink(dashboardUrl),
    phoneReachable: !confirmUrlNeedsPhoneRewrite(dashboardUrl),
    expiresAt: null,
  };
}

export function extractConfirmToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const fromUrl = tokenFromConfirmUrl(s);
  if (fromUrl) return fromUrl;
  const match = s.match(/[?&]token=([^&\s]+)/i);
  if (match) return decodeURIComponent(match[1]);
  if (/^[a-f0-9]{32,}$/i.test(s)) return s.toLowerCase();
  return s;
}

function normalizePreview(raw) {
  const row = raw && typeof raw === 'object' ? raw : {};
  const deliveries = Array.isArray(row.deliveries) ? row.deliveries : [];
  return {
    isValid: Boolean(row.is_valid),
    invalidReason: row.invalid_reason || null,
    expiresAt: row.expires_at || null,
    expired: Boolean(row.expired),
    invalidated: Boolean(row.invalidated),
    riderName: row.rider_name || '',
    riderContact: row.rider_contact || '',
    activeCount: Number(row.active_count || 0),
    completedCount: Number(row.completed_count || 0),
    deliveries: deliveries.map((d) => ({
      orderId: d.order_id,
      deliveryId: d.delivery_id,
      customerName: d.customer_name || 'Customer',
      customerPhone: d.customer_phone || '',
      customerAddress: d.customer_address || '',
      landmark: d.landmark || '',
      deliveryStatus: d.delivery_status || d.order_status || '',
      orderStatus: d.order_status || '',
      lat: d.delivery_lat,
      lng: d.delivery_lng,
      paymentMethod: d.payment_method || '',
      itemsSummary: d.items_summary || '',
      itemsCount: Number(d.items_count || 0),
      expectedDeliveryAt: d.expected_delivery_at,
      riderName: d.rider_name || row.rider_name || '',
      riderContact: d.rider_contact || row.rider_contact || '',
      vehicleInfo: d.vehicle_info || '',
      area: d.area || 'Unspecified area',
      tokenVerified: Boolean(d.token_verified),
      riderReported: Boolean(d.rider_reported_delivered),
    })),
  };
}

export const riderAccessService = {
  async issueRiderAccess({
    riderId,
    riderName,
    riderContact,
    adminUser,
    forceNew = false,
    ttlHours = RIDER_ACCESS_TTL_HOURS,
  }) {
    const key = riderAccessKey({ riderId, riderName, riderContact });
    let plainToken = forceNew ? null : getCachedRiderAccessToken(key);
    if (!plainToken) plainToken = generateSecureToken(32);
    const tokenHash = hashDeliveryToken(plainToken);
    const createdBy = adminUser?.name || adminUser?.email || adminUser?.id || 'Admin';

    const client = supabaseManager.getClient();
    let expiresAt = null;
    if (client) {
      try {
        const { data, error } = await client.rpc('issue_rider_access_token', {
          p_token_hash: tokenHash,
          p_rider_id: riderId || null,
          p_rider_name: riderName || null,
          p_rider_contact: riderContact || null,
          p_ttl_hours: ttlHours,
          p_created_by: createdBy,
          p_force_new: Boolean(forceNew),
        });
        if (error) {
          console.warn('[RiderAccess] issue rpc:', error);
          return { success: false, error: error.message || 'Could not issue rider access.' };
        }
        const row = data && typeof data === 'object' ? data : {};
        if (row.success === false) {
          return { success: false, error: row.error || 'Could not issue rider access.' };
        }
        expiresAt = row.expires_at || null;
      } catch (e) {
        console.warn('[RiderAccess] issue:', e);
        return { success: false, error: e?.message || 'Could not issue rider access.' };
      }
    }

    cacheRiderAccessToken(key, plainToken, expiresAt);
    const bundle = await makePhoneReachableRiderBundle(plainToken);
    return {
      success: true,
      token: bundle.token,
      dashboardUrl: bundle.dashboardUrl,
      qrImageUrl: bundle.qrImageUrl,
      phoneReachable: bundle.phoneReachable,
      expiresAt,
      riderKey: key,
      riderName,
      riderContact,
    };
  },

  async getCachedBundle({ riderId, riderName, riderContact } = {}) {
    const key = riderAccessKey({ riderId, riderName, riderContact });
    const token = getCachedRiderAccessToken(key);
    if (!token) return null;
    const bundle = await makePhoneReachableRiderBundle(token);
    return { ...bundle, riderKey: key, riderName, riderContact };
  },

  async getPreview(plainToken) {
    const token = String(plainToken || '').trim();
    if (!token || token.length < 16) {
      return { success: false, error: 'Invalid or missing access token.', preview: null };
    }
    const tokenHash = hashDeliveryToken(token);
    const client = supabaseManager.getClient();
    if (!client) {
      return { success: false, error: 'Cannot reach the store right now.', preview: null };
    }
    try {
      const { data, error } = await client.rpc('get_rider_run_preview', {
        p_token_hash: tokenHash,
      });
      if (error) {
        return { success: false, error: error.message || 'Could not load deliveries.', preview: null };
      }
      const preview = normalizePreview(data);
      return {
        success: preview.isValid,
        error: preview.isValid ? null : preview.invalidReason || 'This rider link is not valid.',
        preview,
      };
    } catch (e) {
      return { success: false, error: e?.message || 'Could not load deliveries.', preview: null };
    }
  },

  async fillMissingCoords(plainToken, deliveries) {
    const token = String(plainToken || '').trim();
    const list = Array.isArray(deliveries) ? deliveries : [];
    const client = supabaseManager.getClient();
    const next = [];
    for (const d of list) {
      if (parseLatLng(d.lat, d.lng)) {
        next.push(d);
        continue;
      }
      const geo = await geocodeAddress(d.customerAddress);
      if (!geo) {
        next.push(d);
        continue;
      }
      if (client && token) {
        try {
          await client.rpc('rider_save_delivery_coords', {
            p_token_hash: hashDeliveryToken(token),
            p_order_id: d.orderId,
            p_lat: geo.lat,
            p_lng: geo.lng,
          });
        } catch (_e) {}
      }
      next.push({ ...d, lat: geo.lat, lng: geo.lng });
    }
    return next;
  },

  async updateStatus({ token, orderId, status, notes = '' }) {
    const client = supabaseManager.getClient();
    if (!client) return { success: false, error: 'Cannot reach the store right now.' };
    try {
      const { data, error } = await client.rpc('rider_update_delivery_status', {
        p_token_hash: hashDeliveryToken(token),
        p_order_id: orderId,
        p_new_status: status,
        p_notes: notes || null,
      });
      if (error) return { success: false, error: error.message || 'Status update failed.' };
      const row = data && typeof data === 'object' ? data : {};
      if (!row.success) return { success: false, error: row.error || 'Status update failed.' };
      return { success: true, orderId: row.order_id, deliveryStatus: row.delivery_status };
    } catch (e) {
      return { success: false, error: e?.message || 'Status update failed.' };
    }
  },

  async confirmByQr({ accessToken, orderId, scannedRaw, notes = '', photo = null }) {
    const confirmToken = extractConfirmToken(scannedRaw);
    if (!confirmToken) {
      return { success: false, error: 'Scan the QR on the parcel packing label.' };
    }
    const client = supabaseManager.getClient();
    if (!client) return { success: false, error: 'Cannot reach the store right now.' };
    try {
      const { data, error } = await client.rpc('rider_confirm_delivery_by_qr', {
        p_access_hash: hashDeliveryToken(accessToken),
        p_order_id: orderId,
        p_confirm_token_hash: hashDeliveryToken(confirmToken),
        p_notes: notes || null,
        p_photo: photo || null,
      });
      if (error) return { success: false, error: error.message || 'QR confirmation failed.' };
      const row = data && typeof data === 'object' ? data : {};
      if (!row.success) return { success: false, error: row.error || 'QR confirmation failed.' };
      try {
        await notificationService.notifyAdminRiderReportedDelivered({
          orderId: row.order_id || orderId,
          riderName: 'Rider',
          notes: notes || 'Confirmed via order QR from rider dashboard',
          reportedBy: 'Rider',
        });
      } catch (_e) {}
      return { success: true, orderId: row.order_id || orderId, deliveryStatus: row.delivery_status };
    } catch (e) {
      return { success: false, error: e?.message || 'QR confirmation failed.' };
    }
  },
};

export default riderAccessService;
