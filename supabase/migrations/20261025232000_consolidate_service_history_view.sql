-- ==============================================================================
-- Migration: Consolidate service_history into VIEW over bookings
-- Pattern: Expand / Compat (Zero data loss, no DROP ... CASCADE)
-- ==============================================================================

BEGIN;

-- 1. Create a point-in-time safety backup table
CREATE TABLE IF NOT EXISTS public._backup_service_history_20261025 AS 
SELECT * FROM public.service_history;

-- 2. Rename existing table to service_history_legacy
ALTER TABLE public.service_history RENAME TO service_history_legacy;

-- 3. Create the compatibility VIEW over bookings with security_invoker = true
CREATE OR REPLACE VIEW public.service_history
WITH (security_invoker = true) AS
SELECT
    b.booking_id AS history_id,
    b.booking_id,
    b.customer_id,
    b.user_id,
    b.customer_name,
    b.motorcycle_id,
    b.bike_brand,
    b.bike_model,
    b.bike_year,
    COALESCE(b.plate_number, b.bike_plate) AS plate_number,
    b.package_id,
    b.package_name,
    b.service_type,
    COALESCE(b.included_services, '[]'::jsonb) AS services_performed,
    COALESCE(b.appointment_date, to_char(b.schedule, 'YYYY-MM-DD')) AS service_date,
    COALESCE(b.package_price, 0) AS package_price,
    COALESCE(b.additional_charges, 0) AS additional_charges,
    b.additional_charges_notes,
    COALESCE(b.final_service_total, b.price, 0) AS final_price,
    b.service_notes,
    b.created_at,
    b.updated_at
FROM public.bookings b;

-- 4. Grant read permissions to anon, authenticated, and service_role
GRANT SELECT ON public.service_history TO anon, authenticated, service_role;

COMMIT;
