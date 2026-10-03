-- Housekeeping helper for expired reservations (schedule externally via pg_cron / Edge / n8n)
UPDATE public.inventory SET lead_time_days = 3 WHERE lead_time_days IS NULL;

CREATE OR REPLACE FUNCTION public.fn_daily_inventory_housekeeping()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_released integer;
BEGIN
  v_released := public.fn_release_expired_reservations();
  RETURN jsonb_build_object(
    'released_reservations', v_released,
    'ran_at', timezone('utc', now()),
    'note', 'Call from pg_cron/Edge/n8n daily. Full forecast snapshots use forecastService manually or via Edge Function.'
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.fn_daily_inventory_housekeeping() TO anon, authenticated, service_role;
