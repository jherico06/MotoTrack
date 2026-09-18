-- =========================================================================
-- Migration 013: Shipping fee → rider earnings
-- Order shipping_fee is credited to the assigned rider when delivery is
-- confirmed Delivered by admin.
-- =========================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rider_earning NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rider_earning_credited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rider_earning_credited_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(14, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.rider_earnings (
  id TEXT PRIMARY KEY DEFAULT ('re-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
  rider_id TEXT REFERENCES public.riders(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES public.orders(order_id) ON DELETE SET NULL,
  delivery_id TEXT,
  rider_name TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'shipping_fee',
  notes TEXT DEFAULT '',
  credited_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rider_earnings_rider_id ON public.rider_earnings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_order_id ON public.rider_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_created_at ON public.rider_earnings(created_at);

ALTER TABLE public.rider_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_rider_earnings" ON public.rider_earnings;
CREATE POLICY "allow_anon_read_rider_earnings" ON public.rider_earnings FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_rider_earnings" ON public.rider_earnings;
CREATE POLICY "allow_anon_write_rider_earnings" ON public.rider_earnings FOR ALL USING (true) WITH CHECK (true);

COMMENT ON COLUMN public.orders.shipping_fee IS
  'Checkout shipping fee charged to the customer; becomes rider earning when delivered.';
COMMENT ON COLUMN public.order_deliveries.rider_earning IS
  'Shipping fee amount credited to the rider for this delivery.';
COMMENT ON COLUMN public.riders.total_earnings IS
  'Lifetime sum of shipping-fee earnings from completed deliveries.';
