-- Downpayment due date: unpaid AWAITING_DOWNPAYMENT bookings auto-cancel after payment_deadline.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS downpayment_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

COMMENT ON COLUMN public.bookings.payment_deadline IS
  'Deadline for customer downpayment after approval. Past-due unpaid bookings are auto-cancelled.';
COMMENT ON COLUMN public.bookings.downpayment_required IS
  'True when booking requires a downpayment before confirmation/scheduling.';
COMMENT ON COLUMN public.bookings.cancelled_reason IS
  'Reason when booking was cancelled or expired (manual or auto).';

CREATE INDEX IF NOT EXISTS idx_bookings_payment_deadline_awaiting
  ON public.bookings (payment_deadline)
  WHERE status = 'AWAITING_DOWNPAYMENT' AND payment_deadline IS NOT NULL;

-- Expire unpaid downpayment bookings past payment_deadline.
-- Callable from client (garageService) or scheduled job.
CREATE OR REPLACE FUNCTION public.expire_unpaid_downpayment_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER := 0;
  expired_ids TEXT[];
BEGIN
  WITH expired AS (
    UPDATE public.bookings b
    SET
      status = 'BOOKING_EXPIRED',
      current_stage = 'Booking cancelled — downpayment deadline passed; slot released',
      cancelled_reason = 'Downpayment not paid by due date',
      downpayment_status = CASE
        WHEN COALESCE(b.downpayment_status, '') = 'Paid' THEN b.downpayment_status
        ELSE 'Expired'
      END,
      updated_at = NOW()
    WHERE UPPER(COALESCE(b.status, '')) = 'AWAITING_DOWNPAYMENT'
      AND b.payment_deadline IS NOT NULL
      AND b.payment_deadline < NOW()
      AND COALESCE(b.downpayment_status, '') <> 'Paid'
      AND COALESCE(b.amount_paid, 0) <= 0
    RETURNING b.booking_id
  )
  SELECT COALESCE(array_agg(booking_id), ARRAY[]::TEXT[]), COUNT(*)::INTEGER
  INTO expired_ids, expired_count
  FROM expired;

  IF expired_count > 0 THEN
    INSERT INTO public.booking_status_history (
      booking_id,
      from_status,
      to_status,
      event_type,
      description,
      actor_role,
      changed_by,
      notes,
      created_at
    )
    SELECT
      bid,
      'AWAITING_DOWNPAYMENT',
      'BOOKING_EXPIRED',
      'BOOKING_CANCELLED',
      'Booking automatically cancelled — downpayment deadline missed',
      'system',
      'system',
      'Downpayment not paid by due date',
      NOW()
    FROM unnest(expired_ids) AS bid;
  END IF;

  RETURN COALESCE(expired_count, 0);
END;
$$;

COMMENT ON FUNCTION public.expire_unpaid_downpayment_bookings() IS
  'Cancels AWAITING_DOWNPAYMENT bookings whose payment_deadline has passed without payment.';

GRANT EXECUTE ON FUNCTION public.expire_unpaid_downpayment_bookings() TO anon, authenticated, service_role;

-- Optional schedule when pg_cron is available (safe no-op if not installed / not permitted).
DO $cronsetup$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not available: %', SQLERRM;
      RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('expire-unpaid-downpayments');
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'expire-unpaid-downpayments',
      '*/15 * * * *',
      'SELECT public.expire_unpaid_downpayment_bookings();'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule expire-unpaid-downpayments cron: %', SQLERRM;
  END;
END;
$cronsetup$;
