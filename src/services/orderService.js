// ─── ORDER SERVICE (SUPABASE PRIMARY SOURCE OF DATA & UNIVERSAL STORAGE) ───────
import { appStorage } from './storageAdapter';
import { supabaseManager } from './supabaseClient';
import { emailService } from './emailService';
import { productService } from './productService';
import { notificationService } from './notificationService';
import { auditLogService } from './auditLogService';

const STORAGE_KEY_ORDERS = 'mototrack_orders_db';
const STORAGE_KEY_OFFLINE_QUEUE = 'mototrack_orders_offline_queue';
const MAX_OFFLINE_RETRIES = 5;

function makeEntityId(prefix) {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${Date.now()}-${rand}`;
}

/** Cross-tab shared cache — sessionStorage alone cannot be seen by an admin tab. */
function readSharedOrdersJson() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(STORAGE_KEY_ORDERS);
    }
  } catch (_e) {}
  return null;
}

function writeSharedOrdersJson(json) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_ORDERS, json);
    }
  } catch (_e) {}
}

export const ORDER_STATUSES = {
  PENDING_APPROVAL: 'Pending Approval',
  PROCESSING: 'Processing',
  READY: 'Ready for Delivery',
  OUT: 'Out for Delivery',
  REPORTED: 'Delivery Reported',
  FAILED: 'Delivery Issue',
  RESCHEDULED: 'Rescheduled',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  REFUNDED: 'Refunded',
};

/** @deprecated Use ORDER_STATUSES.FAILED ('Delivery Issue') */
export const LEGACY_DELIVERY_FAILED = 'Delivery Failed';

export function canonicalizeStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return ORDER_STATUSES.PROCESSING;
  if (s === 'shipped' || s === 'in transit' || s.includes('transit')) return ORDER_STATUSES.OUT;
  if (s.includes('pending') || s.includes('approval') || s === 'confirmed') return ORDER_STATUSES.PENDING_APPROVAL;
  if (s === 'processing') return ORDER_STATUSES.PROCESSING;
  if (s === 'ready for delivery') return ORDER_STATUSES.READY;
  if (s === 'out for delivery') return ORDER_STATUSES.OUT;
  if (s === 'delivery reported' || s === 'reported') return ORDER_STATUSES.REPORTED;
  if (s === 'delivery failed' || s === 'delivery issue' || s === 'failed') return ORDER_STATUSES.FAILED;
  if (s === 'rescheduled') return ORDER_STATUSES.RESCHEDULED;
  if (s === 'delivered' || s === 'completed') return ORDER_STATUSES.DELIVERED;
  if (s === 'cancelled') return ORDER_STATUSES.CANCELLED;
  if (s === 'return requested') return ORDER_STATUSES.RETURN_REQUESTED;
  if (s === 'refunded') return ORDER_STATUSES.REFUNDED;
  return String(status || '').trim();
}

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUSES.PENDING_APPROVAL]: [ORDER_STATUSES.PROCESSING, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.PROCESSING]: [ORDER_STATUSES.READY, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.READY]: [ORDER_STATUSES.OUT, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.OUT]: [ORDER_STATUSES.REPORTED, ORDER_STATUSES.FAILED],
  [ORDER_STATUSES.REPORTED]: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.FAILED],
  [ORDER_STATUSES.FAILED]: [ORDER_STATUSES.RESCHEDULED],
  [ORDER_STATUSES.RESCHEDULED]: [ORDER_STATUSES.READY, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.RETURN_REQUESTED],
  [ORDER_STATUSES.CANCELLED]: [],
  [ORDER_STATUSES.RETURN_REQUESTED]: [ORDER_STATUSES.REFUNDED, ORDER_STATUSES.DELIVERED],
  [ORDER_STATUSES.REFUNDED]: [],
};

export function assertStatusTransition(fromStatus, toStatus, options = {}) {
  const from = canonicalizeStatus(fromStatus);
  const to = canonicalizeStatus(toStatus);
  if (from === to) return { ok: true, from, to };

  if (options.adminCorrection) return { ok: true, from, to };

  // Delivered only from Delivery Reported (or admin override via allowDelivered)
  if (to === ORDER_STATUSES.DELIVERED) {
    if (from === ORDER_STATUSES.REPORTED && options.allowDelivered) {
      return { ok: true, from, to };
    }
    if (from === ORDER_STATUSES.OUT && options.allowDelivered) {
      return { ok: true, from, to };
    }
    return {
      ok: false,
      from,
      to,
      error: 'Orders become Delivered only after admin confirmation of a delivery report.',
    };
  }

  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      from,
      to,
      error: `Cannot change status from "${from}" to "${to}".`,
    };
  }

  return { ok: true, from, to };
}

export function isCodPaymentMethod(method) {
  const m = String(method || '').toLowerCase();
  return m.includes('cash') || m.includes('cod');
}

export function canCustomerCancelStatus(status) {
  const s = canonicalizeStatus(status);
  return s === ORDER_STATUSES.PENDING_APPROVAL || s === ORDER_STATUSES.PROCESSING;
}

export function canCustomerRequestReturnStatus(status) {
  return canonicalizeStatus(status) === ORDER_STATUSES.DELIVERED;
}

export function canCustomerEditAddressStatus(status) {
  const s = canonicalizeStatus(status);
  return s === ORDER_STATUSES.PENDING_APPROVAL || s === ORDER_STATUSES.PROCESSING || s === ORDER_STATUSES.READY;
}

function statusRank(status) {
  const s = canonicalizeStatus(status);
  if (s === ORDER_STATUSES.CANCELLED) return 50;
  if (s === ORDER_STATUSES.REFUNDED) return 45;
  if (s === ORDER_STATUSES.RETURN_REQUESTED) return 42;
  if (s === ORDER_STATUSES.DELIVERED) return 40;
  if (s === ORDER_STATUSES.REPORTED) return 36;
  if (s === ORDER_STATUSES.OUT) return 32;
  if (s === ORDER_STATUSES.FAILED) return 28;
  if (s === ORDER_STATUSES.RESCHEDULED) return 26;
  if (s === ORDER_STATUSES.READY) return 24;
  if (s === ORDER_STATUSES.PROCESSING) return 20;
  if (s === ORDER_STATUSES.PENDING_APPROVAL) return 10;
  return 0;
}

function pickPreferredOrder(a, b) {
  const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
  const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
  const aRank = statusRank(a.status);
  const bRank = statusRank(b.status);

  // Forward progress wins (Shipped/Delivered beat stale Pending/Processing)
  // unless the other side is Cancelled with a newer timestamp.
  const aCancelled = aRank >= 50;
  const bCancelled = bRank >= 50;
  if (aCancelled !== bCancelled) {
    return bTime >= aTime ? b : a;
  }
  if (!aCancelled && !bCancelled && aRank !== bRank) {
    const preferred = aRank > bRank ? a : b;
    const other = preferred === a ? b : a;
    // Keep richer fields from the other copy
    return {
      ...other,
      ...preferred,
      status: preferred.status,
      estimated_delivery: preferred.estimated_delivery || other.estimated_delivery,
      updated_at: preferred.updated_at || other.updated_at,
      items:
        Array.isArray(preferred.items) && preferred.items.length > 0
          ? preferred.items
          : other.items || [],
      user_id: preferred.user_id || other.user_id || null,
      stock_restored: Boolean(preferred.stock_restored || other.stock_restored),
    };
  }

  const newer = bTime >= aTime ? b : a;
  const older = newer === b ? a : b;
  return {
    ...older,
    ...newer,
    items:
      Array.isArray(newer.items) && newer.items.length > 0
        ? newer.items
        : Array.isArray(older.items) && older.items.length > 0
          ? older.items
          : newer.items || older.items || [],
    user_id: newer.user_id || older.user_id || null,
    stock_restored: Boolean(newer.stock_restored || older.stock_restored),
    status: newer.status || older.status,
  };
}

function mergeOrderLists(...lists) {
  const byId = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const order of list) {
      if (!order) continue;
      const id = order.order_id || order.id;
      if (!id) continue;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, order);
        continue;
      }
      byId.set(id, pickPreferredOrder(prev, order));
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
  );
}

let ordersBroadcast = null;
function getOrdersBroadcast() {
  if (ordersBroadcast) return ordersBroadcast;
  try {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      ordersBroadcast = new BroadcastChannel('mototrack_orders');
    }
  } catch (_e) {}
  return ordersBroadcast;
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** Match an order to the signed-in customer (ids, phone, or email). */
function orderBelongsToUser(order, user) {
  if (!order || !user) return false;
  const userId = user.id || user.user_id || null;
  const customerId = user.customer_id || null;
  const orderId = String(order.order_id || order.id || '');

  // Never treat seeded demo orders as the signed-in customer's history
  if (/^ord-(9104|9052|8975|8921|8710)$/.test(orderId)) return false;

  if (userId && (order.user_id === userId || order.userId === userId || order.customer_id === userId)) {
    return true;
  }
  if (customerId && (order.customer_id === customerId || order.user_id === customerId || order.userId === customerId)) {
    return true;
  }

  const userPhone = normalizePhoneDigits(user.phone);
  const orderPhone = normalizePhoneDigits(order.customer_phone);
  if (userPhone.length >= 10 && orderPhone.length >= 10) {
    if (userPhone.slice(-10) === orderPhone.slice(-10)) return true;
  }

  const email = String(user.email || '').toLowerCase().trim();
  if (email) {
    if (String(order.customer_phone || '').toLowerCase().trim() === email) return true;
    if (String(order.customer_email || '').toLowerCase().trim() === email) return true;
  }

  return false;
}

const INITIAL_DEMO_ORDERS = [
  {
    order_id: 'ord-9104',
    id: 'ord-9104',
    customer_id: 'cust-02',
    customer_name: 'Carlos Mendoza',
    customer_phone: '+63 (918) 723-9014',
    customer_address: 'Blk 12 Lot 4, Silvercrest Homes, Taguig City, Metro Manila',
    delivery_notes: 'Please call 10 mins before arrival. Prepare change for ₱70,000.',
    payment_method: 'Cash on Delivery (COD)',
    cod_change_for: '70000',
    total_amount: 68500.0,
    discount_amount: 0.0,
    grand_total: 68500.0,
    items_summary: 'Öhlins TTX GP Rear Shock Absorber (x1)',
    items_count: 1,
    status: 'Pending Approval',
    channel: 'Online Store',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    order_date: 'Today, 10:15 AM',
    estimated_delivery: 'Today (Awaiting Verification)',
    tracking_number: 'MOTO-TRK-9104882',
    courier: 'MotoTrack Express SuperAir',
    items: [
      {
        product_id: 'prod-03',
        name: 'Öhlins TTX GP Rear Shock Absorber',
        brand: 'Öhlins',
        category: 'Suspension',
        quantity: 1,
        price: 68500.0,
        image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    order_id: 'ord-9052',
    id: 'ord-9052',
    customer_id: 'cust-03',
    customer_name: 'Dave Bautista',
    customer_phone: '+63 (927) 419-8821',
    customer_address: 'Unit 8B Tower 2, Pioneer Woodlands, Mandaluyong City',
    delivery_notes: 'Leave with lobby reception if unavailable.',
    payment_method: 'Cash on Delivery (COD)',
    cod_change_for: '30000',
    total_amount: 27450.0,
    discount_amount: 500.0,
    grand_total: 26950.0,
    items_summary: 'Brembo 19RCS Corsa Corta (x1), D.I.D 520VR46 Gold Chain (x1)',
    items_count: 2,
    status: 'Pending Approval',
    channel: 'Online Store',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    order_date: 'Today, 09:30 AM',
    estimated_delivery: 'Today (Awaiting Verification)',
    tracking_number: 'MOTO-TRK-9052119',
    courier: 'MotoTrack Express SuperAir',
    items: [
      {
        product_id: 'prod-02',
        name: 'Brembo 19RCS Corsa Corta Radial Master Cylinder',
        brand: 'Brembo',
        category: 'Brakes',
        quantity: 1,
        price: 18500.0,
        image: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80',
      },
      {
        product_id: 'prod-05',
        name: 'D.I.D 520VR46 Rossi Edition Gold X-Ring Chain',
        brand: 'D.I.D',
        category: 'Transmission',
        quantity: 1,
        price: 8950.0,
        image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    order_id: 'ord-8975',
    id: 'ord-8975',
    customer_id: 'cust-04',
    customer_name: 'Samantha Cruz',
    customer_phone: '+63 (917) 832-1145',
    customer_address: '14 Acacia Ave, Ayala Alabang Village, Muntinlupa',
    delivery_notes: 'Fragile carbon helmet. Handle with care.',
    payment_method: 'GCash',
    gcash_reference: 'MP-GCASH-981442',
    total_amount: 85000.0,
    discount_amount: 2500.0,
    grand_total: 82500.0,
    items_summary: 'AGV Pista GP RR Full Carbon Track Helmet (x1)',
    items_count: 1,
    status: 'Processing',
    channel: 'Online Store',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    order_date: 'Today, 07:15 AM',
    estimated_delivery: 'In 1-2 Business Days',
    tracking_number: 'MOTO-TRK-8975412',
    courier: 'MotoTrack Express SuperAir',
    items: [
      {
        product_id: 'prod-06',
        name: 'AGV Pista GP RR Full Carbon Track Helmet',
        brand: 'AGV',
        category: 'Accessories',
        quantity: 1,
        price: 85000.0,
        image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    order_id: 'ord-8921',
    id: 'ord-8921',
    customer_id: 'cust-01',
    customer_name: 'Alex Rider',
    customer_phone: '+63 (917) 582-9410',
    customer_address: '742 Evergreen Terrace, Pasig City, Metro Manila',
    payment_method: 'Credit Card / Apple Pay',
    total_amount: 59500.0,
    discount_amount: 1500.0,
    grand_total: 58000.0,
    items_summary: 'Akrapovič Titanium Slip-On Racing Exhaust (x1)',
    items_count: 1,
    status: 'Out for Delivery',
    channel: 'Online Store',
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    order_date: 'Yesterday',
    estimated_delivery: 'Today (Out for Delivery)',
    tracking_number: 'MOTO-TRK-7891024',
    courier: 'MotoTrack Express SuperAir',
    items: [
      {
        product_id: 'prod-01',
        name: 'Akrapovič Titanium Slip-On Racing Exhaust',
        brand: 'Akrapovič',
        category: 'Exhaust',
        quantity: 1,
        price: 59500.0,
        image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    order_id: 'ord-8710',
    id: 'ord-8710',
    customer_id: 'cust-05',
    customer_name: 'Miguel Tan',
    customer_phone: '+63 (905) 124-7789',
    customer_address: '88 Katipunan Ave, Loyola Heights, Quezon City',
    payment_method: 'Cash on Delivery (COD)',
    total_amount: 24000.0,
    discount_amount: 0.0,
    grand_total: 24000.0,
    items_summary: 'Dynojet Power Commander V Fuel & Ignition (x1)',
    items_count: 1,
    status: 'Delivered',
    channel: 'Online Store',
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    order_date: 'Aug 21, 2026',
    estimated_delivery: 'Delivered Aug 22, 2026',
    tracking_number: 'MOTO-TRK-8710554',
    courier: 'MotoTrack Express SuperAir',
    items: [
      {
        product_id: 'prod-04',
        name: 'Dynojet Power Commander V Fuel & Ignition',
        brand: 'Dynojet',
        category: 'Engine',
        quantity: 1,
        price: 24000.0,
        image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
];

class OrderService {
  constructor() {
    this.listeners = new Set();
    this.initLocalStorage();
  }

  canonicalizeStatus(status) {
    return canonicalizeStatus(status);
  }

  canCustomerCancel(status) {
    return canCustomerCancelStatus(status);
  }

  canCustomerRequestReturn(status) {
    return canCustomerRequestReturnStatus(status);
  }

  canCustomerEditAddress(status) {
    return canCustomerEditAddressStatus(status);
  }

  initLocalStorage() {
    try {
      const existing = appStorage.getItem(STORAGE_KEY_ORDERS);
      // Seed an explicit empty cache — never inject demo orders that become "ghost" customer orders
      if (!existing) {
        appStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
        writeSharedOrdersJson('[]');
      }
    } catch (e) {}

    // Auto-sync offline status updates when online (creates sync after fetch reconcile)
    setTimeout(() => this.syncPendingOrders({ skipCreates: true }), 2000);
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => this.syncPendingOrders({ skipCreates: true }));
    }
  }

  getOfflineQueue() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  saveOfflineQueue(queue) {
    try {
      appStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) {}
  }

  enqueueOfflineAction(action) {
    const queue = this.getOfflineQueue();
    queue.push({
      ...action,
      queued_at: new Date().toISOString(),
      retry_count: 0,
    });
    this.saveOfflineQueue(queue);
    console.log(`[OrderService] Queued offline action: ${action.type}`);
  }

  async syncPendingOrders({ skipCreates = false, onlyCreates = false } = {}) {
    const queue = this.getOfflineQueue();
    if (!queue || queue.length === 0) return;

    const client = supabaseManager.getClient();
    if (!client) return;

    console.log(`[OrderService] Syncing ${queue.length} pending offline order actions...`);
    const remaining = [];

    for (const item of queue) {
      if (skipCreates && item.type === 'create_order') {
        remaining.push(item);
        continue;
      }
      if (onlyCreates && item.type !== 'create_order') {
        remaining.push(item);
        continue;
      }

      const retries = item.retry_count || 0;
      if (retries >= MAX_OFFLINE_RETRIES) {
        console.warn(`[OrderService] Dropping offline action after ${retries} retries:`, item.type, item.orderId);
        continue;
      }

      try {
        let failed = false;

        if (item.type === 'create_order') {
          const { error: ordErr } = await client.from('orders').upsert([item.orderPayload]);
          if (ordErr) {
            failed = true;
            console.warn('[OrderService] Offline create_order upsert failed:', ordErr);
          } else {
            if (Array.isArray(item.orderItemsPayload) && item.orderItemsPayload.length > 0) {
              const { error } = await client.from('order_items').upsert(item.orderItemsPayload);
              if (error) failed = true;
            }
            if (!failed && item.paymentPayload) {
              const { error } = await client.from('payments').upsert([item.paymentPayload]);
              if (error) failed = true;
            }
            if (!failed && item.salePayload) {
              const { error } = await client.from('sales').upsert([item.salePayload]);
              if (error) failed = true;
            }
          }
        } else if (item.type === 'update_status') {
          const { error } = await client
            .from('orders')
            .update({ status: item.status, updated_at: new Date().toISOString() })
            .eq('order_id', item.orderId);
          if (error) failed = true;
        } else if (item.type === 'update_address') {
          const { error } = await client
            .from('orders')
            .update({ customer_address: item.address })
            .eq('order_id', item.orderId);
          if (error) failed = true;
        } else if (item.type === 'cancel_order') {
          const { error } = await client
            .from('orders')
            .update({ status: 'Cancelled', cancel_reason: item.reason })
            .eq('order_id', item.orderId);
          if (error) {
            failed = true;
          } else {
            try {
              await client.from('order_notes').insert([
                {
                  order_id: item.orderId,
                  note_type: 'cancellation',
                  content: item.reason,
                  author: item.author || 'Customer',
                },
              ]);
            } catch (e) {
              console.warn('[OrderService] Offline cancel note insert failed:', e);
            }
          }
        } else if (item.type === 'request_return') {
          const { error } = await client
            .from('orders')
            .update({
              status: 'Return Requested',
              return_status: 'requested',
              return_reason: item.reason,
              return_notes: item.notes,
              return_requested_at: new Date().toISOString(),
            })
            .eq('order_id', item.orderId);
          if (error) {
            failed = true;
          } else {
            try {
              await client.from('order_notes').insert([
                {
                  order_id: item.orderId,
                  note_type: 'return',
                  content: `Return requested: ${item.reason} - ${item.notes || 'No notes'}`,
                  author: 'Customer',
                },
              ]);
            } catch (e) {
              console.warn('[OrderService] Offline return note insert failed:', e);
            }
          }
        }

        if (failed) {
          remaining.push({ ...item, retry_count: retries + 1 });
        }
      } catch (err) {
        console.warn(`[OrderService] Retry failed for offline action ${item.type}:`, err);
        remaining.push({ ...item, retry_count: retries + 1 });
      }
    }

    this.saveOfflineQueue(remaining);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    this.setupRealtimeSubscription();
    return () => this.listeners.delete(listener);
  }

  setupRealtimeSubscription() {
    if (this._realtimeChannel) return;
    try {
      const client = supabaseManager.getClient();
      if (!client) return;
      this._realtimeChannel = client
        .channel('public:orders_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
          try {
            const fresh = await this.getAllOrders();
            if (Array.isArray(fresh)) this.notifyListeners(fresh);
          } catch (e) {
            console.warn('[OrderService] realtime refresh failed:', e);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[OrderService] realtime setup failed:', e);
    }
  }

  notifyListeners(orders) {
    this.listeners.forEach((fn) => {
      try {
        fn(orders);
      } catch (e) {}
    });
  }

  getLocalOrders() {
    let sessionOrders = null;
    let sharedOrders = null;
    try {
      const raw = appStorage.getItem(STORAGE_KEY_ORDERS);
      if (raw !== null && raw !== undefined) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) sessionOrders = parsed;
      }
    } catch (e) {}
    try {
      const sharedRaw = readSharedOrdersJson();
      if (sharedRaw !== null && sharedRaw !== undefined) {
        const parsed = JSON.parse(sharedRaw);
        if (Array.isArray(parsed)) sharedOrders = parsed;
      }
    } catch (e) {}

    // Explicit empty cache must stay empty (do not resurrect demo seed orders)
    if (sessionOrders !== null || sharedOrders !== null) {
      return mergeOrderLists(sessionOrders || [], sharedOrders || []);
    }
    // No cache yet — start empty so DB deletes / fresh installs don't show ghost demo orders
    return [];
  }

  getOrders(userId = null) {
    if (!userId || userId === 'guest') return [];
    const orders = this.getLocalOrders();
    return orders.filter(
      (o) => o.customer_id === userId || o.user_id === userId || o.userId === userId
    );
  }

  saveLocalOrders(orders) {
    try {
      const json = JSON.stringify(orders);
      appStorage.setItem(STORAGE_KEY_ORDERS, json);
      writeSharedOrdersJson(json);
      this.notifyListeners(orders);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('mototrack_orders_updated', { detail: orders }));
        } catch (_e) {}
        try {
          const bc = getOrdersBroadcast();
          bc?.postMessage({ type: 'orders_updated', at: Date.now() });
        } catch (_e) {}
      }
    } catch (e) {}
  }

  clearLocalOrders() {
    try {
      const empty = '[]';
      appStorage.setItem(STORAGE_KEY_ORDERS, empty);
      writeSharedOrdersJson(empty);
      // Also drop queued creates so they can't resurrect deleted DB rows
      try {
        const queue = this.getOfflineQueue() || [];
        this.saveOfflineQueue(queue.filter((item) => item?.type !== 'create_order'));
      } catch (_e) {}
      this.notifyListeners([]);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('mototrack_orders_updated', { detail: [] }));
        } catch (_e) {}
        try {
          getOrdersBroadcast()?.postMessage({ type: 'orders_cleared', at: Date.now() });
        } catch (_e) {}
      }
    } catch (e) {}
  }

  /** Order IDs waiting to sync creates to Supabase — must not be dropped on remote reconcile. */
  getPendingCreateOrderIds() {
    try {
      const queue = this.getOfflineQueue() || [];
      return new Set(
        queue
          .filter((item) => item?.type === 'create_order')
          .map((item) => item.orderId || item.orderPayload?.order_id)
          .filter(Boolean)
      );
    } catch (_e) {
      return new Set();
    }
  }

  /**
   * Drop offline create_order jobs that are no longer in Supabase after a successful fetch.
   * Prevents deleted DB rows from being re-inserted on the next sync.
   */
  dropOfflineCreatesNotInRemote(remoteIds, { dropAllCreates = false } = {}) {
    try {
      const queue = this.getOfflineQueue() || [];
      if (!queue.length) return;
      const keep = queue.filter((item) => {
        if (item?.type !== 'create_order') return true;
        if (dropAllCreates) return false;
        const id = item.orderId || item.orderPayload?.order_id;
        return id && remoteIds.has(id);
      });
      if (keep.length !== queue.length) {
        this.saveOfflineQueue(keep);
        console.log(
          `[OrderService] Dropped ${queue.length - keep.length} stale offline create_order action(s)`
        );
      }
    } catch (e) {
      console.warn('[OrderService] dropOfflineCreatesNotInRemote failed:', e);
    }
  }

  /**
   * Reconcile local cache with a successful Supabase fetch.
   * Remote is source of truth for existence.
   */
  reconcileWithRemote(remoteOrders, localOrders) {
    const remote = Array.isArray(remoteOrders) ? remoteOrders : [];
    // Do not keep local-only rows — DB deletes must disappear from the app.
    // Fresh offline creates are covered by createOrder writing local + queue;
    // after a successful remote fetch, only remote rows remain.
    return mergeOrderLists(remote, []);
  }

  /**
   * Fetch orders from Supabase and merge with local/offline cache.
   * Admin (no userId/customerId) always receives the merged full list.
   * Pass `currentUser` as 4th arg (or object as 1st) for reliable ownership matching.
   */
  async getUserOrders(userId, customerId, customerName, currentUser = null) {
    // Never sync create_order before fetch — that re-inserts rows deleted in Supabase.
    try {
      await this.syncPendingOrders({ skipCreates: true });
    } catch (e) {
      console.warn('[OrderService] sync before fetch failed:', e);
    }

    const user =
      currentUser && typeof currentUser === 'object'
        ? currentUser
        : userId || customerId
          ? { id: userId, user_id: userId, customer_id: customerId, name: customerName }
          : null;

    const local = this.getLocalOrders();
    let remote = [];
    let remoteFetchOk = false;
    // Unfiltered fetch (admin or customer without cust- id) sees the full table slice
    const isUnfilteredRemote =
      !(customerId && String(customerId).startsWith('cust-'));

    const client = supabaseManager.getClient();
    if (client) {
      try {
        let query = client
          .from('orders')
          .select('*, order_items(*, products(*, categories(name))), order_deliveries(*, riders(*))')
          .order('created_at', { ascending: false })
          .limit(150);

        if (customerId && String(customerId).startsWith('cust-')) {
          query = query.eq('customer_id', customerId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          remoteFetchOk = true;
          remote = data.map((o) => {
            const items = Array.isArray(o.order_items)
              ? o.order_items.map((oi) => ({
                  product_id: oi.product_id,
                  name: oi.products?.name || 'Motorcycle Part',
                  brand: oi.products?.brand || 'MotoTrack',
                  category: oi.products?.categories?.name || oi.products?.category || 'Gear',
                  quantity: oi.quantity || 1,
                  price: Number(oi.cost || oi.products?.price || 0),
                  image:
                    oi.products?.image ||
                    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
                }))
              : [];

            const deliveryRow = Array.isArray(o.order_deliveries)
              ? o.order_deliveries[0]
              : o.order_deliveries;
            const riderRow = deliveryRow?.riders
              ? Array.isArray(deliveryRow.riders)
                ? deliveryRow.riders[0]
                : deliveryRow.riders
              : null;

            return {
              order_id: o.order_id || o.id,
              id: o.order_id || o.id,
              customer_id: o.customer_id,
              customer_name: o.customer_name,
              customer_phone: o.customer_phone,
              customer_address: o.customer_address,
              delivery_notes: o.delivery_notes,
              payment_method: o.payment_method || 'Cash on Delivery (COD)',
              total_amount: Number(o.total_amount || o.grand_total || 0),
              discount_amount: Number(o.discount_amount || 0),
              shipping_fee: Number(o.shipping_fee || 0),
              grand_total: Number(o.grand_total || o.total_amount || 0),
              items_summary: o.items_summary || items.map((i) => `${i.name} (x${i.quantity})`).join(', '),
              items_count: o.items_count || items.length,
              status: o.status || 'Pending Approval',
              channel: o.channel || 'Online Store',
              created_at: o.created_at || new Date().toISOString(),
              updated_at: o.updated_at || o.created_at || new Date().toISOString(),
              order_date: new Date(o.created_at || Date.now()).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              estimated_delivery:
                o.estimated_delivery ||
                (o.status === 'Pending Approval' ? 'Awaiting COD Approval' : 'In 1-3 Business Days'),
              tracking_number:
                o.tracking_number ||
                'MOTO-TRK-' + ((o.order_id || '').replace(/\D/g, '').slice(0, 7) || '7891234'),
              courier: o.courier || 'MotoTrack Express SuperAir',
              cancel_reason: o.cancel_reason,
              return_status: o.return_status,
              user_id: o.user_id || null,
              items: items.length > 0 ? items : this.parseItemsSummary(o.items_summary),
              // Joined from order_deliveries → riders (not stored on orders)
              rider_id: deliveryRow?.rider_id || riderRow?.id || null,
              rider_name: riderRow?.name || null,
              rider_contact: riderRow?.phone || null,
              rider_vehicle: riderRow?.vehicle_info || null,
              rider_plate: riderRow?.plate_number || null,
              rider_avatar: riderRow?.avatar || null,
              customer_delivery_confirmed: Boolean(deliveryRow?.customer_confirmed),
              customer_delivery_confirmed_at: deliveryRow?.customer_confirmed_at || null,
              rider_reported_delivered: Boolean(deliveryRow?.rider_reported_delivered),
              rider_reported_at: deliveryRow?.rider_reported_at || null,
              admin_confirmed: Boolean(deliveryRow?.admin_confirmed),
              admin_confirmed_at: deliveryRow?.admin_confirmed_at || null,
              admin_confirmed_reason: deliveryRow?.admin_confirmed_reason || '',
            };
          });
        }
      } catch (e) {
        console.warn('Supabase get orders note:', e);
      }
    }

    const isAdminQuery = !customerId && !userId && !user;
    const remoteIds = new Set(remote.map((o) => o.order_id || o.id).filter(Boolean));

    if (remoteFetchOk) {
      // If the DB table is empty (unfiltered), wipe local cache + offline creates so ghosts can't return
      if (isUnfilteredRemote && remote.length === 0) {
        this.dropOfflineCreatesNotInRemote(remoteIds, { dropAllCreates: true });
        this.clearLocalOrders();
        if (isAdminQuery) return [];
      } else {
        this.dropOfflineCreatesNotInRemote(remoteIds, { dropAllCreates: false });
      }
    }

    try {
      await this.syncPendingOrders({ onlyCreates: true });
    } catch (e) {
      console.warn('[OrderService] sync creates after fetch failed:', e);
    }

    const reconciled = remoteFetchOk
      ? this.reconcileWithRemote(remote, local)
      : mergeOrderLists(remote, local);

    if (isAdminQuery) {
      this.saveLocalOrders(reconciled);
      return reconciled;
    }

    const ownershipUser = user || {
      id: userId,
      user_id: userId,
      customer_id: customerId,
      name: customerName,
    };

    if (remoteFetchOk) {
      const others =
        isUnfilteredRemote && remote.length === 0
          ? []
          : local.filter((o) => !orderBelongsToUser(o, ownershipUser));
      const mineRemote = remote.filter((o) => orderBelongsToUser(o, ownershipUser));
      const nextCache = mergeOrderLists(others, mineRemote);
      this.saveLocalOrders(nextCache);

      const ownedPending = [...this.getPendingCreateOrderIds()].filter((id) => {
        const localHit = local.find((o) => (o.order_id || o.id) === id);
        return localHit && orderBelongsToUser(localHit, ownershipUser) && !remoteIds.has(id);
      });
      if (ownedPending.length) {
        const q = (this.getOfflineQueue() || []).filter((item) => {
          if (item?.type !== 'create_order') return true;
          const id = item.orderId || item.orderPayload?.order_id;
          return !ownedPending.includes(id);
        });
        this.saveOfflineQueue(q);
      }

      return mineRemote;
    }

    return reconciled.filter((o) => orderBelongsToUser(o, ownershipUser));
  }

  async getAllOrders() {
    return this.getUserOrders(null, null, null, null);
  }

  /** Public helper for UI filters / live subscriptions */
  orderBelongsToUser(order, user) {
    return orderBelongsToUser(order, user);
  }

  parseItemsSummary(summary) {
    if (!summary) return [];
    return summary.split(',').map((part, index) => {
      const match = part.trim().match(/^(.*?)\s*\(x(\d+)\)$/);
      if (match) {
        return {
          product_id: 'prod-unknown-' + index,
          name: match[1],
          brand: 'MotoTrack',
          category: 'Gear',
          quantity: parseInt(match[2], 10),
          price: 0,
          priceUnavailable: true,
          image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
        };
      }
      return {
        product_id: 'prod-unknown-' + index,
        name: part.trim(),
        brand: 'MotoTrack',
        category: 'Gear',
        quantity: 1,
        price: 0,
        priceUnavailable: true,
        image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      };
    });
  }

  /**
   * Resolve a customers.customer_id that exists in Supabase, or null (FK-safe).
   */
  async resolveValidCustomerId(customerId, userId, customerName, customerPhone) {
    const client = supabaseManager.getClient();
    if (!client) return customerId || null;

    const tryFind = async (column, value) => {
      if (!value) return null;
      try {
        const { data } = await client
          .from('customers')
          .select('customer_id')
          .eq(column, value)
          .limit(1);
        return data?.[0]?.customer_id || null;
      } catch (_e) {
        return null;
      }
    };

    let valid =
      (await tryFind('customer_id', customerId)) ||
      (await tryFind('user_id', userId)) ||
      (await tryFind('user_id', customerId));

    if (valid) return valid;

    // Create a lightweight customer row so future orders / RLS keep working
    if (userId || customerName || customerPhone) {
      const newId =
        customerId && String(customerId).startsWith('cust-') ? customerId : makeEntityId('cust');
      const baseRow = {
        customer_id: newId,
        name: customerName || 'MotoTrack Customer',
        email: (customerPhone || '').includes('@') ? customerPhone : `${newId}@mototrack.local`,
        contact_number: customerPhone || null,
      };
      try {
        let insert = await client
          .from('customers')
          .insert([{ ...baseRow, user_id: userId || null }])
          .select('customer_id')
          .limit(1);
        if (insert.error) {
          insert = await client.from('customers').insert([baseRow]).select('customer_id').limit(1);
        }
        if (!insert.error && insert.data?.[0]?.customer_id) return insert.data[0].customer_id;
      } catch (e) {
        console.warn('[OrderService] Could not create customer row:', e);
      }
    }

    return null;
  }

  /**
   * Unified Single Write Path for creating orders (Online Store & In-Store)
   * Local-First + Supabase Sync + Inventory Stock Decrement + Payment Record
   */
  async createOrder({
    userId = null,
    customerId = null,
    customerName,
    customerPhone,
    customerAddress,
    deliveryNotes = '',
    paymentMethod,
    gcashNumber = null,
    gcashReference = null,
    codChangeFor = null,
    promoId = null,
    total,
    discountAmount = 0,
    shippingFee = 0,
    grandTotal,
    items = [],
    channel = 'Online Store',
    overrideStatus = null,
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'Cannot place an order with an empty cart', supabaseSynced: false };
    }

    const orderId = makeEntityId('ord');
    const isCOD =
      (paymentMethod || '').toLowerCase().includes('cash') || (paymentMethod || '').includes('COD');
    const orderStatus = overrideStatus || (isCOD ? 'Pending Approval' : 'Processing');
    const nowIso = new Date().toISOString();

    let deliveryLat = null;
    let deliveryLng = null;
    try {
      const { geocodeAddress } = await import('../utils/geo');
      const geo = await geocodeAddress(customerAddress);
      if (geo) {
        deliveryLat = geo.lat;
        deliveryLng = geo.lng;
      }
    } catch (_e) {}

    const resolvedCustomerId = await this.resolveValidCustomerId(
      customerId,
      userId,
      customerName,
      customerPhone
    );

    const normalizedItems = (items || []).map((i) => ({
      product_id: i.product?.id || i.product?.product_id || i.product_id || i.id,
      name: i.product?.name || i.name || 'Pro Motorcycle Component',
      brand: i.product?.brand || i.brand || 'MotoTrack',
      category: i.product?.category || i.category || 'Accessories',
      quantity: Number(i.quantity || 1),
      price: Number(i.product?.price ?? i.price ?? 0),
      image:
        i.product?.image ||
        i.image ||
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    }));

    if (normalizedItems.every((it) => !it.product_id)) {
      return { success: false, error: 'Order items are missing product IDs', supabaseSynced: false };
    }

    const stockResult = await productService.deductStock(normalizedItems);
    if (!stockResult.success) {
      return {
        success: false,
        error: stockResult.error || 'Insufficient stock for one or more items',
        insufficient: stockResult.insufficient,
        supabaseSynced: false,
      };
    }

    const itemsSummary = normalizedItems.map((i) => `${i.name} (x${i.quantity})`).join(', ');
    const itemsCount = normalizedItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

    const newOrder = {
      order_id: orderId,
      id: orderId,
      user_id: userId || null,
      customer_id: resolvedCustomerId || customerId || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      delivery_notes: deliveryNotes,
      delivery_landmark: deliveryNotes || '',
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      payment_method: paymentMethod,
      gcash_number: paymentMethod === 'GCash' ? gcashNumber || customerPhone : null,
      gcash_reference:
        paymentMethod === 'GCash'
          ? gcashReference || 'MP-GCASH-' + Math.floor(100000 + Math.random() * 900000)
          : null,
      cod_change_for: isCOD ? codChangeFor : null,
      promo_id: promoId || null,
      total_amount: Number(total),
      discount_amount: Number(discountAmount || 0),
      shipping_fee: Number(shippingFee || 0),
      grand_total: Number(grandTotal || total),
      items_summary: itemsSummary,
      items_count: itemsCount,
      status: orderStatus,
      channel,
      created_at: nowIso,
      updated_at: nowIso,
      order_date: 'Today',
      estimated_delivery: isCOD ? 'Today (Awaiting COD Verification)' : 'Today (30-45 mins Express Courier)',
      tracking_number: 'MOTO-TRK-' + Math.floor(1000000 + Math.random() * 9000000),
      courier: 'MotoTrack Express SuperAir',
      items: normalizedItems,
      stock_restored: false,
      stock_deducted: true,
    };

    const existing = this.getLocalOrders();
    this.saveLocalOrders([newOrder, ...existing]);

    try {
      notificationService.notifyAdminNewOrder({
        orderId: newOrder.order_id,
        customerName: newOrder.customer_name,
        totalAmount: newOrder.grand_total,
        itemCount: newOrder.items_count,
        paymentMethod: newOrder.payment_method,
      });

      if (
        paymentMethod === 'GCash' ||
        paymentMethod === 'Online Transfer' ||
        paymentMethod === 'Credit Card' ||
        (paymentMethod || '').toLowerCase().includes('gcash')
      ) {
        notificationService.notifyAdminPaymentConfirmed({
          orderId: newOrder.order_id,
          customerName: newOrder.customer_name,
          totalAmount: newOrder.grand_total,
          paymentMethod: newOrder.payment_method,
        });
      }
    } catch (_notifErr) {
      console.warn('[OrderService] Admin notification failed:', _notifErr);
    }

    for (const it of normalizedItems) {
      try {
        const match = (stockResult.products || []).find(
          (p) => p.id === it.product_id || p.product_id === it.product_id
        );
        const newStock = match ? Number(match.stock || 0) : null;
        if (newStock === 0) {
          notificationService.notifyAdminOutOfStock({
            productName: it.name,
            productId: it.product_id,
          });
        } else if (newStock !== null && newStock <= 5) {
          notificationService.notifyAdminLowStock({
            productName: it.name,
            productId: it.product_id,
            currentStock: newStock,
            minThreshold: 5,
          });
        }
      } catch (e) {
        console.warn('[OrderService] Stock alert error:', e);
      }
    }

    const client = supabaseManager.getClient();
    let supabaseSuccess = false;

    const orderPayload = {
      order_id: orderId,
      customer_id: resolvedCustomerId,
      promo_id: promoId || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      delivery_notes: deliveryNotes,
      delivery_landmark: deliveryNotes || null,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      payment_method: paymentMethod,
      channel,
      total_amount: Number(total),
      discount_amount: Number(discountAmount || 0),
      shipping_fee: Number(shippingFee || 0),
      grand_total: Number(grandTotal || total),
      status: orderStatus,
      items_summary: itemsSummary,
      items_count: itemsCount,
      tracking_number: newOrder.tracking_number,
      courier: newOrder.courier,
      estimated_delivery: newOrder.estimated_delivery,
      cod_change_for: isCOD ? codChangeFor : null,
    };

    const paymentId = makeEntityId('pay');
    const paymentPayload = {
      payment_id: paymentId,
      order_id: orderId,
      payment_method: paymentMethod,
      amount: Number(grandTotal || total),
      reference_number: isCOD
        ? 'COD-PENDING'
        : newOrder.gcash_reference || 'TXN-' + Math.floor(100000 + Math.random() * 900000),
      status: isCOD ? 'Pending' : 'Completed',
    };

    const saleId = makeEntityId('sale');
    const salePayload = {
      sale_id: saleId,
      customer_id: resolvedCustomerId,
      payment_id: paymentId,
      sale_type: channel === 'Online Store' ? 'Online' : 'POS',
      total_amount: Number(grandTotal || total),
      amount_paid: isCOD ? 0 : Number(grandTotal || total),
      change: 0,
    };

    const orderItemsPayload = normalizedItems.map((it) => ({
      order_item_id: makeEntityId('oi'),
      order_id: orderId,
      product_id: it.product_id,
      quantity: it.quantity,
      cost: it.price,
      subtotal: it.price * it.quantity,
    }));

    if (client) {
      try {
        let { error: ordErr } = await client.from('orders').insert([orderPayload]);

        // Retry without FK fields that often break demo accounts / invalid promos
        if (ordErr) {
          console.warn('[OrderService] Order insert failed, retrying without FKs:', ordErr);
          const { customer_id: _c, promo_id: _p, ...safePayload } = orderPayload;
          const retry = await client.from('orders').insert([{ ...safePayload, customer_id: null, promo_id: null }]);
          ordErr = retry.error;
        }

        if (ordErr && /delivery_lat|delivery_lng|delivery_landmark/.test(String(ordErr.message || ''))) {
          const {
            delivery_lat: _lat,
            delivery_lng: _lng,
            delivery_landmark: _lm,
            ...withoutGeo
          } = orderPayload;
          const geoRetry = await client.from('orders').insert([{ ...withoutGeo, customer_id: null, promo_id: null }]);
          ordErr = geoRetry.error;
        }

        if (!ordErr) {
          supabaseSuccess = true;
          const { error: payErr } = await client.from('payments').insert([paymentPayload]);
          if (payErr) console.warn('[OrderService] Payment insert failed:', payErr);
          const { error: saleErr } = await client.from('sales').insert([
            { ...salePayload, customer_id: resolvedCustomerId },
          ]);
          if (saleErr) {
            const saleRetry = await client.from('sales').insert([{ ...salePayload, customer_id: null }]);
            if (saleRetry.error) console.warn('[OrderService] Sale insert failed:', saleRetry.error);
          }
          if (orderItemsPayload.length > 0) {
            const { error: itemsErr } = await client.from('order_items').insert(orderItemsPayload);
            if (itemsErr) {
              // Drop invalid product_id FKs and retry bare rows
              const bareItems = orderItemsPayload.map(({ product_id, ...rest }) => ({
                ...rest,
                product_id: null,
              }));
              const itemsRetry = await client.from('order_items').insert(bareItems);
              if (itemsRetry.error) console.warn('[OrderService] Order items insert failed:', itemsRetry.error);
            }
          }
        } else {
          console.warn('[OrderService] Supabase insert failed, enqueuing offline:', ordErr);
        }
      } catch (err) {
        console.warn('[OrderService] Supabase insert error:', err);
      }
    }

    if (!supabaseSuccess) {
      this.enqueueOfflineAction({
        type: 'create_order',
        orderId,
        orderPayload: { ...orderPayload, customer_id: resolvedCustomerId, promo_id: null },
        paymentPayload,
        salePayload: { ...salePayload, customer_id: resolvedCustomerId },
        orderItemsPayload,
      });
    }

    try {
      await emailService.sendOrderConfirmationEmail({
        order: newOrder,
        customerEmail: customerPhone?.includes('@') ? customerPhone : null,
        customerName,
      });
    } catch (e) {
      console.warn('[OrderService] Order confirmation email failed:', e);
    }

    return { success: true, order: newOrder, supabaseSynced: supabaseSuccess };
  }

  /**
   * Update Delivery Address for an existing order
   */
  async updateAddress(orderId, newAddress) {
    if (!orderId || !newAddress) return { success: false, error: 'Order ID and address are required' };
    const cleanAddress = newAddress.trim();

    const orders = this.getLocalOrders();
    const existing = orders.find((o) => o.order_id === orderId || o.id === orderId);
    if (!existing) return { success: false, error: 'Order not found' };
    if (!canCustomerEditAddressStatus(existing.status)) {
      return {
        success: false,
        error: 'Address cannot be changed after the order is out for delivery.',
      };
    }
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        targetOrder = { ...o, customer_address: cleanAddress, updated_at: new Date().toISOString() };
        return targetOrder;
      }
      return o;
    });
    this.saveLocalOrders(updated);

    const client = supabaseManager.getClient();
    let synced = false;
    if (client) {
      try {
        const { error } = await client
          .from('orders')
          .update({ customer_address: cleanAddress })
          .eq('order_id', orderId);
        if (!error) synced = true;
      } catch (e) {}
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'update_address',
        orderId,
        address: cleanAddress,
      });
    }

    return { success: true, order: targetOrder, address: cleanAddress };
  }

  /**
   * Admin 1-Click Approve for Cash on Delivery Orders
   */
  async approveCODOrder(orderId) {
    const orders = this.getLocalOrders();
    const existing = orders.find((o) => o.order_id === orderId || o.id === orderId);
    if (!existing) return { success: false, error: 'Order not found.' };
    if (!isCodPaymentMethod(existing.payment_method)) {
      return { success: false, error: 'Only Cash on Delivery orders can be approved this way.' };
    }
    const from = canonicalizeStatus(existing.status);
    if (from === ORDER_STATUSES.PROCESSING) {
      return { success: true, order: existing };
    }
    if (from !== ORDER_STATUSES.PENDING_APPROVAL) {
      return {
        success: false,
        error: `Cannot approve COD while the order is "${existing.status}".`,
      };
    }

    const nowIso = new Date().toISOString();
    const client = supabaseManager.getClient();
    let synced = false;
    if (client) {
      try {
        const { data, error } = await client
          .from('orders')
          .update({ status: ORDER_STATUSES.PROCESSING, updated_at: nowIso })
          .eq('order_id', orderId)
          .select('order_id');
        if (!error && Array.isArray(data) && data.length > 0) synced = true;
        else if (error) console.warn('Supabase approve COD error:', error);
        try {
          await client.from('payments').update({ status: 'Completed' }).eq('order_id', orderId);
        } catch (payErr) {
          console.warn('[OrderService] COD payment status update failed:', payErr);
        }
      } catch (e) {
        console.warn('Supabase approve COD error:', e);
      }
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'update_status',
        orderId,
        status: ORDER_STATUSES.PROCESSING,
      });
    }

    let targetOrder = null;
    let found = false;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        found = true;
        targetOrder = {
          ...o,
          status: ORDER_STATUSES.PROCESSING,
          payment_status: 'Completed',
          cod_approved_at: nowIso,
          estimated_delivery: 'In 1-2 Business Days (Packing)',
          updated_at: nowIso,
        };
        return targetOrder;
      }
      return o;
    });
    if (!found) {
      targetOrder = {
        order_id: orderId,
        id: orderId,
        status: 'Processing',
        cod_approved_at: nowIso,
        estimated_delivery: 'In 1-2 Business Days (Packing)',
        updated_at: nowIso,
        created_at: nowIso,
      };
      updated.unshift(targetOrder);
    }
    this.saveLocalOrders(updated);

    // Notification
    try {
      if (targetOrder) {
        notificationService.notifyAdminPaymentConfirmed({
          orderId,
          customerName: targetOrder.customer_name,
          totalAmount: targetOrder.grand_total || targetOrder.total_amount || 0,
          paymentMethod: 'COD (Approved & Verified)',
        });
        auditLogService.logOrderAction({
          action: 'COD_ORDER_APPROVED',
          target: `Order #${orderId}`,
          details: `Admin approved Cash on Delivery order for ${targetOrder.customer_name} (₱${Number(targetOrder.grand_total || targetOrder.total_amount || 0).toLocaleString()}). Queued for warehouse packing.`,
          severity: 'SUCCESS',
          metadata: { orderId, customer: targetOrder.customer_name, grand_total: targetOrder.grand_total },
        });
        await emailService.sendOrderStatusNotification({
          orderId,
          oldStatus: 'Pending Approval',
          newStatus: 'Processing',
          customerEmail: targetOrder.customer_phone?.includes('@') ? targetOrder.customer_phone : null,
          customerName: targetOrder.customer_name,
          trackingNumber: targetOrder.tracking_number,
          notes: 'Your COD order has been approved by our admin team.',
        });
      }
    } catch (e) {}

    return { success: true, order: targetOrder };
  }

  /**
   * Update Order Status
   * @param {object} [options]
   * @param {boolean} [options.allowDelivered] - allow setting Delivered (admin confirmation only)
   * @param {boolean} [options.skipTransitionCheck]
   * @param {object} [options.deliveryMeta] - denormalized delivery fields to merge on local order
   */
  async updateOrderStatus(orderId, newStatus, notes = '', options = {}) {
    const {
      allowDelivered = false,
      skipTransitionCheck = false,
      deliveryMeta = null,
      adminCorrection = false,
    } = options || {};

    const orders = this.getLocalOrders();
    const existing = orders.find((o) => o.order_id === orderId || o.id === orderId);
    const oldStatusRaw = existing?.status || ORDER_STATUSES.PENDING_APPROVAL;
    const canonicalNew = canonicalizeStatus(newStatus);
    const canonicalOld = canonicalizeStatus(oldStatusRaw);

    if (!skipTransitionCheck) {
      const check = assertStatusTransition(canonicalOld, canonicalNew, {
        allowDelivered,
        adminCorrection,
      });
      if (!check.ok) {
        return { success: false, error: check.error };
      }
    }

    if (
      canonicalNew === ORDER_STATUSES.DELIVERED &&
      canonicalOld === ORDER_STATUSES.OUT &&
      !allowDelivered &&
      !adminCorrection
    ) {
      return {
        success: false,
        error:
          'Out for Delivery orders become Delivered only when an authorized admin marks them delivered.',
      };
    }

    const nowIso = new Date().toISOString();
    const client = supabaseManager.getClient();
    let synced = false;

    const supabasePatch = {
      status: canonicalNew,
      updated_at: nowIso,
    };

    if (client) {
      try {
        const { data, error } = await client
          .from('orders')
          .update(supabasePatch)
          .eq('order_id', orderId)
          .select('order_id');
        if (!error && Array.isArray(data) && data.length > 0) {
          synced = true;
        } else if (error) {
          console.warn('Supabase update order status error:', error);
        } else {
          console.warn('[OrderService] Status update matched 0 rows for', orderId);
        }
      } catch (e) {
        console.warn('Supabase update order status error:', e);
      }
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'update_status',
        orderId,
        status: canonicalNew,
      });
    }

    let oldStatus = ORDER_STATUSES.PENDING_APPROVAL;
    let targetOrder = null;
    let shouldRestoreStock = false;
    let found = false;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        found = true;
        oldStatus = o.status;
        let est = o.estimated_delivery;
        if (canonicalNew === ORDER_STATUSES.PENDING_APPROVAL) est = 'Awaiting COD Approval';
        if (canonicalNew === ORDER_STATUSES.PROCESSING) est = 'Preparing & Packing at Warehouse';
        if (canonicalNew === ORDER_STATUSES.READY) est = 'Ready for courier dispatch';
        if (canonicalNew === ORDER_STATUSES.OUT) est = 'Out for Courier Delivery Today';
        if (canonicalNew === ORDER_STATUSES.FAILED) est = 'Delivery attempt failed';
        if (canonicalNew === ORDER_STATUSES.RESCHEDULED) est = 'Delivery rescheduled';
        if (canonicalNew === ORDER_STATUSES.DELIVERED) est = 'Delivered & Received';
        if (canonicalNew === ORDER_STATUSES.CANCELLED) est = 'Order Cancelled';
        if (canonicalNew === ORDER_STATUSES.RETURN_REQUESTED) est = 'Return requested';
        if (canonicalNew === ORDER_STATUSES.REFUNDED) est = 'Refunded';
        shouldRestoreStock =
          canonicalNew === ORDER_STATUSES.CANCELLED &&
          canonicalizeStatus(o.status) !== ORDER_STATUSES.CANCELLED &&
          !o.stock_restored &&
          Array.isArray(o.items) &&
          o.items.length > 0;
        targetOrder = {
          ...o,
          status: canonicalNew,
          estimated_delivery: est,
          updated_at: nowIso,
          ...(canonicalNew === ORDER_STATUSES.CANCELLED ? { stock_restored: true } : {}),
          ...(deliveryMeta || {}),
        };
        return targetOrder;
      }
      return o;
    });

    if (!found) {
      targetOrder = {
        order_id: orderId,
        id: orderId,
        status: canonicalNew,
        estimated_delivery:
          canonicalNew === ORDER_STATUSES.DELIVERED
            ? 'Delivered & Received'
            : canonicalNew === ORDER_STATUSES.OUT
              ? 'Out for Courier Delivery Today'
              : canonicalNew === ORDER_STATUSES.CANCELLED
                ? 'Order Cancelled'
                : 'Status updated',
        updated_at: nowIso,
        created_at: nowIso,
        ...(deliveryMeta || {}),
      };
      updated.unshift(targetOrder);
    }

    this.saveLocalOrders(updated);

    if (shouldRestoreStock && targetOrder?.items) {
      try {
        await productService.restoreStock(targetOrder.items);
      } catch (e) {
        console.warn('[OrderService] Stock restore on status cancel failed:', e);
      }
    }

    try {
      if (targetOrder) {
        notificationService.notifyAdminOrderStatusUpdated({
          orderId,
          status: canonicalNew,
          customerName: targetOrder.customer_name,
        });
        auditLogService.logOrderAction({
          action: 'ORDER_STATUS_CHANGED',
          target: `Order #${orderId}`,
          details: `Order status changed from "${oldStatus}" to "${canonicalNew}" for customer ${targetOrder.customer_name}.${notes ? ` Notes: ${notes}` : ''}${shouldRestoreStock ? ' Stock returned to inventory.' : ''}`,
          severity: canonicalNew === ORDER_STATUSES.CANCELLED ? 'WARNING' : 'INFO',
          metadata: { orderId, oldStatus, newStatus: canonicalNew, customer: targetOrder.customer_name, notes },
        });
        await emailService.sendOrderStatusNotification({
          orderId,
          oldStatus,
          newStatus: canonicalNew,
          customerEmail: targetOrder.customer_phone?.includes('@') ? targetOrder.customer_phone : null,
          customerName: targetOrder.customer_name,
          trackingNumber: targetOrder.tracking_number,
          notes,
        });
      }
    } catch (e) {
      console.warn('[OrderService] Status notification failed:', e);
    }

    return { success: true, order: targetOrder };
  }

  /**
   * Cancel an order & persist cancellation reason in orders + order_notes
   */
  async cancelOrder(orderId, reason = 'Cancelled by Customer', options = {}) {
    if (!orderId) return { success: false, error: 'Order ID is required' };
    const cleanReason = (reason || 'Cancelled by Customer').trim();
    const { admin = false } = options || {};

    const orders = this.getLocalOrders();
    const prior = orders.find((o) => o.order_id === orderId || o.id === orderId);
    if (!prior) {
      return { success: false, error: 'Order not found' };
    }
    const priorStatus = canonicalizeStatus(prior.status);
    if (priorStatus === ORDER_STATUSES.CANCELLED) {
      return { success: true, order: prior };
    }
    if (!admin && !canCustomerCancelStatus(prior.status)) {
      return {
        success: false,
        error: 'This order can no longer be cancelled. Contact the store if you need help.',
      };
    }
    if (
      admin &&
      (priorStatus === ORDER_STATUSES.DELIVERED ||
        priorStatus === ORDER_STATUSES.REFUNDED ||
        priorStatus === ORDER_STATUSES.RETURN_REQUESTED)
    ) {
      return {
        success: false,
        error: `Cannot cancel an order that is "${priorStatus}".`,
      };
    }

    const oldStatus = prior.status || 'Processing';
    const shouldRestoreStock = !prior.stock_restored && Array.isArray(prior.items) && prior.items.length > 0;

    const targetOrder = {
      ...prior,
      status: 'Cancelled',
      cancel_reason: cleanReason,
      estimated_delivery: 'Order Cancelled',
      updated_at: new Date().toISOString(),
      stock_restored: true,
    };
    this.saveLocalOrders(orders.map((o) => (o.order_id === orderId || o.id === orderId ? targetOrder : o)));

    if (shouldRestoreStock) {
      try {
        await productService.restoreStock(prior.items);
      } catch (e) {
        console.warn('[OrderService] Stock restore on cancel failed:', e);
      }
    }

    const client = supabaseManager.getClient();
    let synced = false;
    if (client) {
      try {
        const { error } = await client
          .from('orders')
          .update({ status: 'Cancelled', cancel_reason: cleanReason })
          .eq('order_id', orderId);
        if (!error) {
          synced = true;
          try {
            await client.from('order_notes').insert([
              {
                order_id: orderId,
                note_type: 'cancellation',
                content: cleanReason,
                author: 'Customer',
              },
            ]);
          } catch (e) {
            console.warn('[OrderService] Cancel note insert failed:', e);
          }
        }
      } catch (e) {
        console.warn('[OrderService] Cancel sync failed:', e);
      }
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'cancel_order',
        orderId,
        reason: cleanReason,
      });
    }

    try {
      await emailService.sendOrderStatusNotification({
        orderId,
        oldStatus,
        newStatus: 'Cancelled',
        customerEmail: targetOrder.customer_phone?.includes('@') ? targetOrder.customer_phone : null,
        customerName: targetOrder.customer_name,
        trackingNumber: targetOrder.tracking_number,
        notes: cleanReason,
      });
      notificationService.notifyAdminOrderStatusUpdated({
        orderId,
        status: `Cancelled (${cleanReason})`,
        customerName: targetOrder.customer_name,
      });
      auditLogService.logOrderAction({
        action: 'ORDER_CANCELLED',
        target: `Order #${orderId}`,
        details: `Order #${orderId} was cancelled. Reason: ${cleanReason}.${shouldRestoreStock ? ' Stock returned to inventory.' : ''}`,
        severity: 'WARNING',
        metadata: { orderId, reason: cleanReason, customer: targetOrder.customer_name },
      });
    } catch (e) {
      console.warn('[OrderService] Cancel notification failed:', e);
    }

    return { success: true, order: targetOrder };
  }

  /**
   * Request Return / Refund (30-day policy)
   */
  async requestReturn(
    orderId,
    { reason = 'Defective / Damaged part', notes = '', refundMethod = 'Original Payment' }
  ) {
    if (!orderId) return { success: false, error: 'Order ID is required' };
    const orders = this.getLocalOrders();
    const prior = orders.find((o) => o.order_id === orderId || o.id === orderId);
    if (!prior) return { success: false, error: 'Order not found' };
    if (!canCustomerRequestReturnStatus(prior.status)) {
      return { success: false, error: 'Returns can only be requested for delivered orders.' };
    }
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        targetOrder = {
          ...o,
          status: 'Return Requested',
          return_status: 'requested',
          return_reason: reason,
          return_notes: notes,
          return_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return targetOrder;
      }
      return o;
    });
    this.saveLocalOrders(updated);

    try {
      if (targetOrder) {
        notificationService.notifyAdminOrderStatusUpdated({
          orderId,
          status: `Return Requested (${reason})`,
          customerName: targetOrder.customer_name,
        });
      }
    } catch (_err) {}

    const client = supabaseManager.getClient();
    let synced = false;
    if (client) {
      try {
        const { error } = await client
          .from('orders')
          .update({
            status: 'Return Requested',
            return_status: 'requested',
            return_reason: reason,
            return_notes: notes,
            return_requested_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);
        if (!error) {
          synced = true;
          try {
            await client.from('order_notes').insert([
              {
                order_id: orderId,
                note_type: 'return',
                content: `Return Requested: ${reason}. Notes: ${notes || 'None'}. Refund: ${refundMethod}`,
                author: 'Customer',
              },
            ]);
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'request_return',
        orderId,
        reason,
        notes,
      });
    }

    try {
      if (targetOrder) {
        await emailService.sendOrderStatusNotification({
          orderId,
          oldStatus: 'Delivered',
          newStatus: 'Return Requested',
          customerName: targetOrder.customer_name,
          notes: `Reason: ${reason}`,
        });
      }
    } catch (e) {}

    return { success: true, order: targetOrder };
  }

  /**
   * Process Return Decision (Admin Action)
   */
  async processReturn(orderId, decision = 'Approved', adminNotes = '') {
    const isApprove = decision === 'Approved';
    const newStatus = isApprove ? ORDER_STATUSES.REFUNDED : ORDER_STATUSES.DELIVERED;
    const returnStatus = isApprove ? 'approved' : 'rejected';

    const orders = this.getLocalOrders();
    const prior = orders.find((o) => o.order_id === orderId || o.id === orderId);
    if (!prior) return { success: false, error: 'Order not found' };
    if (canonicalizeStatus(prior.status) !== ORDER_STATUSES.RETURN_REQUESTED) {
      return { success: false, error: 'No return request is pending for this order.' };
    }
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        targetOrder = {
          ...o,
          status: newStatus,
          return_status: returnStatus,
          updated_at: new Date().toISOString(),
          stock_restored: isApprove ? true : o.stock_restored,
        };
        return targetOrder;
      }
      return o;
    });
    this.saveLocalOrders(updated);

    if (isApprove && targetOrder && !prior.stock_restored && Array.isArray(prior.items) && prior.items.length > 0) {
      try {
        await productService.restoreStock(prior.items);
      } catch (e) {
        console.warn('[OrderService] Stock restore on return failed:', e);
      }
    }

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('orders')
          .update({ status: newStatus, return_status: returnStatus })
          .eq('order_id', orderId);
        try {
          await client.from('order_notes').insert([
            {
              order_id: orderId,
              note_type: 'admin',
              content: `Return ${decision} by Admin. ${adminNotes}`,
              author: 'Admin',
            },
          ]);
        } catch (e) {
          console.warn('[OrderService] Return note insert failed:', e);
        }
      } catch (e) {
        console.warn('[OrderService] Return sync failed:', e);
      }
    }

    return { success: true, order: targetOrder };
  }

  /**
   * Export Orders to CSV (Admin feature)
   */
  exportOrdersToCSV(ordersList = null) {
    const list = ordersList && Array.isArray(ordersList) ? ordersList : this.getLocalOrders();
    if (!list || list.length === 0) return '';

    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Phone',
      'Address',
      'Payment Method',
      'Channel',
      'Items Summary',
      'Total Amount',
      'Discount',
      'Grand Total',
      'Status',
      'Courier',
      'Tracking Number',
      'Cancel Reason',
    ];

    const escapeCSV = (str) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = list.map((o) => [
      escapeCSV(o.order_id || o.id),
      escapeCSV(o.order_date || o.created_at),
      escapeCSV(o.customer_name),
      escapeCSV(o.customer_phone),
      escapeCSV(o.customer_address),
      escapeCSV(o.payment_method),
      escapeCSV(o.channel || 'Online Store'),
      escapeCSV(o.items_summary),
      escapeCSV(o.total_amount),
      escapeCSV(o.discount_amount),
      escapeCSV(o.grand_total),
      escapeCSV(o.status),
      escapeCSV(o.courier),
      escapeCSV(o.tracking_number),
      escapeCSV(o.cancel_reason || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `mototrack_orders_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.warn('[OrderService] CSV download trigger note:', e);
      }
    }

    return csvContent;
  }

  /**
   * Generate tracking milestone timeline for an order
   */
  getTrackingTimeline(order) {
    const rawStatus = (order.status || 'Pending Approval').trim();
    const status = rawStatus.toLowerCase();
    const isCancelled = status === 'cancelled';
    const isDelivered = status === 'delivered' || status === 'completed';
    const isFailed =
      status === 'delivery failed' || status === 'delivery issue' || status === 'failed';
    const isReported = status === 'delivery reported' || status === 'reported';
    const isRescheduled = status === 'rescheduled';
    const isOut =
      status === 'out for delivery' ||
      status === 'shipped' ||
      status === 'in transit' ||
      isReported ||
      isDelivered ||
      isFailed;
    const isReady =
      status === 'ready for delivery' || isOut || isRescheduled;
    const isProcessing = status === 'processing' || isReady;
    const isPendingApproval = status.includes('pending') || status.includes('approval');
    const isCOD = (order.payment_method || '').toLowerCase().includes('cash');
    const rider = order.rider_name || order.courier || null;
    const confirmedAt = order.admin_confirmed_at || order.updated_at || null;
    const adminConfirmed = Boolean(order.admin_confirmed);

    if (isCancelled) {
      return [
        {
          id: 1,
          title: 'Order Placed',
          description: 'Your purchase was received and logged in the system.',
          date: order.order_date || 'Today',
          time: '09:30 AM',
          completed: true,
          current: false,
          icon: 'receipt',
        },
        {
          id: 2,
          title: 'Order Cancelled',
          description: 'Order was cancelled. No charges or shipments will proceed.',
          date: 'Today',
          time: '11:00 AM',
          completed: true,
          current: true,
          isCancelled: true,
          icon: 'x-lg',
        },
      ];
    }

    const milestones = [
      {
        id: 1,
        title: isCOD ? 'COD Order Placed' : 'Payment Confirmed & Order Placed',
        description: isCOD
          ? 'Cash on delivery order submitted and queued for admin review.'
          : 'Payment authorized. Receipt logged.',
        date: order.order_date || 'Today',
        time: '09:30 AM',
        completed: true,
        current: isPendingApproval,
        icon: isCOD ? 'cash-coin' : 'receipt',
      },
      {
        id: 2,
        title: isPendingApproval ? 'Awaiting Confirmation' : 'Processing & Packing',
        description: isPendingApproval
          ? 'Store admin is reviewing your order.'
          : 'Parts inspected and packed at MotoTrack Warehouse.',
        date: isProcessing ? 'Today' : 'Pending',
        time: isProcessing ? '01:15 PM' : '--',
        completed: isProcessing && !isPendingApproval,
        current: status === 'processing',
        icon: 'box-seam-fill',
      },
      {
        id: 3,
        title: isRescheduled ? 'Rescheduled' : 'Ready for Delivery',
        description: isRescheduled
          ? 'Delivery was rescheduled. Awaiting re-dispatch.'
          : order.rider_name
            ? `Assigned to rider ${order.rider_name}. Awaiting dispatch.`
            : 'Waiting for rider assignment and dispatch.',
        date: isReady ? 'Today' : 'Pending',
        time: isReady ? '02:00 PM' : '--',
        completed: isReady,
        current: status === 'ready for delivery' || isRescheduled,
        icon: isRescheduled ? 'arrow-repeat' : 'clipboard-check',
      },
      {
        id: 4,
        title: isFailed ? 'Delivery Issue' : 'Out for Delivery',
        description: isFailed
          ? 'Delivery had an issue. The store will reschedule and issue a new confirmation link.'
          : rider
            ? `With ${rider}. Scan the delivery QR after drop-off to report delivery.`
            : 'Out for delivery. Rider confirms via secure QR after drop-off.',
        date: isOut || isFailed ? 'Today' : 'Pending',
        time: isOut || isFailed ? '03:45 PM' : '--',
        completed: (isOut || isFailed) && !isReported && !isDelivered ? true : isOut || isFailed || isReported || isDelivered,
        current:
          (status === 'out for delivery' ||
            status === 'shipped' ||
            status === 'in transit' ||
            isFailed) &&
          !isReported &&
          !isDelivered,
        icon: isFailed ? 'exclamation-triangle' : 'truck',
      },
      {
        id: 5,
        title: 'Delivery Reported',
        description: isDelivered
          ? 'Rider reported drop-off; store admin confirmed.'
          : isReported || order.rider_reported_delivered
            ? 'Rider reported delivery. Waiting for store admin to confirm.'
            : 'Waiting for rider to confirm via QR/link after drop-off.',
        date: isReported || isDelivered ? 'Today' : 'Pending',
        time: isReported || isDelivered ? '04:30 PM' : '--',
        completed: isReported || isDelivered,
        current: isReported && !isDelivered,
        icon: 'clipboard-check',
      },
      {
        id: 6,
        title: 'Delivered',
        description: isDelivered
          ? adminConfirmed
            ? 'Store admin confirmed delivery after rider report.'
            : 'Order marked as delivered by the store.'
          : 'Waiting for store admin to confirm delivery.',
        date: isDelivered
          ? confirmedAt
            ? new Date(confirmedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Today'
          : order.estimated_delivery || 'Upcoming',
        time: isDelivered
          ? confirmedAt
            ? new Date(confirmedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })
            : '05:30 PM'
          : '--',
        completed: isDelivered,
        current: isDelivered,
        icon: 'check-circle-fill',
      },
    ];

    return milestones;
  }

  /**
   * Create an in-store POS Order
   */
  async createPOSOrder(orderData) {
    const posId = makeEntityId('pos');
    const dateObj = new Date();
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newOrder = {
      order_id: posId,
      id: posId,
      customer_id: orderData.customer_id || 'walkin-guest',
      customer_name: orderData.customer_name || 'Walk-in Customer',
      customer_phone: orderData.customer_phone || 'N/A',
      customer_address: 'In-Store Counter / Direct Handover',
      payment_method: orderData.payment_method || 'Cash',
      amount_tendered: Number(orderData.amount_tendered || orderData.grand_total || 0),
      change_amount: Number(orderData.change_amount || 0),
      total_amount: Number(orderData.total_amount || orderData.grand_total || 0),
      discount_amount: Number(orderData.discount_amount || 0),
      discount_code: orderData.discount_code || '',
      grand_total: Number(orderData.grand_total || 0),
      channel: 'POS (In-Store)',
      cashier: orderData.cashier || 'Admin Cashier',
      items_summary: (orderData.items || []).map((i) => `${i.name} (x${i.quantity})`).join(', '),
      items_count: (orderData.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0),
      status: 'Delivered',
      created_at: dateObj.toISOString(),
      order_date: formattedDate,
      estimated_delivery: 'Fulfilled at Counter',
      tracking_number: 'POS-' + Math.floor(100000 + Math.random() * 900000),
      courier: 'Direct Handover (Walk-in)',
      items: orderData.items || [],
      stock_deducted: false,
    };

    const posItems = newOrder.items || [];
    if (posItems.length > 0) {
      const stockRes = await productService.deductStock(posItems);
      if (!stockRes?.success) {
        return { success: false, error: stockRes?.error || 'Insufficient stock for POS sale.' };
      }
      newOrder.stock_deducted = true;
    }

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('orders').insert([
          {
            order_id: newOrder.order_id,
            customer_name: newOrder.customer_name,
            payment_method: newOrder.payment_method,
            total_amount: newOrder.total_amount,
            discount_amount: newOrder.discount_amount,
            grand_total: newOrder.grand_total,
            status: 'Delivered',
            channel: 'POS (In-Store)',
            items_summary: newOrder.items_summary,
            items_count: newOrder.items_count,
          },
        ]);
      } catch (e) {
        console.warn('Supabase POS order insert note:', e);
      }
    }

    const currentOrders = this.getLocalOrders();
    const updated = [newOrder, ...currentOrders];
    this.saveLocalOrders(updated);

    return { success: true, order: newOrder };
  }

  /**
   * Submit ratings & reviews for delivered order items
   */
  async submitOrderRating(orderId, ratingData = {}) {
    if (!orderId) return { success: false, error: 'Order ID is required' };
    const orders = this.getLocalOrders();
    const index = orders.findIndex((o) => o.order_id === orderId || o.id === orderId);
    if (index === -1) return { success: false, error: 'Order not found' };

    const order = orders[index];
    const updatedOrder = {
      ...order,
      is_rated: true,
      rating_data: {
        rated_at: new Date().toISOString(),
        customer_rating: Number(ratingData.overallRating || 5),
        courier_rating: Number(ratingData.courierRating || 5),
        items_ratings: ratingData.itemsRatings || {},
        feedback: ratingData.feedback || '',
      },
    };

    orders[index] = updatedOrder;
    this.saveLocalOrders(orders);

    // Sync to Supabase if connected
    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('orders')
          .update({
            is_rated: true,
            rating_data: updatedOrder.rating_data,
          })
          .eq('order_id', orderId);
      } catch (e) {
        console.warn('Supabase rating update note:', e);
      }
    }

    return { success: true, order: updatedOrder };
  }
}

export const orderService = new OrderService();
export default orderService;
