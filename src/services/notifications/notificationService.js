import { storageAdapter } from '../system/storageAdapter.js';
import { supabaseManager } from '../../lib/supabase.js';
import { resolveReorderLevel } from '../../utils/inventoryHelpers.js';

const CUSTOMER_STORAGE_KEY = '@mototrack_user_notifications';
const ADMIN_STORAGE_KEY = '@mototrack_admin_notifications';
const READ_KEYS_STORAGE_KEY = '@mototrack_read_notification_keys';
const CLEARED_KEYS_STORAGE_KEY = '@mototrack_cleared_notification_keys';

export function stripEmojis(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isDateTodayOrSoon(dateStr) {
  if (!dateStr) return false;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return false;
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 1;
  } catch (_e) {
    return false;
  }
}

/**
 * 15 Dedicated Admin Notification Categories:
 * 1. order_placed: New customer order placed
 * 2. payment_confirmed: Order payment confirmed
 * 3. order_status: Order status updated
 * 4. low_stock: Product reaches low stock
 * 5. out_of_stock: Product becomes out of stock
 * 6. booking_new: New repair or customization booking submitted
 * 7. booking_cancelled: Customer cancels a booking
 * 8. service_approaching: Scheduled repair or service is approaching
 * 9. service_completed: Repair or PMS service is completed
 * 10. customer_registered: Customer registers a new account
 * 11. review_submitted: Customer submits a review or rating
 * 12. restock_attention: Purchase order or restocking request needs attention
 * 13. restock_recommendation: System recommends restocking based on sales activity
 * 14. sales_update: Important sales or inventory updates
 * 15. security_activity: Important system or security activities
 */

const INITIAL_ADMIN_NOTIFICATIONS = [];

const SEED_CUSTOMER_NOTIFICATION_IDS = new Set([
  'cust-notif-welcome',
  'cust-notif-1',
  'cust-notif-2',
  'cust-notif-3',
  'cust-notif-4',
]);

export function isSeedCustomerNotification(item) {
  if (!item) return false;
  const id = String(item.id || '');
  if (SEED_CUSTOMER_NOTIFICATION_IDS.has(id)) return true;
  const message = String(item.message || '');
  return (
    message.includes('BK-REP-4921') ||
    message.includes('MT-ORD-8821') ||
    message.includes('124.106.128.45') ||
    message.includes('Motul 300V brake fluid flush')
  );
}

function liveCustomerNotifications(list) {
  return (Array.isArray(list) ? list : []).filter((item) => item && !isSeedCustomerNotification(item));
}

export function isOrderNotification(n) {
  if (!n) return false;
  const t = (n.type || '').toLowerCase();
  const c = (n.category || '').toLowerCase();
  const l = (n.link || '').toLowerCase();
  return (
    t.includes('order') ||
    c.includes('order') ||
    c.includes('delivery') ||
    l.includes('order') ||
    Boolean(n.meta?.orderId)
  );
}

export function isBookingNotification(n) {
  if (!n) return false;
  const t = (n.type || '').toLowerCase();
  const c = (n.category || '').toLowerCase();
  const l = (n.link || '').toLowerCase();
  return (
    t.includes('booking') ||
    t.includes('service') ||
    t.includes('garage') ||
    t.includes('pit') ||
    c.includes('booking') ||
    c.includes('service') ||
    c.includes('garage') ||
    c.includes('pit') ||
    c.includes('repair') ||
    c.includes('pms') ||
    l.includes('booking') ||
    l.includes('garage') ||
    Boolean(n.meta?.bookingId)
  );
}

export function isPromoNotification(n) {
  if (!n) return false;
  const t = (n.type || '').toLowerCase();
  const c = (n.category || '').toLowerCase();
  return (
    t.includes('promo') ||
    c.includes('promo') ||
    c.includes('welcome') ||
    c.includes('discount') ||
    c.includes('voucher') ||
    c.includes('deal') ||
    t.includes('discount')
  );
}

export function isSecurityNotification(n) {
  if (!n) return false;
  const t = (n.type || '').toLowerCase();
  const c = (n.category || '').toLowerCase();
  return (
    t.includes('security') ||
    t.includes('system') ||
    c.includes('security') ||
    c.includes('system') ||
    c.includes('auth') ||
    c.includes('password')
  );
}

export function extractUserContext(userOrId, userEmail = null, userName = null) {
  const ids = new Set();
  const emails = new Set();
  const names = new Set();

  let userObj = null;
  if (userOrId && typeof userOrId === 'object') {
    userObj = userOrId;
  } else if (userOrId && typeof userOrId !== 'object') {
    const raw = String(userOrId).trim();
    if (raw && raw !== 'guest') {
      if (raw.includes('@')) {
        emails.add(raw.toLowerCase());
      } else {
        ids.add(raw);
      }
    }
  }

  if (userObj) {
    [userObj.id, userObj.user_id, userObj.userId, userObj.customer_id, userObj.customerId]
      .filter(Boolean)
      .forEach((v) => {
        const s = String(v).trim();
        if (s && s !== 'guest') ids.add(s);
      });
    [userObj.email, userObj.userEmail, userObj.customer_email]
      .filter(Boolean)
      .forEach((v) => {
        const s = String(v).trim().toLowerCase();
        if (s) emails.add(s);
      });
    [userObj.name, userObj.userName, userObj.customer_name, userObj.fullName]
      .filter(Boolean)
      .forEach((v) => {
        const s = String(v).trim().toLowerCase();
        if (s) names.add(s);
      });
  }

  if (userEmail) {
    const s = String(userEmail).trim().toLowerCase();
    if (s) emails.add(s);
  }
  if (userName) {
    const s = String(userName).trim().toLowerCase();
    if (s) names.add(s);
  }

  if (typeof window !== 'undefined') {
    try {
      let rawSession = null;
      if (window.sessionStorage) {
        rawSession = window.sessionStorage.getItem('mototrack_current_session');
      }
      if (!rawSession && window.localStorage) {
        rawSession = window.localStorage.getItem('mototrack_current_session');
      }
      if (!rawSession) {
        rawSession = storageAdapter.getItem('mototrack_current_session');
      }
      if (rawSession) {
        const authUser = JSON.parse(rawSession);
        if (authUser) {
          const authId = String(authUser.id || authUser.user_id || '').trim();
          const authCustomerId = String(authUser.customer_id || authUser.customerId || '').trim();
          const authEmail = String(authUser.email || '').trim().toLowerCase();

          const isMatch =
            ids.size === 0 ||
            (authId && ids.has(authId)) ||
            (authCustomerId && ids.has(authCustomerId)) ||
            (authEmail && emails.has(authEmail));

          if (isMatch) {
            if (authId && authId !== 'guest') ids.add(authId);
            if (authCustomerId && authCustomerId !== 'guest') ids.add(authCustomerId);
            if (authEmail) emails.add(authEmail);
            if (authUser.name) names.add(String(authUser.name).trim().toLowerCase());
          }
        }
      }
    } catch (_e) {}
  }

  return { ids, emails, names, hasIdentity: ids.size > 0 || emails.size > 0 };
}

export function notificationMatchesUser(n, userContext) {
  if (!n) return false;
  if (isSeedCustomerNotification(n)) return false;

  // Broadcast to all customers
  if (n.target === 'all') return true;

  if (!userContext || !userContext.hasIdentity) {
    return false;
  }

  const { ids, emails, names } = userContext;

  // Match by direct ID fields
  if (n.user_id && ids.has(String(n.user_id).trim())) return true;
  if (n.customer_id && ids.has(String(n.customer_id).trim())) return true;
  if (n.meta?.userId && ids.has(String(n.meta.userId).trim())) return true;
  if (n.meta?.customerId && ids.has(String(n.meta.customerId).trim())) return true;

  // Match by email
  const nEmail = (
    n.customer_email ||
    n.email ||
    n.meta?.customerEmail ||
    n.meta?.userEmail ||
    n.meta?.email ||
    ''
  ).trim().toLowerCase();
  if (nEmail && emails.has(nEmail)) return true;

  // Match by customer name if available
  const nName = (n.customer_name || n.meta?.customerName || n.meta?.userName || '').trim().toLowerCase();
  if (nName && names.has(nName)) return true;

  // Match if notification references a booking owned by this user
  try {
    let refBookingId = String(n.meta?.bookingId || '').trim();
    if (!refBookingId) {
      const match =
        String(n.message || '').match(/#(BK-[A-Z0-9-]+)/i) ||
        String(n.title || '').match(/#(BK-[A-Z0-9-]+)/i);
      if (match) refBookingId = match[1];
    }
    if (refBookingId && typeof window !== 'undefined' && window.localStorage) {
      const rawBookings = window.localStorage.getItem('mototrack_garage_bookings');
      if (rawBookings) {
        const bookings = JSON.parse(rawBookings);
        const owned =
          Array.isArray(bookings) &&
          bookings.some((b) => {
            const matchId =
              String(b.id || b.booking_id || '').toLowerCase() === refBookingId.toLowerCase();
            if (!matchId) return false;
            const bEmail = (b.customer_email || b.userEmail || '').trim().toLowerCase();
            const bUserId = String(b.customer_id || b.user_id || b.userId || '').trim();
            return (bEmail && emails.has(bEmail)) || (bUserId && ids.has(bUserId));
          });
        if (owned) return true;
      }
    }
  } catch (_e) {}

  // Match if notification references an order owned by this user
  try {
    let refOrderId = String(n.meta?.orderId || '').trim();
    if (!refOrderId) {
      const match =
        String(n.message || '').match(/#(ORD-[A-Z0-9-]+)/i) ||
        String(n.title || '').match(/#(ORD-[A-Z0-9-]+)/i) ||
        String(n.message || '').match(/#(MT-ORD-[A-Z0-9-]+)/i) ||
        String(n.title || '').match(/#(MT-ORD-[A-Z0-9-]+)/i);
      if (match) refOrderId = match[1];
    }
    if (refOrderId && typeof window !== 'undefined' && window.localStorage) {
      const rawOrders = window.localStorage.getItem('mototrack_orders_db');
      if (rawOrders) {
        const orders = JSON.parse(rawOrders);
        const owned =
          Array.isArray(orders) &&
          orders.some((o) => {
            const matchId =
              String(o.order_id || o.id || '').toLowerCase() === refOrderId.toLowerCase();
            if (!matchId) return false;
            const oEmail = (o.customer_email || o.userEmail || o.email || '').trim().toLowerCase();
            const oUserId = String(o.user_id || o.userId || o.customer_id || '').trim();
            return (oEmail && emails.has(oEmail)) || (oUserId && ids.has(oUserId));
          });
        if (owned) return true;
      }
    }
  } catch (_e) {}

  return false;
}

class NotificationService {
  constructor() {
    this.adminNotifications = [...INITIAL_ADMIN_NOTIFICATIONS];
    this.customerNotifications = [];
    this.readNotificationKeys = new Set();
    this.clearedNotificationKeys = new Set();
    this.subscribers = new Set();
    this.initialized = false;
    this.init();
  }

  sanitize(item) {
    if (!item) return item;
    let title = stripEmojis(item.title);
    let message = stripEmojis(item.message);
    if (message) {
      message = message
        .replace(/\s+at Quezon City Hub/gi, '')
        .replace(/Quezon City Hub/gi, '')
        .trim();
    }
    return {
      ...item,
      title,
      message,
    };
  }

  async _loadKeySet(storageKey) {
    try {
      let raw = await storageAdapter.getItem(storageKey);
      if (!raw && typeof window !== 'undefined' && window.localStorage) {
        try {
          raw = window.localStorage.getItem(storageKey);
        } catch (_e) {}
      }
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr.map((k) => String(k).trim()).filter(Boolean));
        }
      }
    } catch (_e) {}
    return new Set();
  }

  async init() {
    try {
      // 1. Load persistent Read and Cleared notification keys
      this.readNotificationKeys = await this._loadKeySet(READ_KEYS_STORAGE_KEY);
      this.clearedNotificationKeys = await this._loadKeySet(CLEARED_KEYS_STORAGE_KEY);

      // 2. Load Customer Notifications (try storageAdapter then localStorage)
      let storedCust = await storageAdapter.getItem(CUSTOMER_STORAGE_KEY);
      if (!storedCust && typeof window !== 'undefined' && window.localStorage) {
        try {
          storedCust = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
        } catch (_e) {}
      }

      if (storedCust) {
        const parsed = JSON.parse(storedCust);
        const liveItems = liveCustomerNotifications(
          Array.isArray(parsed) ? parsed.map((n) => this.sanitize(n)) : []
        );
        this.customerNotifications = liveItems
          .filter((n) => {
            if (!n) return false;
            const nId = String(n.id || '');
            const dbId = String(n.dbRecordId || '');
            if (this.clearedNotificationKeys.has(nId) || (dbId && this.clearedNotificationKeys.has(dbId))) {
              return false;
            }
            return true;
          })
          .map((n) => {
            const nId = String(n.id || '');
            const dbId = String(n.dbRecordId || '');
            const ordId = String(n.meta?.orderId || '');
            const bId = String(n.meta?.bookingId || '');
            const isMarkedRead =
              n.status === 'read' ||
              n.read === true ||
              this.readNotificationKeys.has(nId) ||
              (dbId && this.readNotificationKeys.has(dbId)) ||
              (ordId && this.readNotificationKeys.has(ordId)) ||
              (bId && this.readNotificationKeys.has(bId));
            if (isMarkedRead) {
              if (nId) this.readNotificationKeys.add(nId);
              if (dbId) this.readNotificationKeys.add(dbId);
              if (ordId) this.readNotificationKeys.add(ordId);
              if (bId) this.readNotificationKeys.add(bId);
              return { ...n, status: 'read', read: true };
            }
            return n;
          });
      } else {
        this.customerNotifications = [];
      }

      // 3. Load Admin Notifications (only live database/system alerts)
      let storedAdmin = await storageAdapter.getItem(ADMIN_STORAGE_KEY);
      if (!storedAdmin && typeof window !== 'undefined' && window.localStorage) {
        try {
          storedAdmin = window.localStorage.getItem(ADMIN_STORAGE_KEY);
        } catch (_e) {}
      }

      if (storedAdmin) {
        const parsedAdmin = JSON.parse(storedAdmin);
        this.adminNotifications = Array.isArray(parsedAdmin)
          ? parsedAdmin
              .filter((n) => n.isDatabaseLive || (n.id && String(n.id).startsWith('db-')))
              .map((n) => {
                const s = this.sanitize(n);
                const sId = String(s.id || '');
                const dbId = String(s.dbRecordId || '');
                if (this.readNotificationKeys.has(sId) || (dbId && this.readNotificationKeys.has(dbId))) {
                  return { ...s, status: 'read', read: true };
                }
                return s;
              })
          : [];
      } else {
        this.adminNotifications = [];
      }

      await this.persist();
    } catch (_e) {
      this.customerNotifications = [];
      this.adminNotifications = [];
    }
    this.initialized = true;
    this.notify();

    // Attach real-time system event listeners & auto-sync from database
    this.setupSystemEventListeners();
    this.syncFromDatabase().catch((e) => console.warn('[NotificationService] initial sync note:', e));
  }

  async persist() {
    try {
      const custStr = JSON.stringify(this.customerNotifications);
      const adminStr = JSON.stringify(this.adminNotifications);
      const readStr = JSON.stringify([...this.readNotificationKeys]);
      const clearedStr = JSON.stringify([...this.clearedNotificationKeys]);

      await storageAdapter.setItem(CUSTOMER_STORAGE_KEY, custStr);
      await storageAdapter.setItem(ADMIN_STORAGE_KEY, adminStr);
      await storageAdapter.setItem(READ_KEYS_STORAGE_KEY, readStr);
      await storageAdapter.setItem(CLEARED_KEYS_STORAGE_KEY, clearedStr);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(CUSTOMER_STORAGE_KEY, custStr);
          window.localStorage.setItem(ADMIN_STORAGE_KEY, adminStr);
          window.localStorage.setItem(READ_KEYS_STORAGE_KEY, readStr);
          window.localStorage.setItem(CLEARED_KEYS_STORAGE_KEY, clearedStr);
        } catch (_e) {}
      }
    } catch (_e) {}
  }

  _createPayload() {
    const list = [...this.customerNotifications];
    list.admin = this.adminNotifications;
    list.customer = this.customerNotifications;
    list.all = [...this.adminNotifications, ...this.customerNotifications];
    return list;
  }

  notify() {
    const payload = this._createPayload();
    this.subscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (_e) {}
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Initial emission
    try {
      callback(this._createPayload());
    } catch (_e) {}
    return () => this.subscribers.delete(callback);
  }

  // ─── ADMIN NOTIFICATIONS ACCESSORS ───

  getAdminNotifications() {
    return this.adminNotifications.map((n) => this.sanitize(n));
  }

  getAdminUnreadCount() {
    return this.adminNotifications.filter((n) => n.status === 'unread').length;
  }

  async markAdminAsRead(id) {
    this.adminNotifications = this.adminNotifications.map((n) =>
      n.id === id ? { ...n, status: 'read' } : n
    );
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  async markAdminAsUnread(id) {
    this.adminNotifications = this.adminNotifications.map((n) =>
      n.id === id ? { ...n, status: 'unread' } : n
    );
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  async deleteAdminNotification(id) {
    this.adminNotifications = this.adminNotifications.filter((n) => n.id !== id);
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  async markAllAdminAsRead() {
    this.adminNotifications = this.adminNotifications.map((n) => ({ ...n, status: 'read' }));
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  setupSystemEventListeners() {
    if (this._eventsSetup) return;
    this._eventsSetup = true;

    let debounceTimer = null;
    const triggerDebouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.syncFromDatabase().catch((e) => console.warn('[NotificationService] Realtime sync error:', e));
      }, 2500);
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mototrack_orders_updated', triggerDebouncedSync);
      window.addEventListener('mototrack_bookings_updated', triggerDebouncedSync);
      window.addEventListener('mototrack_products_updated', triggerDebouncedSync);
      window.addEventListener('mototrack_users_updated', triggerDebouncedSync);
      window.addEventListener('storage', (e) => {
        if (
          e.key &&
          (e.key.includes('order') ||
            e.key.includes('garage') ||
            e.key.includes('product') ||
            e.key.includes('user'))
        ) {
          triggerDebouncedSync();
        }
      });
    }

    try {
      const client = supabaseManager.getClient();
      if (client && !this._realtimeSubscribed) {
        this._realtimeSubscribed = true;
        client
          .channel('public:system_alerts_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
            triggerDebouncedSync()
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () =>
            triggerDebouncedSync()
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () =>
            triggerDebouncedSync()
          )
          .subscribe();
      }
    } catch (_e) {}
  }

  /**
   * Synchronize Admin Notifications with Live Database Data (Supabase & Local DB)
   * Fetches real records across Orders, Pit Bay Bookings, Products Stock, and Users.
   */
  async syncFromDatabase({ force = false } = {}) {
    try {
      const generatedAlerts = [];
      const generatedCustomerAlerts = [];

      // 1. Fetch live orders (use TTL cache — avoid full re-download on every alert sync)
      let orders = [];
      try {
        const ordMod = await import('../orders/orderService.js');
        if (ordMod?.orderService?.getAllOrders) {
          orders = (await ordMod.orderService.getAllOrders({ force: Boolean(force) })) || [];
        }
      } catch (_e) {}
      if (!orders.length) {
        try {
          const raw = await storageAdapter.getItem('mototrack_orders_db');
          if (raw) orders = JSON.parse(raw);
        } catch (_e) {}
      }

      if (Array.isArray(orders)) {
        for (const o of orders) {
          if (!o) continue;
          const orderId = o.order_id || o.id || 'N/A';
          const customerName = o.customer_name || 'Customer';
          const totalAmount = Number(o.total_amount || o.grand_total || 0);
          const itemCount = Array.isArray(o.order_items) ? o.order_items.length : (o.itemsCount || 1);
          const paymentMethod = o.payment_method || 'COD';
          const status = String(o.status || 'Processing').trim();
          const createdAt = o.created_at || new Date().toISOString();
          const sLower = status.toLowerCase();

          // Order Placed / Processing Alert for Admin
          generatedAlerts.push({
            id: `db-order-placed-${orderId}`,
            dbRecordId: orderId,
            isDatabaseLive: true,
            target: 'admin',
            category: 'order_placed',
            type: 'order',
            priority: 'high',
            title: 'New Customer Order Placed',
            message: `Customer ${customerName} placed Order #${orderId} (₱${totalAmount.toLocaleString()} - ${itemCount} item${itemCount > 1 ? 's' : ''}) via ${paymentMethod}. Current Status: ${status}.`,
            meta: { orderId, customerName, totalAmount, itemCount, paymentMethod, status },
            status: 'unread',
            created_at: createdAt,
            link: 'orders',
            icon: 'bag-check-fill',
          });

          // Customer Order Alert
          const orderCustomerUserId = o.user_id || o.userId || o.customer_id || o.customerId || null;
          const orderCustomerEmail = o.customer_email || o.userEmail || o.email || null;
          const orderCustomerName = o.customer_name || o.userName || null;
          const custNotifId = `db-cust-order-${orderId}`;

          if (
            !this.clearedNotificationKeys.has(custNotifId) &&
            !this.clearedNotificationKeys.has(String(orderId))
          ) {
            let custTitle = 'Order Placed';
            let custMsg = `Your Order #${orderId} (${itemCount} item${itemCount > 1 ? 's' : ''} - ₱${totalAmount.toLocaleString()}) via ${paymentMethod} is being prepared.`;
            let custIcon = 'bag-check-fill';
            let custStatus = 'unread';

            if (sLower === 'delivered') {
              custTitle = 'Order Delivered';
              custMsg = `Your Order #${orderId} has been successfully delivered. Thank you for choosing MotoTrack!`;
              custIcon = 'check-circle-fill';
              custStatus = 'read';
            } else if (sLower === 'out for delivery' || sLower.includes('out for')) {
              custTitle = 'Order Out for Delivery';
              custMsg = `Your Order #${orderId} is out for delivery. Courier rider is en route to your address.`;
              custIcon = 'truck';
            } else if (sLower.includes('cancel')) {
              custTitle = 'Order Cancelled';
              custMsg = `Your Order #${orderId} has been cancelled.`;
              custIcon = 'x-circle-fill';
            }

            if (
              this.readNotificationKeys.has(custNotifId) ||
              this.readNotificationKeys.has(String(orderId))
            ) {
              custStatus = 'read';
            }

            if ((orderCustomerUserId && orderCustomerUserId !== 'guest') || orderCustomerEmail) {
              generatedCustomerAlerts.push({
                id: custNotifId,
                dbRecordId: orderId,
                isDatabaseLive: true,
                target: 'customer',
                user_id: orderCustomerUserId,
                customer_id: o.customer_id || o.customerId || null,
                customer_email: orderCustomerEmail,
                customer_name: orderCustomerName,
                category: 'order_status',
                type: 'order',
                priority: 'high',
                title: custTitle,
                message: custMsg,
                meta: {
                  orderId,
                  totalAmount,
                  itemCount,
                  paymentMethod,
                  status,
                  userId: orderCustomerUserId,
                  customerId: o.customer_id || o.customerId || null,
                  customerEmail: orderCustomerEmail,
                  customerName: orderCustomerName,
                },
                status: custStatus,
                read: custStatus === 'read',
                created_at: o.updated_at || createdAt,
                link: 'orders',
                icon: custIcon,
              });
            }
          }

          // Payment Confirmed Alert (if paid / confirmed / gcash)
          const isPaid =
            String(o.payment_status || '').toLowerCase() === 'paid' ||
            status.toLowerCase().includes('paid') ||
            paymentMethod.toLowerCase().includes('gcash');
          if (isPaid) {
            generatedAlerts.push({
              id: `db-payment-${orderId}`,
              dbRecordId: orderId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'payment_confirmed',
              type: 'payment',
              priority: 'medium',
              title: 'Order Payment Confirmed',
              message: `Payment of ₱${totalAmount.toLocaleString()} for Order #${orderId} was verified via ${paymentMethod}. Ready for dispatch.`,
              meta: { orderId, customerName, totalAmount, paymentMethod },
              status: 'unread',
              created_at: createdAt,
              link: 'orders',
              icon: 'credit-card-2-front-fill',
            });
          }

          // Order status alerts for Admin
          if (sLower === 'out for delivery' || sLower.includes('out for')) {
            generatedAlerts.push({
              id: `db-order-out-${orderId}`,
              dbRecordId: orderId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'order_status',
              type: 'order',
              priority: 'medium',
              title: 'Order Out for Delivery',
              message: `Order #${orderId} is currently out for delivery to ${customerName} (${o.customer_address || 'Customer Address'}).`,
              meta: { orderId, customerName, status },
              status: 'unread',
              created_at: o.updated_at || createdAt,
              link: 'orders',
              icon: 'truck',
            });
          } else if (sLower === 'delivered') {
            generatedAlerts.push({
              id: `db-order-delivered-${orderId}`,
              dbRecordId: orderId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'order_status',
              type: 'order',
              priority: 'low',
              title: 'Order Delivered Successfully',
              message: `Order #${orderId} was finalized and delivered to ${customerName}.`,
              meta: { orderId, customerName, status },
              status: 'read',
              created_at: o.delivered_at || o.updated_at || createdAt,
              link: 'orders',
              icon: 'check2-all',
            });
          } else if (sLower.includes('cancel') || sLower.includes('issue') || sLower.includes('return')) {
            generatedAlerts.push({
              id: `db-order-issue-${orderId}-${sLower.slice(0, 8)}`,
              dbRecordId: orderId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'order_status',
              type: 'order',
              priority: 'urgent',
              title: `Order Alert: ${status}`,
              message: `Order #${orderId} for ${customerName} was updated to "${status}". Attention required.`,
              meta: { orderId, customerName, status },
              status: 'unread',
              created_at: o.updated_at || createdAt,
              link: 'orders',
              icon: 'exclamation-octagon-fill',
            });
          }
        }
      }

      // 2. Fetch live garage bookings
      let bookings = [];
      try {
        const garMod = await import('../bookings/garageService.js');
        if (garMod?.garageService?.getAllBookings) {
          bookings = (await garMod.garageService.getAllBookings()) || [];
        }
      } catch (_e) {}
      if (!bookings.length) {
        try {
          const raw = await storageAdapter.getItem('mototrack_garage_bookings');
          if (raw) bookings = JSON.parse(raw);
        } catch (_e) {}
      }

      if (Array.isArray(bookings)) {
        for (const b of bookings) {
          if (!b) continue;
          const bookingId = b.id || b.booking_id || 'N/A';
          const customerName = b.customer_name || 'Customer';
          const vehicle = b.vehicle_model || b.motorcycle_model || b.motorcycle || 'Motorcycle';
          const plate = b.plate_number || b.plate || '';
          const serviceTitle = b.service_name || b.service_title || b.category || 'Pitstop Service';
          const status = String(b.status || '').toLowerCase().trim();
          const date = b.appointment_date || b.date || 'Upcoming';
          const timeSlot = b.appointment_time || b.time_slot || b.time || 'Schedule';
          const mechanic = b.assigned_mechanic || 'Technician';
          const bay = b.bay_name || b.pit_bay || 'Pit Bay';
          const createdAt = b.created_at || new Date().toISOString();

          // Customer Booking Alert
          const bookingCustomerUserId = b.user_id || b.userId || b.customer_id || b.customerId || null;
          const bookingCustomerEmail = b.customer_email || b.userEmail || b.email || null;
          const bookingCustomerName = b.customer_name || b.userName || null;
          const bookNotifId = `db-cust-booking-${bookingId}`;

          if (
            !this.clearedNotificationKeys.has(bookNotifId) &&
            !this.clearedNotificationKeys.has(String(bookingId))
          ) {
            let bookTitle = 'Pit Bay Appointment Confirmed';
            let bookMsg = `Your appointment for ${serviceTitle} (${vehicle}) at ${bay} is scheduled for ${date} at ${timeSlot}.`;
            let bookIcon = 'tools';
            let bookStatus = 'unread';

            if (status === 'completed' || status.includes('done')) {
              bookTitle = 'Pitstop Service Completed';
              bookMsg = `Your ${serviceTitle} on ${vehicle} is completed. Ready for pickup at ${bay}!`;
              bookIcon = 'check-circle-fill';
              bookStatus = 'read';
            } else if (status === 'cancelled' || status.includes('cancel')) {
              bookTitle = 'Pitstop Booking Cancelled';
              bookMsg = `Your booking #${bookingId} for ${vehicle} was cancelled${b.cancellation_reason ? `: ${b.cancellation_reason}` : ''}.`;
              bookIcon = 'calendar-x-fill';
            } else if (status === 'in_service' || status.includes('progress')) {
              bookTitle = 'Motorcycle in Service Bay';
              bookMsg = `Technician ${mechanic} is now servicing your ${vehicle} in ${bay}.`;
              bookIcon = 'gear-wide-connected';
            }

            if (
              this.readNotificationKeys.has(bookNotifId) ||
              this.readNotificationKeys.has(String(bookingId))
            ) {
              bookStatus = 'read';
            }

            if ((bookingCustomerUserId && bookingCustomerUserId !== 'guest') || bookingCustomerEmail) {
              generatedCustomerAlerts.push({
                id: bookNotifId,
                dbRecordId: bookingId,
                isDatabaseLive: true,
                target: 'customer',
                user_id: bookingCustomerUserId,
                customer_id: b.customer_id || b.customerId || null,
                customer_email: bookingCustomerEmail,
                customer_name: bookingCustomerName,
                category: 'booking_status',
                type: 'booking',
                priority: 'high',
                title: bookTitle,
                message: bookMsg,
                meta: {
                  bookingId,
                  customerName: bookingCustomerName,
                  vehicle,
                  serviceTitle,
                  date,
                  timeSlot,
                  mechanic,
                  bay,
                  userId: bookingCustomerUserId,
                  customerId: b.customer_id || b.customerId || null,
                  customerEmail: bookingCustomerEmail,
                },
                status: bookStatus,
                read: bookStatus === 'read',
                created_at: b.updated_at || createdAt,
                link: 'bookings',
                icon: bookIcon,
              });
            }
          }

          // Admin Booking Alerts
          if (status === 'cancelled' || status.includes('cancel')) {
            generatedAlerts.push({
              id: `db-booking-cancelled-${bookingId}`,
              dbRecordId: bookingId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'booking_cancelled',
              type: 'booking',
              priority: 'medium',
              title: 'Customer Cancelled Booking',
              message: `Booking #${bookingId} for ${vehicle} (${customerName}) was cancelled${b.cancellation_reason ? `: ${b.cancellation_reason}` : ''}. Pit bay slot released back to queue.`,
              meta: { bookingId, customerName, vehicle, bay, reason: b.cancellation_reason },
              status: 'unread',
              created_at: b.cancelled_at || b.updated_at || createdAt,
              link: 'garage',
              icon: 'calendar-x-fill',
            });
          } else if (status === 'completed' || status.includes('done')) {
            generatedAlerts.push({
              id: `db-booking-completed-${bookingId}`,
              dbRecordId: bookingId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'service_completed',
              type: 'booking',
              priority: 'medium',
              title: 'Pitstop Service Completed',
              message: `${mechanic} finished ${serviceTitle} on ${vehicle}${plate ? ` (${plate})` : ''} for ${customerName}. Ready for inspection & billing.`,
              meta: { bookingId, customerName, mechanic, vehicle, serviceTitle },
              status: 'read',
              created_at: b.completed_at || b.updated_at || createdAt,
              link: 'garage',
              icon: 'check-circle-fill',
            });
          } else {
            // New booking alert
            generatedAlerts.push({
              id: `db-booking-new-${bookingId}`,
              dbRecordId: bookingId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'booking_new',
              type: 'booking',
              priority: 'high',
              title: 'New Pitstop Booking Received',
              message: `${customerName} booked ${serviceTitle} for ${vehicle}${plate ? ` (Plate: ${plate})` : ''} on ${date} at ${timeSlot}. Bay: ${bay}.`,
              meta: { bookingId, customerName, vehicle, serviceTitle, date, timeSlot },
              status: 'unread',
              created_at: createdAt,
              link: 'garage',
              icon: 'calendar-plus-fill',
            });

            // If appointment is today or tomorrow
            if (isDateTodayOrSoon(date)) {
              generatedAlerts.push({
                id: `db-booking-approaching-${bookingId}`,
                dbRecordId: bookingId,
                isDatabaseLive: true,
                target: 'admin',
                category: 'service_approaching',
                type: 'booking',
                priority: 'high',
                title: 'Scheduled Pitstop Service Approaching',
                message: `Upcoming appointment for ${vehicle} (${customerName} - ${mechanic}) is scheduled for ${date} at ${timeSlot} in ${bay}.`,
                meta: { bookingId, customerName, vehicle, mechanic, bay, date, timeSlot },
                status: 'unread',
                created_at: createdAt,
                link: 'garage',
                icon: 'clock-history',
              });
            }
          }
        }
      }

      // 3. Fetch live products & inventory stock levels
      let products = [];
      try {
        const prdMod = await import('../products/productService.js');
        if (prdMod?.productService?.getProducts) {
          products = (await prdMod.productService.getProducts()) || [];
        }
      } catch (_e) {}
      if (!products.length) {
        try {
          const raw = await storageAdapter.getItem('mototrack_products_db');
          if (raw) products = JSON.parse(raw);
        } catch (_e) {}
      }

      if (Array.isArray(products)) {
        for (const p of products) {
          if (!p) continue;
          const stock = Number(p.stock ?? 0);
          const pId = p.id || p.product_id;
          const pName = p.name || 'Motorcycle Part';

          if (stock <= 0) {
            generatedAlerts.push({
              id: `db-stock-out-${pId}`,
              dbRecordId: pId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'out_of_stock',
              type: 'inventory',
              priority: 'urgent',
              title: 'Product Out of Stock Alert',
              message: `"${pName}" has reached 0 units in warehouse storage. Reorder required immediately.`,
              meta: { productName: pName, productId: pId, currentStock: 0 },
              status: 'unread',
              created_at: new Date().toISOString(),
              link: 'inventory',
              icon: 'x-octagon-fill',
            });
          } else if (stock <= resolveReorderLevel(p, 5)) {
            const threshold = resolveReorderLevel(p, 5);
            generatedAlerts.push({
              id: `db-stock-low-${pId}`,
              dbRecordId: pId,
              isDatabaseLive: true,
              target: 'admin',
              category: 'low_stock',
              type: 'inventory',
              priority: 'high',
              title: 'Low Stock Threshold Warning',
              message: `"${pName}" has reached low stock: only ${stock} unit${stock === 1 ? '' : 's'} remaining in warehouse (Threshold: ${threshold}).`,
              meta: { productName: pName, productId: pId, currentStock: stock, minThreshold: threshold },
              status: 'unread',
              created_at: new Date().toISOString(),
              link: 'inventory',
              icon: 'exclamation-triangle-fill',
            });
          }
        }
      }

      // 4. Fetch live registered users
      let users = [];
      try {
        const usrMod = await import('../staff/userService.js');
        if (usrMod?.userService?.getAllUsers) {
          users = (await usrMod.userService.getAllUsers()) || [];
        }
      } catch (_e) {}
      if (!users.length) {
        try {
          const raw = await storageAdapter.getItem('mototrack_users_db');
          if (raw) users = JSON.parse(raw);
        } catch (_e) {}
      }

      if (Array.isArray(users)) {
        for (const u of users) {
          if (!u || u.role === 'admin') continue;
          const uId = u.id || u.user_id;
          const uName = u.name || u.username || 'New Rider';
          const uEmail = u.email || '';
          generatedAlerts.push({
            id: `db-user-${uId}`,
            dbRecordId: uId,
            isDatabaseLive: true,
            target: 'admin',
            category: 'customer_registered',
            type: 'user',
            priority: 'low',
            title: 'New Customer Registered',
            message: `Rider account registered: "${uName}" (${uEmail || 'No email provided'}). Added to customer directory.`,
            meta: { customerName: uName, email: uEmail, userId: uId },
            status: 'read',
            created_at: u.created_at || new Date().toISOString(),
            link: 'users',
            icon: 'person-plus-fill',
          });
        }
      }

      // Reconcile and Merge Admin Alerts:
      const existingStatusMap = new Map();
      this.adminNotifications.forEach((n) => {
        if (n && n.id) {
          existingStatusMap.set(n.id, {
            status: n.status,
            created_at: n.created_at,
          });
        }
      });

      const mergedLiveAlerts = generatedAlerts.map((gen) => {
        if (existingStatusMap.has(gen.id)) {
          const existing = existingStatusMap.get(gen.id);
          return {
            ...gen,
            status: existing.status,
            created_at: existing.created_at || gen.created_at,
          };
        }
        return gen;
      });

      const nonDbAlerts = this.adminNotifications.filter(
        (n) => !n.isDatabaseLive && !String(n.id).startsWith('db-')
      );

      const combined = [...mergedLiveAlerts, ...nonDbAlerts];
      combined.sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      });

      this.adminNotifications = combined.map((n) => this.sanitize(n));

      // Reconcile and Merge Customer Alerts:
      const existingCustStatusMap = new Map();
      this.customerNotifications.forEach((n) => {
        if (!n) return;
        const keys = [n.id, n.dbRecordId, n.meta?.orderId, n.meta?.bookingId].filter(Boolean);
        const isRead = n.status === 'read' || n.read === true;
        keys.forEach((k) => {
          const sk = String(k).trim();
          existingCustStatusMap.set(sk, {
            status: isRead ? 'read' : n.status,
            read: isRead,
            created_at: n.created_at,
          });
          if (isRead) {
            this.readNotificationKeys.add(sk);
          }
        });
      });

      const generatedCustOrderIds = new Set();
      const generatedCustBookingIds = new Set();
      generatedCustomerAlerts.forEach((gen) => {
        if (gen.meta?.orderId) generatedCustOrderIds.add(String(gen.meta.orderId));
        if (gen.dbRecordId) generatedCustOrderIds.add(String(gen.dbRecordId));
        if (gen.meta?.bookingId) generatedCustBookingIds.add(String(gen.meta.bookingId));
      });

      const mergedCustomerLiveAlerts = generatedCustomerAlerts
        .filter((gen) => {
          const sId = String(gen.id || '');
          const dbId = String(gen.dbRecordId || '');
          const ordId = String(gen.meta?.orderId || '');
          const bId = String(gen.meta?.bookingId || '');
          if (
            this.clearedNotificationKeys.has(sId) ||
            (dbId && this.clearedNotificationKeys.has(dbId)) ||
            (ordId && this.clearedNotificationKeys.has(ordId)) ||
            (bId && this.clearedNotificationKeys.has(bId))
          ) {
            return false;
          }
          return true;
        })
        .map((gen) => {
          const keys = [gen.id, gen.dbRecordId, gen.meta?.orderId, gen.meta?.bookingId]
            .filter(Boolean)
            .map((k) => String(k).trim());

          const matchKey = keys.find((k) => existingCustStatusMap.has(k));
          const existing = matchKey ? existingCustStatusMap.get(matchKey) : null;

          const isAlreadyRead =
            gen.status === 'read' ||
            gen.read === true ||
            (existing && (existing.status === 'read' || existing.read === true)) ||
            keys.some((k) => this.readNotificationKeys.has(k));

          if (isAlreadyRead) {
            keys.forEach((k) => this.readNotificationKeys.add(k));
            return {
              ...gen,
              status: 'read',
              read: true,
              created_at: existing?.created_at || gen.created_at,
            };
          }

          if (existing) {
            return {
              ...gen,
              status: existing.status,
              read: false,
              created_at: existing.created_at || gen.created_at,
            };
          }

          return gen;
        });

      const nonDbCustomerAlerts = this.customerNotifications.filter((n) => {
        if (!n) return false;
        if (n.isDatabaseLive || String(n.id).startsWith('db-cust-')) return false;

        const nId = String(n.id || '');
        const dbId = String(n.dbRecordId || '');
        const ordId = String(n.meta?.orderId || '');
        const bId = String(n.meta?.bookingId || '');

        if (
          this.clearedNotificationKeys.has(nId) ||
          (dbId && this.clearedNotificationKeys.has(dbId)) ||
          (ordId && this.clearedNotificationKeys.has(ordId)) ||
          (bId && this.clearedNotificationKeys.has(bId))
        ) {
          return false;
        }

        // Avoid duplicate alert if a live database alert already represents the same order or booking
        if (ordId && generatedCustOrderIds.has(ordId)) return false;
        if (dbId && generatedCustOrderIds.has(dbId)) return false;
        if (bId && generatedCustBookingIds.has(bId)) return false;

        return true;
      });

      const baseCustomer = liveCustomerNotifications(nonDbCustomerAlerts);
      const combinedCustomer = [...mergedCustomerLiveAlerts, ...baseCustomer];
      const seenCustIds = new Set();
      const dedupedCustomer = [];
      for (const item of combinedCustomer) {
        if (!seenCustIds.has(item.id)) {
          seenCustIds.add(item.id);
          dedupedCustomer.push(this.sanitize(item));
        }
      }
      dedupedCustomer.sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      });

      this.customerNotifications = liveCustomerNotifications(dedupedCustomer);

      await this.persist();
      this.notify();
      return {
        success: true,
        count: this.adminNotifications.length,
        liveDbCount: mergedLiveAlerts.length,
        customerCount: this.customerNotifications.length,
      };
    } catch (err) {
      console.warn('[NotificationService] syncFromDatabase error:', err);
      return { success: false, error: err.message };
    }
  }

  getDatabaseAlertsCount() {
    return this.adminNotifications.filter(
      (n) => n.isDatabaseLive || (n.id && String(n.id).startsWith('db-'))
    ).length;
  }

  async clearSampleNotifications() {
    this.adminNotifications = this.adminNotifications.filter(
      (n) => n.isDatabaseLive || (n.id && String(n.id).startsWith('db-'))
    );
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  async clearAllAdmin() {
    this.adminNotifications = [];
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  // ─── CUSTOMER NOTIFICATIONS ACCESSORS ───

  getCustomerNotifications(userOrId = null, userEmail = null, userName = null) {
    const userContext = extractUserContext(userOrId, userEmail, userName);
    if (!userContext.hasIdentity) {
      return [];
    }
    const list = this.customerNotifications.map((n) => this.sanitize(n));
    return list.filter((n) => notificationMatchesUser(n, userContext));
  }

  getCustomerUnreadCount(userOrId = null, userEmail = null, userName = null) {
    return this.getCustomerNotifications(userOrId, userEmail, userName).filter(
      (n) => n.status === 'unread'
    ).length;
  }

  async markCustomerAsRead(id) {
    const sId = String(id).trim();
    this.readNotificationKeys.add(sId);
    let matched = null;
    this.customerNotifications = this.customerNotifications.map((n) => {
      if (String(n.id) === sId) {
        matched = n;
        return { ...n, status: 'read', read: true };
      }
      return n;
    });
    if (matched) {
      if (matched.dbRecordId) this.readNotificationKeys.add(String(matched.dbRecordId).trim());
      if (matched.meta?.orderId) this.readNotificationKeys.add(String(matched.meta.orderId).trim());
      if (matched.meta?.bookingId) this.readNotificationKeys.add(String(matched.meta.bookingId).trim());
    }
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async markCustomerAsUnread(id) {
    const sId = String(id).trim();
    this.readNotificationKeys.delete(sId);
    let matched = null;
    this.customerNotifications = this.customerNotifications.map((n) => {
      if (String(n.id) === sId) {
        matched = n;
        return { ...n, status: 'unread', read: false };
      }
      return n;
    });
    if (matched) {
      if (matched.dbRecordId) this.readNotificationKeys.delete(String(matched.dbRecordId).trim());
      if (matched.meta?.orderId) this.readNotificationKeys.delete(String(matched.meta.orderId).trim());
      if (matched.meta?.bookingId) this.readNotificationKeys.delete(String(matched.meta.bookingId).trim());
    }
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async deleteCustomerNotification(id) {
    const sId = String(id).trim();
    this.clearedNotificationKeys.add(sId);
    const item = this.customerNotifications.find((n) => String(n.id) === sId);
    if (item) {
      if (item.dbRecordId) this.clearedNotificationKeys.add(String(item.dbRecordId).trim());
      if (item.meta?.orderId) this.clearedNotificationKeys.add(String(item.meta.orderId).trim());
      if (item.meta?.bookingId) this.clearedNotificationKeys.add(String(item.meta.bookingId).trim());
    }
    this.customerNotifications = this.customerNotifications.filter(
      (n) => String(n.id) !== sId
    );
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async markAllCustomerAsRead(userOrId = null) {
    const userContext = extractUserContext(userOrId);
    this.customerNotifications = this.customerNotifications.map((n) => {
      if (!userContext.hasIdentity || notificationMatchesUser(n, userContext)) {
        if (n.id) this.readNotificationKeys.add(String(n.id).trim());
        if (n.dbRecordId) this.readNotificationKeys.add(String(n.dbRecordId).trim());
        if (n.meta?.orderId) this.readNotificationKeys.add(String(n.meta.orderId).trim());
        if (n.meta?.bookingId) this.readNotificationKeys.add(String(n.meta.bookingId).trim());
        return { ...n, status: 'read', read: true };
      }
      return n;
    });
    await this.persist();
    this.notify();
    return this.getCustomerNotifications(userOrId);
  }

  async clearCustomerReadNotifications(userOrId = null) {
    const userContext = extractUserContext(userOrId);
    this.customerNotifications = this.customerNotifications.filter((n) => {
      const isMatch = !userContext.hasIdentity || notificationMatchesUser(n, userContext);
      const isRead = n.status === 'read' || n.read === true;
      if (isMatch && isRead) {
        if (n.id) this.clearedNotificationKeys.add(String(n.id).trim());
        if (n.dbRecordId) this.clearedNotificationKeys.add(String(n.dbRecordId).trim());
        if (n.meta?.orderId) this.clearedNotificationKeys.add(String(n.meta.orderId).trim());
        if (n.meta?.bookingId) this.clearedNotificationKeys.add(String(n.meta.bookingId).trim());
        return false;
      }
      return true;
    });
    await this.persist();
    this.notify();
    return this.getCustomerNotifications(userOrId);
  }

  async clearAllCustomer(userOrId = null) {
    const userContext = extractUserContext(userOrId);
    this.customerNotifications = this.customerNotifications.filter((n) => {
      const isMatch = !userContext.hasIdentity || notificationMatchesUser(n, userContext);
      if (isMatch) {
        if (n.id) this.clearedNotificationKeys.add(String(n.id).trim());
        if (n.dbRecordId) this.clearedNotificationKeys.add(String(n.dbRecordId).trim());
        if (n.meta?.orderId) this.clearedNotificationKeys.add(String(n.meta.orderId).trim());
        if (n.meta?.bookingId) this.clearedNotificationKeys.add(String(n.meta.bookingId).trim());
        return false;
      }
      return true;
    });
    await this.persist();
    this.notify();
    return this.getCustomerNotifications(userOrId);
  }

  // ─── BACKWARD COMPATIBILITY HELPERS ───

  getNotifications(userOrId = null, userEmail = null, userName = null) {
    return this.getCustomerNotifications(userOrId, userEmail, userName);
  }

  getUnreadCount(userOrId = null, userEmail = null, userName = null) {
    return this.getCustomerUnreadCount(userOrId, userEmail, userName);
  }

  async markAsRead(id) {
    const inAdmin = this.adminNotifications.some((n) => n.id === id);
    if (inAdmin) {
      return this.markAdminAsRead(id);
    }
    return this.markCustomerAsRead(id);
  }

  async markAsUnread(id) {
    const inAdmin = this.adminNotifications.some((n) => n.id === id);
    if (inAdmin) {
      return this.markAdminAsUnread(id);
    }
    return this.markCustomerAsUnread(id);
  }

  async deleteNotification(id) {
    const inAdmin = this.adminNotifications.some((n) => n.id === id);
    if (inAdmin) {
      return this.deleteAdminNotification(id);
    }
    return this.deleteCustomerNotification(id);
  }

  async markAllAsRead(userOrId = null) {
    return this.markAllCustomerAsRead(userOrId);
  }

  async clearAll(userOrId = null) {
    return this.clearAllCustomer(userOrId);
  }

  // ─── ADD NOTIFICATION (SCOPE AWARE & RICH EXTRACTION) ───

  async addNotification({
    target = 'customer',
    userId,
    user_id,
    customerId,
    customer_id,
    email,
    userEmail,
    customerEmail,
    name,
    userName,
    customerName,
    title,
    message,
    type,
    category,
    priority = 'normal',
    link,
    icon,
    meta = {},
  }) {
    const rawTitle = stripEmojis(title) || 'MotoTrack Alert';
    const rawMessage = stripEmojis(message) || '';
    const resolvedUserId =
      userId ||
      user_id ||
      meta?.userId ||
      meta?.customerId ||
      customerId ||
      customer_id ||
      'guest';
    const resolvedCustomerId =
      customerId || customer_id || meta?.customerId || meta?.customer_id || null;
    const resolvedEmail =
      email ||
      userEmail ||
      customerEmail ||
      meta?.customerEmail ||
      meta?.userEmail ||
      meta?.email ||
      null;
    const resolvedName =
      name || userName || customerName || meta?.customerName || meta?.userName || null;

    // Auto-detect booking ID or order ID from message or meta
    let resolvedType = type;
    let resolvedCategory = category;
    let resolvedLink = link;
    let resolvedIcon = icon;
    let bookingId = meta?.bookingId;
    let orderId = meta?.orderId;

    if (!bookingId) {
      const match =
        rawMessage.match(/#(BK-[A-Z0-9-]+)/i) || rawTitle.match(/#(BK-[A-Z0-9-]+)/i);
      if (match) bookingId = match[1];
    }
    if (!orderId) {
      const match =
        rawMessage.match(/#(ORD-[A-Z0-9-]+)/i) ||
        rawTitle.match(/#(ORD-[A-Z0-9-]+)/i) ||
        rawMessage.match(/#(MT-ORD-[A-Z0-9-]+)/i) ||
        rawTitle.match(/#(MT-ORD-[A-Z0-9-]+)/i);
      if (match) orderId = match[1];
    }

    const tLower = (rawTitle || '').toLowerCase();
    const isBookingRelated =
      Boolean(bookingId) ||
      tLower.includes('booking') ||
      tLower.includes('pit bay') ||
      tLower.includes('pitstop') ||
      tLower.includes('service bay') ||
      tLower.includes('mechanic') ||
      tLower.includes('pms');

    const isOrderRelated =
      Boolean(orderId) ||
      tLower.includes('order') ||
      tLower.includes('delivery') ||
      tLower.includes('shipped');

    if (isBookingRelated) {
      if (!resolvedType) resolvedType = 'booking';
      if (!resolvedCategory || resolvedCategory === 'general') resolvedCategory = 'booking_status';
      if (!resolvedLink) resolvedLink = 'bookings';
      if (!resolvedIcon) resolvedIcon = 'tools';
    } else if (isOrderRelated) {
      if (!resolvedType) resolvedType = 'order';
      if (!resolvedCategory || resolvedCategory === 'general') resolvedCategory = 'order_status';
      if (!resolvedLink) resolvedLink = 'orders';
      if (!resolvedIcon) resolvedIcon = 'bag-check-fill';
    } else {
      if (!resolvedType) resolvedType = 'order';
      if (!resolvedCategory) resolvedCategory = 'general';
      if (!resolvedLink) resolvedLink = 'orders';
      if (!resolvedIcon) resolvedIcon = 'bell-fill';
    }

    const notifItem = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      target,
      user_id: resolvedUserId,
      customer_id: resolvedCustomerId,
      customer_email: resolvedEmail,
      customer_name: resolvedName,
      title: rawTitle,
      message: rawMessage,
      type: resolvedType,
      category: resolvedCategory,
      priority,
      status: 'unread',
      created_at: new Date().toISOString(),
      link: resolvedLink,
      icon: resolvedIcon,
      meta: {
        ...meta,
        userId: resolvedUserId,
        customerId: resolvedCustomerId,
        customerEmail: resolvedEmail,
        customerName: resolvedName,
        bookingId: bookingId || meta?.bookingId,
        orderId: orderId || meta?.orderId,
      },
    };

    if (target === 'admin') {
      this.adminNotifications.unshift(notifItem);
    } else if (target === 'all') {
      this.adminNotifications.unshift({ ...notifItem, target: 'admin' });
      this.customerNotifications.unshift({ ...notifItem, target: 'customer' });
    } else {
      this.customerNotifications.unshift(notifItem);
    }

    await this.persist();
    this.notify();
    return notifItem;
  }

  // ─── DEDICATED CUSTOMER NOTIFICATION EMITTER METHODS ───

  async notifyCustomerOrderPlaced({
    userId,
    customerEmail,
    customerName,
    orderId,
    itemCount = 1,
    totalAmount,
    paymentMethod,
  }) {
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      customerName,
      title: 'Order Placed Successfully',
      message: `Your Order #${orderId} (${itemCount} item${itemCount > 1 ? 's' : ''} - ₱${Number(totalAmount || 0).toLocaleString()}) via ${paymentMethod || 'COD'} is being prepared.`,
      type: 'order',
      category: 'order_placed',
      priority: 'high',
      link: 'orders',
      icon: 'bag-check-fill',
      meta: { orderId, totalAmount, itemCount, paymentMethod, customerEmail, customerName },
    });
  }

  async notifyCustomerPaymentConfirmed({
    userId,
    customerEmail,
    customerName,
    orderId,
    totalAmount,
    paymentMethod = 'Online Transfer',
  }) {
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      customerName,
      title: 'Order Payment Confirmed',
      message: `Your payment of ₱${Number(totalAmount || 0).toLocaleString()} for Order #${orderId} was verified via ${paymentMethod}. We are dispatching your items.`,
      type: 'order',
      category: 'payment_confirmed',
      priority: 'high',
      link: 'orders',
      icon: 'credit-card-2-front-fill',
      meta: { orderId, totalAmount, paymentMethod, customerEmail, customerName },
    });
  }

  async notifyCustomerOrderStatus({
    userId,
    customerEmail,
    customerName,
    orderId,
    status,
    message,
  }) {
    const statusIcons = {
      'Processing': 'gear-wide-connected',
      'Ready for Delivery': 'box-seam',
      'Out for Delivery': 'truck',
      'Delivered': 'check-circle-fill',
      'Cancelled': 'x-circle-fill',
    };
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      customerName,
      title: `Order #${orderId} — ${status}`,
      message: message || `Your order status has been updated to "${status}".`,
      type: 'order',
      category: 'order_status',
      priority: status === 'Out for Delivery' || status === 'Delivered' ? 'high' : 'normal',
      link: 'orders',
      icon: statusIcons[status] || 'box-seam',
      meta: { orderId, status, customerEmail, customerName },
    });
  }

  async notifyCustomerBookingStatus({
    userId,
    customerEmail,
    customerName,
    bookingId,
    serviceTitle,
    status,
    message,
  }) {
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      customerName,
      title: `Booking #${bookingId} — ${status}`,
      message:
        message ||
        `Your pit appointment for ${serviceTitle || 'service'} has been updated to "${status}".`,
      type: 'booking',
      category: 'booking_status',
      priority: 'normal',
      link: 'bookings',
      icon: 'tools',
      meta: { bookingId, status, serviceTitle, customerEmail, customerName },
    });
  }

  async notifyCustomerSecurityAlert({ userId, customerEmail, title, message }) {
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      title: title || 'Security Alert',
      message: message || 'Your account security details were updated.',
      type: 'security',
      category: 'security',
      priority: 'urgent',
      link: 'profile',
      icon: 'shield-lock-fill',
      meta: { customerEmail },
    });
  }

  async notifyCustomerProfileUpdated({ userId, customerEmail, customerName }) {
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      customerName,
      title: 'Profile Updated',
      message: 'Your account profile details and preferences were successfully saved.',
      type: 'security',
      category: 'profile_updated',
      priority: 'normal',
      link: 'profile',
      icon: 'person-check-fill',
      meta: { customerEmail, customerName },
    });
  }

  async notifyCustomerCustomizationSaved({ userId, customerEmail, setupName }) {
    return this.addNotification({
      target: 'customer',
      userId,
      customerEmail,
      title: '3D Customization Saved',
      message: `Your motorcycle setup "${setupName || 'Custom Build'}" was saved to your garage studio.`,
      type: 'promo',
      category: 'customizer',
      priority: 'normal',
      link: 'customizer',
      icon: 'palette-fill',
      meta: { setupName, customerEmail },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 15 DEDICATED ADMIN NOTIFICATION EMITTER METHODS
  // ──────────────────────────────────────────────────────────────────────────

  // 1. The admin receives a notification when a new customer places an order.
  async notifyAdminNewOrder({ orderId, customerName, totalAmount, itemCount = 1, paymentMethod = 'COD' }) {
    return this.addNotification({
      target: 'admin',
      category: 'order_placed',
      type: 'order',
      priority: 'high',
      title: 'New Customer Order Placed',
      message: `Customer ${customerName || 'Guest'} placed Order #${orderId} (₱${Number(totalAmount || 0).toLocaleString()} - ${itemCount} item${itemCount > 1 ? 's' : ''}) via ${paymentMethod}.`,
      meta: { orderId, customerName, totalAmount, itemCount, paymentMethod },
      link: 'orders',
      icon: 'bag-check-fill',
    });
  }

  // 2. The admin receives a notification when an order payment is confirmed.
  async notifyAdminPaymentConfirmed({ orderId, customerName, totalAmount, paymentMethod = 'Online Transfer' }) {
    return this.addNotification({
      target: 'admin',
      category: 'payment_confirmed',
      type: 'payment',
      priority: 'medium',
      title: 'Order Payment Confirmed',
      message: `Payment of ₱${Number(totalAmount || 0).toLocaleString()} for Order #${orderId} by ${customerName || 'Customer'} was confirmed via ${paymentMethod}. Ready for dispatch.`,
      meta: { orderId, customerName, totalAmount, paymentMethod },
      link: 'orders',
      icon: 'credit-card-2-front-fill',
    });
  }

  // 3. The admin receives a notification when an order status is updated.
  async notifyAdminOrderStatusUpdated({ orderId, status, customerName }) {
    return this.addNotification({
      target: 'admin',
      category: 'order_status',
      type: 'order',
      priority: 'low',
      title: 'Order Status Updated',
      message: `Order #${orderId} for ${customerName || 'Customer'} was marked as "${status}".`,
      meta: { orderId, status, customerName },
      link: 'orders',
      icon: 'truck',
    });
  }

  // 4. The admin receives a notification when a product reaches low stock.
  async notifyAdminLowStock({ productName, productId, currentStock, minThreshold = 5 }) {
    return this.addNotification({
      target: 'admin',
      category: 'low_stock',
      type: 'inventory',
      priority: 'high',
      title: 'Low Stock Threshold Warning',
      message: `"${productName}" has reached low stock: only ${currentStock} unit${currentStock === 1 ? '' : 's'} remaining in warehouse (Threshold: ${minThreshold}).`,
      meta: { productName, productId, currentStock, minThreshold },
      link: 'inventory',
      icon: 'exclamation-triangle-fill',
    });
  }

  // 5. The admin receives a notification when a product becomes out of stock.
  async notifyAdminOutOfStock({ productName, productId }) {
    return this.addNotification({
      target: 'admin',
      category: 'out_of_stock',
      type: 'inventory',
      priority: 'urgent',
      title: 'Product Out of Stock Alert',
      message: `"${productName}" is now completely OUT OF STOCK (0 units remaining). Restock immediately to prevent checkout drop-offs.`,
      meta: { productName, productId, currentStock: 0 },
      link: 'inventory',
      icon: 'x-octagon-fill',
    });
  }

  // 6. The admin receives a notification when a new repair or customization booking is submitted.
  async notifyAdminNewBooking({ bookingId, customerName, serviceType, vehicleModel, date, timeSlot }) {
    return this.addNotification({
      target: 'admin',
      category: 'booking_new',
      type: 'booking',
      priority: 'high',
      title: 'New Pitstop Booking Received',
      message: `New booking submitted by ${customerName || 'Customer'} for ${serviceType || 'Service'} (${vehicleModel || 'Motorcycle'}) on ${date || 'Upcoming'} at ${timeSlot || 'Scheduled Slot'}.`,
      meta: { bookingId, customerName, serviceType, vehicleModel, date, timeSlot },
      link: 'garage',
      icon: 'calendar-plus-fill',
    });
  }

  // 7. The admin receives a notification when a customer cancels a booking.
  async notifyAdminBookingCancelled({ bookingId, customerName, serviceType, reason }) {
    return this.addNotification({
      target: 'admin',
      category: 'booking_cancelled',
      type: 'booking',
      priority: 'medium',
      title: 'Pitstop Booking Cancelled',
      message: `Customer ${customerName || 'Customer'} cancelled booking #${bookingId || 'N/A'}${reason ? ` (Reason: ${reason})` : ''}. Pit bay slot returned to availability.`,
      meta: { bookingId, customerName, serviceType, reason },
      link: 'garage',
      icon: 'calendar-x-fill',
    });
  }

  // 8. The admin receives a notification when a scheduled repair or service is approaching.
  async notifyAdminServiceApproaching({ bookingId, customerName, mechanicName, bayNumber, vehiclePlate, timeRemaining = '30 minutes' }) {
    return this.addNotification({
      target: 'admin',
      category: 'service_approaching',
      type: 'booking',
      priority: 'high',
      title: 'Upcoming Service Schedule',
      message: `Scheduled service #${bookingId || 'Ticket'} (${customerName || 'Customer'} - ${vehiclePlate || 'Vehicle'}) starts in ${timeRemaining} at ${bayNumber || 'Pit Bay'} with ${mechanicName || 'Assigned Mechanic'}.`,
      meta: { bookingId, customerName, mechanicName, bayNumber, vehiclePlate, timeRemaining },
      link: 'garage',
      icon: 'clock-history',
    });
  }

  // 9. The admin receives a notification when a repair or PMS service is completed.
  async notifyAdminServiceCompleted({ bookingId, customerName, mechanicName, serviceTitle, vehiclePlate }) {
    return this.addNotification({
      target: 'admin',
      category: 'service_completed',
      type: 'booking',
      priority: 'medium',
      title: 'Pitstop Service Completed',
      message: `Mechanic ${mechanicName || 'Technician'} finished ${serviceTitle || 'PMS Service'} for ${customerName || 'Customer'} (${vehiclePlate || 'Plate'}). Ready for customer release & billing.`,
      meta: { bookingId, customerName, mechanicName, serviceTitle, vehiclePlate },
      link: 'garage',
      icon: 'check-circle-fill',
    });
  }

  // 10. The admin receives a notification when a customer registers a new account.
  async notifyAdminCustomerRegistered({ customerName, email, phone }) {
    return this.addNotification({
      target: 'admin',
      category: 'customer_registered',
      type: 'user',
      priority: 'low',
      title: 'New Customer Registered',
      message: `New rider profile registered: "${customerName || 'New User'}" (${email || 'No email provided'}). Added to customer directory.`,
      meta: { customerName, email, phone },
      link: 'users',
      icon: 'person-plus-fill',
    });
  }

  // 11. The admin receives a notification when a customer submits a review or rating.
  async notifyAdminCustomerReview({ customerName, productName, rating = 5, comment }) {
    return this.addNotification({
      target: 'admin',
      category: 'review_submitted',
      type: 'review',
      priority: 'medium',
      title: 'New Customer Review Submitted',
      message: `Customer ${customerName || 'Rider'} posted a ${rating}-star review on "${productName}": "${comment || 'Verified purchase'}"`,
      meta: { customerName, productName, rating, comment },
      link: 'inventory',
      icon: 'star-fill',
    });
  }

  // 12. The admin receives a notification when a purchase order or restocking request needs attention.
  async notifyAdminRestockAttention({ poNumber, supplierName, itemCount, totalCost, reason = 'Pending Approval' }) {
    return this.addNotification({
      target: 'admin',
      category: 'restock_attention',
      type: 'procurement',
      priority: 'high',
      title: 'Restocking Request Needs Attention',
      message: `Purchase Order #${poNumber || 'PO-REQ'} with supplier ${supplierName || 'Supplier'} (${itemCount || 1} items - ₱${Number(totalCost || 0).toLocaleString()}) requires attention: ${reason}.`,
      meta: { poNumber, supplierName, itemCount, totalCost, reason },
      link: 'suppliers',
      icon: 'file-earmark-text-fill',
    });
  }

  // 13. The admin receives a notification when the system recommends restocking a product based on sales activity.
  async notifyAdminRestockRecommendation({ productName, salesVelocity, currentStock, suggestedQty }) {
    return this.addNotification({
      target: 'admin',
      category: 'restock_recommendation',
      type: 'inventory',
      priority: 'medium',
      title: 'AI Restock Recommendation',
      message: `High sales velocity for "${productName}" (${salesVelocity || 'trending'}). Current stock: ${currentStock}. Recommended reorder: ${suggestedQty} units.`,
      meta: { productName, salesVelocity, currentStock, suggestedQty },
      link: 'inventory',
      icon: 'graph-up-arrow',
    });
  }

  // 14. The admin receives a notification about important sales or inventory updates.
  async notifyAdminSalesInventoryUpdate({ title, message, metrics = {} }) {
    return this.addNotification({
      target: 'admin',
      category: 'sales_update',
      type: 'sales',
      priority: 'medium',
      title: title || 'Important Sales & Inventory Milestone',
      message: message || 'Store revenue & inventory balance updated with notable performance metrics.',
      meta: metrics,
      link: 'overview',
      icon: 'cash-coin',
    });
  }

  // 15. The admin receives a notification about important system or security activities.
  async notifyAdminSecurityAlert({ title, message, ipAddress, severity = 'high', action }) {
    return this.addNotification({
      target: 'admin',
      category: 'security_activity',
      type: 'system',
      priority: severity === 'urgent' ? 'urgent' : severity === 'high' ? 'high' : 'medium',
      title: title || 'System Security Activity Detected',
      message: message || `Administrative security event recorded${ipAddress ? ` from IP ${ipAddress}` : ''}.`,
      meta: { ipAddress, severity, action },
      link: 'settings',
      icon: 'shield-lock-fill',
    });
  }

  async notifyCustomerOutForDelivery({ userId, orderId, riderName, expectedDelivery }) {
    const expectText = expectedDelivery
      ? ` Expected: ${new Date(expectedDelivery).toLocaleDateString()}.`
      : '';
    return this.addNotification({
      target: 'customer',
      userId: userId || 'guest',
      category: 'delivery_out',
      type: 'order',
      priority: 'high',
      title: 'Your order is out for delivery',
      message: `Your order #${orderId} is out for delivery${riderName ? ` with ${riderName}` : ''}.${expectText} The rider will confirm drop-off; the store then finalizes delivery.`,
      meta: { orderId, riderName },
      link: 'orders',
      icon: 'truck',
    });
  }

  async notifyAdminDeliveryConfirmed({
    orderId,
    customerName,
    riderName,
    confirmedAt,
    adminOverride = true,
  }) {
    const timeLabel = confirmedAt
      ? new Date(confirmedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '';
    return this.addNotification({
      target: 'admin',
      category: 'delivery_confirmed',
      type: 'order',
      priority: 'high',
      title: 'Order Delivered',
      message: `Order #${orderId} has been marked as delivered${customerName ? ` for ${customerName}` : ''}.${riderName ? ` Rider: ${riderName}.` : ''}${timeLabel ? ` Time: ${timeLabel}.` : ''} Confirmed by store admin.`,
      meta: { orderId, customerName, riderName, confirmedAt, adminOverride },
      link: 'orders',
      icon: 'check-circle-fill',
    });
  }

  async notifyAdminRiderReportedDelivered({ orderId, riderName, notes, reportedBy }) {
    return this.addNotification({
      target: 'admin',
      category: 'rider_reported_delivered',
      type: 'order',
      priority: 'high',
      title: 'Delivery Reported',
      message: `${riderName || 'The rider'} reported that order #${orderId} was delivered.${notes ? ` Note: ${notes}` : ''} Review the report and tap Confirm Delivery.${reportedBy ? ` Reported by ${reportedBy}.` : ''}`,
      meta: { orderId, riderName, notes, reportedBy },
      link: 'orders',
      icon: 'bicycle',
    });
  }

  async notifyCustomerDeliveryConfirmed({ userId, orderId }) {
    return this.addNotification({
      target: 'customer',
      userId: userId || 'guest',
      category: 'delivery_confirmed',
      type: 'order',
      priority: 'medium',
      title: 'Order Delivered',
      message: `Your order #${orderId} has been marked as delivered by the store. If you did not receive it, please contact MotoTrack support.`,
      meta: { orderId },
      link: 'orders',
      icon: 'check-circle-fill',
    });
  }

  async notifyCustomerDeliveryFailed({ userId, orderId, notes }) {
    return this.addNotification({
      target: 'customer',
      userId: userId || 'guest',
      category: 'delivery_failed',
      type: 'order',
      priority: 'high',
      title: 'Delivery attempt failed',
      message: `We could not complete delivery for order #${orderId}.${notes ? ` ${notes}` : ''} The store will reschedule.`,
      meta: { orderId, notes },
      link: 'orders',
      icon: 'exclamation-triangle',
    });
  }

  async notifyCustomerDeliveryRescheduled({ userId, orderId, notes }) {
    return this.addNotification({
      target: 'customer',
      userId: userId || 'guest',
      category: 'delivery_rescheduled',
      type: 'order',
      priority: 'medium',
      title: 'Delivery rescheduled',
      message: `Delivery for order #${orderId} has been rescheduled.${notes ? ` ${notes}` : ''} We will assign a rider again shortly.`,
      meta: { orderId, notes },
      link: 'orders',
      icon: 'arrow-repeat',
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
