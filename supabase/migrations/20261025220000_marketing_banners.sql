-- Migration: 20261025220000_marketing_banners.sql
-- Create marketing_banners table strictly with 5 fields:
-- id, title, subtitle, description, image

CREATE TABLE IF NOT EXISTS public.marketing_banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT ''
);

-- Drop any columns that do not belong to the 5 specified fields
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'marketing_banners'
          AND column_name NOT IN ('id', 'title', 'subtitle', 'description', 'image')
    ) LOOP
        EXECUTE 'ALTER TABLE public.marketing_banners DROP COLUMN IF EXISTS ' || quote_ident(r.column_name) || ' CASCADE;';
    END LOOP;
END $$;

-- Insert initial banner
INSERT INTO public.marketing_banners (id, title, subtitle, description, image)
VALUES (
  'hero-main',
  'Everything Your Ride Needs',
  'Ride More Worry Less',
  'Quality motorcycle parts, accessories, and professional service — all in one place.',
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1600&q=80'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  image = EXCLUDED.image
WHERE marketing_banners.title IS NULL OR marketing_banners.title = '';

-- Enable RLS
ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read marketing_banners" ON public.marketing_banners;
CREATE POLICY "Allow public read marketing_banners"
  ON public.marketing_banners FOR SELECT
  USING (true);

-- Allow authenticated admin write access
DROP POLICY IF EXISTS "Allow authenticated admin manage marketing_banners" ON public.marketing_banners;
CREATE POLICY "Allow authenticated admin manage marketing_banners"
  ON public.marketing_banners FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()::text
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()::text
        AND users.role = 'admin'
    )
  );

-- Views for backward compatibility / alias queries
CREATE OR REPLACE VIEW public.marketing_banner AS SELECT * FROM public.marketing_banners;
CREATE OR REPLACE VIEW public.banners AS SELECT * FROM public.marketing_banners;
