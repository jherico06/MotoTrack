-- =========================================================================
-- Migration 008: Delivery Riders Staff Roster
-- Admin-managed rider directory (no rider login). Linked to order_deliveries.
-- =========================================================================

-- 1. Create public.riders table
CREATE TABLE IF NOT EXISTS public.riders (
    id TEXT PRIMARY KEY DEFAULT ('rider-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    short_name TEXT,
    phone TEXT,
    vehicle_info TEXT DEFAULT '',
    plate_number TEXT DEFAULT '',
    avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    status TEXT NOT NULL DEFAULT 'Available',
    rating NUMERIC(3, 1) DEFAULT 5.0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_riders_status ON public.riders(status);
CREATE INDEX IF NOT EXISTS idx_riders_name ON public.riders(name);

-- 2. Link rider_id on order_deliveries and orders
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'order_deliveries'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'order_deliveries' AND column_name = 'rider_id'
        ) THEN
            ALTER TABLE public.order_deliveries ADD COLUMN rider_id TEXT;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'order_deliveries' AND column_name = 'rider_plate'
        ) THEN
            ALTER TABLE public.order_deliveries ADD COLUMN rider_plate TEXT;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'order_deliveries' AND column_name = 'rider_avatar'
        ) THEN
            ALTER TABLE public.order_deliveries ADD COLUMN rider_avatar TEXT;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rider_id'
        ) THEN
            ALTER TABLE public.orders ADD COLUMN rider_id TEXT;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rider_contact'
        ) THEN
            ALTER TABLE public.orders ADD COLUMN rider_contact TEXT;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rider_vehicle'
        ) THEN
            ALTER TABLE public.orders ADD COLUMN rider_vehicle TEXT;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rider_plate'
        ) THEN
            ALTER TABLE public.orders ADD COLUMN rider_plate TEXT;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rider_avatar'
        ) THEN
            ALTER TABLE public.orders ADD COLUMN rider_avatar TEXT;
        END IF;
    END IF;
END $$;

-- Indexes only if dependent tables exist (007 may not be applied yet)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'order_deliveries'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_order_deliveries_rider_id ON public.order_deliveries(rider_id);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
    END IF;
END $$;

-- 3. RLS (permissive demo pattern consistent with mechanics)
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_riders" ON public.riders;
CREATE POLICY "allow_anon_read_riders" ON public.riders
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "allow_anon_write_riders" ON public.riders;
CREATE POLICY "allow_anon_write_riders" ON public.riders
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_riders_updated_at ON public.riders;
CREATE TRIGGER trg_riders_updated_at
    BEFORE UPDATE ON public.riders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'riders'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.riders;
        END IF;
    END IF;
END $$;

-- 6. Seed default delivery riders
INSERT INTO public.riders (id, name, short_name, phone, vehicle_info, plate_number, avatar, status, rating)
VALUES
(
    'rider-juan',
    'Juan Dela Cruz',
    'Juan',
    '09171234567',
    'Yamaha NMAX 155',
    'NMX-1001',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    'Available',
    4.9
),
(
    'rider-maria',
    'Maria Santos',
    'Maria',
    '09181234567',
    'Honda Click 160',
    'HND-2044',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    'Available',
    4.8
),
(
    'rider-carlo',
    'Carlo Reyes',
    'Carlo',
    '09191234567',
    'Kawasaki Rouser 200',
    'KAW-3310',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    'Available',
    5.0
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.riders IS 'Admin-managed delivery rider staff roster (no rider login)';
COMMENT ON COLUMN public.riders.status IS 'Available | On Delivery | Off Duty';
