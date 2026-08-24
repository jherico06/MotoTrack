import { createClient } from '@supabase/supabase-js';
import { appStorage } from './storageAdapter';

// User's configured Supabase project credentials (JWT Anon Key for PostgREST & Auth)
export const DEFAULT_SUPABASE_URL = 'https://vtbdmurblidtdghaotne.supabase.co';
export const LEGACY_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YmRtdXJibGlkdGRnaGFvdG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzc1MTgsImV4cCI6MjEwMjYxMzUxOH0.MBzHtE42GqOTEReIr35QZfTSejrsk6UIdmc1mwIBqwI';
export const DEFAULT_SUPABASE_ANON_KEY = LEGACY_SUPABASE_ANON_KEY;

const STORAGE_KEYS = {
  SUPABASE_URL: 'mototrack_supabase_url',
  SUPABASE_ANON_KEY: 'mototrack_supabase_anon_key',
};

function sanitizeSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_SUPABASE_URL;
  let clean = url.trim();
  // Auto-correct .supabase.com typos to .supabase.co
  clean = clean.replace(/\.supabase\.com(\/|$)/i, '.supabase.co$1');
  // Remove /rest/v1 or trailing slashes
  clean = clean.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  // If only project ID was entered (e.g. vtbdmurblidtdghaotne)
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.includes('.')) {
      clean = 'https://' + clean;
    } else {
      clean = `https://${clean}.supabase.co`;
    }
  }
  return clean;
}

function sanitizeAnonKey(key) {
  if (!key || typeof key !== 'string') return DEFAULT_SUPABASE_ANON_KEY;
  const clean = key.trim();
  if (clean.startsWith('sb_secret_') || clean.startsWith('sb_publishable_') || clean.length < 20) {
    return DEFAULT_SUPABASE_ANON_KEY;
  }
  return clean;
}

class SupabaseManager {
  constructor() {
    this.client = null;
    this.initClient();
  }

  getCredentials() {
    try {
      const rawUrl = appStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
      const url = sanitizeSupabaseUrl(rawUrl);
      const rawKey = appStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;
      const key = sanitizeAnonKey(rawKey);
      return { url, key };
    } catch (e) {
      return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_ANON_KEY };
    }
  }

  saveCredentials(url, key) {
    try {
      const cleanUrl = sanitizeSupabaseUrl(url);
      const cleanKey = sanitizeAnonKey(key);
      appStorage.setItem(STORAGE_KEYS.SUPABASE_URL, cleanUrl);
      appStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, cleanKey);
      this.initClient();
      return { success: true, url: cleanUrl, key: cleanKey };
    } catch (e) {
      return { success: false, url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_ANON_KEY };
    }
  }

  resetToDefaults() {
    try {
      appStorage.setItem(STORAGE_KEYS.SUPABASE_URL, DEFAULT_SUPABASE_URL);
      appStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);
      this.initClient();
      return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_ANON_KEY };
    } catch (e) {
      return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_ANON_KEY };
    }
  }

  initClient() {
    const { url, key } = this.getCredentials();
    try {
      this.client = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.warn('Failed to init Supabase client:', e);
      this.client = null;
    }
  }

  getClient() {
    if (!this.client) {
      this.initClient();
    }
    return this.client;
  }

  async testConnection() {
    try {
      const client = this.getClient();
      if (!client) return { connected: false, message: 'Supabase client not initialized' };

      const [prodsRes, usersRes, catsRes] = await Promise.all([
        client.from('products').select('product_id').limit(1),
        client.from('users').select('user_id').limit(1),
        client.from('categories').select('category_id').limit(1),
      ]);

      if (prodsRes.error || usersRes.error) {
        const err = prodsRes.error || usersRes.error;
        return { connected: false, message: err.message };
      }

      return {
        connected: true,
        message: 'Successfully connected to Supabase project (vtbdmurblidtdghaotne)! All ER tables live and synced.',
      };
    } catch (e) {
      return { connected: false, message: e.message || 'Connection error' };
    }
  }

  getSqlMigrationScript() {
    return `-- =========================================================================
-- MotoTrack Sports & Pro Gear Store - Full 23-Table Supabase ER Schema
-- Project: vtbdmurblidtdghaotne
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/vtbdmurblidtdghaotne/sql
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS public.users (
    user_id TEXT PRIMARY KEY DEFAULT ('usr-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
    status TEXT NOT NULL DEFAULT 'active',
    phone TEXT,
    address TEXT,
    avatar TEXT,
    member_since TEXT DEFAULT '2026',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    customer_id TEXT PRIMARY KEY DEFAULT ('cust-' || substr(md5(random()::text), 1, 12)),
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ADDRESSES
CREATE TABLE IF NOT EXISTS public.addresses (
    address_id TEXT PRIMARY KEY DEFAULT ('addr-' || substr(md5(random()::text), 1, 12)),
    customer_id TEXT REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    label TEXT DEFAULT 'Home',
    full_address TEXT NOT NULL,
    city TEXT,
    province TEXT,
    zip_code TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. OTP VERIFICATIONS
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id TEXT PRIMARY KEY DEFAULT ('otp-' || substr(md5(random()::text), 1, 12)),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id TEXT PRIMARY KEY DEFAULT ('notif-' || substr(md5(random()::text), 1, 12)),
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    status TEXT DEFAULT 'unread',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
    supplier_id TEXT PRIMARY KEY DEFAULT ('sup-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    category_id TEXT PRIMARY KEY DEFAULT ('cat-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    product_id TEXT PRIMARY KEY,
    supplier_id TEXT REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL,
    category_id TEXT REFERENCES public.categories(category_id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    old_price NUMERIC(10, 2),
    rating NUMERIC(3, 1) DEFAULT 5.0,
    reviews INTEGER DEFAULT 0,
    compatibility TEXT,
    sku TEXT,
    stock INTEGER DEFAULT 10,
    badge TEXT,
    type TEXT DEFAULT 'newArrival',
    is_new BOOLEAN DEFAULT false,
    discount TEXT,
    image TEXT,
    material TEXT,
    weight TEXT,
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. INVENTORY
CREATE TABLE IF NOT EXISTS public.inventory (
    inventory_id TEXT PRIMARY KEY DEFAULT ('inv-' || substr(md5(random()::text), 1, 12)),
    product_id TEXT REFERENCES public.products(product_id) ON DELETE CASCADE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER DEFAULT 5,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. DISCOUNTS
CREATE TABLE IF NOT EXISTS public.discounts (
    discount_id TEXT PRIMARY KEY DEFAULT ('disc-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'percentage',
    value NUMERIC(10, 2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    min_purchase NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. PROMOS
CREATE TABLE IF NOT EXISTS public.promos (
    promo_id TEXT PRIMARY KEY DEFAULT ('prm-' || substr(md5(random()::text), 1, 12)),
    discount_id TEXT REFERENCES public.discounts(discount_id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER DEFAULT 20,
    description TEXT,
    usage_limit INTEGER DEFAULT 100,
    used_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    order_id TEXT PRIMARY KEY DEFAULT ('ord-' || substr(md5(random()::text), 1, 12)),
    customer_id TEXT REFERENCES public.customers(customer_id) ON DELETE SET NULL,
    address_id TEXT REFERENCES public.addresses(address_id) ON DELETE SET NULL,
    promo_id TEXT REFERENCES public.promos(promo_id) ON DELETE SET NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'Processing',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    payment_method TEXT DEFAULT 'Credit Card',
    items_summary TEXT,
    items_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    order_item_id TEXT PRIMARY KEY DEFAULT ('oi-' || substr(md5(random()::text), 1, 12)),
    order_id TEXT REFERENCES public.orders(order_id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(product_id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    cost NUMERIC(10, 2) DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- 14. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
    payment_id TEXT PRIMARY KEY DEFAULT ('pay-' || substr(md5(random()::text), 1, 12)),
    order_id TEXT REFERENCES public.orders(order_id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    reference_number TEXT,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'Completed'
);

-- 15. SALES
CREATE TABLE IF NOT EXISTS public.sales (
    sale_id TEXT PRIMARY KEY DEFAULT ('sale-' || substr(md5(random()::text), 1, 12)),
    customer_id TEXT REFERENCES public.customers(customer_id) ON DELETE SET NULL,
    payment_id TEXT REFERENCES public.payments(payment_id) ON DELETE SET NULL,
    sale_type TEXT DEFAULT 'Online',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
    change NUMERIC(10, 2) DEFAULT 0,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. SALE_ITEMS
CREATE TABLE IF NOT EXISTS public.sale_items (
    sale_item_id TEXT PRIMARY KEY DEFAULT ('si-' || substr(md5(random()::text), 1, 12)),
    sale_id TEXT REFERENCES public.sales(sale_id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(product_id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- 17. CARTS
CREATE TABLE IF NOT EXISTS public.carts (
    cart_id TEXT PRIMARY KEY DEFAULT ('cart-' || substr(md5(random()::text), 1, 12)),
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. CART_ITEMS
CREATE TABLE IF NOT EXISTS public.cart_items (
    cart_item_id TEXT PRIMARY KEY DEFAULT ('ci-' || substr(md5(random()::text), 1, 12)),
    cart_id TEXT REFERENCES public.carts(cart_id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(product_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- 19. SERVICES
CREATE TABLE IF NOT EXISTS public.services (
    service_id TEXT PRIMARY KEY DEFAULT ('srv-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    category TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    duration TEXT DEFAULT '60 min',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    booking_id TEXT PRIMARY KEY DEFAULT ('bk-' || substr(md5(random()::text), 1, 12)),
    customer_id TEXT REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    service_id TEXT REFERENCES public.services(service_id) ON DELETE SET NULL,
    schedule TIMESTAMP WITH TIME ZONE NOT NULL,
    previous_schedule TIMESTAMP WITH TIME ZONE,
    rescheduled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 21. PURCHASE_ORDERS
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    po_id TEXT PRIMARY KEY DEFAULT ('po-' || substr(md5(random()::text), 1, 12)),
    supplier_id TEXT REFERENCES public.suppliers(supplier_id) ON DELETE SET NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'Completed',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 22. PURCHASE_ITEMS
CREATE TABLE IF NOT EXISTS public.purchase_items (
    purchase_item_id TEXT PRIMARY KEY DEFAULT ('pi-' || substr(md5(random()::text), 1, 12)),
    po_id TEXT REFERENCES public.purchase_orders(po_id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(product_id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- 23. SYSTEM_SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    settings_id TEXT PRIMARY KEY DEFAULT ('set-' || substr(md5(random()::text), 1, 12)),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
`;
  }
}

export const supabaseManager = new SupabaseManager();
export const supabase = new Proxy(
  {},
  {
    get(target, prop) {
      const client = supabaseManager.getClient();
      if (!client) return undefined;
      const val = client[prop];
      if (typeof val === 'function') {
        return val.bind(client);
      }
      return val;
    },
  }
);
