-- =========================================================================
-- Migration: Enable write RLS for public.categories and add icon/image columns
-- Allows store admins to add and manage product categories dynamically.
-- =========================================================================

-- Ensure icon and image columns exist on categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image TEXT;

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "allow_anon_read_categories" ON public.categories;
CREATE POLICY "allow_anon_read_categories" ON public.categories
  FOR SELECT USING (true);

-- Admin write access (anon + authenticated)
DROP POLICY IF EXISTS "allow_anon_write_categories" ON public.categories;
DROP POLICY IF EXISTS "categories_public_write" ON public.categories;
CREATE POLICY "allow_anon_write_categories" ON public.categories
  FOR ALL USING (true) WITH CHECK (true);
