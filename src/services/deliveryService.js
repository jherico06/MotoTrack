/**
 * MotoTrack Delivery Management & Proof of Delivery
 * Admin assigns riders; authenticated riders confirm via packing QR.
 */
import { appStorage } from './storageAdapter';
import { supabaseManager } from './supabaseClient';
import { orderService } from './orderService';
import { notificationService } from './notificationService';
import { auditLogService } from './auditLogService';
import { riderService, RIDER_STATUSES } from './riderService';
import {
  generateSecureToken,
  hashDeliveryToken,
  normalizeTokenHash,
  buildDeliveryConfirmUrl,
  qrImageUrlForLink,
  makePhoneReachableConfirmBundle,
} from '../utils/deliveryToken';
import { dateInputToIso, expectedDeliveryStatusText } from '../utils/deliveryDate';
import { riderAccessService, extractConfirmToken } from './riderAccessService';
import { geocodeAddress } from '../utils/geo';

const STORAGE_KEY_DELIVERIES = 'mototrack_order_deliveries';
const STORAGE_KEY_HISTORY = 'mototrack_delivery_history';
/** Local map: orderId → last plaintext token (admin device only; never synced as plaintext) */
const STORAGE_KEY_TOKEN_CACHE = 'mototrack_delivery_token_cache';

const deliveryListeners = new Set();
let deliveryRealtimeChannel = null;
let deliveryRealtimeTimer = null;

function notifyDeliveryListeners(payload = { source: 'local' }) {
  deliveryListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('[DeliveryService] listener error:', e);
    }
  });
}

function scheduleDeliveryRealtimeNotify() {
  if (deliveryRealtimeTimer) clearTimeout(deliveryRealtimeTimer);
  deliveryRealtimeTimer = setTimeout(() => {
    deliveryRealtimeTimer = null;
    notifyDeliveryListeners({ source: 'realtime', at: Date.now() });
  }, 250);
}

function setupDeliveryRealtime() {
  if (deliveryRealtimeChannel) return;
  try {
    const client = supabaseManager.getClient();
    if (!client) return;

    deliveryRealtimeChannel = client
      .channel('public:delivery_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_deliveries' }, () => {
        scheduleDeliveryRealtimeNotify();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        scheduleDeliveryRealtimeNotify();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected — clients will receive live delivery/order updates.
        }
      });
  } catch (e) {
    console.warn('[DeliveryService] realtime setup failed:', e);
  }
}

export const DELIVERY_STATUSES = {
  READY: 'Ready for Delivery',
  OUT: 'Out for Delivery',
  REPORTED: 'Delivery Reported',
  DELIVERED: 'Delivered',
  FAILED: 'Delivery Issue',
  RESCHEDULED: 'Rescheduled',
};

export { buildDeliveryConfirmUrl, qrImageUrlForLink };

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function tokenShareBundle(plainToken) {
  const bundle = await makePhoneReachableConfirmBundle(plainToken);
  return {
    token: bundle.token,
    confirmUrl: bundle.confirmUrl,
    qrImageUrl: bundle.qrImageUrl,
    expiresAt: null,
    phoneReachable: bundle.phoneReachable,
  };
}

function stripOtpSecrets(delivery) {
  if (!delivery) return null;
  const {
    otp_hash,
    confirmation_token_hash,
    _plain_token,
    ...safe
  } = delivery;
  return safe;
}

function enrichDeliveryWithRider(delivery) {
  if (!delivery) return null;
  const rider = delivery.rider_id ? riderService.getRiderById(delivery.rider_id) : null;
  if (!rider) {
    return {
      ...delivery,
      rider_name: delivery.rider_name || null,
      rider_contact: delivery.rider_contact || null,
      vehicle_info: delivery.vehicle_info || null,
      rider_plate: delivery.rider_plate || null,
      rider_avatar: delivery.rider_avatar || null,
    };
  }
  return {
    ...delivery,
    rider_name: delivery.rider_name || rider.name,
    rider_contact: delivery.rider_contact || rider.phone || '',
    vehicle_info: delivery.vehicle_info || rider.vehicleInfo || '',
    rider_plate: delivery.rider_plate || rider.plateNumber || '',
    rider_avatar: delivery.rider_avatar || rider.avatar || '',
  };
}

/** Columns allowed on public.order_deliveries after normalization + token fields */
function toDeliveryDbRow(record) {
  return {
    delivery_id: record.delivery_id,
    order_id: record.order_id,
    rider_id: record.rider_id || null,
    rider_name: record.rider_name || null,
    rider_contact: record.rider_contact || null,
    vehicle_info: record.vehicle_info || null,
    delivery_notes: record.delivery_notes || '',
    delivery_status: record.delivery_status,
    expected_delivery_at: record.expected_delivery_at || null,
    otp_hash: record.otp_hash || null,
    otp_expires_at: record.otp_expires_at || null,
    otp_verified: Boolean(record.otp_verified),
    otp_verified_at: record.otp_verified_at || null,
    confirmation_token_hash: record.confirmation_token_hash || null,
    confirmation_token_expires_at: record.confirmation_token_expires_at || null,
    confirmation_token_used_at: record.confirmation_token_used_at || null,
    confirmation_token_invalidated_at: record.confirmation_token_invalidated_at || null,
    confirmation_token_created_at: record.confirmation_token_created_at || null,
    token_verified: Boolean(record.token_verified),
    customer_confirmed: Boolean(record.customer_confirmed),
    customer_confirmed_at: record.customer_confirmed_at || null,
    confirmed_by_customer_id: record.confirmed_by_customer_id || null,
    proof_of_delivery: record.proof_of_delivery || null,
    proof_uploaded_by: record.proof_uploaded_by || null,
    proof_uploaded_at: record.proof_uploaded_at || null,
    delivery_photo: record.delivery_photo || null,
    delivery_issue_notes: record.delivery_issue_notes || null,
    shipping_fee: Number(record.shipping_fee || 0) || 0,
    rider_earning: Number(record.rider_earning || 0) || 0,
    rider_earning_credited: Boolean(record.rider_earning_credited),
    rider_earning_credited_at: record.rider_earning_credited_at || null,
    assigned_by: record.assigned_by || null,
    assigned_at: record.assigned_at || null,
    delivered_at: record.delivered_at || null,
    rider_reported_delivered: Boolean(record.rider_reported_delivered),
    rider_reported_at: record.rider_reported_at || null,
    rider_reported_by: record.rider_reported_by || null,
    rider_report_notes: record.rider_report_notes || '',
    admin_confirmed: Boolean(record.admin_confirmed),
    admin_confirmed_at: record.admin_confirmed_at || null,
    admin_confirmed_reason: record.admin_confirmed_reason || '',
    confirmed_by_admin: record.confirmed_by_admin || null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function isOutForDeliveryStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'out for delivery' || s === 'shipped' || s === 'in transit';
}

function isReportedStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'delivery reported' || s === 'reported';
}

function isIssueStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'delivery issue' || s === 'delivery failed' || s === 'failed';
}

function getTokenCache() {
  try {
    const raw = appStorage.getItem(STORAGE_KEY_TOKEN_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_e) {}
  return {};
}

function saveTokenCache(map) {
  try {
    appStorage.setItem(STORAGE_KEY_TOKEN_CACHE, JSON.stringify(map || {}));
  } catch (_e) {}
}

function cachePlainToken(orderId, plainToken) {
  if (!orderId || !plainToken) return;
  const map = getTokenCache();
  map[orderId] = {
    token: plainToken,
    cached_at: new Date().toISOString(),
  };
  saveTokenCache(map);
}

function clearCachedToken(orderId) {
  if (!orderId) return;
  const map = getTokenCache();
  delete map[orderId];
  saveTokenCache(map);
}

function getCachedPlainToken(orderId) {
  const entry = getTokenCache()[orderId];
  return entry?.token || null;
}

function createTokenFields() {
  const plainToken = generateSecureToken(32);
  const nowIso = new Date().toISOString();
  return {
    plainToken,
    fields: {
      confirmation_token_hash: hashDeliveryToken(plainToken),
      // No time expiry — token stays valid until used / delivered / invalidated
      confirmation_token_expires_at: null,
      confirmation_token_used_at: null,
      confirmation_token_invalidated_at: null,
      confirmation_token_created_at: nowIso,
      token_verified: false,
    },
  };
}

function invalidateTokenFields(delivery) {
  return {
    ...delivery,
    confirmation_token_hash: null,
    confirmation_token_expires_at: null,
    confirmation_token_used_at: delivery?.confirmation_token_used_at || null,
    confirmation_token_invalidated_at: new Date().toISOString(),
    confirmation_token_created_at: delivery?.confirmation_token_created_at || null,
    token_verified: Boolean(delivery?.token_verified),
  };
}

/** Resolve shipping fee that becomes rider earnings (₱0 if free shipping). */
function resolveShippingFee(order, delivery) {
  const fromDelivery = Number(delivery?.shipping_fee);
  if (Number.isFinite(fromDelivery) && fromDelivery >= 0 && delivery?.shipping_fee != null) {
    return fromDelivery;
  }
  const fromOrder = Number(order?.shipping_fee);
  if (Number.isFinite(fromOrder) && fromOrder >= 0 && order?.shipping_fee != null) {
    return fromOrder;
  }
  // Infer for older orders: grand_total - (subtotal - discount)
  const grand = Number(order?.grand_total);
  const sub = Number(order?.total_amount);
  const disc = Number(order?.discount_amount || 0);
  if (Number.isFinite(grand) && Number.isFinite(sub)) {
    const inferred = grand - (sub - disc);
    if (Number.isFinite(inferred) && inferred >= 0) return Math.round(inferred * 100) / 100;
  }
  return 0;
}

function mergeLocalOrderMeta(orderId, patch) {
  const orders = orderService.getLocalOrders();
  const next = orders.map((o) =>
    o.order_id === orderId || o.id === orderId ? { ...o, ...patch } : o
  );
  orderService.saveLocalOrders(next);
}

function isAdminUser(user) {
  return Boolean(user && (user.role === 'admin' || user.isAdmin));
}

function getLocalDeliveries() {
  try {
    const raw = appStorage.getItem(STORAGE_KEY_DELIVERIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_e) {}
  return [];
}

function saveLocalDeliveries(list) {
  try {
    appStorage.setItem(STORAGE_KEY_DELIVERIES, JSON.stringify(list));
  } catch (_e) {}
}

function getLocalHistory() {
  try {
    const raw = appStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_e) {}
  return [];
}

function saveLocalHistory(list) {
  try {
    appStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list));
  } catch (_e) {}
}

function upsertLocalDelivery(record) {
  const list = getLocalDeliveries();
  const idx = list.findIndex((d) => d.order_id === record.order_id || d.delivery_id === record.delivery_id);
  if (idx >= 0) list[idx] = { ...list[idx], ...record };
  else list.unshift(record);
  saveLocalDeliveries(list);
  return record;
}

async function appendHistory({ orderId, action, previousStatus, newStatus, performedBy, notes, metadata }) {
  const row = {
    id: makeId('dh'),
    order_id: orderId,
    action,
    previous_status: previousStatus || null,
    new_status: newStatus || null,
    performed_by: performedBy || 'System',
    notes: notes || '',
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  };
  const hist = getLocalHistory();
  hist.unshift(row);
  saveLocalHistory(hist);

  const client = supabaseManager.getClient();
  if (client) {
    try {
      await client.from('delivery_history').insert([row]);
    } catch (e) {
      console.warn('[DeliveryService] history insert failed:', e);
    }
  }
  return row;
}

function findOrder(orderId) {
  const orders = orderService.getLocalOrders();
  return orders.find((o) => o.order_id === orderId || o.id === orderId) || null;
}

export const deliveryService = {
  DELIVERY_STATUSES,

  /**
   * Live updates when order_deliveries / orders change in Supabase.
   * Rider + Admin screens subscribe so status updates appear without manual refresh.
   */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    deliveryListeners.add(listener);
    setupDeliveryRealtime();
    return () => deliveryListeners.delete(listener);
  },

  notifyChanged(payload = { source: 'mutation' }) {
    notifyDeliveryListeners(payload);
  },

  normalizeStatus(status) {
    const s = String(status || '').trim();
    const lower = s.toLowerCase();
    if (lower === 'shipped' || lower === 'in transit') return DELIVERY_STATUSES.OUT;
    if (lower === 'delivery failed' || lower === 'failed') return DELIVERY_STATUSES.FAILED;
    if (lower === 'delivery reported' || lower === 'reported') return DELIVERY_STATUSES.REPORTED;
    return s;
  },

  async getDeliveryForOrder(orderId, { includeOtpHash = false } = {}) {
    if (!orderId) return null;
    let record = getLocalDeliveries().find((d) => d.order_id === orderId);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('order_deliveries')
          .select('*')
          .eq('order_id', orderId)
          .limit(1);
        if (!error && data?.[0]) {
          record = data[0];
          upsertLocalDelivery(record);
        }
      } catch (e) {
        console.warn('[DeliveryService] getDeliveryForOrder:', e);
      }
    }

    if (!record) return null;
    const enriched = enrichDeliveryWithRider(record);
    return includeOtpHash ? enriched : stripOtpSecrets(enriched);
  },

  async getDeliveryHistory(orderId) {
    if (!orderId) return [];
    let rows = getLocalHistory().filter((h) => h.order_id === orderId);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('delivery_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length) {
          rows = data;
          const others = getLocalHistory().filter((h) => h.order_id !== orderId);
          saveLocalHistory([...data, ...others]);
        }
      } catch (e) {
        console.warn('[DeliveryService] getDeliveryHistory:', e);
      }
    }

    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  /**
   * Admin assigns a registered rider (staff roster) and marks Ready for Delivery.
   */
  async assignDelivery({
    orderId,
    riderId,
    notes = '',
    expectedDate = null,
    adminUser,
    // Legacy free-text fields ignored when riderId is provided
    riderName,
    riderContact,
    vehicleInfo = '',
  }) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can assign delivery.' };
    }
    if (!orderId) {
      return { success: false, error: 'Order ID is required.' };
    }

    let rider = null;
    if (riderId) {
      await riderService.fetchRiders();
      rider = riderService.getRiderById(riderId);
      if (!rider) {
        return { success: false, error: 'Selected rider was not found in the staff roster.' };
      }
      if ((rider.status || '').toLowerCase() === RIDER_STATUSES.OFF_DUTY.toLowerCase()) {
        return { success: false, error: 'That rider is Off Duty. Choose an Available rider.' };
      }
    } else if (String(riderName || '').trim()) {
      // Ad-hoc rider record (name + contact only — no account / login)
      rider = {
        id: null,
        name: String(riderName).trim(),
        phone: String(riderContact || '').trim(),
        vehicleInfo: String(vehicleInfo || '').trim(),
        plateNumber: '',
        avatar: '',
      };
    } else {
      return {
        success: false,
        error: 'Select a registered rider or enter the rider name and contact.',
      };
    }

    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    const prev = this.normalizeStatus(order.status);
    if (!['processing', 'rescheduled', 'ready for delivery'].includes(prev.toLowerCase())) {
      return {
        success: false,
        error: `Cannot assign delivery while order is "${order.status}". Process the order first.`,
      };
    }

    const nowIso = new Date().toISOString();
    const existing = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    const deliveryId = existing?.delivery_id || makeId('del');
    const adminLabel = adminUser?.name || adminUser?.email || adminUser?.id || 'Admin';
    const shippingFee = resolveShippingFee(order, existing);

    const expectedIso = expectedDate ? dateInputToIso(expectedDate) : null;
    const record = enrichDeliveryWithRider({
      delivery_id: deliveryId,
      order_id: orderId,
      rider_id: rider.id || null,
      rider_name: rider.name,
      rider_contact: rider.phone || '',
      vehicle_info: rider.vehicleInfo || '',
      delivery_notes: String(notes || '').trim(),
      delivery_status: DELIVERY_STATUSES.READY,
      expected_delivery_at: expectedIso,
      shipping_fee: shippingFee,
      rider_earning: shippingFee,
      rider_earning_credited: false,
      rider_earning_credited_at: null,
      otp_hash: existing?.otp_hash || null,
      otp_expires_at: existing?.otp_expires_at || null,
      otp_verified: false,
      otp_verified_at: null,
      confirmation_token_hash: null,
      confirmation_token_expires_at: null,
      confirmation_token_used_at: null,
      confirmation_token_invalidated_at: existing?.confirmation_token_invalidated_at || null,
      confirmation_token_created_at: null,
      token_verified: false,
      customer_confirmed: false,
      customer_confirmed_at: null,
      confirmed_by_customer_id: null,
      rider_reported_delivered: false,
      rider_reported_at: null,
      rider_reported_by: null,
      rider_report_notes: '',
      admin_confirmed: false,
      admin_confirmed_at: null,
      admin_confirmed_reason: '',
      confirmed_by_admin: null,
      delivery_photo: null,
      delivery_issue_notes: null,
      proof_of_delivery: existing?.proof_of_delivery || null,
      proof_uploaded_by: existing?.proof_uploaded_by || null,
      proof_uploaded_at: existing?.proof_uploaded_at || null,
      assigned_by: adminLabel,
      assigned_at: nowIso,
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
    });

    clearCachedToken(orderId);
    upsertLocalDelivery(record);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(record)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            status: DELIVERY_STATUSES.READY,
            estimated_delivery: expectedIso
              ? expectedDeliveryStatusText(expectedIso, 'Expected')
              : 'Ready for dispatch',
            updated_at: nowIso,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('[DeliveryService] assignDelivery supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, DELIVERY_STATUSES.READY, 'Delivery assigned', {
      allowDelivered: false,
      skipTransitionCheck: true,
      deliveryMeta: {
        // Client-side display fields only (not DB columns on orders)
        rider_id: record.rider_id,
        rider_name: record.rider_name,
        rider_contact: record.rider_contact,
        rider_vehicle: record.vehicle_info,
        rider_plate: record.rider_plate,
        rider_avatar: record.rider_avatar,
        expected_delivery_at: record.expected_delivery_at,
        estimated_delivery: expectedIso
          ? expectedDeliveryStatusText(expectedIso, 'Expected')
          : 'Ready for dispatch',
      },
    });

    await appendHistory({
      orderId,
      action: 'ASSIGN_RIDER',
      previousStatus: prev,
      newStatus: DELIVERY_STATUSES.READY,
      performedBy: adminLabel,
      notes: `Assigned rider ${record.rider_name}${record.rider_contact ? ` (${record.rider_contact})` : ''}`,
      metadata: {
        rider_id: record.rider_id,
        rider_name: record.rider_name,
      },
    });

    try {
      auditLogService.logOrderAction({
        action: 'DELIVERY_ASSIGNED',
        target: `Order #${orderId}`,
        details: `Admin assigned rider ${record.rider_name} to Order #${orderId}.`,
        severity: 'INFO',
        metadata: { orderId, rider: record.rider_name, rider_id: record.rider_id },
      });
    } catch (_e) {}

    try {
      if (!order.delivery_lat || !order.delivery_lng) {
        const geo = await geocodeAddress(order.customer_address);
        if (geo && client) {
          await client
            .from('orders')
            .update({ delivery_lat: geo.lat, delivery_lng: geo.lng, delivery_landmark: order.delivery_notes || null })
            .eq('order_id', orderId);
        }
      }
    } catch (_e) {}

    let riderAccess = null;
    try {
      riderAccess = await riderAccessService.issueRiderAccess({
        riderId: record.rider_id,
        riderName: record.rider_name,
        riderContact: record.rider_contact,
        adminUser,
      });
    } catch (e) {
      console.warn('[DeliveryService] rider access:', e);
    }

    this.notifyChanged({ source: 'assign', orderId });
    return { success: true, delivery: stripOtpSecrets(record), riderAccess };
  },

  /**
   * Admin marks Out for Delivery and issues a single-use secure confirmation token/QR.
   */
  async markOutForDelivery(orderId, adminUser, { expectedDate = null } = {}) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can mark out for delivery.' };
    }
    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    let delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery?.rider_name && !delivery?.rider_id) {
      return { success: false, error: 'Assign a rider (name + contact) before marking Out for Delivery.' };
    }

    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const prev = delivery.delivery_status || order.status;
    const { plainToken, fields: tokenFields } = createTokenFields();
    const shippingFee = resolveShippingFee(order, delivery);
    const expectedIso = expectedDate ? dateInputToIso(expectedDate) : delivery.expected_delivery_at || null;

    delivery = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.OUT,
      expected_delivery_at: expectedIso,
      shipping_fee: shippingFee,
      rider_earning: shippingFee,
      otp_hash: null,
      otp_expires_at: null,
      otp_verified: false,
      otp_verified_at: null,
      ...tokenFields,
      customer_confirmed: false,
      customer_confirmed_at: null,
      rider_reported_delivered: false,
      rider_reported_at: null,
      rider_reported_by: null,
      rider_report_notes: '',
      admin_confirmed: false,
      admin_confirmed_at: null,
      admin_confirmed_reason: '',
      confirmed_by_admin: null,
      delivery_photo: null,
      delivery_issue_notes: null,
      updated_at: nowIso,
    };
    upsertLocalDelivery(delivery);
    cachePlainToken(orderId, plainToken);

    if (delivery.rider_id) {
      try {
        await riderService.setRiderStatus(delivery.rider_id, RIDER_STATUSES.ON_DELIVERY);
      } catch (_e) {}
    }

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(delivery)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            status: DELIVERY_STATUSES.OUT,
            estimated_delivery: expectedIso
              ? expectedDeliveryStatusText(expectedIso, 'Out for delivery — expected')
              : 'Out for delivery today',
            updated_at: nowIso,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('[DeliveryService] markOutForDelivery supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, DELIVERY_STATUSES.OUT, 'Out for delivery', {
      skipTransitionCheck: true,
      deliveryMeta: {
        rider_id: delivery.rider_id,
        rider_name: delivery.rider_name,
        rider_contact: delivery.rider_contact,
        rider_vehicle: delivery.vehicle_info,
        rider_plate: delivery.rider_plate,
        rider_avatar: delivery.rider_avatar,
        has_delivery_token: true,
        confirmation_token_expires_at: null,
        expected_delivery_at: expectedIso,
        estimated_delivery: expectedIso
          ? expectedDeliveryStatusText(expectedIso, 'Out for delivery — expected')
          : 'Out for delivery today',
      },
    });

    await appendHistory({
      orderId,
      action: 'OUT_FOR_DELIVERY',
      previousStatus: prev,
      newStatus: DELIVERY_STATUSES.OUT,
      performedBy: adminLabel,
      notes: 'Dispatched. Secure confirmation QR/link issued (valid until delivery is confirmed).',
      metadata: { no_time_expiry: true },
    });

    const customerUserId = order.user_id || order.customer_id || null;
    try {
      await notificationService.notifyCustomerOutForDelivery({
        userId: customerUserId,
        orderId,
        riderName: delivery.rider_name,
        expectedDelivery: delivery.expected_delivery_at,
      });
    } catch (e) {
      console.warn('[DeliveryService] customer out-for-delivery notification failed:', e);
    }

    return {
      success: true,
      delivery: stripOtpSecrets(delivery),
      ...(await tokenShareBundle(plainToken)),
    };
  },

  /**
   * Admin regenerates a new QR/token (invalidates the previous one).
   */
  async regenerateDeliveryToken(orderId, adminUser) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can regenerate delivery tokens.' };
    }
    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    const status = this.normalizeStatus(order.status);
    if (
      status !== DELIVERY_STATUSES.OUT &&
      status !== DELIVERY_STATUSES.RESCHEDULED &&
      status !== DELIVERY_STATUSES.READY &&
      !isOutForDeliveryStatus(order.status)
    ) {
      return {
        success: false,
        error: 'A new confirmation token can only be issued for active delivery orders.',
      };
    }

    let delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) return { success: false, error: 'No delivery assignment found.' };

    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const { plainToken, fields: tokenFields } = createTokenFields();

    delivery = {
      ...delivery,
      ...tokenFields,
      token_verified: false,
      rider_reported_delivered: false,
      rider_reported_at: null,
      rider_reported_by: null,
      rider_report_notes: '',
      updated_at: nowIso,
    };
    upsertLocalDelivery(delivery);
    cachePlainToken(orderId, plainToken);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(delivery)], { onConflict: 'order_id' });
      } catch (e) {
        console.warn('[DeliveryService] regenerateDeliveryToken supabase:', e);
      }
    }

    await appendHistory({
      orderId,
      action: 'TOKEN_REGENERATED',
      previousStatus: order.status,
      newStatus: order.status,
      performedBy: adminLabel,
      notes: 'Previous confirmation token invalidated. New QR/link issued (valid until delivery is confirmed).',
      metadata: { no_time_expiry: true },
    });

    return {
      success: true,
      delivery: stripOtpSecrets(delivery),
      ...(await tokenShareBundle(plainToken)),
    };
  },

  /**
   * Returns cached plaintext token for admin re-display (same device), if still valid.
   */
  getAdminDeliveryTokenBundle(orderId) {
    const plain = getCachedPlainToken(orderId);
    if (!plain) return null;
    const delivery = getLocalDeliveries().find((d) => d.order_id === orderId);
    if (!delivery?.confirmation_token_hash) return null;
    if (delivery.confirmation_token_used_at || delivery.confirmation_token_invalidated_at) return null;
    if (normalizeTokenHash(delivery.confirmation_token_hash) !== hashDeliveryToken(plain)) {
      return null;
    }
    const confirmUrl = buildDeliveryConfirmUrl(plain);
    return {
      token: plain,
      confirmUrl,
      qrImageUrl: qrImageUrlForLink(confirmUrl),
      expiresAt: null,
    };
  },

  /**
   * Admin sets or changes the customer-facing expected delivery date.
   */
  async updateExpectedDelivery(orderId, expectedDate, adminUser) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can set the expected delivery date.' };
    }
    if (!orderId) return { success: false, error: 'Order ID is required.' };
    const expectedIso = dateInputToIso(expectedDate);
    if (!expectedIso) {
      return { success: false, error: 'Pick a valid expected delivery date.' };
    }

    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    let delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const statusLabel = this.normalizeStatus(order.status);
    const outLike = statusLabel === DELIVERY_STATUSES.OUT || isOutForDeliveryStatus(order.status);
    const estimated = expectedDeliveryStatusText(
      expectedIso,
      outLike ? 'Out for delivery — expected' : 'Expected'
    );

    if (!delivery) {
      delivery = {
        delivery_id: makeId('del'),
        order_id: orderId,
        delivery_status: order.status || DELIVERY_STATUSES.READY,
        expected_delivery_at: expectedIso,
        assigned_by: adminLabel,
        assigned_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
    } else {
      delivery = {
        ...delivery,
        expected_delivery_at: expectedIso,
        updated_at: nowIso,
      };
    }
    upsertLocalDelivery(delivery);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(delivery)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            estimated_delivery: estimated,
            updated_at: nowIso,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('[DeliveryService] updateExpectedDelivery supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, order.status, 'Expected delivery date updated', {
      skipTransitionCheck: true,
      deliveryMeta: {
        expected_delivery_at: expectedIso,
        estimated_delivery: estimated,
      },
    });

    await appendHistory({
      orderId,
      action: 'EXPECTED_DELIVERY_SET',
      previousStatus: order.status,
      newStatus: order.status,
      performedBy: adminLabel,
      notes: estimated,
      metadata: { expected_delivery_at: expectedIso },
    });

    return { success: true, delivery: stripOtpSecrets(delivery), estimated_delivery: estimated };
  },

  async uploadProofOfDelivery(orderId, imageUri, adminUser) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can upload proof of delivery.' };
    }
    if (!imageUri) return { success: false, error: 'No image provided.' };

    const delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) {
      return { success: false, error: 'Assign delivery before uploading proof.' };
    }

    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const updated = {
      ...delivery,
      proof_of_delivery: imageUri,
      proof_uploaded_by: adminLabel,
      proof_uploaded_at: nowIso,
      updated_at: nowIso,
    };
    upsertLocalDelivery(updated);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(updated)], { onConflict: 'order_id' });
      } catch (e) {
        console.warn('[DeliveryService] proof upload supabase:', e);
      }
    }

    await appendHistory({
      orderId,
      action: 'PROOF_UPLOADED',
      previousStatus: delivery.delivery_status,
      newStatus: delivery.delivery_status,
      performedBy: adminLabel,
      notes: 'Admin uploaded proof of delivery photo.',
    });

    return { success: true, delivery: stripOtpSecrets(updated) };
  },

  async markDeliveryFailed(orderId, adminUser, notes = '') {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can mark a delivery issue.' };
    }
    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    const prev = this.normalizeStatus(order.status);
    if (
      prev !== DELIVERY_STATUSES.OUT &&
      prev !== DELIVERY_STATUSES.REPORTED &&
      !isOutForDeliveryStatus(order.status) &&
      !isReportedStatus(order.status)
    ) {
      return { success: false, error: 'Only Out for Delivery or Delivery Reported orders can be marked as an issue.' };
    }

    const delivery = (await this.getDeliveryForOrder(orderId, { includeOtpHash: true })) || {
      delivery_id: makeId('del'),
      order_id: orderId,
    };
    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const noteText = String(notes || '').trim();
    let updated = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.FAILED,
      delivery_notes: noteText || delivery.delivery_notes || '',
      delivery_issue_notes: noteText,
      otp_hash: null,
      otp_expires_at: null,
      rider_reported_delivered: Boolean(delivery.rider_reported_delivered),
      updated_at: nowIso,
    };
    updated = invalidateTokenFields(updated);
    upsertLocalDelivery(updated);
    clearCachedToken(orderId);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(updated)], { onConflict: 'order_id' });
      } catch (e) {
        console.warn('[DeliveryService] markFailed supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, DELIVERY_STATUSES.FAILED, noteText || 'Delivery issue', {
      skipTransitionCheck: true,
      deliveryMeta: {
        delivery_status: DELIVERY_STATUSES.FAILED,
        rider_id: updated.rider_id,
        rider_name: updated.rider_name,
        delivery_issue_notes: noteText,
      },
    });

    if (updated.rider_id) {
      try {
        await riderService.setRiderStatus(updated.rider_id, RIDER_STATUSES.AVAILABLE);
      } catch (_e) {}
    }

    await appendHistory({
      orderId,
      action: 'DELIVERY_ISSUE',
      previousStatus: prev,
      newStatus: DELIVERY_STATUSES.FAILED,
      performedBy: adminLabel,
      notes: noteText || 'Delivery issue reported by admin',
      metadata: { token_invalidated: true },
    });

    try {
      await notificationService.notifyCustomerDeliveryFailed({
        userId: order.user_id || order.customer_id,
        orderId,
        notes: noteText || 'Delivery attempt had an issue',
      });
    } catch (e) {
      console.warn('[DeliveryService] fail notification failed:', e);
    }

    return { success: true, delivery: stripOtpSecrets(updated) };
  },

  /** Alias used by Admin UI */
  async markDeliveryIssue(orderId, adminUser, notes = '') {
    return this.markDeliveryFailed(orderId, adminUser, notes);
  },

  async rescheduleDelivery(orderId, adminUser, notes = '', { generateNewToken = false } = {}) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can reschedule delivery.' };
    }
    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    const prev = this.normalizeStatus(order.status);
    if (prev !== DELIVERY_STATUSES.FAILED && prev !== DELIVERY_STATUSES.RESCHEDULED && !isIssueStatus(order.status)) {
      return { success: false, error: 'Reschedule is available after a delivery issue.' };
    }

    const delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    let updated = {
      ...(delivery || { delivery_id: makeId('del'), order_id: orderId }),
      delivery_status: DELIVERY_STATUSES.RESCHEDULED,
      delivery_notes: notes || delivery?.delivery_notes || '',
      updated_at: nowIso,
    };
    updated = invalidateTokenFields(updated);
    clearCachedToken(orderId);

    let tokenBundle = null;
    if (generateNewToken) {
      const { plainToken, fields: tokenFields } = createTokenFields();
      updated = { ...updated, ...tokenFields };
      cachePlainToken(orderId, plainToken);
      tokenBundle = {
        ...(await tokenShareBundle(plainToken)),
        expiresAt: updated.confirmation_token_expires_at,
      };
    }

    upsertLocalDelivery(updated);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(updated)], { onConflict: 'order_id' });
      } catch (e) {
        console.warn('[DeliveryService] reschedule supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, DELIVERY_STATUSES.RESCHEDULED, notes || 'Delivery rescheduled', {
      skipTransitionCheck: true,
      deliveryMeta: {
        delivery_status: DELIVERY_STATUSES.RESCHEDULED,
        rider_id: updated.rider_id,
        rider_name: updated.rider_name,
      },
    });

    if (updated.rider_id) {
      try {
        await riderService.setRiderStatus(updated.rider_id, RIDER_STATUSES.AVAILABLE);
      } catch (_e) {}
    }

    await appendHistory({
      orderId,
      action: 'RESCHEDULED',
      previousStatus: prev,
      newStatus: DELIVERY_STATUSES.RESCHEDULED,
      performedBy: adminLabel,
      notes: notes || 'Delivery rescheduled; previous confirmation token invalidated.',
      metadata: { new_token: Boolean(tokenBundle) },
    });

    try {
      await notificationService.notifyCustomerDeliveryRescheduled({
        userId: order.user_id || order.customer_id,
        orderId,
        notes: notes || 'Delivery was rescheduled',
      });
    } catch (e) {
      console.warn('[DeliveryService] reschedule notification failed:', e);
    }

    return {
      success: true,
      delivery: stripOtpSecrets(updated),
      ...(tokenBundle || {}),
    };
  },

  /**
   * Admin manually logs that the rider reported drop-off (fallback if QR unused).
   * Moves order to Delivery Reported — not Delivered.
   */
  async reportRiderDelivered({ orderId, notes = '', adminUser }) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can log a rider drop-off report.' };
    }
    if (!orderId) return { success: false, error: 'Order ID is required.' };

    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };
    if (!isOutForDeliveryStatus(order.status) && this.normalizeStatus(order.status) !== DELIVERY_STATUSES.OUT) {
      return { success: false, error: 'Rider drop-off can only be logged while the order is Out for Delivery.' };
    }

    const delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) {
      return { success: false, error: 'No delivery assignment found for this order.' };
    }
    if ((order.status || '').toLowerCase() === 'delivered' || delivery.delivery_status === DELIVERY_STATUSES.DELIVERED) {
      return { success: false, error: 'This order is already delivered.' };
    }

    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const noteText = String(notes || '').trim();
    let updated = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.REPORTED,
      rider_reported_delivered: true,
      rider_reported_at: nowIso,
      rider_reported_by: adminLabel,
      rider_report_notes: noteText,
      updated_at: nowIso,
    };
    // Burn any outstanding token so it cannot be reused
    updated = {
      ...updated,
      confirmation_token_used_at: delivery.confirmation_token_used_at || nowIso,
      confirmation_token_invalidated_at: delivery.confirmation_token_invalidated_at || nowIso,
    };
    upsertLocalDelivery(updated);
    clearCachedToken(orderId);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(updated)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            status: DELIVERY_STATUSES.REPORTED,
            estimated_delivery: 'Delivery reported — awaiting admin confirmation',
            updated_at: nowIso,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('[DeliveryService] reportRiderDelivered supabase:', e);
      }
    }

    await orderService.updateOrderStatus(
      orderId,
      DELIVERY_STATUSES.REPORTED,
      noteText || 'Rider reported delivery',
      {
        skipTransitionCheck: true,
        deliveryMeta: {
          rider_reported_delivered: true,
          rider_reported_at: nowIso,
          rider_reported_by: adminLabel,
          rider_report_notes: noteText,
          rider_id: updated.rider_id,
          rider_name: updated.rider_name,
          rider_contact: updated.rider_contact,
        },
      }
    );

    mergeLocalOrderMeta(orderId, {
      status: DELIVERY_STATUSES.REPORTED,
      rider_reported_delivered: true,
      rider_reported_at: nowIso,
      rider_reported_by: adminLabel,
      rider_report_notes: noteText,
      updated_at: nowIso,
    });

    await appendHistory({
      orderId,
      action: 'RIDER_REPORTED_DELIVERED',
      previousStatus: delivery.delivery_status || order.status,
      newStatus: DELIVERY_STATUSES.REPORTED,
      performedBy: adminLabel,
      notes: noteText
        ? `${updated.rider_name || 'Rider'} reported drop-off. ${noteText}`
        : `${updated.rider_name || 'Rider'} reported the item was delivered.`,
      metadata: { rider_id: updated.rider_id, rider_name: updated.rider_name },
    });

    try {
      await notificationService.notifyAdminRiderReportedDelivered({
        orderId,
        riderName: updated.rider_name,
        notes: noteText,
        reportedBy: adminLabel,
      });
    } catch (e) {
      console.warn('[DeliveryService] rider report notification failed:', e);
    }

    try {
      auditLogService.logOrderAction({
        action: 'RIDER_REPORTED_DELIVERED',
        target: `Order #${orderId}`,
        details: `Rider ${updated.rider_name || ''} reported drop-off for Order #${orderId}. Status: Delivery Reported.`,
        severity: 'INFO',
        metadata: { orderId, rider_id: updated.rider_id },
      });
    } catch (_e) {}

    return { success: true, delivery: stripOtpSecrets(updated) };
  },

  /**
   * Public (no auth): validate token and return safe preview for rider confirmation page.
   */
  async getPublicDeliveryPreview(plainToken) {
    const token = String(plainToken || '').trim();
    if (!token || token.length < 16) {
      return { success: false, error: 'Invalid or missing confirmation token.', preview: null };
    }
    const tokenHash = hashDeliveryToken(token);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client.rpc('get_delivery_confirm_preview', {
          p_token_hash: tokenHash,
        });
        if (!error && data) {
          const row = Array.isArray(data) ? data[0] : data;
          if (row) {
            return {
              success: Boolean(row.is_valid),
              error: row.is_valid ? null : row.invalid_reason || 'Token is not valid',
              preview: {
                orderId: row.order_id,
                deliveryId: row.delivery_id,
                deliveryStatus: row.delivery_status,
                orderStatus: row.order_status,
                riderName: row.rider_name,
                riderContact: row.rider_contact,
                itemCount: row.item_count,
                destinationHint: row.destination_hint,
                expectedDeliveryAt: row.expected_delivery_at,
                expiresAt: row.token_expires_at,
                tokenUsed: row.token_used,
                tokenInvalidated: row.token_invalidated,
                tokenExpired: row.token_expired,
                isValid: row.is_valid,
              },
            };
          }
        }
      } catch (e) {
        console.warn('[DeliveryService] getPublicDeliveryPreview rpc:', e);
      }
    }

    // Local / offline fallback
    const list = getLocalDeliveries();
    const delivery = list.find(
      (d) => normalizeTokenHash(d.confirmation_token_hash) === tokenHash
    );
    if (!delivery) {
      return { success: false, error: 'Token not found', preview: null };
    }
    const order = findOrder(delivery.order_id);
    const used = Boolean(delivery.confirmation_token_used_at || delivery.token_verified);
    const invalidated = Boolean(delivery.confirmation_token_invalidated_at);
    const expired = false; // Tokens do not time-expire
    const ofd =
      isOutForDeliveryStatus(order?.status) ||
      this.normalizeStatus(order?.status) === DELIVERY_STATUSES.OUT;
    let reason = null;
    let ok = true;
    if (used) {
      reason = 'Token already used';
      ok = false;
    } else if (invalidated) {
      reason = 'Token invalidated';
      ok = false;
    } else if (!ofd) {
      reason = 'Order is not out for delivery';
      ok = false;
    }

    const addr = String(order?.customer_address || '');
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    const destinationHint = parts.length ? parts[parts.length - 1] : 'Delivery address on file';

    return {
      success: ok,
      error: ok ? null : reason,
      preview: {
        orderId: delivery.order_id,
        deliveryId: delivery.delivery_id,
        deliveryStatus: delivery.delivery_status,
        orderStatus: order?.status || null,
        riderName: delivery.rider_name,
        riderContact: delivery.rider_contact,
        itemCount: order?.items_count || (order?.items || []).length || 0,
        destinationHint,
        expectedDeliveryAt: delivery.expected_delivery_at,
        expiresAt: delivery.confirmation_token_expires_at,
        tokenUsed: used,
        tokenInvalidated: invalidated,
        tokenExpired: expired,
        isValid: ok,
      },
    };
  },

  /**
   * Public (no auth): rider taps Confirm Delivered → Delivery Reported (not Delivered).
   */
  async confirmDeliveryByToken({ token, notes = '', photo = null }) {
    const plain = String(token || '').trim();
    if (!plain || plain.length < 16) {
      return { success: false, error: 'Invalid confirmation token.' };
    }
    const tokenHash = hashDeliveryToken(plain);
    const noteText = String(notes || '').trim();
    const photoUri = photo || null;

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client.rpc('confirm_delivery_by_token', {
          p_token_hash: tokenHash,
          p_notes: noteText || null,
          p_photo: photoUri,
        });
        if (!error && data) {
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.success) {
            const orderId = row.order_id;
            const nowIso = new Date().toISOString();
            // Sync local cache
            let delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
            if (delivery) {
              delivery = {
                ...delivery,
                delivery_status: DELIVERY_STATUSES.REPORTED,
                rider_reported_delivered: true,
                rider_reported_at: nowIso,
                rider_reported_by: delivery.rider_name || 'Rider (token)',
                rider_report_notes: noteText,
                delivery_photo: photoUri || delivery.delivery_photo,
                proof_of_delivery: photoUri || delivery.proof_of_delivery,
                token_verified: true,
                confirmation_token_used_at: nowIso,
                updated_at: nowIso,
              };
              upsertLocalDelivery(delivery);
            }
            mergeLocalOrderMeta(orderId, {
              status: DELIVERY_STATUSES.REPORTED,
              rider_reported_delivered: true,
              rider_reported_at: nowIso,
              token_verified: true,
              updated_at: nowIso,
            });
            clearCachedToken(orderId);

            try {
              await notificationService.notifyAdminRiderReportedDelivered({
                orderId,
                riderName: delivery?.rider_name,
                notes: noteText || 'Confirmed via secure QR/link',
                reportedBy: delivery?.rider_name || 'Rider',
              });
            } catch (_e) {}

            return {
              success: true,
              orderId,
              message: 'Delivery reported. The store admin will confirm shortly.',
              delivery: stripOtpSecrets(delivery),
            };
          }
          return { success: false, error: row?.error_message || 'Confirmation failed.' };
        }
        if (error) console.warn('[DeliveryService] confirm rpc error:', error);
      } catch (e) {
        console.warn('[DeliveryService] confirmDeliveryByToken rpc:', e);
      }
    }

    // Local fallback
    const previewRes = await this.getPublicDeliveryPreview(plain);
    if (!previewRes.success || !previewRes.preview?.isValid) {
      return { success: false, error: previewRes.error || 'Token is not valid for confirmation.' };
    }

    const orderId = previewRes.preview.orderId;
    const order = findOrder(orderId);
    let delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) return { success: false, error: 'Delivery record not found.' };

    const nowIso = new Date().toISOString();
    delivery = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.REPORTED,
      rider_reported_delivered: true,
      rider_reported_at: nowIso,
      rider_reported_by: delivery.rider_name || 'Rider (token)',
      rider_report_notes: noteText,
      delivery_photo: photoUri || delivery.delivery_photo,
      proof_of_delivery: photoUri || delivery.proof_of_delivery,
      proof_uploaded_by: photoUri ? delivery.rider_name || 'Rider (token)' : delivery.proof_uploaded_by,
      proof_uploaded_at: photoUri ? nowIso : delivery.proof_uploaded_at,
      token_verified: true,
      confirmation_token_used_at: nowIso,
      updated_at: nowIso,
    };
    upsertLocalDelivery(delivery);
    clearCachedToken(orderId);

    await orderService.updateOrderStatus(
      orderId,
      DELIVERY_STATUSES.REPORTED,
      noteText || 'Rider confirmed via QR/link',
      {
        skipTransitionCheck: true,
        deliveryMeta: {
          rider_reported_delivered: true,
          rider_reported_at: nowIso,
          token_verified: true,
          rider_name: delivery.rider_name,
          rider_contact: delivery.rider_contact,
        },
      }
    );

    await appendHistory({
      orderId,
      action: 'RIDER_TOKEN_CONFIRMED',
      previousStatus: order?.status || DELIVERY_STATUSES.OUT,
      newStatus: DELIVERY_STATUSES.REPORTED,
      performedBy: delivery.rider_name || 'Rider (token)',
      notes: noteText || 'Rider confirmed delivery via secure QR/link',
      metadata: {
        token_verified: true,
        has_photo: Boolean(photoUri),
        rider_name: delivery.rider_name,
        rider_contact: delivery.rider_contact,
      },
    });

    try {
      await notificationService.notifyAdminRiderReportedDelivered({
        orderId,
        riderName: delivery.rider_name,
        notes: noteText || 'Confirmed via secure QR/link',
        reportedBy: delivery.rider_name || 'Rider',
      });
    } catch (_e) {}

    this.notifyChanged({ source: 'token_confirm', orderId });
    return {
      success: true,
      orderId,
      message: 'Delivery reported. The store admin will confirm shortly.',
      delivery: stripOtpSecrets(delivery),
    };
  },

  /**
   * Optional customer "Confirm Received" on My Orders — does not mark Delivered alone.
   */
  async customerConfirmReceived({ orderId, customerUser }) {
    if (!orderId) return { success: false, error: 'Order ID is required.' };
    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    const status = this.normalizeStatus(order.status);
    if (
      status !== DELIVERY_STATUSES.OUT &&
      status !== DELIVERY_STATUSES.REPORTED &&
      !isOutForDeliveryStatus(order.status) &&
      !isReportedStatus(order.status)
    ) {
      return { success: false, error: 'You can only confirm receipt while the order is out for delivery or reported.' };
    }

    const delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) return { success: false, error: 'No delivery found for this order.' };

    const nowIso = new Date().toISOString();
    const customerLabel =
      customerUser?.name || customerUser?.email || order.customer_name || 'Customer';
    const updated = {
      ...delivery,
      customer_confirmed: true,
      customer_confirmed_at: nowIso,
      confirmed_by_customer_id: customerUser?.id || order.customer_id || null,
      updated_at: nowIso,
    };
    upsertLocalDelivery(updated);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(updated)], { onConflict: 'order_id' });
      } catch (e) {
        console.warn('[DeliveryService] customerConfirmReceived supabase:', e);
      }
    }

    mergeLocalOrderMeta(orderId, {
      customer_delivery_confirmed: true,
      customer_delivery_confirmed_at: nowIso,
      updated_at: nowIso,
    });

    await appendHistory({
      orderId,
      action: 'CUSTOMER_CONFIRMED_RECEIVED',
      previousStatus: order.status,
      newStatus: order.status,
      performedBy: customerLabel,
      notes: 'Customer tapped Confirm Received on My Orders.',
    });

    try {
      await notificationService.addNotification({
        target: 'admin',
        category: 'customer_confirmed_received',
        type: 'order',
        priority: 'medium',
        title: 'Customer confirmed receipt',
        message: `${customerLabel} confirmed they received order #${orderId}. Review and mark Delivered when ready.`,
        meta: { orderId },
        link: 'orders',
        icon: 'person-check',
      });
    } catch (_e) {}

    return { success: true, delivery: stripOtpSecrets(updated) };
  },

  /**
   * Admin closes Delivery Reported (or Out for Delivery override) as Delivered.
   */
  async adminMarkDelivered({ orderId, reason, adminUser }) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can mark an order delivered.' };
    }
    const reasonText = String(reason || '').trim();
    if (!reasonText) {
      return { success: false, error: 'A reason is required to mark this order as delivered.' };
    }
    if (!orderId) return { success: false, error: 'Order ID is required.' };

    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    const status = this.normalizeStatus(order.status);
    const localDelivered =
      status === DELIVERY_STATUSES.DELIVERED || (order.status || '').toLowerCase() === 'delivered';
    const localReported = status === DELIVERY_STATUSES.REPORTED || isReportedStatus(order.status);
    const localOfd = isOutForDeliveryStatus(order.status) || status === DELIVERY_STATUSES.OUT;
    if (!localDelivered && !localReported && !localOfd) {
      return {
        success: false,
        error: 'Only Delivery Reported (or Out for Delivery) orders can be confirmed as delivered.',
      };
    }

    const delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) {
      return { success: false, error: 'Assign and dispatch a rider before marking delivered.' };
    }

    const nowIso = new Date().toISOString();
    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    const prevStatus = order.status;
    const shippingFee = resolveShippingFee(order, delivery);
    let updatedDelivery = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.DELIVERED,
      shipping_fee: shippingFee,
      rider_earning: shippingFee,
      admin_confirmed: true,
      admin_confirmed_at: nowIso,
      admin_confirmed_reason: reasonText,
      confirmed_by_admin: adminLabel,
      rider_reported_delivered: true,
      rider_reported_at: delivery.rider_reported_at || nowIso,
      rider_reported_by: delivery.rider_reported_by || adminLabel,
      updated_at: nowIso,
    };
    updatedDelivery = invalidateTokenFields(updatedDelivery);

    // Credit shipping fee as rider earnings (once)
    if (!delivery.rider_earning_credited && shippingFee > 0) {
      try {
        const creditRes = await riderService.creditShippingEarning({
          riderId: updatedDelivery.rider_id,
          riderName: updatedDelivery.rider_name,
          orderId,
          deliveryId: updatedDelivery.delivery_id,
          amount: shippingFee,
          creditedBy: adminLabel,
          notes: `Shipping fee earnings for order #${orderId}`,
        });
        if (creditRes.success && !creditRes.skipped) {
          updatedDelivery.rider_earning_credited = true;
          updatedDelivery.rider_earning_credited_at = nowIso;
        }
      } catch (e) {
        console.warn('[DeliveryService] rider earning credit failed:', e);
      }
    } else if (shippingFee <= 0) {
      updatedDelivery.rider_earning_credited = true;
      updatedDelivery.rider_earning_credited_at = nowIso;
    }

    upsertLocalDelivery(updatedDelivery);
    clearCachedToken(orderId);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('order_deliveries')
          .upsert([toDeliveryDbRow(updatedDelivery)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            status: 'Delivered',
            estimated_delivery: 'Delivered (admin confirmed)',
            updated_at: nowIso,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('[DeliveryService] adminMarkDelivered supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, 'Delivered', `Admin confirmed delivery: ${reasonText}`, {
      allowDelivered: true,
      skipTransitionCheck: true,
      adminCorrection: true,
      deliveryMeta: {
        rider_id: updatedDelivery.rider_id,
        rider_name: updatedDelivery.rider_name,
        rider_contact: updatedDelivery.rider_contact,
        rider_vehicle: updatedDelivery.vehicle_info,
        rider_plate: updatedDelivery.rider_plate,
        rider_avatar: updatedDelivery.rider_avatar,
        rider_reported_delivered: true,
        rider_reported_at: updatedDelivery.rider_reported_at,
        admin_confirmed: true,
        admin_confirmed_at: nowIso,
        admin_confirmed_reason: reasonText,
        confirmed_by_admin: adminLabel,
        token_verified: Boolean(updatedDelivery.token_verified),
        customer_delivery_confirmed: Boolean(updatedDelivery.customer_confirmed),
        customer_delivery_confirmed_at: updatedDelivery.customer_confirmed_at || null,
      },
    });

    if (updatedDelivery.rider_id) {
      try {
        await riderService.setRiderStatus(updatedDelivery.rider_id, RIDER_STATUSES.AVAILABLE);
      } catch (_e) {}
    }

    await appendHistory({
      orderId,
      action: 'ADMIN_MARKED_DELIVERED',
      previousStatus: prevStatus,
      newStatus: 'Delivered',
      performedBy: adminLabel,
      notes: reasonText,
      metadata: {
        admin_confirmed: true,
        token_verified: Boolean(updatedDelivery.token_verified),
        customer_confirmed: Boolean(updatedDelivery.customer_confirmed),
        shipping_fee: shippingFee,
        rider_earning: shippingFee,
        rider_earning_credited: Boolean(updatedDelivery.rider_earning_credited),
      },
    });

    try {
      await notificationService.notifyAdminDeliveryConfirmed({
        orderId,
        customerName: order.customer_name,
        riderName: updatedDelivery.rider_name,
        confirmedAt: nowIso,
        adminOverride: true,
      });
      await notificationService.notifyCustomerDeliveryConfirmed({
        userId: order.user_id || order.customer_id,
        orderId,
      });
    } catch (e) {
      console.warn('[DeliveryService] admin mark delivered notifications failed:', e);
    }

    return {
      success: true,
      delivery: stripOtpSecrets(updatedDelivery),
      message: 'Order marked as delivered by admin.',
    };
  },

  /**
   * Gated admin correction: Delivered → another status with required reason.
   */
  async adminCorrectDeliveryStatus(orderId, newStatus, reason, adminUser) {
    if (!isAdminUser(adminUser)) {
      return { success: false, error: 'Only authorized admins can correct delivery status.' };
    }
    if (!String(reason || '').trim()) {
      return { success: false, error: 'A correction reason is required.' };
    }
    const order = findOrder(orderId);
    if (!order) return { success: false, error: 'Order not found.' };

    if (String(newStatus || '').toLowerCase() === 'delivered') {
      return this.adminMarkDelivered({ orderId, reason, adminUser });
    }

    const adminLabel = adminUser?.name || adminUser?.email || 'Admin';
    await orderService.updateOrderStatus(orderId, newStatus, `Admin correction: ${reason}`, {
      allowDelivered: false,
      skipTransitionCheck: true,
      adminCorrection: true,
    });

    await appendHistory({
      orderId,
      action: 'ADMIN_CORRECTION',
      previousStatus: order.status,
      newStatus,
      performedBy: adminLabel,
      notes: reason,
    });

    return { success: true };
  },

  riderFacingStatus(status) {
    const n = this.normalizeStatus(status);
    if (n === DELIVERY_STATUSES.READY) return 'Assigned';
    if (n === DELIVERY_STATUSES.OUT) return 'Out for Delivery';
    if (n === DELIVERY_STATUSES.DELIVERED) return 'Delivered';
    if (n === DELIVERY_STATUSES.REPORTED) return 'Out for Delivery';
    return n || 'Assigned';
  },

  buildRiderDeliveryCard(delivery, order) {
    const items = Array.isArray(order?.items)
      ? order.items
      : orderService.parseItemsSummary
        ? orderService.parseItemsSummary(order?.items_summary)
        : [];
    const itemsSummary =
      order?.items_summary ||
      (Array.isArray(items)
        ? items.map((it) => `${it.name || it.product_name || 'Item'} (x${it.quantity || 1})`).join(', ')
        : '');
    const paymentMethod = order?.payment_method || delivery?.payment_method || '';
    const paymentStatus =
      order?.payment_status ||
      (/cod|cash on delivery/i.test(paymentMethod) ? 'Unpaid (COD)' : 'Paid');
    const statusSource = delivery?.delivery_status || order?.status;
    return {
      orderId: delivery?.order_id || order?.order_id,
      deliveryId: delivery?.delivery_id,
      riderId: delivery?.rider_id || order?.rider_id,
      customerName: order?.customer_name || 'Customer',
      customerPhone: order?.customer_phone || '',
      customerAddress: order?.customer_address || '',
      landmark: order?.delivery_landmark || order?.delivery_notes || delivery?.delivery_notes || '',
      items,
      itemsSummary,
      itemsCount: Number(order?.items_count || items?.length || 0),
      totalAmount: Number(order?.grand_total ?? order?.total_amount ?? 0) || 0,
      paymentMethod,
      paymentStatus,
      deliveryStatus: this.riderFacingStatus(statusSource),
      rawStatus: statusSource,
      lat: order?.delivery_lat ?? delivery?.delivery_lat,
      lng: order?.delivery_lng ?? delivery?.delivery_lng,
      expectedDeliveryAt: delivery?.expected_delivery_at || order?.expected_delivery_at || null,
      deliveredAt: delivery?.delivered_at || order?.delivered_at || null,
      assignedAt: delivery?.assigned_at || null,
      riderName: delivery?.rider_name || '',
      shippingFee: Number(delivery?.shipping_fee ?? order?.shipping_fee ?? 0) || 0,
      riderEarning: Number(delivery?.rider_earning ?? delivery?.shipping_fee ?? order?.shipping_fee ?? 0) || 0,
    };
  },

  async getMyDeliveries(riderId) {
    if (!riderId) return [];
    await riderService.fetchRiders();
    let deliveries = getLocalDeliveries().filter((d) => d.rider_id === riderId);
    let orders = orderService.getLocalOrders();

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data: drows } = await client.from('order_deliveries').select('*').eq('rider_id', riderId);
        if (Array.isArray(drows)) {
          deliveries = drows;
          drows.forEach((row) => upsertLocalDelivery(row));
        }
        const ids = [...new Set(deliveries.map((d) => d.order_id).filter(Boolean))];
        if (ids.length) {
          const { data: orows } = await client.from('orders').select('*').in('order_id', ids);
          if (Array.isArray(orows) && orows.length) {
            const byId = new Map(orows.map((o) => [o.order_id, o]));
            orders = orders.map((o) => byId.get(o.order_id) || o);
            orows.forEach((o) => {
              if (!orders.some((x) => x.order_id === o.order_id)) orders.push(o);
            });
          }
        }
        const { data: assignedOrders } = await client.from('orders').select('*').eq('rider_id', riderId);
        if (Array.isArray(assignedOrders)) {
          assignedOrders.forEach((o) => {
            if (!orders.some((x) => x.order_id === o.order_id)) orders.push(o);
            if (!deliveries.some((d) => d.order_id === o.order_id)) {
              deliveries.push({
                order_id: o.order_id,
                rider_id: riderId,
                delivery_status: o.status,
              });
            }
          });
        }
      } catch (e) {
        console.warn('[DeliveryService] getMyDeliveries:', e);
      }
    }

    const cards = deliveries
      .filter((d) => d.rider_id === riderId)
      .map((d) => {
        const order = orders.find((o) => o.order_id === d.order_id || o.id === d.order_id) || {};
        return this.buildRiderDeliveryCard(d, order);
      })
      .filter((c) => c.orderId);

    const rank = (s) => {
      const v = String(s || '').toLowerCase();
      if (v === 'delivered') return 3;
      if (v.includes('out')) return 1;
      if (v.includes('assigned') || v.includes('ready')) return 0;
      return 2;
    };
    cards.sort((a, b) => rank(a.deliveryStatus) - rank(b.deliveryStatus));
    return cards;
  },

  async riderMarkOutForDelivery({ riderId, orderId, riderUser }) {
    if (!riderId || !orderId) return { success: false, error: 'Missing rider or order.' };
    const sessionRider = riderUser?.rider_id;
    if (sessionRider && sessionRider !== riderId) {
      return { success: false, error: 'You can only update your own deliveries.' };
    }

    const order = findOrder(orderId);
    let delivery = await this.getDeliveryForOrder(orderId, { includeOtpHash: true });
    if (!delivery) return { success: false, error: 'Delivery assignment not found.' };
    if (delivery.rider_id !== riderId) {
      return { success: false, error: 'This order is not assigned to you.' };
    }

    const current = this.riderFacingStatus(delivery.delivery_status || order?.status);
    if (current === 'Delivered') {
      return { success: false, error: 'This order is already delivered.' };
    }
    if (current === 'Out for Delivery') {
      return { success: true, delivery: stripOtpSecrets(delivery), already: true };
    }

    const nowIso = new Date().toISOString();
    const riderLabel = riderUser?.name || delivery.rider_name || 'Rider';
    let tokenFields = {};
    let plainToken = null;
    if (!delivery.confirmation_token_hash) {
      const created = createTokenFields();
      plainToken = created.plainToken;
      tokenFields = created.fields;
    }

    delivery = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.OUT,
      ...tokenFields,
      updated_at: nowIso,
    };
    upsertLocalDelivery(delivery);
    if (plainToken) cachePlainToken(orderId, plainToken);

    try {
      await riderService.setRiderStatus(riderId, RIDER_STATUSES.ON_DELIVERY);
    } catch (_e) {}

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('order_deliveries').upsert([toDeliveryDbRow(delivery)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            status: DELIVERY_STATUSES.OUT,
            estimated_delivery: 'Out for delivery',
            updated_at: nowIso,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('[DeliveryService] riderMarkOutForDelivery supabase:', e);
      }
    }

    await orderService.updateOrderStatus(orderId, DELIVERY_STATUSES.OUT, 'Rider started delivery', {
      skipTransitionCheck: true,
      deliveryMeta: {
        rider_id: delivery.rider_id,
        rider_name: delivery.rider_name,
        has_delivery_token: Boolean(delivery.confirmation_token_hash),
      },
    });

    await appendHistory({
      orderId,
      action: 'OUT_FOR_DELIVERY',
      previousStatus: current,
      newStatus: DELIVERY_STATUSES.OUT,
      performedBy: riderLabel,
      notes: 'Rider marked Out for Delivery',
    });

    try {
      await notificationService.notifyCustomerOutForDelivery?.({
        userId: order?.user_id || order?.customer_id || null,
        orderId,
        riderName: delivery.rider_name,
        expectedDelivery: delivery.expected_delivery_at,
      });
    } catch (_e) {}

    this.notifyChanged({ source: 'rider_out', orderId });
    return { success: true, delivery: stripOtpSecrets(delivery) };
  },

  async riderVerifyDeliveryQr({ riderId, orderId, scannedRaw }) {
    if (!riderId) return { success: false, error: 'Rider session required.' };
    const confirmToken = extractConfirmToken(scannedRaw);
    if (!confirmToken) {
      return { success: false, error: 'Could not read a delivery QR code. Scan the packing label again.' };
    }
    const tokenHash = hashDeliveryToken(confirmToken);

    const mine = await this.getMyDeliveries(riderId);
    let match = null;
    for (const card of mine) {
      const delivery = await this.getDeliveryForOrder(card.orderId, { includeOtpHash: true });
      if (!delivery?.confirmation_token_hash) continue;
      if (normalizeTokenHash(delivery.confirmation_token_hash) === tokenHash) {
        match = { card, delivery };
        break;
      }
    }

    if (!match) {
      return {
        success: false,
        error: 'This QR code is invalid or belongs to another order. Delivery cannot be confirmed.',
      };
    }
    if (orderId && match.card.orderId !== orderId) {
      return {
        success: false,
        error: `This QR belongs to order #${match.card.orderId}, not #${orderId}. Scan the correct packing label.`,
      };
    }
    if (match.card.deliveryStatus === 'Delivered') {
      return { success: false, error: 'This order is already delivered.' };
    }

    return { success: true, delivery: match.card, verifiedToken: confirmToken };
  },

  async riderConfirmDeliveredByQr({ riderId, riderUser, orderId, scannedRaw }) {
    const verified = await this.riderVerifyDeliveryQr({ riderId, orderId, scannedRaw });
    if (!verified.success) return verified;

    const targetOrderId = verified.delivery.orderId;
    const order = findOrder(targetOrderId);
    let delivery = await this.getDeliveryForOrder(targetOrderId, { includeOtpHash: true });
    if (!delivery || delivery.rider_id !== riderId) {
      return { success: false, error: 'This order is not assigned to you.' };
    }

    const nowIso = new Date().toISOString();
    const riderLabel = riderUser?.name || delivery.rider_name || 'Rider';
    const shippingFee = resolveShippingFee(order, delivery);

    let updatedDelivery = {
      ...delivery,
      delivery_status: DELIVERY_STATUSES.DELIVERED,
      delivered_at: nowIso,
      token_verified: true,
      confirmation_token_used_at: nowIso,
      rider_reported_delivered: true,
      rider_reported_at: nowIso,
      rider_reported_by: riderLabel,
      rider_report_notes: 'Confirmed via order QR scan',
      admin_confirmed: true,
      admin_confirmed_at: nowIso,
      admin_confirmed_reason: 'Rider QR confirmation',
      confirmed_by_admin: riderLabel,
      shipping_fee: shippingFee,
      rider_earning: shippingFee,
      updated_at: nowIso,
    };
    updatedDelivery = invalidateTokenFields({
      ...updatedDelivery,
      token_verified: true,
      confirmation_token_used_at: nowIso,
    });

    if (!delivery.rider_earning_credited && shippingFee > 0) {
      try {
        const creditRes = await riderService.creditShippingEarning({
          riderId,
          riderName: updatedDelivery.rider_name,
          orderId: targetOrderId,
          deliveryId: updatedDelivery.delivery_id,
          amount: shippingFee,
          creditedBy: riderLabel,
          notes: `Shipping fee earnings for order #${targetOrderId}`,
        });
        if (creditRes.success && !creditRes.skipped) {
          updatedDelivery.rider_earning_credited = true;
          updatedDelivery.rider_earning_credited_at = nowIso;
        }
      } catch (e) {
        console.warn('[DeliveryService] rider earning credit failed:', e);
      }
    }

    upsertLocalDelivery(updatedDelivery);
    clearCachedToken(targetOrderId);

    try {
      await riderService.setRiderStatus(riderId, RIDER_STATUSES.AVAILABLE);
    } catch (_e) {}

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('order_deliveries')
          .upsert([toDeliveryDbRow(updatedDelivery)], { onConflict: 'order_id' });
        await client
          .from('orders')
          .update({
            status: DELIVERY_STATUSES.DELIVERED,
            estimated_delivery: 'Delivered',
            delivered_at: nowIso,
            delivered_by_rider_id: riderId,
            updated_at: nowIso,
          })
          .eq('order_id', targetOrderId);
      } catch (e) {
        console.warn('[DeliveryService] riderConfirmDeliveredByQr supabase:', e);
      }
    }

    await orderService.updateOrderStatus(targetOrderId, DELIVERY_STATUSES.DELIVERED, 'Rider confirmed delivery via QR', {
      allowDelivered: true,
      skipTransitionCheck: true,
      deliveryMeta: {
        rider_id: riderId,
        rider_name: updatedDelivery.rider_name,
        delivered_at: nowIso,
        delivered_by_rider_id: riderId,
        token_verified: true,
      },
    });

    await appendHistory({
      orderId: targetOrderId,
      action: 'DELIVERED',
      previousStatus: delivery.delivery_status,
      newStatus: DELIVERY_STATUSES.DELIVERED,
      performedBy: riderLabel,
      notes: 'Rider scanned order QR and confirmed delivered',
      metadata: { delivered_at: nowIso, rider_id: riderId },
    });

    try {
      await notificationService.notifyCustomerDelivered?.({
        userId: order?.user_id || order?.customer_id || null,
        orderId: targetOrderId,
        riderName: updatedDelivery.rider_name,
      });
    } catch (_e) {}

    this.notifyChanged({ source: 'rider_delivered', orderId: targetOrderId });
    return {
      success: true,
      delivery: this.buildRiderDeliveryCard(updatedDelivery, { ...order, status: DELIVERY_STATUSES.DELIVERED, delivered_at: nowIso }),
    };
  },
};

export default deliveryService;
