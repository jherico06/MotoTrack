// ─── SUPABASE FULL ER DATABASE SERVICE ──────────────────────────────────────
import { supabase } from './supabaseClient';

export const databaseService = {
  // ─── 1. SUPPLIERS ───
  async getSuppliers() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Failed to fetch suppliers from Supabase:', e);
      }
    }
    return [
      { supplier_id: 'sup-01', name: 'Akrapovič Racing Exhausts', contact_person: 'Igor Akrapovič', phone: '+386 1 7878 000', address: 'Ivančna Gorica, Slovenia' },
      { supplier_id: 'sup-02', name: 'Brembo High Performance SpA', contact_person: 'Matteo Rossi', phone: '+39 035 605 111', address: 'Curno, Bergamo, Italy' },
      { supplier_id: 'sup-03', name: 'Öhlins Racing AB', contact_person: 'Kenth Öhlin', phone: '+46 8 5979 6300', address: 'Upplands Väsby, Sweden' },
      { supplier_id: 'sup-04', name: 'D.I.D Daido Kogyo Co.', contact_person: 'Kenji Takahashi', phone: '+81 761 74 1211', address: 'Ishikawa, Japan' },
      { supplier_id: 'sup-05', name: 'Dynojet Research Inc.', contact_person: 'Robert Miller', phone: '+1 (800) 992-4993', address: 'Las Vegas, NV, USA' },
    ];
  },

  async addSupplier({ name, contact_person = '', phone = '', address = '' }) {
    const id = 'sup-' + Date.now();
    const newSupplier = { supplier_id: id, name, contact_person, phone, address };
    if (supabase) {
      try {
        await supabase.from('suppliers').insert([newSupplier]);
      } catch (e) {}
    }
    return newSupplier;
  },

  // ─── 2. CATEGORIES ───
  async getCategories() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Failed to fetch categories from Supabase:', e);
      }
    }
    return [
      { category_id: 'cat-01', name: 'Exhaust', description: 'Titanium & Carbon fiber high-performance exhaust systems' },
      { category_id: 'cat-02', name: 'Brakes', description: 'Monobloc calipers, floating rotors and sintered racing pads' },
      { category_id: 'cat-03', name: 'Suspension', description: 'Inverted racing forks, monoshocks and steering dampers' },
      { category_id: 'cat-04', name: 'Engine', description: 'ECU tuners, high-flow filters, camshafts and spark plugs' },
      { category_id: 'cat-05', name: 'Drivetrain', description: 'Gold X-ring chains, sprockets and slipper clutches' },
      { category_id: 'cat-06', name: 'Helmets', description: 'FIM & ECE certified full carbon fiber track helmets' },
      { category_id: 'cat-07', name: 'Tires', description: 'WSBK compound superbike and sport tires' },
      { category_id: 'cat-08', name: 'Accessories', description: 'Billet CNC rearsets, aero winglets and levers' },
    ];
  },

  async addCategory({ name, description = '' }) {
    const id = 'cat-' + Date.now();
    const newCat = { category_id: id, name, description };
    if (supabase) {
      try {
        await supabase.from('categories').insert([newCat]);
      } catch (e) {}
    }
    return newCat;
  },

  // ─── 3. INVENTORY & STOCKS ───
  async getInventory() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('inventory')
          .select('*, products(name, category, brand, price, sku, image)')
          .order('stock_quantity', { ascending: true });
        if (!error && data) return data;
      } catch (e) {
        console.warn('Failed to fetch inventory from Supabase:', e);
      }
    }
    return [];
  },

  async updateStock(productId, stockQuantity) {
    if (supabase) {
      try {
        await supabase.from('products').update({ stock: stockQuantity }).or(`product_id.eq.${productId},id.eq.${productId}`);
        await supabase.from('inventory').upsert([
          {
            inventory_id: 'inv-' + productId,
            product_id: productId,
            stock_quantity: stockQuantity,
            last_updated: new Date().toISOString(),
          },
        ]);
      } catch (e) {}
    }
    return { success: true };
  },

  // ─── 4. SERVICES & BOOKINGS ───
  async getServices() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Failed to fetch services from Supabase:', e);
      }
    }
    return [
      { service_id: 'srv-01', name: 'Dyno Tuning, Custom Fuel Mapping & ECU Flashing', category: 'Motor Tuning', price: 250.0, duration: '90 min', status: 'active' },
      { service_id: 'srv-02', name: 'Full Suspension Sag & Track Setup Calibration', category: 'Chassis', price: 150.0, duration: '60 min', status: 'active' },
      { service_id: 'srv-03', name: 'Race Caliper Overhaul & High-Temp Fluid Bleed', category: 'Braking', price: 120.0, duration: '45 min', status: 'active' },
      { service_id: 'srv-04', name: '520 Chain Conversion & Sprocket Gearing Fitting', category: 'Drivetrain', price: 95.0, duration: '40 min', status: 'active' },
    ];
  },

  async getBookings() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, customers(name, email, contact_number), services(name, price, duration)')
          .order('schedule', { ascending: false });
        if (!error && data) return data;
      } catch (e) {
        console.warn('Failed to fetch bookings from Supabase:', e);
      }
    }
    return [];
  },

  async createBooking({ customerId, serviceId, schedule, notes = '' }) {
    const id = 'bk-' + Date.now();
    const newBooking = {
      booking_id: id,
      customer_id: customerId,
      service_id: serviceId,
      schedule,
      notes,
      status: 'Confirmed',
    };
    if (supabase) {
      try {
        await supabase.from('bookings').insert([newBooking]);
      } catch (e) {}
    }
    return newBooking;
  },

  async updateBookingStatus(bookingId, status) {
    if (supabase) {
      try {
        await supabase.from('bookings').update({ status }).eq('booking_id', bookingId);
      } catch (e) {}
    }
    return { success: true };
  },

  // ─── 5. ORDERS & PAYMENTS & SALES ───
  async getOrders() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) {
        console.warn('Failed to fetch orders from Supabase:', e);
      }
    }
    return [];
  },

  async createOrder({
    customerId = null,
    customerName,
    customerPhone,
    customerAddress,
    paymentMethod,
    total,
    discountAmount = 0,
    grandTotal,
    itemsSummary,
    itemsCount,
    items = [],
  }) {
    const orderId = 'ord-' + Date.now();
    const isCOD = (paymentMethod || '').toLowerCase().includes('cash') || (paymentMethod || '').includes('COD');
    const initialStatus = isCOD ? 'Pending Approval' : 'Processing';

    const newOrder = {
      order_id: orderId,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      payment_method: paymentMethod,
      total_amount: Number(total),
      discount_amount: Number(discountAmount),
      grand_total: Number(grandTotal || total),
      items_summary: itemsSummary,
      items_count: itemsCount,
      status: initialStatus,
    };

    if (supabase) {
      try {
        await supabase.from('orders').insert([newOrder]);

        // Create Payment record
        const paymentId = 'pay-' + Date.now();
        await supabase.from('payments').insert([
          {
            payment_id: paymentId,
            order_id: orderId,
            payment_method: paymentMethod,
            amount: Number(grandTotal || total),
            reference_number: isCOD ? 'COD-PENDING' : 'TXN-' + Math.floor(100000 + Math.random() * 900000),
            status: isCOD ? 'Pending' : 'Completed',
          },
        ]);

        // Create Sales record
        const saleId = 'sale-' + Date.now();
        await supabase.from('sales').insert([
          {
            sale_id: saleId,
            customer_id: customerId,
            payment_id: paymentId,
            sale_type: 'Online',
            total_amount: Number(grandTotal || total),
            amount_paid: isCOD ? 0 : Number(grandTotal || total),
            change: 0,
          },
        ]);

        // Create Order Items
        if (Array.isArray(items) && items.length > 0) {
          const orderItemsPayload = items.map((it) => ({
            order_item_id: 'oi-' + Math.floor(Math.random() * 1000000),
            order_id: orderId,
            product_id: it.product?.product_id || it.product?.id || it.product_id,
            quantity: it.quantity || 1,
            cost: Number(it.product?.price || 0),
            subtotal: Number(it.product?.price || 0) * (it.quantity || 1),
          }));
          await supabase.from('order_items').insert(orderItemsPayload);
        }
      } catch (e) {
        console.warn('Supabase order creation error:', e);
      }
    }

    return { success: true, order: newOrder };
  },

  async approveCODOrder(orderId) {
    if (supabase) {
      try {
        await supabase.from('orders').update({ status: 'Processing' }).or(`order_id.eq.${orderId},id.eq.${orderId}`);
      } catch (e) {}
    }
    return { success: true };
  },

  async updateOrderStatus(orderId, status) {
    if (supabase) {
      try {
        await supabase.from('orders').update({ status }).or(`order_id.eq.${orderId},id.eq.${orderId}`);
      } catch (e) {}
    }
    return { success: true };
  },

  // ─── 6. SYSTEM SETTINGS ───
  async getSettings() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (!error && data) return data;
      } catch (e) {}
    }
    return [
      { key: 'store_name', value: 'MotoTrack Sports & Pro Gear' },
      { key: 'currency', value: 'USD' },
      { key: 'admin_security_key', value: 'ADMIN2026' },
    ];
  },

  // ─── 7. TABLE METRICS / DASHBOARD STATS ───
  async getStats() {
    try {
      const [prodsRes, ordersRes, usersRes, promosRes, custsRes, srvRes] = await Promise.all([
        supabase ? supabase.from('products').select('product_id, price, stock', { count: 'exact' }) : { data: [], count: 0 },
        supabase ? supabase.from('orders').select('order_id, grand_total, status', { count: 'exact' }) : { data: [], count: 0 },
        supabase ? supabase.from('users').select('user_id, role', { count: 'exact' }) : { data: [], count: 0 },
        supabase ? supabase.from('promos').select('promo_id', { count: 'exact' }) : { data: [], count: 0 },
        supabase ? supabase.from('customers').select('customer_id', { count: 'exact' }) : { data: [], count: 0 },
        supabase ? supabase.from('services').select('service_id', { count: 'exact' }) : { data: [], count: 0 },
      ]);

      const products = prodsRes.data || [];
      const orders = ordersRes.data || [];
      const users = usersRes.data || [];

      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
      const lowStockCount = products.filter((p) => Number(p.stock || 0) <= 5).length;
      const adminCount = users.filter((u) => u.role === 'admin').length;
      const customerCount = users.filter((u) => u.role !== 'admin').length;

      return {
        totalProducts: prodsRes.count || products.length,
        totalOrders: ordersRes.count || orders.length,
        totalUsers: usersRes.count || users.length,
        adminCount,
        customerCount,
        totalRevenue,
        lowStockCount,
        totalPromos: promosRes.count || 0,
        totalCustomers: custsRes.count || 0,
        totalServices: srvRes.count || 0,
      };
    } catch (e) {
      return {
        totalProducts: 8,
        totalOrders: 1,
        totalUsers: 2,
        adminCount: 1,
        customerCount: 1,
        totalRevenue: 1095.0,
        lowStockCount: 2,
        totalPromos: 4,
        totalCustomers: 1,
        totalServices: 4,
      };
    }
  },
};
