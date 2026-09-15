import { storageAdapter } from './storageAdapter.js';
import { supabaseManager } from './supabaseClient.js';

const CUSTOMER_STORAGE_KEY = '@mototrack_user_notifications';
const ADMIN_STORAGE_KEY = '@mototrack_admin_notifications';

export function stripEmojis(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

const INITIAL_ADMIN_NOTIFICATIONS = [
  {
    id: 'admin-notif-1',
    target: 'admin',
    category: 'order_placed',
    type: 'order',
    priority: 'high',
    title: 'New Customer Order Placed',
    message: 'Customer John Dela Cruz placed Order #MT-ORD-9412 (₱14,500 - 3 items). Awaiting processing & fulfillment dispatch.',
    meta: { orderId: 'MT-ORD-9412', customer: 'John Dela Cruz', amount: 14500, itemsCount: 3 },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    link: 'orders',
    icon: 'bag-check-fill',
  },
  {
    id: 'admin-notif-2',
    target: 'admin',
    category: 'payment_confirmed',
    type: 'payment',
    priority: 'medium',
    title: 'Order Payment Confirmed',
    message: 'Payment of ₱18,250 for Order #MT-ORD-9304 was successfully verified via GCash. Order queued for courier handover.',
    meta: { orderId: 'MT-ORD-9304', amount: 18250, method: 'GCash' },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    link: 'orders',
    icon: 'credit-card-2-front-fill',
  },
  {
    id: 'admin-notif-3',
    target: 'admin',
    category: 'order_status',
    type: 'order',
    priority: 'low',
    title: 'Order Status Updated',
    message: 'Order #MT-ORD-8821 was updated to "Out for Delivery" by Express Logistics Partner.',
    meta: { orderId: 'MT-ORD-8821', status: 'Out for Delivery' },
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    link: 'orders',
    icon: 'truck',
  },
  {
    id: 'admin-notif-4',
    target: 'admin',
    category: 'low_stock',
    type: 'inventory',
    priority: 'high',
    title: 'Low Stock Threshold Reached',
    message: 'Brembo RCS 19 Corsa Corta Brake Master Cylinder is down to 2 units remaining (Minimum threshold: 5).',
    meta: { productName: 'Brembo RCS 19 Corsa Corta', currentStock: 2, minThreshold: 5 },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    link: 'inventory',
    icon: 'exclamation-triangle-fill',
  },
  {
    id: 'admin-notif-5',
    target: 'admin',
    category: 'out_of_stock',
    type: 'inventory',
    priority: 'urgent',
    title: 'Product Out of Stock Alert',
    message: 'Akrapovič Carbon Slip-On Exhaust (Kawasaki ZX-6R) has reached 0 units in warehouse storage. Reorder required immediately.',
    meta: { productName: 'Akrapovič Carbon Slip-On Exhaust', currentStock: 0 },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    link: 'inventory',
    icon: 'x-octagon-fill',
  },
  {
    id: 'admin-notif-6',
    target: 'admin',
    category: 'booking_new',
    type: 'booking',
    priority: 'high',
    title: 'New Pitstop Booking Submitted',
    message: 'Maria Santos submitted a booking for Pro Performance 20-Point PMS (Yamaha NMAX 155, Plate: NMX-482).',
    meta: { customer: 'Maria Santos', vehicle: 'Yamaha NMAX 155', service: 'Pro Performance Full PMS' },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    link: 'garage',
    icon: 'calendar-plus-fill',
  },
  {
    id: 'admin-notif-7',
    target: 'admin',
    category: 'booking_cancelled',
    type: 'booking',
    priority: 'medium',
    title: 'Customer Cancelled Booking',
    message: 'Booking #BK-REP-4190 scheduled for Bay 2 was cancelled by customer Mark Reyes. Pit bay slot released back to queue.',
    meta: { bookingId: 'BK-REP-4190', customer: 'Mark Reyes', bay: 'Bay 2' },
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
    link: 'garage',
    icon: 'calendar-x-fill',
  },
  {
    id: 'admin-notif-8',
    target: 'admin',
    category: 'service_approaching',
    type: 'booking',
    priority: 'high',
    title: 'Scheduled Pitstop Service Approaching',
    message: 'Appointment for Honda CBR650R (Master Tech Jayson - Pit Bay 1) starts in 30 minutes at 10:30 AM.',
    meta: { vehicle: 'Honda CBR650R', mechanic: 'Master Tech Jayson', bay: 'Pit Bay 1', startsIn: '30 mins' },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    link: 'garage',
    icon: 'clock-history',
  },
  {
    id: 'admin-notif-9',
    target: 'admin',
    category: 'service_completed',
    type: 'booking',
    priority: 'medium',
    title: 'Repair / PMS Service Completed',
    message: 'Mechanic Carlos successfully completed Full Brake Caliper Rebuild & Bleed on Ducati Monster. Vehicle ready for inspection.',
    meta: { mechanic: 'Carlos', vehicle: 'Ducati Monster', service: 'Full Brake Caliper Rebuild' },
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
    link: 'garage',
    icon: 'check-circle-fill',
  },
  {
    id: 'admin-notif-10',
    target: 'admin',
    category: 'customer_registered',
    type: 'user',
    priority: 'low',
    title: 'New Customer Registered',
    message: 'New verified rider account registered: Alex Tan (alex.tan@gmail.com). Customer added to customer directory.',
    meta: { customer: 'Alex Tan', email: 'alex.tan@gmail.com' },
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    link: 'users',
    icon: 'person-plus-fill',
  },
  {
    id: 'admin-notif-11',
    target: 'admin',
    category: 'review_submitted',
    type: 'review',
    priority: 'medium',
    title: 'New Customer Review Submitted',
    message: 'Dave P. submitted a 5-star rating for Motul 300V Factory Line 10W-40: "Amazing oil, shifting is butter-smooth on track!"',
    meta: { rating: 5, customer: 'Dave P.', product: 'Motul 300V Factory Line 10W-40' },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    link: 'inventory',
    icon: 'star-fill',
  },
  {
    id: 'admin-notif-12',
    target: 'admin',
    category: 'restock_attention',
    type: 'procurement',
    priority: 'high',
    title: 'Purchase Order Needs Attention',
    message: 'Restocking Request #PO-2026-089 (Öhlins Suspensions Batch - ₱245,000) is awaiting admin approval and PO sign-off.',
    meta: { poNumber: 'PO-2026-089', supplier: 'Öhlins Official PH', amount: 245000 },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    link: 'suppliers',
    icon: 'file-earmark-text-fill',
  },
  {
    id: 'admin-notif-13',
    target: 'admin',
    category: 'restock_recommendation',
    type: 'inventory',
    priority: 'medium',
    title: 'AI Restock Recommendation',
    message: 'High sales velocity detected: NGK Iridium Spark Plugs sold 42 units in 5 days. Recommended reorder quantity: 60 units.',
    meta: { product: 'NGK Iridium Spark Plugs', velocity: '8.4 units/day', recommendedQty: 60 },
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    link: 'inventory',
    icon: 'graph-up-arrow',
  },
  {
    id: 'admin-notif-14',
    target: 'admin',
    category: 'sales_update',
    type: 'sales',
    priority: 'medium',
    title: 'Important Sales & Revenue Milestone',
    message: 'Store gross revenue surpassed daily milestone: ₱148,200 recorded across in-store POS and e-commerce checkouts today.',
    meta: { dailyTotal: 148200, onlineOrders: 14, posOrders: 28 },
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    link: 'overview',
    icon: 'cash-coin',
  },
  {
    id: 'admin-notif-15',
    target: 'admin',
    category: 'security_activity',
    type: 'system',
    priority: 'urgent',
    title: 'Important Security Activity Detected',
    message: 'Admin Master PIN was verified and security configuration backup was generated from IP 192.168.1.104.',
    meta: { action: 'Security Backup & PIN Verification', ip: '192.168.1.104' },
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    link: 'settings',
    icon: 'shield-lock-fill',
  },
];

const INITIAL_CUSTOMER_NOTIFICATIONS = [
  {
    id: 'cust-notif-1',
    target: 'customer',
    user_id: 'guest',
    title: 'Pit Bay Appointment Confirmed',
    message: 'Your Repair appointment (Ticket #BK-REP-4921) at Quezon City Hub is confirmed for tomorrow at 10:30 AM.',
    type: 'booking',
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    link: 'bookings',
    icon: 'tools',
  },
  {
    id: 'cust-notif-2',
    target: 'customer',
    user_id: 'guest',
    title: 'Order Out for Delivery',
    message: 'Order #MT-ORD-8821 with Akrapovič Carbon Slip-On is now out with courier rider Jherico. Track location live!',
    type: 'order',
    status: 'unread',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    link: 'orders',
    icon: 'bag-check-fill',
  },
  {
    id: 'cust-notif-3',
    target: 'customer',
    user_id: 'guest',
    title: 'Weekend PMS Special',
    message: 'Get a free Motul 300V brake fluid flush with any 20-Point PMS booking this weekend. Limited bay slots!',
    type: 'promo',
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    link: 'garage',
    icon: 'lightning-charge-fill',
  },
  {
    id: 'cust-notif-4',
    target: 'customer',
    user_id: 'guest',
    title: 'Security Verification Alert',
    message: 'New login detected from Chrome on Windows (124.106.128.45). If this was you, no action is needed.',
    type: 'security',
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    link: 'settings',
    icon: 'shield-lock-fill',
  },
];

class NotificationService {
  constructor() {
    this.adminNotifications = [...INITIAL_ADMIN_NOTIFICATIONS];
    this.customerNotifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
    this.subscribers = new Set();
    this.initialized = false;
    this.init();
  }

  sanitize(item) {
    if (!item) return item;
    return {
      ...item,
      title: stripEmojis(item.title),
      message: stripEmojis(item.message),
    };
  }

  async init() {
    try {
      // Load Customer Notifications
      const storedCust = await storageAdapter.getItem(CUSTOMER_STORAGE_KEY);
      if (storedCust) {
        const parsed = JSON.parse(storedCust);
        this.customerNotifications = Array.isArray(parsed) && parsed.length > 0
          ? parsed.map((n) => this.sanitize(n))
          : [...INITIAL_CUSTOMER_NOTIFICATIONS];
      } else {
        this.customerNotifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
      }

      // Load Admin Notifications
      const storedAdmin = await storageAdapter.getItem(ADMIN_STORAGE_KEY);
      if (storedAdmin) {
        const parsedAdmin = JSON.parse(storedAdmin);
        this.adminNotifications = Array.isArray(parsedAdmin) && parsedAdmin.length > 0
          ? parsedAdmin.map((n) => this.sanitize(n))
          : [...INITIAL_ADMIN_NOTIFICATIONS];
      } else {
        this.adminNotifications = [...INITIAL_ADMIN_NOTIFICATIONS];
      }

      await this.persist();
    } catch (_e) {
      this.customerNotifications = [...INITIAL_CUSTOMER_NOTIFICATIONS];
      this.adminNotifications = [...INITIAL_ADMIN_NOTIFICATIONS];
    }
    this.initialized = true;
    this.notify();
  }

  async persist() {
    try {
      await storageAdapter.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(this.customerNotifications));
      await storageAdapter.setItem(ADMIN_STORAGE_KEY, JSON.stringify(this.adminNotifications));
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

  async clearAllAdmin() {
    this.adminNotifications = [];
    await this.persist();
    this.notify();
    return this.adminNotifications;
  }

  // ─── CUSTOMER NOTIFICATIONS ACCESSORS ───

  getCustomerNotifications(userId = null) {
    if (!userId) return []; // If not logged in, no notifications are shown

    const list = this.customerNotifications.map((n) => this.sanitize(n));
    if (userId === 'guest') {
      return list.filter((n) => !n.user_id || n.user_id === 'guest');
    }
    return list.filter((n) => n.user_id === userId);
  }

  getCustomerUnreadCount(userId = null) {
    return this.getCustomerNotifications(userId).filter((n) => n.status === 'unread').length;
  }

  async markCustomerAsRead(id) {
    this.customerNotifications = this.customerNotifications.map((n) =>
      n.id === id ? { ...n, status: 'read' } : n
    );
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async markCustomerAsUnread(id) {
    this.customerNotifications = this.customerNotifications.map((n) =>
      n.id === id ? { ...n, status: 'unread' } : n
    );
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async deleteCustomerNotification(id) {
    this.customerNotifications = this.customerNotifications.filter((n) => n.id !== id);
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async markAllCustomerAsRead(userId = null) {
    this.customerNotifications = this.customerNotifications.map((n) => {
      const isGuest = !userId || userId === 'guest';
      const matchesUser = isGuest ? (!n.user_id || n.user_id === 'guest') : (n.user_id === userId);
      
      if (matchesUser) {
        return { ...n, status: 'read' };
      }
      return n;
    });
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  async clearAllCustomer(userId = null) {
    if (!userId || userId === 'guest') {
      this.customerNotifications = this.customerNotifications.filter(
        (n) => n.user_id && n.user_id !== 'guest'
      );
    } else {
      this.customerNotifications = this.customerNotifications.filter(
        (n) => n.user_id !== userId
      );
    }
    await this.persist();
    this.notify();
    return this.customerNotifications;
  }

  // ─── BACKWARD COMPATIBILITY HELPERS ───

  getNotifications(userId = null) {
    return this.getCustomerNotifications(userId);
  }

  getUnreadCount(userId = null) {
    return this.getCustomerUnreadCount(userId);
  }

  async markAsRead(id) {
    // Check admin first, then customer
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

  async markAllAsRead(userId = null) {
    await this.markAllCustomerAsRead(userId);
    return this.customerNotifications;
  }

  async clearAll(userId = null) {
    return this.clearAllCustomer(userId);
  }

  // ─── ADD NOTIFICATION (SCOPE AWARE) ───

  async addNotification({
    target = 'customer',
    userId,
    title,
    message,
    type = 'order',
    category = 'general',
    priority = 'normal',
    link = 'orders',
    icon = 'bell-fill',
    meta = {},
  }) {
    const notifItem = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      target,
      user_id: userId || 'guest',
      title: stripEmojis(title) || 'MotoTrack Alert',
      message: stripEmojis(message) || '',
      type,
      category,
      priority,
      status: 'unread',
      created_at: new Date().toISOString(),
      link,
      icon,
      meta,
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
}

export const notificationService = new NotificationService();
export default notificationService;
