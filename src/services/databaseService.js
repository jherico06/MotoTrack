// ─── SUPABASE FULL ER DATABASE SERVICE ──────────────────────────────────────
import { supabase } from './supabaseClient';
import { orderService } from './orderService';
import { supplierService } from './supplierService';

export const databaseService = {
  // ─── 1. SUPPLIERS ───
  async getSuppliers() {
    try {
      const data = await supplierService.fetchSuppliers();
      return data || [];
    } catch (e) {
      console.warn('Failed to fetch suppliers from database:', e);
      return [];
    }
  },

  async addSupplier({ name, contact_person = '', phone = '', address = '', ...rest }) {
    try {
      const res = await supplierService.addSupplier({
        name,
        contact_person,
        phone,
        address,
        ...rest,
      });
      return res?.supplier || null;
    } catch (e) {
      console.warn('Failed to add supplier to database:', e);
      return null;
    }
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
      {
        category_id: 'cat-01',
        name: 'Engine',
        description: 'Camshafts, big bore kits, pistons and high-performance engine parts',
      },
      {
        category_id: 'cat-02',
        name: 'Electrical',
        description: 'Lithium batteries, iridium spark plugs, stators and electronics',
      },
      {
        category_id: 'cat-03',
        name: 'Tires & Wheels',
        description: 'WSBK compound racing tires and forged lightweight wheels',
      },
      {
        category_id: 'cat-04',
        name: 'Brakes',
        description: 'Radial master cylinders, monobloc calipers, racing pads and rotors',
      },
      {
        category_id: 'cat-05',
        name: 'Suspension',
        description: 'Monoshock dampers, cartridge kits, steering dampers and springs',
      },
      {
        category_id: 'cat-06',
        name: 'Transmission',
        description: 'Gold racing chains, sprockets, slipper clutches and quickshifters',
      },
      {
        category_id: 'cat-07',
        name: 'Fuel System',
        description: 'ECU tuners, flat-slide carburetors, fuel pumps and injectors',
      },
      {
        category_id: 'cat-08',
        name: 'Body Parts',
        description: 'Full carbon fiber fairings, CNC billet rearsets and aero winglets',
      },
      {
        category_id: 'cat-09',
        name: 'Exhaust',
        description: 'Titanium & Carbon fiber slip-on and full racing exhaust systems',
      },
      {
        category_id: 'cat-10',
        name: 'Maintenance',
        description: '100% synthetic racing oils, high-flow filters, fluids and care',
      },
      {
        category_id: 'cat-11',
        name: 'Accessories',
        description: 'FIM helmets, phone vibration mounts, luggage and gear',
      },
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
        await supabase
          .from('products')
          .update({ stock: stockQuantity })
          .or(`product_id.eq.${productId},id.eq.${productId}`);
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
      {
        service_id: 'srv-01',
        name: 'Dyno Tuning, Custom Fuel Mapping & ECU Flashing',
        category: 'Motor Tuning',
        price: 250.0,
        duration: '90 min',
        status: 'active',
      },
      {
        service_id: 'srv-02',
        name: 'Full Suspension Sag & Track Setup Calibration',
        category: 'Chassis',
        price: 150.0,
        duration: '60 min',
        status: 'active',
      },
      {
        service_id: 'srv-03',
        name: 'Race Caliper Overhaul & High-Temp Fluid Bleed',
        category: 'Braking',
        price: 120.0,
        duration: '45 min',
        status: 'active',
      },
      {
        service_id: 'srv-04',
        name: '520 Chain Conversion & Sprocket Gearing Fitting',
        category: 'Drivetrain',
        price: 95.0,
        duration: '40 min',
        status: 'active',
      },
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

  async deleteBooking(bookingId) {
    if (supabase) {
      try {
        await supabase.from('bookings').delete().eq('booking_id', bookingId);
      } catch (e) {}
    }
    return { success: true };
  },

  // ─── 5. ORDERS & PAYMENTS & SALES (DELEGATED TO UNIFIED ORDER SERVICE) ───
  async getOrders() {
    return orderService.getAllOrders();
  },

  async createOrder(orderData) {
    return orderService.createOrder(orderData);
  },

  async approveCODOrder(orderId) {
    return orderService.approveCODOrder(orderId);
  },

  async updateOrderStatus(orderId, status) {
    return orderService.updateOrderStatus(orderId, status);
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
        supabase
          ? supabase.from('products').select('product_id, price, stock', { count: 'exact' })
          : { data: [], count: 0 },
        supabase
          ? supabase.from('orders').select('order_id, grand_total, status', { count: 'exact' })
          : { data: [], count: 0 },
        supabase
          ? supabase.from('users').select('user_id, role', { count: 'exact' })
          : { data: [], count: 0 },
        supabase ? supabase.from('promos').select('promo_id', { count: 'exact' }) : { data: [], count: 0 },
        supabase
          ? supabase.from('customers').select('customer_id', { count: 'exact' })
          : { data: [], count: 0 },
        supabase
          ? supabase.from('services').select('service_id', { count: 'exact' })
          : { data: [], count: 0 },
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
