-- GPS delivery tracking: one latest location row per active order.
-- Rider upserts while Out for Delivery; admin/customer read via RLS.

CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id TEXT PRIMARY KEY DEFAULT ('dloc-' || substr(md5(random()::text), 1, 12)),
  order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(order_id) ON DELETE CASCADE,
  rider_id TEXT NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT delivery_locations_lat_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT delivery_locations_lng_check CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_delivery_locations_rider_id ON public.delivery_locations (rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_locations_updated_at ON public.delivery_locations (updated_at DESC);

COMMENT ON TABLE public.delivery_locations IS 'Latest GPS point per order while rider is actively delivering. Upserted periodically (not every second).';

ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

-- Helpers (stable, security definer not required — uses auth.jwt / auth.uid)
CREATE OR REPLACE FUNCTION public.is_moto_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
      AND lower(coalesce(u.role, '')) IN ('admin', 'administrator')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_rider_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.id
  FROM public.riders r
  JOIN public.users u ON u.user_id = r.user_id
  WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "delivery_locations_admin_select" ON public.delivery_locations;
CREATE POLICY "delivery_locations_admin_select" ON public.delivery_locations
  FOR SELECT
  USING (public.is_moto_admin() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "delivery_locations_rider_select" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_select" ON public.delivery_locations
  FOR SELECT
  USING (
    rider_id = public.current_rider_id()
    OR public.is_moto_admin()
  );

DROP POLICY IF EXISTS "delivery_locations_customer_select" ON public.delivery_locations;
CREATE POLICY "delivery_locations_customer_select" ON public.delivery_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customers c ON c.customer_id = o.customer_id
      JOIN public.users u ON u.user_id = c.user_id
      WHERE o.order_id = delivery_locations.order_id
        AND (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "delivery_locations_rider_insert" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_insert" ON public.delivery_locations
  FOR INSERT
  WITH CHECK (
    rider_id = public.current_rider_id()
    AND EXISTS (
      SELECT 1
      FROM public.order_deliveries d
      WHERE d.order_id = delivery_locations.order_id
        AND d.rider_id = delivery_locations.rider_id
        AND lower(coalesce(d.delivery_status, '')) IN (
          'out for delivery',
          'delivery reported'
        )
    )
  );

DROP POLICY IF EXISTS "delivery_locations_rider_update" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_update" ON public.delivery_locations
  FOR UPDATE
  USING (
    rider_id = public.current_rider_id()
    AND EXISTS (
      SELECT 1
      FROM public.order_deliveries d
      WHERE d.order_id = delivery_locations.order_id
        AND d.rider_id = delivery_locations.rider_id
        AND lower(coalesce(d.delivery_status, '')) IN (
          'out for delivery',
          'delivery reported'
        )
    )
  )
  WITH CHECK (
    rider_id = public.current_rider_id()
  );

DROP POLICY IF EXISTS "delivery_locations_rider_delete" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_delete" ON public.delivery_locations
  FOR DELETE
  USING (
    rider_id = public.current_rider_id()
    OR public.is_moto_admin()
  );

-- Realtime for live admin/customer maps
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'delivery_locations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;
    END IF;
  END IF;
END $$;

-- Replica identity full so UPDATE payloads include old/new for clients
ALTER TABLE public.delivery_locations REPLICA IDENTITY FULL;
