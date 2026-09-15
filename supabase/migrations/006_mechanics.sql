-- =========================================================================
-- Migration 006: Mechanics & Pit Technicians Schema & Realtime
-- Enables full storage and management of certified mechanics and pit bay
-- technicians in Supabase, linked to garage bookings and roster availability.
-- =========================================================================

-- 1. Create public.mechanics table
CREATE TABLE IF NOT EXISTS public.mechanics (
    id TEXT PRIMARY KEY DEFAULT ('tech-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    short_name TEXT,
    specialization TEXT DEFAULT 'Engine Overhaul & Diagnostics',
    experience TEXT DEFAULT '5 Years Pro Tech',
    certifications TEXT DEFAULT 'Certified Motorcycle Technician',
    avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    bay TEXT DEFAULT 'Bay 1 (Master Diagnostic Cell)',
    status TEXT NOT NULL DEFAULT 'Available',
    phone TEXT,
    email TEXT,
    rating NUMERIC(3, 1) DEFAULT 5.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Safely add mechanic columns to public.bookings if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings' 
        AND column_name = 'mechanic'
    ) THEN
        ALTER TABLE public.bookings ADD COLUMN mechanic TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings' 
        AND column_name = 'mechanic_id'
    ) THEN
        ALTER TABLE public.bookings ADD COLUMN mechanic_id TEXT;
    END IF;
END $$;

-- 3. Indexes for fast roster lookups and filtering
CREATE INDEX IF NOT EXISTS idx_mechanics_status ON public.mechanics(status);
CREATE INDEX IF NOT EXISTS idx_mechanics_bay ON public.mechanics(bay);
CREATE INDEX IF NOT EXISTS idx_mechanics_name ON public.mechanics(name);

-- 4. Row Level Security (RLS)
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to read mechanics roster
DROP POLICY IF EXISTS "allow_anon_read_mechanics" ON public.mechanics;
CREATE POLICY "allow_anon_read_mechanics" ON public.mechanics
    FOR SELECT
    USING (true);

-- Allow anonymous and authenticated users to insert, update, and delete mechanics
DROP POLICY IF EXISTS "allow_anon_write_mechanics" ON public.mechanics;
CREATE POLICY "allow_anon_write_mechanics" ON public.mechanics
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Trigger for automated updated_at timestamp management
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mechanics_updated_at ON public.mechanics;
CREATE TRIGGER trg_mechanics_updated_at
    BEFORE UPDATE ON public.mechanics
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Add to Realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'mechanics'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.mechanics;
        END IF;
    END IF;
END $$;

-- 7. Seed initial default certified pit technicians
INSERT INTO public.mechanics (id, name, short_name, specialization, experience, certifications, avatar, bay, status)
VALUES
(
    'tech-jayson',
    'Master Tech Jayson (Yamaha & Honda Certified)',
    'Master Tech Jayson',
    'Engine Overhaul & Diagnostics',
    '9 Years Pro Tech',
    'Yamaha YTA Gold • Honda Master',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    'Bay 1 (Master Diagnostic Cell)',
    'Available'
),
(
    'tech-mark',
    'Senior Dyno Tech Mark',
    'Senior Tech Mark',
    'ECU Dyno & Fuel Mapping',
    '7 Years Dyno Tuner',
    'Dynojet Certified • Akrapovič Tech',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    'Bay 2 (Dynojet 250i Cell)',
    'Available'
),
(
    'tech-alvin',
    'Tech Alvin (Suspension Specialist)',
    'Tech Alvin',
    'Öhlins & WP Suspension Geometry',
    '6 Years Track Suspension',
    'Öhlins Certified Service Center',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    'Bay 3 (Suspension & Alignment Bay)',
    'Available'
),
(
    'tech-christian',
    'Tech Christian (Brembo Brake Specialist)',
    'Tech Christian',
    'Hydraulics & Calipers',
    '5 Years Hydraulic Specialist',
    'Brembo Track System Certified',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
    'Bay 4 (Brake & Chassis Bay)',
    'Available'
),
(
    'tech-general',
    'MotoTrack Assigned Specialist',
    'Tech Noel & Team',
    'PMS & General Maintenance',
    '4 Years Fast-Turnaround PMS',
    'Liqui-Moly / Motul Certified Hub',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
    'Bay 5 (Express PMS Bay)',
    'Available'
)
ON CONFLICT (id) DO NOTHING;

-- Comments on table and columns
COMMENT ON TABLE public.mechanics IS 'Certified mechanics and pit bay technicians for MotoTrack garage';
COMMENT ON COLUMN public.mechanics.id IS 'Unique identifier for the mechanic (e.g. tech-jayson)';
COMMENT ON COLUMN public.mechanics.name IS 'Full technician name including certification titles';
COMMENT ON COLUMN public.mechanics.short_name IS 'Short display name for quick badges and cards';
COMMENT ON COLUMN public.mechanics.bay IS 'Assigned pit bay or workshop cell';
COMMENT ON COLUMN public.mechanics.status IS 'Current roster status (Available, Busy, On Leave)';
