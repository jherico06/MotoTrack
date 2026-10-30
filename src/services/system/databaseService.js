// ─── SUPABASE FULL ER DATABASE SERVICE ──────────────────────────────────────
import { supabase } from '../../lib/supabase.js';
import { orderService } from '../orders/orderService.js';
import { supplierService } from '../inventory/supplierService.js';
import { categoryService } from '../products/categoryService.js';

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
  async getCategories(options) {
    try {
      return await categoryService.getCategories(options);
    } catch (e) {
      console.warn('Failed to fetch categories:', e);
      return [];
    }
  },

  async addCategory({ name, description = '', icon = '', image = '' }) {
    try {
      const res = await categoryService.addCategory({ name, description, icon, image });
      return res.category || res;
    } catch (e) {
      console.warn('Failed to add category:', e);
      return { category_id: 'cat-' + Date.now(), name, description };
    }
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
    try {
      const { productService } = await import('../products/productService.js');
      return await productService.updateProduct(productId, {
        stock: stockQuantity,
        stockReason: 'adjustment',
        stockRefType: 'inventory_adjustment',
      });
    } catch (e) {
      console.warn('databaseService.updateStock failed:', e);
      return { success: false, error: e?.message || 'Stock update failed' };
    }
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
    const empty = {
      totalProducts: 0,
      totalOrders: 0,
      totalUsers: 0,
      adminCount: 0,
      customerCount: 0,
      totalRevenue: 0,
      lowStockCount: 0,
      totalPromos: 0,
      totalCustomers: 0,
      totalServices: 0,
      error: true,
    };
    try {
      if (!supabase) return { ...empty, error: 'Supabase client is not configured' };

      const [prodsRes, ordersRes, usersRes, promosRes, custsRes, srvRes] = await Promise.all([
        supabase
          .from('products')
          .select('product_id, status, inventory(stock_quantity, reorder_level)', { count: 'exact' }),
        supabase.from('orders').select('order_id, grand_total, total_amount, status', { count: 'exact' }),
        supabase.from('users').select('user_id, role', { count: 'exact' }),
        supabase.from('promos').select('promo_id', { count: 'exact' }),
        supabase.from('customers').select('customer_id', { count: 'exact' }),
        supabase.from('services').select('service_id', { count: 'exact' }),
      ]);

      if (prodsRes.error || ordersRes.error) {
        return { ...empty, error: prodsRes.error?.message || ordersRes.error?.message };
      }

      const products = (prodsRes.data || []).filter((product) => {
        const status = String(product.status || 'active').toLowerCase();
        return status !== 'archived' && status !== 'deleted' && status !== 'inactive';
      });
      const orders = ordersRes.data || [];
      const users = usersRes.data || [];
      const excluded = new Set(['cancelled', 'canceled', 'refunded']);

      const totalRevenue = orders.reduce((sum, order) => {
        const status = String(order.status || '').toLowerCase();
        if (excluded.has(status)) return sum;
        return sum + (Number(order.grand_total) || Number(order.total_amount) || 0);
      }, 0);
      const lowStockCount = products.filter((product) => {
        const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
        const stock = Number(inventory?.stock_quantity ?? 0);
        const reorder = Number(inventory?.reorder_level);
        const level = Number.isFinite(reorder) && reorder >= 0 ? reorder : 5;
        return stock > 0 && stock <= level;
      }).length;
      const staffRoles = new Set(['admin', 'staff', 'mechanic', 'rider']);
      const adminCount = users.filter((user) => String(user.role || '').toLowerCase() === 'admin').length;
      const customerCount = users.filter((user) => !staffRoles.has(String(user.role || '').toLowerCase())).length;

      return {
        totalProducts: products.length,
        totalOrders: ordersRes.count || orders.length,
        totalUsers: usersRes.count || users.length,
        adminCount,
        customerCount,
        totalRevenue,
        lowStockCount,
        totalPromos: promosRes.count || 0,
        totalCustomers: custsRes.count || customerCount,
        totalServices: srvRes.count || 0,
        error: false,
      };
    } catch (e) {
      return { ...empty, error: e?.message || 'Stats request failed' };
    }
  },
};
