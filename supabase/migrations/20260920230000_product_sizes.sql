-- Optional product sizes (tires, rims, etc.) — additive only
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS size TEXT;

COMMENT ON COLUMN public.products.sizes IS 'Optional size options JSON array for tires/rims/etc.';
COMMENT ON COLUMN public.order_items.size IS 'Selected size snapshot at order time';
