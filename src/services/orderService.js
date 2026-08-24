// ─── ORDER SERVICE (SUPABASE PRIMARY SOURCE OF DATA & UNIVERSAL STORAGE) ───────
import { appStorage } from './storageAdapter';
import { supabaseManager } from './supabaseClient';

const STORAGE_KEY_ORDERS = 'mototrack_orders_db';

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
        category: 'Drivetrain',
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
        category: 'Helmets',
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

  saveLocalOrders(orders) {
    try {
      appStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
      this.notifyListeners(orders);
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
        } else if (customerName) {
          query = query.ilike('customer_name', customerName);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
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
              estimated_delivery: o.status === 'Pending Approval' ? 'Awaiting COD Approval' : 'In 1-3 Business Days',
              tracking_number: 'MOTO-TRK-' + ((o.order_id || '').replace(/\D/g, '').slice(0, 7) || '7891234'),
              courier: 'MotoTrack Express SuperAir',
              items: items.length > 0 ? items : this.parseItemsSummary(o.items_summary),
            };
          });

          this.saveLocalOrders(formatted);
          return formatted;
        }
      } catch (e) {
        console.warn('Supabase get orders note:', e);
      }
    }

    return this.getLocalOrders();
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
   * Admin 1-Click Approve for Cash on Delivery Orders
   */
  async approveCODOrder(orderId) {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('orders')
          .update({ status: 'Processing' })
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
      } catch (e) {
        console.warn('Supabase approve COD error:', e);
      }
    }

    const orders = this.getLocalOrders();
    const updated = orders.map((o) =>
      o.order_id === orderId || o.id === orderId
        ? {
            ...o,
            status: 'Processing',
            cod_approved_at: new Date().toISOString(),
            estimated_delivery: 'In 1-2 Business Days (Packing)',
          }
        : o
    );
    this.saveLocalOrders(updated);
    const targetOrder = updated.find((o) => o.order_id === orderId || o.id === orderId);

    return { success: true, order: targetOrder };
  }

  /**
   * Update Order Status (Pending Approval -> Processing -> Shipped -> Delivered -> Cancelled)
   */
  async updateOrderStatus(orderId, newStatus) {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('orders')
          .update({ status: newStatus })
          .or(`order_id.eq.${orderId},id.eq.${orderId}`);
      } catch (e) {
        console.warn('Supabase update order status error:', e);
      }
    }

    const orders = this.getLocalOrders();
    const updated = orders.map((o) => {
      if (o.order_id === orderId || o.id === orderId) {
        let est = o.estimated_delivery;
        if (newStatus === 'Pending Approval') est = 'Awaiting COD Approval';
        if (newStatus === 'Processing') est = 'Preparing & Packing at Warehouse';
        if (newStatus === 'Shipped') est = 'Out for Courier Delivery Today';
        if (newStatus === 'Delivered') est = 'Delivered & Received';
        if (newStatus === 'Cancelled') est = 'Order Cancelled';
        return {
          ...o,
          status: newStatus,
          estimated_delivery: est,
          updated_at: new Date().toISOString(),
        };
      }
      return o;
    });

    this.saveLocalOrders(updated);
    const targetOrder = updated.find((o) => o.order_id === orderId || o.id === orderId);
    return { success: true, order: targetOrder };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, reason = 'Cancelled by Administrator / Customer') {
    return this.updateOrderStatus(orderId, 'Cancelled');
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
