-- Add motorcycle photo/color/type to customizations for accurate AI previews
ALTER TABLE public.customizations
  ADD COLUMN IF NOT EXISTS motorcycle_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS motorcycle_color TEXT,
  ADD COLUMN IF NOT EXISTS motorcycle_type TEXT;
