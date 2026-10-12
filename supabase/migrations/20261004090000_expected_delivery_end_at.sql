-- Delivery window end date (start remains expected_delivery_at)
ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS expected_delivery_end_at timestamptz;

COMMENT ON COLUMN public.order_deliveries.expected_delivery_end_at IS
  'End of expected delivery window; start is expected_delivery_at';
