-- ==============================================================================
-- 005_suppliers_enhancements.sql
-- MOTOTRACK: SUPPLIERS & VENDORS MODULE EXTENSIONS & ROW LEVEL SECURITY
-- ==============================================================================

-- 1. Ensure public.suppliers has all columns for full procurement management
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS categories TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS lead_time TEXT DEFAULT '3-5 Days';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 1) DEFAULT 5.0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 3. Anonymous & Authenticated Read Policy
DROP POLICY IF EXISTS "allow_anon_read_suppliers" ON public.suppliers;
CREATE POLICY "allow_anon_read_suppliers" ON public.suppliers
    FOR SELECT USING (true);

-- 4. Anonymous & Authenticated Write Policy
DROP POLICY IF EXISTS "allow_anon_write_suppliers" ON public.suppliers;
CREATE POLICY "allow_anon_write_suppliers" ON public.suppliers
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Realtime Publication: Ensure changes to suppliers broadcast to clients
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
