-- =========================================================================
-- Remove active mechanic role workflows + add CC-based fixed PMS catalog.
-- Preserves historical mechanic columns/records and booking history.
-- Does not delete customer, order, product, or inventory data.
-- =========================================================================

-- 1) Configurable motorcycle CC pricing categories
CREATE TABLE IF NOT EXISTS public.cc_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_cc NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_cc NUMERIC(10, 2), -- NULL = no upper bound (e.g. Big Bikes)
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT cc_categories_min_nonneg CHECK (min_cc >= 0),
  CONSTRAINT cc_categories_max_gte_min CHECK (max_cc IS NULL OR max_cc >= min_cc)
);

CREATE INDEX IF NOT EXISTS idx_cc_categories_active_sort
  ON public.cc_categories (is_active, sort_order);

-- 2) PMS fixed-rate service catalog
CREATE TABLE IF NOT EXISTS public.pms_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pms_services_active_sort
  ON public.pms_services (is_active, sort_order);

-- 3) Per-category fixed prices (NULL price_php = Not Available)
CREATE TABLE IF NOT EXISTS public.pms_service_prices (
  id BIGSERIAL PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES public.pms_services(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES public.cc_categories(id) ON DELETE CASCADE,
  price_php NUMERIC(12, 2), -- NULL means Not Available (never treat as 0)
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pms_service_prices_unique UNIQUE (service_id, category_id),
  CONSTRAINT pms_service_prices_nonneg CHECK (price_php IS NULL OR price_php >= 0),
  CONSTRAINT pms_service_prices_availability CHECK (
    (is_available = false AND price_php IS NULL)
    OR (is_available = true AND price_php IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pms_service_prices_category
  ON public.pms_service_prices (category_id);

-- 4) Booking snapshot columns for historical price integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'motorcycle_cc'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN motorcycle_cc NUMERIC(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cc_category_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cc_category_id TEXT REFERENCES public.cc_categories(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cc_category_name'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cc_category_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pms_service_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN pms_service_id TEXT REFERENCES public.pms_services(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'quoted_service_rate'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN quoted_service_rate NUMERIC(12, 2);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_cc_category_id ON public.bookings (cc_category_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pms_service_id ON public.bookings (pms_service_id);

-- 5) Soft-disable mechanic roster (keep rows for historical booking FKs/display)
UPDATE public.mechanics
SET
  is_active = false,
  status = CASE
    WHEN lower(coalesce(status, '')) IN ('available', 'busy', 'in pit bay') THEN 'Inactive'
    ELSE coalesce(status, 'Inactive')
  END,
  updated_at = timezone('utc'::text, now())
WHERE coalesce(is_active, true) = true;

-- 6) Deactivate mechanic login accounts (do not delete users / history)
UPDATE public.users
SET
  status = 'inactive',
  updated_at = timezone('utc'::text, now())
WHERE role = 'mechanic'
  AND coalesce(status, '') NOT IN ('inactive', 'disabled', 'deleted');

-- 7) Seed initial CC categories (exact ranges from product requirements)
INSERT INTO public.cc_categories (id, name, min_cc, max_cc, sort_order, is_active)
VALUES
  ('cc-125-below', '125cc and Below', 0, 125, 1, true),
  ('cc-150-160', '150cc–160cc', 150, 160, 2, true),
  ('cc-big-bikes', 'Big Bikes', 161, NULL, 3, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  min_cc = EXCLUDED.min_cc,
  max_cc = EXCLUDED.max_cc,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());

-- 8) Seed 22 PMS services
INSERT INTO public.pms_services (id, name, sort_order, is_active) VALUES
  ('pms-minor-tune-up', 'Minor Tune Up', 1, true),
  ('pms-major-tune-up', 'Major Tune Up', 2, true),
  ('pms-top-overhaul', 'Top Overhaul', 3, true),
  ('pms-major-engine-overhaul', 'Major Engine Overhaul', 4, true),
  ('pms-replace-lubricate-cable', 'Replace/Lubricate Cable', 5, true),
  ('pms-replace-brake-pads', 'Replace Brake Pads', 6, true),
  ('pms-replace-brake-shoe', 'Replace Brake Shoe', 7, true),
  ('pms-replace-front-fork-oil', 'Replace Front Fork Oil', 8, true),
  ('pms-replace-swing-arm-bushing', 'Replace Swing Arm Bushing', 9, true),
  ('pms-replace-steering-ball', 'Replace Steering Ball', 10, true),
  ('pms-replace-front-hub-bearing', 'Replace Front Hub Bearing', 11, true),
  ('pms-replace-rear-hub-bearing', 'Replace Rear Hub Bearing', 12, true),
  ('pms-battery-recharging', 'Battery Recharging', 13, true),
  ('pms-replace-head-light-bulb', 'Replace Head Light Bulb', 14, true),
  ('pms-replace-tail-light-bulb', 'Replace Tail Light Bulb', 15, true),
  ('pms-replace-signal-light-bulb', 'Replace Signal Light Bulb', 16, true),
  ('pms-replace-panel-bulb', 'Replace Panel Bulb', 17, true),
  ('pms-replace-wiring-harness', 'Replace Wiring Harness', 18, true),
  ('pms-replace-drive-chain', 'Replace Drive Chain', 19, true),
  ('pms-overhaul-carburetor', 'Overhaul Carburetor', 20, true),
  ('pms-replace-starter-motor', 'Replace Starter Motor', 21, true),
  ('pms-replace-cam-sprocket-chain', 'Replace Cam Sprocket & Chain', 22, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());

-- 9) Seed fixed prices (NULL + is_available=false = Not Available)
INSERT INTO public.pms_service_prices (service_id, category_id, price_php, is_available) VALUES
  ('pms-minor-tune-up', 'cc-125-below', 300, true),
  ('pms-minor-tune-up', 'cc-150-160', 500, true),
  ('pms-minor-tune-up', 'cc-big-bikes', 700, true),
  ('pms-major-tune-up', 'cc-125-below', 1000, true),
  ('pms-major-tune-up', 'cc-150-160', 1300, true),
  ('pms-major-tune-up', 'cc-big-bikes', 1500, true),
  ('pms-top-overhaul', 'cc-125-below', 1200, true),
  ('pms-top-overhaul', 'cc-150-160', 1500, true),
  ('pms-top-overhaul', 'cc-big-bikes', 1800, true),
  ('pms-major-engine-overhaul', 'cc-125-below', 2000, true),
  ('pms-major-engine-overhaul', 'cc-150-160', 2300, true),
  ('pms-major-engine-overhaul', 'cc-big-bikes', 2500, true),
  ('pms-replace-lubricate-cable', 'cc-125-below', 300, true),
  ('pms-replace-lubricate-cable', 'cc-150-160', 350, true),
  ('pms-replace-lubricate-cable', 'cc-big-bikes', 400, true),
  ('pms-replace-brake-pads', 'cc-125-below', 130, true),
  ('pms-replace-brake-pads', 'cc-150-160', 150, true),
  ('pms-replace-brake-pads', 'cc-big-bikes', 200, true),
  ('pms-replace-brake-shoe', 'cc-125-below', 300, true),
  ('pms-replace-brake-shoe', 'cc-150-160', 350, true),
  ('pms-replace-brake-shoe', 'cc-big-bikes', 400, true),
  ('pms-replace-front-fork-oil', 'cc-125-below', 450, true),
  ('pms-replace-front-fork-oil', 'cc-150-160', 500, true),
  ('pms-replace-front-fork-oil', 'cc-big-bikes', 600, true),
  ('pms-replace-swing-arm-bushing', 'cc-125-below', 500, true),
  ('pms-replace-swing-arm-bushing', 'cc-150-160', 600, true),
  ('pms-replace-swing-arm-bushing', 'cc-big-bikes', 800, true),
  ('pms-replace-steering-ball', 'cc-125-below', 450, true),
  ('pms-replace-steering-ball', 'cc-150-160', 550, true),
  ('pms-replace-steering-ball', 'cc-big-bikes', 700, true),
  ('pms-replace-front-hub-bearing', 'cc-125-below', 300, true),
  ('pms-replace-front-hub-bearing', 'cc-150-160', 350, true),
  ('pms-replace-front-hub-bearing', 'cc-big-bikes', 400, true),
  ('pms-replace-rear-hub-bearing', 'cc-125-below', 300, true),
  ('pms-replace-rear-hub-bearing', 'cc-150-160', 350, true),
  ('pms-replace-rear-hub-bearing', 'cc-big-bikes', 400, true),
  ('pms-battery-recharging', 'cc-125-below', 100, true),
  ('pms-battery-recharging', 'cc-150-160', 100, true),
  ('pms-battery-recharging', 'cc-big-bikes', 100, true),
  ('pms-replace-head-light-bulb', 'cc-125-below', 150, true),
  ('pms-replace-head-light-bulb', 'cc-150-160', 200, true),
  ('pms-replace-head-light-bulb', 'cc-big-bikes', 250, true),
  ('pms-replace-tail-light-bulb', 'cc-125-below', 150, true),
  ('pms-replace-tail-light-bulb', 'cc-150-160', 200, true),
  ('pms-replace-tail-light-bulb', 'cc-big-bikes', 250, true),
  ('pms-replace-signal-light-bulb', 'cc-125-below', 150, true),
  ('pms-replace-signal-light-bulb', 'cc-150-160', 200, true),
  ('pms-replace-signal-light-bulb', 'cc-big-bikes', 250, true),
  ('pms-replace-panel-bulb', 'cc-125-below', 150, true),
  ('pms-replace-panel-bulb', 'cc-150-160', 200, true),
  ('pms-replace-panel-bulb', 'cc-big-bikes', 250, true),
  ('pms-replace-wiring-harness', 'cc-125-below', 900, true),
  ('pms-replace-wiring-harness', 'cc-150-160', 1400, true),
  ('pms-replace-wiring-harness', 'cc-big-bikes', 1900, true),
  ('pms-replace-drive-chain', 'cc-125-below', 350, true),
  ('pms-replace-drive-chain', 'cc-150-160', 400, true),
  ('pms-replace-drive-chain', 'cc-big-bikes', 450, true),
  ('pms-overhaul-carburetor', 'cc-125-below', 300, true),
  ('pms-overhaul-carburetor', 'cc-150-160', 350, true),
  ('pms-overhaul-carburetor', 'cc-big-bikes', NULL, false),
  ('pms-replace-starter-motor', 'cc-125-below', 350, true),
  ('pms-replace-starter-motor', 'cc-150-160', 400, true),
  ('pms-replace-starter-motor', 'cc-big-bikes', 450, true),
  ('pms-replace-cam-sprocket-chain', 'cc-125-below', 800, true),
  ('pms-replace-cam-sprocket-chain', 'cc-150-160', 1000, true),
  ('pms-replace-cam-sprocket-chain', 'cc-big-bikes', 1200, true)
ON CONFLICT (service_id, category_id) DO UPDATE SET
  price_php = EXCLUDED.price_php,
  is_available = EXCLUDED.is_available,
  updated_at = timezone('utc'::text, now());

-- 10) Helper: resolve category from CC (used by app + optional RPC)
CREATE OR REPLACE FUNCTION public.resolve_cc_category(p_engine_cc NUMERIC)
RETURNS TABLE (category_id TEXT, category_name TEXT, min_cc NUMERIC, max_cc NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.min_cc, c.max_cc
  FROM public.cc_categories c
  WHERE c.is_active = true
    AND p_engine_cc IS NOT NULL
    AND p_engine_cc > 0
    AND p_engine_cc >= c.min_cc
    AND (c.max_cc IS NULL OR p_engine_cc <= c.max_cc)
  ORDER BY c.sort_order
  LIMIT 1;
$$;

-- 11) Helper: resolve PMS fixed price (never returns 0 for unavailable)
CREATE OR REPLACE FUNCTION public.resolve_pms_service_price(p_service_id TEXT, p_category_id TEXT)
RETURNS TABLE (
  service_id TEXT,
  service_name TEXT,
  category_id TEXT,
  price_php NUMERIC,
  is_available BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    p.category_id,
    p.price_php,
    COALESCE(p.is_available, false) AND p.price_php IS NOT NULL
  FROM public.pms_services s
  JOIN public.pms_service_prices p ON p.service_id = s.id
  WHERE s.id = p_service_id
    AND p.category_id = p_category_id
    AND s.is_active = true
  LIMIT 1;
$$;

-- 12) RLS — customers can read catalog; only admins mutate (via service role / admin app)
ALTER TABLE public.cc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_service_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_categories_select_authenticated" ON public.cc_categories;
CREATE POLICY "cc_categories_select_authenticated" ON public.cc_categories
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "pms_services_select_authenticated" ON public.pms_services;
CREATE POLICY "pms_services_select_authenticated" ON public.pms_services
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "pms_service_prices_select_authenticated" ON public.pms_service_prices;
CREATE POLICY "pms_service_prices_select_authenticated" ON public.pms_service_prices
  FOR SELECT TO authenticated, anon
  USING (true);

-- Writes go through service role / admin tooling; no public insert/update/delete policies.

COMMENT ON TABLE public.cc_categories IS 'Configurable motorcycle CC bands for PMS fixed-rate pricing';
COMMENT ON TABLE public.pms_services IS 'Fixed-rate PMS service catalog (labor/service rates, not hourly)';
COMMENT ON TABLE public.pms_service_prices IS 'Per-CC-category fixed PHP rates; NULL price = Not Available';
COMMENT ON COLUMN public.bookings.motorcycle_cc IS 'Snapshot of motorcycle engine CC at booking time';
COMMENT ON COLUMN public.bookings.cc_category_id IS 'Snapshot of resolved CC category at booking time';
COMMENT ON COLUMN public.bookings.quoted_service_rate IS 'Snapshot of fixed PMS rate quoted at booking time';
