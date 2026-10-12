-- Promo Management: types, eligibility, min order, product links

ALTER TABLE public.promos
  ADD COLUMN IF NOT EXISTS promo_type TEXT NOT NULL DEFAULT 'PERCENT_OFF',
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'ALL_PRODUCTS',
  ADD COLUMN IF NOT EXISTS minimum_order_amount NUMERIC(10, 2) DEFAULT NULL;

UPDATE public.promos
SET promo_type = COALESCE(NULLIF(TRIM(promo_type), ''), 'PERCENT_OFF')
WHERE promo_type IS NULL OR TRIM(promo_type) = '';

UPDATE public.promos
SET applies_to = COALESCE(NULLIF(TRIM(applies_to), ''), 'ALL_PRODUCTS')
WHERE applies_to IS NULL OR TRIM(applies_to) = '';

UPDATE public.promos
SET
  promo_type = 'FREE_SHIPPING',
  discount_percent = 0
WHERE lower(COALESCE(description, '')) LIKE '%free shipping%'
  AND promo_type = 'PERCENT_OFF';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promos_promo_type_check'
  ) THEN
    ALTER TABLE public.promos
      ADD CONSTRAINT promos_promo_type_check
      CHECK (promo_type IN ('FREE_SHIPPING', 'PERCENT_OFF'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promos_applies_to_check'
  ) THEN
    ALTER TABLE public.promos
      ADD CONSTRAINT promos_applies_to_check
      CHECK (applies_to IN ('ALL_PRODUCTS', 'SELECTED_PRODUCTS'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promo_products (
  promo_id TEXT NOT NULL REFERENCES public.promos(promo_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (promo_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_products_product_id ON public.promo_products(product_id);
CREATE INDEX IF NOT EXISTS idx_promos_code_upper ON public.promos (upper(code));
CREATE INDEX IF NOT EXISTS idx_promos_active_dates ON public.promos (is_active, start_date, end_date);

ALTER TABLE public.promo_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read promo_products" ON public.promo_products;
CREATE POLICY "Public Read promo_products"
  ON public.promo_products FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public Write promo_products" ON public.promo_products;
CREATE POLICY "Public Write promo_products"
  ON public.promo_products FOR ALL TO public USING (true) WITH CHECK (true);

COMMENT ON COLUMN public.promos.promo_type IS 'FREE_SHIPPING | PERCENT_OFF';
COMMENT ON COLUMN public.promos.applies_to IS 'ALL_PRODUCTS | SELECTED_PRODUCTS';
COMMENT ON COLUMN public.promos.minimum_order_amount IS 'Optional cart subtotal minimum in PHP';
