-- =========================================================================
-- Migration 004: Customer Motorcycles ("My Garage")
-- Enables registered riders to manage multiple motorcycles in their garage,
-- record specifications, track odometer mileage, and select bikes for pit bookings.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.customer_motorcycles (
    motorcycle_id TEXT PRIMARY KEY DEFAULT ('moto-' || substr(md5(random()::text), 1, 12)),
    user_id TEXT,
    customer_id TEXT,
    customer_email TEXT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    plate_number TEXT NOT NULL,
    engine_cc INTEGER,
    color TEXT,
    odometer TEXT,
    vin_number TEXT,
    nickname TEXT,
    photo_url TEXT,
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add customer_email if table already existed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'customer_motorcycles' 
        AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE public.customer_motorcycles ADD COLUMN customer_email TEXT;
    END IF;
END $$;

-- Drop foreign key constraints if they were previously created (prevents insert failures if user/customer is not yet seeded)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_motorcycles_user_id_fkey' 
        AND table_name = 'customer_motorcycles'
    ) THEN
        ALTER TABLE public.customer_motorcycles DROP CONSTRAINT customer_motorcycles_user_id_fkey;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_motorcycles_customer_id_fkey' 
        AND table_name = 'customer_motorcycles'
    ) THEN
        ALTER TABLE public.customer_motorcycles DROP CONSTRAINT customer_motorcycles_customer_id_fkey;
    END IF;
END $$;

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_motorcycles_user_id ON public.customer_motorcycles(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_motorcycles_customer_id ON public.customer_motorcycles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_motorcycles_customer_email ON public.customer_motorcycles(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_motorcycles_plate ON public.customer_motorcycles(plate_number);
CREATE INDEX IF NOT EXISTS idx_customer_motorcycles_is_primary ON public.customer_motorcycles(is_primary);

-- Row Level Security (RLS)
ALTER TABLE public.customer_motorcycles ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated users to SELECT
DROP POLICY IF EXISTS "allow_anon_read_motorcycles" ON public.customer_motorcycles;
CREATE POLICY "allow_anon_read_motorcycles" ON public.customer_motorcycles
    FOR SELECT
    USING (true);

-- Allow anon & authenticated users to INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "allow_anon_write_motorcycles" ON public.customer_motorcycles;
CREATE POLICY "allow_anon_write_motorcycles" ON public.customer_motorcycles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_motorcycles_updated_at ON public.customer_motorcycles;
CREATE TRIGGER trg_customer_motorcycles_updated_at
    BEFORE UPDATE ON public.customer_motorcycles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Comment on table and columns
COMMENT ON TABLE public.customer_motorcycles IS 'Registered customer motorcycles in "My Garage" fleet';
COMMENT ON COLUMN public.customer_motorcycles.motorcycle_id IS 'Unique identifier for the motorcycle';
COMMENT ON COLUMN public.customer_motorcycles.is_primary IS 'Whether this motorcycle is the customer default ride';
