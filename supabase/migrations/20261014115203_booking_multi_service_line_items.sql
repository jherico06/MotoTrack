-- Multi-service garage bookings: catalog groups + booking line-item snapshots.

-- 1) Service catalog grouping (customer UI categories; internal metadata)
ALTER TABLE public.pms_services
  ADD COLUMN IF NOT EXISTS service_group TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT;

UPDATE public.pms_services SET service_group = g.service_group, description = g.description, icon = g.icon
FROM (VALUES
  ('pms-minor-tune-up', 'Tune-Up and Maintenance', 'Minor preventive tune-up labor', 'wrench-adjustable'),
  ('pms-major-tune-up', 'Tune-Up and Maintenance', 'Full major tune-up labor', 'wrench-adjustable'),
  ('pms-top-overhaul', 'Engine Services', 'Top-end engine overhaul labor', 'gear-wide-connected'),
  ('pms-major-engine-overhaul', 'Engine Services', 'Major engine overhaul labor', 'gear-wide-connected'),
  ('pms-overhaul-carburetor', 'Engine Services', 'Carburetor overhaul labor', 'gear'),
  ('pms-replace-cam-sprocket-chain', 'Engine Services', 'Cam sprocket and chain replacement labor', 'link-45deg'),
  ('pms-replace-starter-motor', 'Engine Services', 'Starter motor replacement labor', 'lightning-charge'),
  ('pms-replace-brake-pads', 'Brake Services', 'Brake pad replacement labor', 'shield-shaded'),
  ('pms-replace-brake-shoe', 'Brake Services', 'Brake shoe replacement labor', 'shield-shaded'),
  ('pms-battery-recharging', 'Electrical Services', 'Battery recharging service', 'battery-charging'),
  ('pms-replace-head-light-bulb', 'Electrical Services', 'Head light bulb replacement labor', 'lightbulb'),
  ('pms-replace-tail-light-bulb', 'Electrical Services', 'Tail light bulb replacement labor', 'lightbulb'),
  ('pms-replace-signal-light-bulb', 'Electrical Services', 'Signal light bulb replacement labor', 'lightbulb'),
  ('pms-replace-panel-bulb', 'Electrical Services', 'Panel bulb replacement labor', 'lightbulb'),
  ('pms-replace-wiring-harness', 'Electrical Services', 'Wiring harness replacement labor', 'lightning-charge'),
  ('pms-replace-front-fork-oil', 'Suspension and Chassis', 'Front fork oil replacement labor', 'tools'),
  ('pms-replace-swing-arm-bushing', 'Suspension and Chassis', 'Swing arm bushing replacement labor', 'tools'),
  ('pms-replace-steering-ball', 'Suspension and Chassis', 'Steering ball replacement labor', 'tools'),
  ('pms-replace-front-hub-bearing', 'Suspension and Chassis', 'Front hub bearing replacement labor', 'tools'),
  ('pms-replace-rear-hub-bearing', 'Suspension and Chassis', 'Rear hub bearing replacement labor', 'tools'),
  ('pms-replace-lubricate-cable', 'Drive System', 'Cable replace/lubricate labor', 'link'),
  ('pms-replace-drive-chain', 'Drive System', 'Drive chain replacement labor', 'link-45deg')
) AS g(id, service_group, description, icon)
WHERE public.pms_services.id = g.id;

UPDATE public.pms_services
SET service_group = COALESCE(service_group, 'Other Services')
WHERE service_group IS NULL OR btrim(service_group) = '';

-- 2) Booking service line items (historical price snapshots)
CREATE TABLE IF NOT EXISTS public.booking_service_items (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  pms_service_id TEXT REFERENCES public.pms_services(id),
  service_name TEXT NOT NULL,
  service_group TEXT,
  service_description TEXT,
  motorcycle_cc NUMERIC(10, 2),
  cc_category_id TEXT REFERENCES public.cc_categories(id),
  cc_category_name TEXT,
  labor_rate_php NUMERIC(12, 2) NOT NULL CHECK (labor_rate_php >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total_php NUMERIC(12, 2) NOT NULL CHECK (line_total_php >= 0),
  is_additional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_booking_service_items_booking
  ON public.booking_service_items (booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_service_items_service
  ON public.booking_service_items (pms_service_id);

-- 3) Booking-level labor / estimate snapshot columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='labor_subtotal'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN labor_subtotal NUMERIC(12, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='parts_estimate'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN parts_estimate NUMERIC(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='additional_fees_estimate'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN additional_fees_estimate NUMERIC(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='estimated_total'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN estimated_total NUMERIC(12, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='is_estimate_only'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN is_estimate_only BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='rejection_reason'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_service_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_service_items_select" ON public.booking_service_items;
CREATE POLICY "booking_service_items_select" ON public.booking_service_items
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "booking_service_items_write" ON public.booking_service_items;
CREATE POLICY "booking_service_items_write" ON public.booking_service_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

COMMENT ON TABLE public.booking_service_items IS
  'Per-booking service line items with frozen labor rates at quote/booking time';
COMMENT ON COLUMN public.bookings.labor_subtotal IS
  'Snapshot sum of selected service labor rates at booking time';
COMMENT ON COLUMN public.bookings.is_estimate_only IS
  'True until admin confirms quotation / approval; customer-facing totals are estimates';
