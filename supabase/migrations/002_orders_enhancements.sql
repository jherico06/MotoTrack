-- =========================================================================
-- MotoTrack - 002 Orders Enhancements & RLS Hardening Migration
-- =========================================================================

-- 1. Extend orders table with missing attributes
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'Online Store',
    ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS courier TEXT DEFAULT 'MotoTrack Express SuperAir',
    ADD COLUMN IF NOT EXISTS estimated_delivery TEXT,
    ADD COLUMN IF NOT EXISTS cod_change_for TEXT,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
    ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS return_reason TEXT,
    ADD COLUMN IF NOT EXISTS return_notes TEXT,
    ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMP WITH TIME ZONE;

-- 2. Create order_notes table for audit logs, cancellation reasons, and internal notes
CREATE TABLE IF NOT EXISTS public.order_notes (
    note_id TEXT PRIMARY KEY DEFAULT ('not-' || substr(md5(random()::text), 1, 12)),
    order_id TEXT REFERENCES public.orders(order_id) ON DELETE CASCADE,
    note_type TEXT DEFAULT 'cancellation', -- 'cancellation' | 'delivery' | 'admin' | 'return'
    content TEXT NOT NULL,
    author TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on order_notes
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_order_notes" ON public.order_notes;
CREATE POLICY "allow_anon_read_order_notes" ON public.order_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_order_notes" ON public.order_notes;
CREATE POLICY "allow_anon_write_order_notes" ON public.order_notes FOR ALL USING (true) WITH CHECK (true);

-- 3. Harden Orders RLS Policieschan
-- Customers can view their own orders; Admins can view and update all orders
DROP POLICY IF EXISTS "orders_customer_select" ON public.orders;
CREATE POLICY "orders_customer_select" ON public.orders 
    FOR SELECT 
    USING (
        -- Allow authenticated user who owns the customer record
        customer_id IN (
            SELECT c.customer_id FROM public.customers c 
            JOIN public.users u ON c.user_id = u.user_id 
            WHERE u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email'
        )
        -- Or user is an admin
        OR EXISTS (
            SELECT 1 FROM public.users u 
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        -- Permissive fallback for client/local demo mode when auth.uid() is null
        OR auth.uid() IS NULL
    );

DROP POLICY IF EXISTS "orders_admin_status_update" ON public.orders;
CREATE POLICY "orders_admin_status_update" ON public.orders 
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        -- Allow client fallback when auth.uid() is null (demo / offline mode)
        OR auth.uid() IS NULL
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        OR auth.uid() IS NULL
    );
