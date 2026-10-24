-- Add optional banner image URL to promos
ALTER TABLE public.promos ADD COLUMN IF NOT EXISTS image_url TEXT;
COMMENT ON COLUMN public.promos.image_url IS 'Optional banner hero image URL for promotional display';
