-- Additive columns for admin booking management (inspection + mechanic assignment meta).
-- Does not alter existing booking/payment/product flows.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspection_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mechanic_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mechanic_assignment_status TEXT,
  ADD COLUMN IF NOT EXISTS service_notes TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS bike_color TEXT,
  ADD COLUMN IF NOT EXISTS bike_year TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';

COMMENT ON COLUMN public.bookings.inspection_notes IS 'Admin inspection summary saved on the booking';
COMMENT ON COLUMN public.bookings.mechanic_assigned_at IS 'When admin last assigned a mechanic';
COMMENT ON COLUMN public.bookings.mechanic_assignment_status IS 'assigned | unassigned';
