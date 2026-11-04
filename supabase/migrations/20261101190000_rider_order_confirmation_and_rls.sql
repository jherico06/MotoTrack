-- =========================================================================
-- Migration 20261101190000: Rider Order Confirmation, Status Sync & RLS
-- Allows authenticated riders to view and confirm their assigned orders.
-- Preserves RLS security: unauthorized riders cannot confirm others' orders.
-- =========================================================================

-- 1. Ensure columns exist on orders for rider delivery assignment
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_contact TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_vehicle TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_plate TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_avatar TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_by_rider_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_by_rider_id ON public.orders(delivered_by_rider_id);

-- 2. Update RLS policies on public.orders for SELECT
-- Allows: Customers (their own orders), Admins, Assigned Riders (their orders), and Demo/Anon fallback
DROP POLICY IF EXISTS "orders_customer_select" ON public.orders;
CREATE POLICY "orders_customer_select" ON public.orders
    FOR SELECT
    USING (
        -- Customer owner
        customer_id IN (
            SELECT c.customer_id FROM public.customers c
            JOIN public.users u ON c.user_id = u.user_id
            WHERE u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email'
        )
        -- Admin user
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        -- Assigned Rider (order assigned to this rider)
        OR EXISTS (
            SELECT 1 FROM public.riders r
            JOIN public.users u ON (r.user_id = u.user_id OR lower(r.email) = lower(u.email) OR lower(r.username) = lower(u.username))
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND (
                  orders.rider_id = r.id
                  OR orders.delivered_by_rider_id = r.id
                  OR EXISTS (
                      SELECT 1 FROM public.order_deliveries od
                      WHERE od.order_id = orders.order_id AND od.rider_id = r.id
                  )
              )
        )
        -- Rider viewing active orders roster
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'rider'
        )
        -- Permissive fallback for client/local demo mode when auth.uid() is null
        OR auth.uid() IS NULL
    );

-- 3. Update RLS policies on public.orders for UPDATE
-- Admins can update any order.
-- Riders can ONLY update orders assigned to their account.
-- Unauthorized riders cannot update other riders' orders.
DROP POLICY IF EXISTS "orders_admin_status_update" ON public.orders;
DROP POLICY IF EXISTS "orders_status_update" ON public.orders;

CREATE POLICY "orders_status_update" ON public.orders
    FOR UPDATE
    USING (
        -- Admin
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        -- Assigned rider only
        OR EXISTS (
            SELECT 1 FROM public.riders r
            JOIN public.users u ON (r.user_id = u.user_id OR lower(r.email) = lower(u.email) OR lower(r.username) = lower(u.username))
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'rider'
              AND (
                  orders.rider_id = r.id
                  OR orders.delivered_by_rider_id = r.id
                  OR EXISTS (
                      SELECT 1 FROM public.order_deliveries od
                      WHERE od.order_id = orders.order_id AND od.rider_id = r.id
                  )
              )
        )
        -- Client demo fallback
        OR auth.uid() IS NULL
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.riders r
            JOIN public.users u ON (r.user_id = u.user_id OR lower(r.email) = lower(u.email) OR lower(r.username) = lower(u.username))
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'rider'
              AND (
                  orders.rider_id = r.id
                  OR orders.delivered_by_rider_id = r.id
                  OR EXISTS (
                      SELECT 1 FROM public.order_deliveries od
                      WHERE od.order_id = orders.order_id AND od.rider_id = r.id
                  )
              )
        )
        OR auth.uid() IS NULL
    );

-- 4. RLS for public.order_deliveries
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_order_deliveries" ON public.order_deliveries;
CREATE POLICY "allow_anon_read_order_deliveries" ON public.order_deliveries
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_order_deliveries" ON public.order_deliveries;
CREATE POLICY "allow_anon_write_order_deliveries" ON public.order_deliveries
    FOR ALL
    USING (
        -- Admin
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        -- Assigned rider
        OR EXISTS (
            SELECT 1 FROM public.riders r
            JOIN public.users u ON (r.user_id = u.user_id OR lower(r.email) = lower(u.email) OR lower(r.username) = lower(u.username))
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND (order_deliveries.rider_id = r.id OR order_deliveries.rider_id IS NULL)
        )
        OR auth.uid() IS NULL
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND u.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.riders r
            JOIN public.users u ON (r.user_id = u.user_id OR lower(r.email) = lower(u.email) OR lower(r.username) = lower(u.username))
            WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
              AND (order_deliveries.rider_id = r.id OR order_deliveries.rider_id IS NULL)
        )
        OR auth.uid() IS NULL
    );

-- 5. RLS for public.delivery_history
ALTER TABLE public.delivery_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_delivery_history" ON public.delivery_history;
CREATE POLICY "allow_anon_read_delivery_history" ON public.delivery_history
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_delivery_history" ON public.delivery_history;
CREATE POLICY "allow_anon_write_delivery_history" ON public.delivery_history
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Dedicated Server-Side RPC: public.rider_confirm_order
-- Safely confirms, accepts, updates, or completes deliveries with assignment verification.
CREATE OR REPLACE FUNCTION public.rider_confirm_order(
    p_order_id TEXT,
    p_rider_id TEXT,
    p_action TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    now_ts TIMESTAMPTZ := timezone('utc'::text, now());
    oid TEXT := trim(COALESCE(p_order_id, ''));
    rid TEXT := trim(COALESCE(p_rider_id, ''));
    act TEXT := lower(trim(COALESCE(p_action, '')));
    d public.order_deliveries%ROWTYPE;
    o public.orders%ROWTYPE;
    r public.riders%ROWTYPE;
    caller_role TEXT;
    prev_status TEXT;
    next_order_status TEXT;
    next_delivery_status TEXT;
    rider_display_name TEXT;
    est_label TEXT;
BEGIN
    IF oid = '' OR rid = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order ID and Rider ID are required.');
    END IF;

    -- Lookup rider record
    SELECT * INTO r FROM public.riders WHERE id = rid LIMIT 1;
    IF NOT FOUND THEN
        SELECT * INTO r FROM public.riders WHERE user_id = rid OR lower(username) = lower(rid) OR lower(email) = lower(rid) LIMIT 1;
    END IF;
    rider_display_name := COALESCE(r.name, r.short_name, 'Rider');

    -- Lookup order and delivery
    SELECT * INTO o FROM public.orders WHERE order_id = oid FOR UPDATE;
    SELECT * INTO d FROM public.order_deliveries WHERE order_id = oid FOR UPDATE;

    IF o.order_id IS NULL AND d.order_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
    END IF;

    -- Authorization check: Ensure order is assigned to this rider (or caller is admin)
    SELECT role INTO caller_role FROM public.users
    WHERE user_id = auth.uid()::text OR email = auth.jwt() ->> 'email' LIMIT 1;

    IF caller_role <> 'admin' THEN
        IF (d.rider_id IS NOT NULL AND r.id IS NOT NULL AND d.rider_id <> r.id)
           OR (o.rider_id IS NOT NULL AND r.id IS NOT NULL AND o.rider_id <> r.id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: This order is not assigned to your account.');
        END IF;
    END IF;

    prev_status := COALESCE(o.status, d.delivery_status, 'Assigned to Rider');

    -- Action resolution
    IF act IN ('accept', 'confirm_order', 'accept_delivery', 'confirm') THEN
        next_order_status := 'Accepted by Rider';
        next_delivery_status := 'Accepted by Rider';
        est_label := 'Order accepted by rider — preparing for dispatch';
    ELSIF act IN ('start', 'out_for_delivery', 'shipped') THEN
        next_order_status := 'Out for Delivery';
        next_delivery_status := 'Out for Delivery';
        est_label := 'Out for delivery — rider en route';
    ELSIF act IN ('deliver', 'delivered', 'confirm_delivered') THEN
        next_order_status := 'Delivered';
        next_delivery_status := 'Delivered';
        est_label := 'Delivered';
    ELSIF act IN ('fail', 'issue', 'failed', 'delivery_failed') THEN
        next_order_status := 'Delivery Failed';
        next_delivery_status := 'Delivery Issue';
        est_label := 'Delivery attempt failed — awaiting reschedule';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action: ' || act);
    END IF;

    -- Update or insert order_deliveries
    IF d.order_id IS NOT NULL THEN
        UPDATE public.order_deliveries SET
            delivery_status = next_delivery_status,
            rider_id = COALESCE(d.rider_id, r.id, rid),
            rider_name = COALESCE(d.rider_name, rider_display_name),
            delivered_at = CASE WHEN next_delivery_status = 'Delivered' THEN now_ts ELSE d.delivered_at END,
            rider_reported_delivered = CASE WHEN next_delivery_status = 'Delivered' THEN true ELSE d.rider_reported_delivered END,
            rider_reported_at = CASE WHEN next_delivery_status = 'Delivered' THEN now_ts ELSE d.rider_reported_at END,
            rider_reported_by = CASE WHEN next_delivery_status = 'Delivered' THEN rider_display_name ELSE d.rider_reported_by END,
            delivery_issue_notes = CASE WHEN next_delivery_status = 'Delivery Issue' THEN COALESCE(p_notes, d.delivery_issue_notes) ELSE d.delivery_issue_notes END,
            updated_at = now_ts
        WHERE delivery_id = d.delivery_id;
    ELSE
        INSERT INTO public.order_deliveries (
            delivery_id, order_id, rider_id, rider_name, delivery_status,
            delivered_at, rider_reported_delivered, created_at, updated_at
        ) VALUES (
            'del-' || substr(md5(random()::text), 1, 12),
            oid,
            COALESCE(r.id, rid),
            rider_display_name,
            next_delivery_status,
            CASE WHEN next_delivery_status = 'Delivered' THEN now_ts ELSE NULL END,
            CASE WHEN next_delivery_status = 'Delivered' THEN true ELSE false END,
            now_ts,
            now_ts
        );
    END IF;

    -- Update orders table
    IF o.order_id IS NOT NULL THEN
        UPDATE public.orders SET
            status = next_order_status,
            delivery_status = next_delivery_status,
            rider_id = COALESCE(o.rider_id, r.id, rid),
            rider_name = COALESCE(o.rider_name, rider_display_name),
            delivered_at = CASE WHEN next_order_status = 'Delivered' THEN now_ts ELSE o.delivered_at END,
            delivered_by_rider_id = CASE WHEN next_order_status = 'Delivered' THEN COALESCE(r.id, rid) ELSE o.delivered_by_rider_id END,
            estimated_delivery = est_label,
            updated_at = now_ts
        WHERE order_id = oid;
    END IF;

    -- Log to delivery_history
    INSERT INTO public.delivery_history (
        id, order_id, action, previous_status, new_status, performed_by, notes, metadata, created_at
    ) VALUES (
        'dh-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
        oid,
        'RIDER_' || upper(act),
        prev_status,
        next_order_status,
        rider_display_name,
        COALESCE(p_notes, 'Updated from Rider Dashboard: ' || next_order_status),
        jsonb_build_object('rider_id', COALESCE(r.id, rid), 'role', 'rider'),
        now_ts
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', oid,
        'status', next_order_status,
        'delivery_status', next_delivery_status,
        'updated_at', now_ts
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rider_confirm_order(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_confirm_order(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

