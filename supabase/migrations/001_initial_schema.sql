-- =========================================================================
-- MotoTrack Sports & Pro Gear Store - 24-Table Supabase ER Schema
-- Run this in your Supabase SQL Editor:
--   https://supabase.com/dashboard/project/<your-project>/sql
--
-- SECURITY NOTE
--   * Passwords must NEVER be stored as plaintext. The app writes hashed
--     values in the format `sha256$<64-hex>`. Any legacy plaintext rows are
--     automatically upgraded to hashes on the user's next successful sign-in.
--   * The RLS policies below intentionally mirror the current client-side
--     behaviour (the anon key may read/write common tables). Tighten these
--     before production: restrict writes to `auth.role() = 'authenticated'`
--     and gate admin operations through a dedicated service-role token.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS (password column holds a `sha256$...` hash, NEVER plaintext)
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
    subtitle TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_php NUMERIC(10, 2),
    duration TEXT DEFAULT '60 min',
    badge TEXT,
    image TEXT,
    description TEXT,
    inclusions JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    booking_id TEXT PRIMARY KEY DEFAULT ('bk-' || substr(md5(random()::text), 1, 12)),
    customer_id TEXT REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    service_id TEXT REFERENCES public.services(service_id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    bike_brand TEXT,
    bike_model TEXT,
    plate_number TEXT,
    odometer TEXT,
    service_title TEXT,
    service_price NUMERIC(10, 2) DEFAULT 0,
    price_php NUMERIC(10, 2),
    branch TEXT,
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

-- 24. ADMIN_PINS (SEPARATE SECURE PIN TABLE WITH USER_ID FOREIGN KEY)
CREATE TABLE IF NOT EXISTS public.admin_pins (
    pin_id TEXT PRIMARY KEY DEFAULT ('pin-' || substr(md5(random()::text), 1, 12)),
    user_id TEXT UNIQUE NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- NOTE: These default to "permissive for everyone" to keep the current
-- client-driven app working. Harden them before any production deployment
-- (see the comment at the top of this file).

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_users" ON public.users;
CREATE POLICY "allow_anon_read_users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_users" ON public.users;
CREATE POLICY "allow_anon_write_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_read_customers" ON public.customers;
CREATE POLICY "allow_anon_read_customers" ON public.customers FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_customers" ON public.customers;
CREATE POLICY "allow_anon_write_customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_read_addresses" ON public.addresses;
CREATE POLICY "allow_anon_read_addresses" ON public.addresses FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_addresses" ON public.addresses;
CREATE POLICY "allow_anon_write_addresses" ON public.addresses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_read_products" ON public.products;
CREATE POLICY "allow_anon_read_products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_read_categories" ON public.categories;
CREATE POLICY "allow_anon_read_categories" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_read_services" ON public.services;
CREATE POLICY "allow_anon_read_services" ON public.services FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_read_bookings" ON public.bookings;
CREATE POLICY "allow_anon_read_bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_read_orders" ON public.orders;
CREATE POLICY "allow_anon_read_orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_read_order_items" ON public.order_items;
CREATE POLICY "allow_anon_read_order_items" ON public.order_items FOR SELECT USING (true);

-- ─── SEED: BOOTSTRAP ADMIN (password below is the hash of "admin123") ────────
INSERT INTO public.users (user_id, name, email, password, role, status, phone, address, avatar, member_since)
SELECT
    'usr-admin-01',
    'Store Administrator',
    'admin@mototrack.com',
    'sha256$6b376d8c7fbb66b46d2330c92bfd5cef79265d5e6d464da86e3eb1f0d36dffa0',
    'admin',
    'active',
    '(+63) 917 999 0001',
    'MotoTrack HQ, 100 Superbike Blvd, Bonifacio Global City, Taguig, Metro Manila 1634',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    '2024'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@mototrack.com');

INSERT INTO public.admin_pins (user_id, pin)
SELECT 'usr-admin-01', '2026'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_pins WHERE user_id = 'usr-admin-01');