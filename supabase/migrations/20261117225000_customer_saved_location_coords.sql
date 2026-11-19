-- =========================================================================
-- Customer saved exact delivery coordinates (latitude, longitude) & notes
-- Ensures Edit Address / Profile saves pin coordinates & landmark notes,
-- and orders preserve exact coordinates without relying on address geocoding.
-- =========================================================================

-- 1. public.users: store primary delivery coordinates + landmark/delivery notes
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- 2. public.customers: store customer delivery coordinates + notes
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- 3. public.addresses: already has latitude, longitude, landmark; ensure delivery_notes exists
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- 4. public.orders: ensure delivery coordinate & landmark columns exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_landmark TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- 5. Valid coordinate range constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_valid_lat_lng_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_valid_lat_lng_check
      CHECK (
        (latitude IS NULL OR (latitude BETWEEN -90 AND 90))
        AND (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_valid_lat_lng_check'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_valid_lat_lng_check
      CHECK (
        (latitude IS NULL OR (latitude BETWEEN -90 AND 90))
        AND (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addresses_valid_lat_lng_check'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_valid_lat_lng_check
      CHECK (
        (latitude IS NULL OR (latitude BETWEEN -90 AND 90))
        AND (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
      );
  END IF;
END $$;

-- 6. Partial index on default customer addresses with coordinates
CREATE INDEX IF NOT EXISTS idx_addresses_customer_coords
  ON public.addresses(customer_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
