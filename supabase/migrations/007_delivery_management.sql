-- =========================================================================
-- MotoTrack - 007 Delivery Management & Proof of Delivery
-- Rider is delivery metadata only — no rider user accounts.
-- =========================================================================

-- 1. Denormalized fields on orders for admin list performance
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS rider_name TEXT,
    ADD COLUMN IF NOT EXISTS delivery_status TEXT,
    ADD COLUMN IF NOT EXISTS customer_delivery_confirmed BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS customer_delivery_confirmed_at TIMESTAMP WITH TIME ZONE;

-- 2. Order deliveries (1:1 with orders)
CREATE TABLE IF NOT EXISTS public.order_deliveries (
    delivery_id TEXT PRIMARY KEY DEFAULT ('del-' || substr(md5(random()::text), 1, 12)),
    order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(order_id) ON DELETE CASCADE,
    rider_name TEXT,
    rider_contact TEXT,
    vehicle_info TEXT,
    delivery_notes TEXT,
    delivery_status TEXT DEFAULT 'Ready for Delivery',
    expected_delivery_at TIMESTAMP WITH TIME ZONE,
    otp_hash TEXT,
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_verified BOOLEAN DEFAULT false,
    otp_verified_at TIMESTAMP WITH TIME ZONE,
    customer_confirmed BOOLEAN DEFAULT false,
    customer_confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by_customer_id TEXT,
    proof_of_delivery TEXT,
    proof_uploaded_by TEXT,
    proof_uploaded_at TIMESTAMP WITH TIME ZONE,
    assigned_by TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_order_id ON public.order_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_status ON public.order_deliveries(delivery_status);

-- 3. Delivery history / audit trail
CREATE TABLE IF NOT EXISTS public.delivery_history (
    id TEXT PRIMARY KEY DEFAULT ('dh-' || substr(md5(random()::text), 1, 12)),
    order_id TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    performed_by TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_history_order_id ON public.delivery_history(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_history_created_at ON public.delivery_history(created_at);

-- 4. RLS (permissive demo pattern consistent with 002)
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_order_deliveries" ON public.order_deliveries;
CREATE POLICY "allow_anon_read_order_deliveries" ON public.order_deliveries FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_order_deliveries" ON public.order_deliveries;
CREATE POLICY "allow_anon_write_order_deliveries" ON public.order_deliveries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_read_delivery_history" ON public.delivery_history;
CREATE POLICY "allow_anon_read_delivery_history" ON public.delivery_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_delivery_history" ON public.delivery_history;
CREATE POLICY "allow_anon_write_delivery_history" ON public.delivery_history FOR ALL USING (true) WITH CHECK (true);
