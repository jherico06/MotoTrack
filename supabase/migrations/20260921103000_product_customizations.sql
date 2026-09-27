-- =========================================================================
-- Migration: Motorcycle product customizations
-- Adds structured compatibility + saved customer customization builds.
-- Does NOT alter or drop existing product/cart/order/garage tables.
-- =========================================================================

-- -------------------------------------------------------------------------
-- A. Product ↔ motorcycle compatibility (source of truth for fitment)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_compatibility (
    compatibility_id TEXT PRIMARY KEY DEFAULT ('pc-' || substr(md5(random()::text), 1, 12)),
    product_id TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year_from INTEGER,
    year_to INTEGER,
    year_exact INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT product_compatibility_product_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_compatibility_product
  ON public.product_compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_product_compatibility_bike
  ON public.product_compatibility(brand, model);
CREATE INDEX IF NOT EXISTS idx_product_compatibility_years
  ON public.product_compatibility(year_from, year_to, year_exact);

ALTER TABLE public.product_compatibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_product_compatibility" ON public.product_compatibility;
CREATE POLICY "allow_anon_read_product_compatibility"
  ON public.product_compatibility FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_product_compatibility" ON public.product_compatibility;
CREATE POLICY "allow_anon_write_product_compatibility"
  ON public.product_compatibility FOR ALL USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- B. Saved customizations
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customizations (
    customization_id TEXT PRIMARY KEY DEFAULT ('custz-' || substr(md5(random()::text), 1, 12)),
    customer_id TEXT,
    user_id TEXT,
    motorcycle_id TEXT,
    motorcycle_brand TEXT,
    motorcycle_model TEXT,
    motorcycle_year INTEGER,
    name TEXT NOT NULL DEFAULT 'My Customization',
    status TEXT NOT NULL DEFAULT 'draft',
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    preview_image_url TEXT,
    preview_prompt TEXT,
    compatibility_checked BOOLEAN DEFAULT false,
    compatibility_ok BOOLEAN,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT customizations_status_check
      CHECK (status IN ('draft', 'saved', 'previewed', 'in_cart', 'ordered', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_customizations_customer ON public.customizations(customer_id);
CREATE INDEX IF NOT EXISTS idx_customizations_user ON public.customizations(user_id);
CREATE INDEX IF NOT EXISTS idx_customizations_motorcycle ON public.customizations(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_customizations_status ON public.customizations(status);
CREATE INDEX IF NOT EXISTS idx_customizations_created ON public.customizations(created_at DESC);

ALTER TABLE public.customizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_customizations" ON public.customizations;
CREATE POLICY "allow_anon_read_customizations"
  ON public.customizations FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_customizations" ON public.customizations;
CREATE POLICY "allow_anon_write_customizations"
  ON public.customizations FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_customizations_updated_at ON public.customizations;
CREATE TRIGGER trg_customizations_updated_at
  BEFORE UPDATE ON public.customizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- C. Customization line items (snapshot price at save time; cart uses live)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customization_items (
    item_id TEXT PRIMARY KEY DEFAULT ('czi-' || substr(md5(random()::text), 1, 12)),
    customization_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    product_name TEXT,
    product_brand TEXT,
    product_category TEXT,
    size_label TEXT,
    color_label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT customization_items_customization_fkey
      FOREIGN KEY (customization_id) REFERENCES public.customizations(customization_id) ON DELETE CASCADE,
    CONSTRAINT customization_items_product_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_customization_items_customization
  ON public.customization_items(customization_id);
CREATE INDEX IF NOT EXISTS idx_customization_items_product
  ON public.customization_items(product_id);

ALTER TABLE public.customization_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_customization_items" ON public.customization_items;
CREATE POLICY "allow_anon_read_customization_items"
  ON public.customization_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_customization_items" ON public.customization_items;
CREATE POLICY "allow_anon_write_customization_items"
  ON public.customization_items FOR ALL USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- D. Seed structured compatibility from existing free-text product rows
--    (best-effort parse; Universal rows get a wildcard brand/model)
-- -------------------------------------------------------------------------
INSERT INTO public.product_compatibility (compatibility_id, product_id, brand, model, year_from, year_to, notes)
SELECT
  'pc-seed-' || p.product_id,
  p.product_id,
  CASE
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%universal%' THEN 'Universal'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%yamaha%' THEN 'Yamaha'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%honda%' THEN 'Honda'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%kawasaki%' THEN 'Kawasaki'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%suzuki%' THEN 'Suzuki'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%ducati%' THEN 'Ducati'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%bmw%' THEN 'BMW Motorrad'
    ELSE 'Universal'
  END,
  CASE
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%universal%' THEN 'All Models'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%click 160%' THEN 'Click 160'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%nmax%' THEN 'NMAX 155'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%yzf-r1%' OR lower(coalesce(p.compatibility, '')) LIKE '% r1 %' THEN 'YZF-R1'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%cbr1000%' THEN 'CBR1000RR-R'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%zx-10r%' OR lower(coalesce(p.compatibility, '')) LIKE '%zx-6r%' THEN 'Ninja ZX'
    WHEN lower(coalesce(p.compatibility, '')) LIKE '%panigale%' THEN 'Panigale V4'
    ELSE coalesce(nullif(trim(split_part(p.compatibility, '(', 1)), ''), 'Compatible Models')
  END,
  CASE
    WHEN p.compatibility ~ '(20[0-9]{2})\s*[-–]\s*(20[0-9]{2})'
      THEN (regexp_match(p.compatibility, '(20[0-9]{2})\s*[-–]\s*(20[0-9]{2})'))[1]::INTEGER
    ELSE NULL
  END,
  CASE
    WHEN p.compatibility ~ '(20[0-9]{2})\s*[-–]\s*(20[0-9]{2})'
      THEN (regexp_match(p.compatibility, '(20[0-9]{2})\s*[-–]\s*(20[0-9]{2})'))[2]::INTEGER
    ELSE NULL
  END,
  p.compatibility
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_compatibility pc WHERE pc.product_id = p.product_id
);

-- Explicit Honda Click 160 fitment examples (common PH scooter)
INSERT INTO public.product_compatibility (compatibility_id, product_id, brand, model, year_from, year_to, notes)
SELECT
  'pc-click-' || p.product_id,
  p.product_id,
  'Honda',
  'Click 160',
  2022,
  2026,
  'Seeded Click 160 fitment for Accessories / Exhaust / Tires demo'
FROM public.products p
WHERE p.category_id IN ('cat-02', 'cat-03', 'cat-04')
  AND NOT EXISTS (
    SELECT 1 FROM public.product_compatibility pc
    WHERE pc.product_id = p.product_id
      AND lower(pc.brand) = 'honda'
      AND lower(pc.model) LIKE '%click 160%'
  );

COMMENT ON TABLE public.product_compatibility IS 'Structured motorcycle brand/model/year fitment for products';
COMMENT ON TABLE public.customizations IS 'Customer motorcycle customization builds';
COMMENT ON TABLE public.customization_items IS 'Selected products inside a customization build';
