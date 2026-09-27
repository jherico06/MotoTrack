-- =========================================================================
-- Flexible Service Booking, Dynamic Quotation, Mechanic Hourly Rates,
-- Booking Payments, Pickup Verification, Status History
-- Extends existing tables; does NOT replace package booking or shop payments.
-- =========================================================================

-- 1) Mechanics: hourly labor rate (Admin-managed, no login)
ALTER TABLE public.mechanics
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12, 2) NOT NULL DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.mechanics.hourly_rate IS 'Current hourly labor rate (PHP). Snapshot separately on quotations.';
COMMENT ON COLUMN public.mechanics.is_active IS 'Soft-active flag for Admin roster; inactive techs cannot be newly assigned.';

UPDATE public.mechanics
SET hourly_rate = COALESCE(hourly_rate, 150.00),
    is_active = COALESCE(is_active, true)
WHERE hourly_rate IS NULL OR is_active IS NULL;

-- 2) Bookings: flexible workflow columns (preserve existing package fields)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS problem_description TEXT,
  ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS motorcycle_id TEXT,
  ADD COLUMN IF NOT EXISTS preferred_date TEXT,
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT,
  ADD COLUMN IF NOT EXISTS info_request_notes TEXT,
  ADD COLUMN IF NOT EXISTS estimated_labor_hours NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS actual_labor_hours NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS quoted_hourly_rate NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS estimated_labor_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS actual_labor_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS parts_total NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges_total NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_service_total NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS final_service_total NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS downpayment_percent NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS downpayment_type TEXT DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS downpayment_status TEXT DEFAULT 'Not Required',
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid',
  ADD COLUMN IF NOT EXISTS active_quotation_id TEXT,
  ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_qr_token TEXT,
  ADD COLUMN IF NOT EXISTS pickup_qr_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_released_by TEXT,
  ADD COLUMN IF NOT EXISTS plate_number TEXT,
  ADD COLUMN IF NOT EXISTS odometer TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS service_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS price_php NUMERIC(12, 2);

COMMENT ON COLUMN public.bookings.booking_mode IS 'flexible = dynamic quotation; package = legacy fixed package flow';
COMMENT ON COLUMN public.bookings.quoted_hourly_rate IS 'Hourly rate snapshot at quotation time (not live mechanic rate)';

-- Backfill plate/odo/branch aliases if only bike_* columns populated
UPDATE public.bookings
SET plate_number = COALESCE(plate_number, bike_plate),
    odometer = COALESCE(odometer, bike_odo),
    branch = COALESCE(branch, branch_name)
WHERE plate_number IS NULL OR odometer IS NULL OR branch IS NULL;

-- 3) Service quotations (estimated + final), with rate/price snapshots
CREATE TABLE IF NOT EXISTS public.service_quotations (
  quotation_id TEXT PRIMARY KEY DEFAULT ('qt-' || substr(md5(random()::text), 1, 12)),
  booking_id TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  quotation_type TEXT NOT NULL DEFAULT 'estimated',
  status TEXT NOT NULL DEFAULT 'draft',
  mechanic_id TEXT REFERENCES public.mechanics(id) ON DELETE SET NULL,
  mechanic_name TEXT,
  hourly_rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_labor_hours NUMERIC(8, 2) DEFAULT 0,
  actual_labor_hours NUMERIC(8, 2),
  labor_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  parts_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_charges_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  additional_charges_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC(12, 2) DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  downpayment_type TEXT DEFAULT 'percent',
  downpayment_percent NUMERIC(8, 2),
  downpayment_amount NUMERIC(12, 2) DEFAULT 0,
  remaining_balance NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_service_quotations_booking ON public.service_quotations(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_quotations_status ON public.service_quotations(status);

CREATE TABLE IF NOT EXISTS public.service_quotation_items (
  item_id TEXT PRIMARY KEY DEFAULT ('qti-' || substr(md5(random()::text), 1, 12)),
  quotation_id TEXT NOT NULL REFERENCES public.service_quotations(quotation_id) ON DELETE CASCADE,
  booking_id TEXT REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'part',
  product_id TEXT,
  product_name TEXT,
  description TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.service_quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_booking ON public.service_quotation_items(booking_id);

COMMENT ON COLUMN public.service_quotation_items.unit_price IS 'Price snapshot at quotation time; product catalog changes do not alter this';

-- 4) Booking inspections
CREATE TABLE IF NOT EXISTS public.booking_inspections (
  inspection_id TEXT PRIMARY KEY DEFAULT ('insp-' || substr(md5(random()::text), 1, 12)),
  booking_id TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  findings TEXT,
  recommended_work TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  inspected_by TEXT,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_booking_inspections_booking ON public.booking_inspections(booking_id);

-- 5) Additional charges (require customer approval)
CREATE TABLE IF NOT EXISTS public.booking_additional_charges (
  charge_id TEXT PRIMARY KEY DEFAULT ('bac-' || substr(md5(random()::text), 1, 12)),
  booking_id TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  quotation_id TEXT REFERENCES public.service_quotations(quotation_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  additional_labor_hours NUMERIC(8, 2) DEFAULT 0,
  hourly_rate NUMERIC(12, 2) DEFAULT 0,
  labor_cost NUMERIC(12, 2) DEFAULT 0,
  parts_total NUMERIC(12, 2) DEFAULT 0,
  other_amount NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_booking_additional_charges_booking ON public.booking_additional_charges(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_additional_charges_status ON public.booking_additional_charges(status);

-- 6) Extend payments for booking downpayment / final payment (reuse existing table)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS booking_id TEXT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_type TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- order_id was NOT NULL historically in some envs; allow NULL for booking-only payments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'order_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.payments ALTER COLUMN order_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON public.payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);

COMMENT ON COLUMN public.payments.payment_type IS 'DOWNPAYMENT | FINAL_PAYMENT | ORDER (shop) | other';

-- 7) Booking status history
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  history_id TEXT PRIMARY KEY DEFAULT ('bsh-' || substr(md5(random()::text), 1, 12)),
  booking_id TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_booking_status_history_booking ON public.booking_status_history(booking_id);

-- 8) Pickup QR verifications
CREATE TABLE IF NOT EXISTS public.pickup_verifications (
  verification_id TEXT PRIMARY KEY DEFAULT ('pkv-' || substr(md5(random()::text), 1, 12)),
  booking_id TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  customer_id TEXT,
  qr_token TEXT NOT NULL,
  payment_status TEXT,
  pickup_status TEXT,
  qr_valid BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pickup_verifications_token ON public.pickup_verifications(qr_token);
CREATE INDEX IF NOT EXISTS idx_pickup_verifications_booking ON public.pickup_verifications(booking_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_pickup_qr_token
  ON public.bookings(pickup_qr_token)
  WHERE pickup_qr_token IS NOT NULL;

-- 9) Link active quotation FK (after quotations table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bookings_active_quotation_id_fkey'
      AND table_name = 'bookings'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_active_quotation_id_fkey
      FOREIGN KEY (active_quotation_id) REFERENCES public.service_quotations(quotation_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'active_quotation FK skipped: %', SQLERRM;
END $$;

-- 10) updated_at triggers
DROP TRIGGER IF EXISTS trg_service_quotations_updated_at ON public.service_quotations;
CREATE TRIGGER trg_service_quotations_updated_at
  BEFORE UPDATE ON public.service_quotations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_booking_additional_charges_updated_at ON public.booking_additional_charges;
CREATE TRIGGER trg_booking_additional_charges_updated_at
  BEFORE UPDATE ON public.booking_additional_charges
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 11) RLS — align with existing permissive demo pattern (anon + authenticated)
ALTER TABLE public.service_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_additional_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_service_quotations" ON public.service_quotations;
CREATE POLICY "allow_all_service_quotations" ON public.service_quotations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_service_quotation_items" ON public.service_quotation_items;
CREATE POLICY "allow_all_service_quotation_items" ON public.service_quotation_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_booking_inspections" ON public.booking_inspections;
CREATE POLICY "allow_all_booking_inspections" ON public.booking_inspections
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_booking_additional_charges" ON public.booking_additional_charges;
CREATE POLICY "allow_all_booking_additional_charges" ON public.booking_additional_charges
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_booking_status_history" ON public.booking_status_history;
CREATE POLICY "allow_all_booking_status_history" ON public.booking_status_history
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_pickup_verifications" ON public.pickup_verifications;
CREATE POLICY "allow_all_pickup_verifications" ON public.pickup_verifications
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure bookings/payments write policies exist (idempotent)
DROP POLICY IF EXISTS "allow_anon_write_bookings" ON public.bookings;
CREATE POLICY "allow_anon_write_bookings" ON public.bookings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_write_payments" ON public.payments;
CREATE POLICY "allow_anon_write_payments" ON public.payments
  FOR ALL USING (true) WITH CHECK (true);

-- 12) Realtime publication for quotation / payment / pickup tables
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'service_quotations',
      'service_quotation_items',
      'booking_additional_charges',
      'pickup_verifications',
      'booking_status_history'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
