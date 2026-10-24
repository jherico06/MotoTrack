-- =============================================================================
-- Harden expire_unpaid_downpayment_bookings to stop PostgREST log flooding.
--
-- Audit findings:
--   1. Client app called this RPC every ~15 min per open tab (API log ingestion).
--   2. pg_cron job "expire-unpaid-downpayments" already runs every 15 min.
--   3. EXECUTE was granted to PUBLIC / anon / authenticated (any client could call it).
--
-- Fix: cron (or service_role) only; revoke client execute; keep schedule.
-- =============================================================================

-- 1) Revoke public / browser client execute (PostgREST /rest/v1/rpc/...)
REVOKE EXECUTE ON FUNCTION public.expire_unpaid_downpayment_bookings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_unpaid_downpayment_bookings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_unpaid_downpayment_bookings() FROM authenticated;

-- 2) Allow backend / cron owners only
GRANT EXECUTE ON FUNCTION public.expire_unpaid_downpayment_bookings() TO postgres;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_downpayment_bookings() TO service_role;

COMMENT ON FUNCTION public.expire_unpaid_downpayment_bookings() IS
  'Cancels AWAITING_DOWNPAYMENT bookings past payment_deadline. Cron/service_role only — not callable by anon/authenticated clients (avoids API log ingestion spam).';

-- 3) Ensure a single active cron schedule (every 30 min is enough; was */15 + client).
DO $cronsetup$
BEGIN
  BEGIN
    PERFORM cron.unschedule('expire-unpaid-downpayments');
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'expire-unpaid-downpayments',
      '*/30 * * * *',
      'SELECT public.expire_unpaid_downpayment_bookings();'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not (re)schedule expire-unpaid-downpayments cron: %', SQLERRM;
  END;
END;
$cronsetup$;
