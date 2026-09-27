-- Optional product color variants with per-color image
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.colors IS 'Optional color options: [{label, hex?, image?, stock?}]';
