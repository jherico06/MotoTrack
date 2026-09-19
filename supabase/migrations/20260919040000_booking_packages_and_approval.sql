-- Booking packages + admin approval
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS mechanic TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_title TEXT;

ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'Pending';

CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_package_id_idx ON public.bookings (package_id);

COMMENT ON COLUMN public.bookings.package_id IS 'Selected shop service package (services.service_id)';
COMMENT ON COLUMN public.bookings.package_name IS 'Snapshot of package name at booking time';
COMMENT ON COLUMN public.bookings.included_services IS 'Snapshot of package inclusions at booking time';
COMMENT ON COLUMN public.bookings.mechanic IS 'Assigned technician display name after admin approval';
