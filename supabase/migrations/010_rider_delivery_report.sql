-- =========================================================================
-- Migration 010: Rider drop-off report + admin delivery confirmation
-- Riders have no login. Admin logs the rider's report, then can mark
-- Delivered with a required reason if the customer never enters OTP.
-- =========================================================================

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS rider_reported_delivered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rider_reported_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rider_reported_by TEXT,
  ADD COLUMN IF NOT EXISTS rider_report_notes TEXT,
  ADD COLUMN IF NOT EXISTS admin_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_confirmed_reason TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_by_admin TEXT;

COMMENT ON COLUMN public.order_deliveries.rider_reported_delivered IS
  'Rider (via admin) reported the parcel was dropped off; order may still await customer OTP.';
COMMENT ON COLUMN public.order_deliveries.admin_confirmed IS
  'Admin marked Delivered without customer OTP (requires reason).';
