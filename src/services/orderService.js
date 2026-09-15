// ─── ORDER SERVICE (SUPABASE PRIMARY SOURCE OF DATA & UNIVERSAL STORAGE) ───────
import { appStorage } from './storageAdapter';
import { supabaseManager } from './supabaseClient';
import { emailService } from './emailService';
import { productService } from './productService';
import { notificationService } from './notificationService';
import { auditLogService } from './auditLogService';

const STORAGE_KEY_ORDERS = 'mototrack_orders_db';
const STORAGE_KEY_OFFLINE_QUEUE = 'mototrack_orders_offline_queue';

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
    status: 'Shipped',
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

  initLocalStorage() {
    try {
      const existing = appStorage.getItem(STORAGE_KEY_ORDERS);
      if (!existing) {
        appStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(INITIAL_DEMO_ORDERS));
      }
    } catch (e) {}

    // Auto-sync offline orders when online or when window reconnects
    setTimeout(() => this.syncPendingOrders(), 2000);
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => this.syncPendingOrders());
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

  async syncPendingOrders() {
    const queue = this.getOfflineQueue();
    if (!queue || queue.length === 0) return;

    const client = supabaseManager.getClient();
    if (!client) return;

    console.log(`[OrderService] Syncing ${queue.length} pending offline order actions...`);
    const remaining = [];

    for (const item of queue) {
      try {
        if (item.type === 'create_order') {
          await client.from('orders').upsert([item.orderPayload]);
          if (Array.isArray(item.orderItemsPayload) && item.orderItemsPayload.length > 0) {
            await client.from('order_items').upsert(item.orderItemsPayload);
          }
          if (item.paymentPayload) {
            await client.from('payments').upsert([item.paymentPayload]);
          }
          if (item.salePayload) {
            await client.from('sales').upsert([item.salePayload]);
          }
        } else if (item.type === 'update_status') {
          await client
            .from('orders')
            .update({ status: item.status })
            .or(`order_id.eq.${item.orderId},id.eq.${item.orderId}`);
        } else if (item.type === 'update_address') {
          await client
            .from('orders')
            .update({ customer_address: item.address })
            .or(`order_id.eq.${item.orderId},id.eq.${item.orderId}`);
        } else if (item.type === 'cancel_order') {
          await client
            .from('orders')
            .update({ status: 'Cancelled', cancel_reason: item.reason })
            .or(`order_id.eq.${item.orderId},id.eq.${item.orderId}`);
          try {
            await client.from('order_notes').insert([
              {
                order_id: item.orderId,
                note_type: 'cancellation',
                content: item.reason,
                author: item.author || 'Customer',
              },
            ]);
          } catch (e) {}
        } else if (item.type === 'request_return') {
          await client
            .from('orders')
            .update({
              status: 'Return Requested',
              return_status: 'requested',
              return_reason: item.reason,
              return_notes: item.notes,
              return_requested_at: new Date().toISOString(),
            })
            .or(`order_id.eq.${item.orderId},id.eq.${item.orderId}`);
          try {
            await client.from('order_notes').insert([
              {
                order_id: item.orderId,
                note_type: 'return',
                content: `Return requested: ${item.reason} - ${item.notes || 'No notes'}`,
                author: 'Customer',
              },
            ]);
          } catch (e) {}
        }
      } catch (err) {
        console.warn(`[OrderService] Retry failed for offline action ${item.type}:`, err);
        remaining.push({ ...item, retry_count: (item.retry_count || 0) + 1 });
      }
    }

    this.saveOfflineQueue(remaining);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(orders) {
    this.listeners.forEach((fn) => {
      try {
        fn(orders);
      } catch (e) {}
    });
  }

  getLocalOrders() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY_ORDERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_DEMO_ORDERS;
  }

  getOrders(userId = null) {
    const orders = this.getLocalOrders();
    if (!userId || userId === 'guest') return orders;
    return orders.filter(
      (o) =>
        o.customer_id === userId ||
        o.user_id === userId ||
        o.userId === userId ||
        o.customer_name === userId
    );
  }

  saveLocalOrders(orders) {
    try {
      appStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
      this.notifyListeners(orders);
    } catch (e) {}
  }

  clearLocalOrders() {
    try {
      appStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
      this.notifyListeners([]);
    } catch (e) {}
  }

  /**
   * Fetch all orders for current user/customer directly from Supabase with fallback
   */
  async getUserOrders(userId, customerId, customerName) {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        let query = client
          .from('orders')
          .select('*, order_items(*, products(*))')
          .order('created_at', { ascending: false });

        if (customerId) {
          query = query.eq('customer_id', customerId);
        } else if (userId) {
          query = query.eq('customer_id', userId);
        }

        const { data, error } = await query;
        if (!error && data) {
          if (data.length > 0) {
            const formatted = data.map((o) => {
              const items = Array.isArray(o.order_items)
                ? o.order_items.map((oi) => ({
                    product_id: oi.product_id,
                    name: oi.products?.name || 'Motorcycle Part',
                    brand: oi.products?.brand || 'MotoTrack',
                    category: oi.products?.category || 'Gear',
                    quantity: oi.quantity || 1,
                    price: Number(oi.cost || oi.products?.price || 0),
                    image:
                      oi.products?.image ||
                      'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
                  }))
                : [];

              return {
                order_id: o.order_id || o.id,
                id: o.order_id || o.id,
                customer_id: o.customer_id,
                customer_name: o.customer_name,
                customer_phone: o.customer_phone,
                customer_address: o.customer_address,
                payment_method: o.payment_method || 'Cash on Delivery (COD)',
                total_amount: Number(o.total_amount || o.grand_total || 0),
                discount_amount: Number(o.discount_amount || 0),
                grand_total: Number(o.grand_total || o.total_amount || 0),
                items_summary: o.items_summary || items.map((i) => `${i.name} (x${i.quantity})`).join(', '),
                items_count: o.items_count || items.length,
                status: o.status || 'Pending Approval',
                channel: o.channel || 'Online Store',
                created_at: o.created_at || new Date().toISOString(),
                order_date: new Date(o.created_at || Date.now()).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }),
                estimated_delivery:
                  o.status === 'Pending Approval' ? 'Awaiting COD Approval' : 'In 1-3 Business Days',
                tracking_number:
                  'MOTO-TRK-' + ((o.order_id || '').replace(/\D/g, '').slice(0, 7) || '7891234'),
                courier: 'MotoTrack Express SuperAir',
                items: items.length > 0 ? items : this.parseItemsSummary(o.items_summary),
              };
            });

            if (!customerId && !userId) {
              this.saveLocalOrders(formatted);
            }
            return formatted;
          }

          // Supabase returned 0 orders for this specific customer
          if (customerId || userId) {
            return [];
          }

          // Supabase returned 0 orders for Admin query (database has 0 orders)
          this.saveLocalOrders([]);
          return [];
        }
      } catch (e) {
        console.warn('Supabase get orders note:', e);
      }
    }

    // Fallback: If requesting a specific user's orders while offline, strictly match by ID (never by customer_name)
    const local = this.getLocalOrders();
    if (userId || customerId) {
      return local.filter((o) => {
        const uMatch = Boolean(userId && (o.user_id === userId || o.customer_id === userId));
        const cMatch = Boolean(customerId && (o.customer_id === customerId || o.user_id === customerId));
        return uMatch || cMatch;
      });
    }

    return local;
  }

  async getAllOrders() {
    return this.getUserOrders(null, null, null);
  }

  parseItemsSummary(summary) {
    if (!summary) return [];
    return summary.split(',').map((part, index) => {
      const match = part.trim().match(/^(.*?)\s*\(x(\d+)\)$/);
      if (match) {
        return {
          product_id: 'prod-' + index,
          name: match[1],
          brand: 'MotoTrack',
          category: 'Gear',
          quantity: parseInt(match[2], 10),
          price: 99.0,
          image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
        };
      }
      return {
        product_id: 'prod-' + index,
        name: part.trim(),
        brand: 'MotoTrack',
        category: 'Gear',
        quantity: 1,
        price: 99.0,
        image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      };
    });
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
    grandTotal,
    items = [],
    channel = 'Online Store',
    overrideStatus = null,
  }) {
    const orderId = 'ord-' + Date.now() + Math.floor(10 + Math.random() * 90);
    const isCOD =
      (paymentMethod || '').toLowerCase().includes('cash') || (paymentMethod || '').includes('COD');
    const orderStatus = overrideStatus || (isCOD ? 'Pending Approval' : 'Processing');
    const nowIso = new Date().toISOString();

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

    const itemsSummary = normalizedItems.map((i) => `${i.name} (x${i.quantity})`).join(', ');
    const itemsCount = normalizedItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

    const newOrder = {
      order_id: orderId,
      id: orderId,
      user_id: userId || null,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      delivery_notes: deliveryNotes,
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
      grand_total: Number(grandTotal || total),
      items_summary: itemsSummary,
      items_count: itemsCount,
      status: orderStatus,
      channel,
      created_at: nowIso,
      order_date: 'Today',
      estimated_delivery: isCOD ? 'Today (Awaiting COD Verification)' : 'Today (30-45 mins Express Courier)',
      tracking_number: 'MOTO-TRK-' + Math.floor(1000000 + Math.random() * 9000000),
      courier: 'MotoTrack Express SuperAir',
      items: normalizedItems,
    };

    // 1. Optimistic Local Save
    const existing = this.getLocalOrders();
    this.saveLocalOrders([newOrder, ...existing]);

    // Admin Notification: New Customer Order Placed
    try {
      notificationService.notifyAdminNewOrder({
        orderId: newOrder.order_id,
        customerName: newOrder.customer_name,
        totalAmount: newOrder.grand_total,
        itemCount: newOrder.items_count,
        paymentMethod: newOrder.payment_method,
      });

      // Admin Notification: Order Payment Confirmed (if instant digital payment)
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
    } catch (_notifErr) {}

    // 2. Decrement Product Stock & Stock Alerts
    for (const it of normalizedItems) {
      if (it.product_id) {
        try {
          const catalog = await productService.getProducts();
          const match = catalog.find((p) => p.id === it.product_id || p.product_id === it.product_id);
          const currentStock = match ? Number(match.stock || 0) : 10;
          const newStock = Math.max(0, currentStock - it.quantity);
          await productService.updateProduct(it.product_id, { stock: newStock });

          // Admin Notification: Out of Stock or Low Stock
          if (newStock === 0) {
            notificationService.notifyAdminOutOfStock({
              productName: it.name,
              productId: it.product_id,
            });
          } else if (newStock <= 5) {
            notificationService.notifyAdminLowStock({
              productName: it.name,
              productId: it.product_id,
              currentStock: newStock,
              minThreshold: 5,
            });
          }
        } catch (e) {
          console.warn('[OrderService] updateStock error:', e);
        }
      }
    }

    // 3. Supabase Write (Single Write Path)
    const client = supabaseManager.getClient();
    let supabaseSuccess = false;

    const orderPayload = {
      order_id: orderId,
      customer_id: customerId || null,
      promo_id: promoId || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      delivery_notes: deliveryNotes,
      payment_method: paymentMethod,
      channel,
      total_amount: Number(total),
      discount_amount: Number(discountAmount || 0),
      grand_total: Number(grandTotal || total),
      status: orderStatus,
      items_summary: itemsSummary,
      items_count: itemsCount,
      tracking_number: newOrder.tracking_number,
      courier: newOrder.courier,
      estimated_delivery: newOrder.estimated_delivery,
      cod_change_for: isCOD ? codChangeFor : null,
    };

    const paymentId = 'pay-' + Date.now();
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

    const saleId = 'sale-' + Date.now();
    const salePayload = {
      sale_id: saleId,
      customer_id: customerId || null,
      payment_id: paymentId,
      sale_type: channel === 'Online Store' ? 'Online' : 'POS',
      total_amount: Number(grandTotal || total),
      amount_paid: isCOD ? 0 : Number(grandTotal || total),
      change: 0,
    };

    const orderItemsPayload = normalizedItems.map((it) => ({
      order_item_id: 'oi-' + Math.floor(Math.random() * 10000000),
      order_id: orderId,
      product_id: it.product_id,
      quantity: it.quantity,
      cost: it.price,
      subtotal: it.price * it.quantity,
    }));

    if (client) {
      try {
        const { error: ordErr } = await client.from('orders').insert([orderPayload]);
        if (!ordErr) {
          supabaseSuccess = true;
          await client.from('payments').insert([paymentPayload]);
          await client.from('sales').insert([salePayload]);
          if (orderItemsPayload.length > 0) {
            await client.from('order_items').insert(orderItemsPayload);
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
        orderPayload,
        paymentPayload,
        salePayload,
        orderItemsPayload,
      });
    }

    // 4. Send Order Confirmation Email & Notification
    try {
      await emailService.sendOrderConfirmationEmail({
        order: newOrder,
        customerEmail: customerPhone?.includes('@') ? customerPhone : null,
        customerName,
      });
    } catch (e) {}

    return { success: true, order: newOrder };
  }

  /**
   * Update Delivery Address for an existing order
   */
  async updateAddress(orderId, newAddress) {
    if (!orderId || !newAddress) return { success: false, error: 'Order ID and address are required' };
    const cleanAddress = newAddress.trim();

    const orders = this.getLocalOrders();
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
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
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
    const client = supabaseManager.getClient();
    let synced = false;
    if (client) {
      try {
        const { error } = await client
          .from('orders')
          .update({ status: 'Processing' })
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
        if (!error) synced = true;
      } catch (e) {
        console.warn('Supabase approve COD error:', e);
      }
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'update_status',
        orderId,
        status: 'Processing',
      });
    }

    const orders = this.getLocalOrders();
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        targetOrder = {
          ...o,
          status: 'Processing',
          cod_approved_at: new Date().toISOString(),
          estimated_delivery: 'In 1-2 Business Days (Packing)',
          updated_at: new Date().toISOString(),
        };
        return targetOrder;
      }
      return o;
    });
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
   * Update Order Status (Pending Approval -> Processing -> Shipped -> Delivered -> Cancelled)
   */
  async updateOrderStatus(orderId, newStatus, notes = '') {
    const client = supabaseManager.getClient();
    let synced = false;
    if (client) {
      try {
        const { error } = await client
          .from('orders')
          .update({ status: newStatus })
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
        if (!error) synced = true;
      } catch (e) {
        console.warn('Supabase update order status error:', e);
      }
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'update_status',
        orderId,
        status: newStatus,
      });
    }

    const orders = this.getLocalOrders();
    let oldStatus = 'Pending Approval';
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        oldStatus = o.status;
        let est = o.estimated_delivery;
        if (newStatus === 'Pending Approval') est = 'Awaiting COD Approval';
        if (newStatus === 'Processing') est = 'Preparing & Packing at Warehouse';
        if (newStatus === 'Shipped') est = 'Out for Courier Delivery Today';
        if (newStatus === 'Delivered') est = 'Delivered & Received';
        if (newStatus === 'Cancelled') est = 'Order Cancelled';
        targetOrder = {
          ...o,
          status: newStatus,
          estimated_delivery: est,
          updated_at: new Date().toISOString(),
        };
        return targetOrder;
      }
      return o;
    });

    this.saveLocalOrders(updated);

    // Notification
    try {
      if (targetOrder) {
        notificationService.notifyAdminOrderStatusUpdated({
          orderId,
          status: newStatus,
          customerName: targetOrder.customer_name,
        });
        auditLogService.logOrderAction({
          action: 'ORDER_STATUS_CHANGED',
          target: `Order #${orderId}`,
          details: `Order status changed from "${oldStatus}" to "${newStatus}" for customer ${targetOrder.customer_name}.${notes ? ` Notes: ${notes}` : ''}`,
          severity: newStatus === 'Cancelled' ? 'WARNING' : 'INFO',
          metadata: { orderId, oldStatus, newStatus, customer: targetOrder.customer_name, notes },
        });
        await emailService.sendOrderStatusNotification({
          orderId,
          oldStatus,
          newStatus,
          customerEmail: targetOrder.customer_phone?.includes('@') ? targetOrder.customer_phone : null,
          customerName: targetOrder.customer_name,
          trackingNumber: targetOrder.tracking_number,
          notes,
        });
      }
    } catch (e) {}

    return { success: true, order: targetOrder };
  }

  /**
   * Cancel an order & persist cancellation reason in orders + order_notes
   */
  async cancelOrder(orderId, reason = 'Cancelled by Customer') {
    if (!orderId) return { success: false, error: 'Order ID is required' };
    const cleanReason = (reason || 'Cancelled by Customer').trim();

    const orders = this.getLocalOrders();
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        targetOrder = {
          ...o,
          status: 'Cancelled',
          cancel_reason: cleanReason,
          estimated_delivery: 'Order Cancelled',
          updated_at: new Date().toISOString(),
        };
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
          .update({ status: 'Cancelled', cancel_reason: cleanReason })
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
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
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (!synced) {
      this.enqueueOfflineAction({
        type: 'cancel_order',
        orderId,
        reason: cleanReason,
      });
    }

    // Status notification
    try {
      if (targetOrder) {
        await emailService.sendOrderStatusNotification({
          orderId,
          oldStatus: 'Pending Approval',
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
          details: `Order #${orderId} was cancelled. Reason: ${cleanReason}.`,
          severity: 'WARNING',
          metadata: { orderId, reason: cleanReason, customer: targetOrder.customer_name },
        });
      }
    } catch (e) {}

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
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
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
    const newStatus = isApprove ? 'Refunded' : 'Delivered';
    const returnStatus = isApprove ? 'approved' : 'rejected';

    const orders = this.getLocalOrders();
    let targetOrder = null;
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        targetOrder = {
          ...o,
          status: newStatus,
          return_status: returnStatus,
          updated_at: new Date().toISOString(),
        };
        return targetOrder;
      }
      return o;
    });
    this.saveLocalOrders(updated);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('orders')
          .update({ status: newStatus, return_status: returnStatus })
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
        try {
          await client.from('order_notes').insert([
            {
              order_id: orderId,
              note_type: 'admin',
              content: `Return ${decision} by Admin. ${adminNotes}`,
              author: 'Admin',
            },
          ]);
        } catch (e) {}
      } catch (e) {}
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
    const isDelivered = status === 'delivered';
    const isShipped = status === 'shipped' || isDelivered;
    const isProcessing = status === 'processing' || isShipped;
    const isPendingApproval = status.includes('pending') || status.includes('approval');
    const isCOD = (order.payment_method || '').toLowerCase().includes('cash');

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

    // COD Timeline with Verification Milestone
    if (isCOD) {
      return [
        {
          id: 1,
          title: 'COD Order Placed',
          description: 'Cash on delivery order submitted and queued for admin review.',
          date: order.order_date || 'Today',
          time: '09:30 AM',
          completed: true,
          current: isPendingApproval,
          icon: 'cash-coin',
        },
        {
          id: 2,
          title: isPendingApproval ? 'Awaiting Admin COD Approval' : 'COD Approved & Packing',
          description: isPendingApproval
            ? 'Store admin is reviewing address and COD verification.'
            : 'Order approved! Parts inspected and boxed at MotoTrack Warehouse.',
          date: isProcessing ? 'Today' : 'Pending',
          time: isProcessing ? '01:15 PM' : '--',
          completed: isProcessing,
          current: status === 'processing',
          icon: isPendingApproval ? 'shield-lock-fill' : 'box-seam-fill',
        },
        {
          id: 3,
          title: 'Dispatched to Express Courier',
          description: `Handed over to ${order.courier || 'MotoTrack Express'} rider facility.`,
          date: isShipped ? 'Today' : 'Pending',
          time: isShipped ? '03:45 PM' : '--',
          completed: isShipped,
          current: status === 'shipped',
          icon: 'truck',
        },
        {
          id: 4,
          title: 'Delivered & Cash Collected',
          description: 'Package delivered safely. Cash collected upon receipt.',
          date: isDelivered ? 'Today' : order.estimated_delivery || 'Upcoming',
          time: isDelivered ? '05:30 PM' : '--',
          completed: isDelivered,
          current: isDelivered,
          icon: 'check-circle-fill',
        },
      ];
    }

    // Standard Online Paid Order Timeline
    return [
      {
        id: 1,
        title: 'Payment Confirmed & Order Placed',
        description: 'Payment authorized via GCash / Card. Receipt logged.',
        date: order.order_date || 'Today',
        time: '09:30 AM',
        completed: true,
        current: false,
        icon: 'receipt',
      },
      {
        id: 2,
        title: 'Quality Check & Packed',
        description: 'Parts inspected, bubble wrapped & boxed at MotoTrack Warehouse.',
        date: order.order_date || 'Today',
        time: '02:15 PM',
        completed: isProcessing,
        current: status === 'processing',
        icon: 'box-seam-fill',
      },
      {
        id: 3,
        title: 'Dispatched to Courier',
        description: `Handed over to ${order.courier || 'MotoTrack Express'} facility.`,
        date: isShipped ? 'Today' : 'Pending',
        time: isShipped ? '08:45 AM' : '--',
        completed: isShipped,
        current: status === 'shipped',
        icon: 'truck',
      },
      {
        id: 4,
        title: 'Delivered & Signed',
        description: 'Package delivered safely to destination address.',
        date: isDelivered ? 'Today' : order.estimated_delivery || 'Upcoming',
        time: isDelivered ? '03:40 PM' : '--',
        completed: isDelivered,
        current: isDelivered,
        icon: 'check-circle-fill',
      },
    ];
  }

  /**
   * Create an in-store POS Order
   */
  async createPOSOrder(orderData) {
    const posId = 'pos-' + Date.now().toString().slice(-6);
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
    };

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
}

export const orderService = new OrderService();
export default orderService;
