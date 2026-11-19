-- Allow MotoTrack riders (both Supabase JWT and custom-app auth sessions) to upsert/clear
-- live GPS coordinates for orders actively assigned to them in Out for Delivery status.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_locations TO anon, authenticated;

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
        AND (
          u.user_id = (select auth.uid())::text
          OR (
            nullif(trim(coalesce(u.email, '')), '') IS NOT NULL
            AND lower(u.email) = lower(nullif(trim(coalesce((select auth.jwt()) ->> 'email', '')), ''))
          )
        )
    )
  );

DROP POLICY IF EXISTS "delivery_locations_rider_select" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_select" ON public.delivery_locations
  FOR SELECT
  USING (
    rider_id = public.current_rider_id()
    OR public.is_moto_admin()
    OR (select auth.uid()) IS NULL
  );

DROP POLICY IF EXISTS "delivery_locations_rider_insert" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_insert" ON public.delivery_locations
  FOR INSERT
  WITH CHECK (
    (
      (
        (select auth.uid()) IS NOT NULL
        AND (rider_id = public.current_rider_id() OR public.is_moto_admin())
      )
      OR (select auth.uid()) IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.riders r
      WHERE r.id = delivery_locations.rider_id
        AND lower(coalesce(r.account_status, 'active')) = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.order_deliveries d
      LEFT JOIN public.orders o ON o.order_id = d.order_id
      WHERE d.order_id = delivery_locations.order_id
        AND d.rider_id = delivery_locations.rider_id
        AND (
          lower(coalesce(d.delivery_status, '')) IN ('out for delivery', 'delivery reported')
          OR lower(coalesce(o.status, '')) IN ('out for delivery', 'delivery reported')
        )
    )
  );

DROP POLICY IF EXISTS "delivery_locations_rider_update" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_update" ON public.delivery_locations
  FOR UPDATE
  USING (
    (
      (
        (select auth.uid()) IS NOT NULL
        AND (rider_id = public.current_rider_id() OR public.is_moto_admin())
      )
      OR (select auth.uid()) IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.order_deliveries d
      LEFT JOIN public.orders o ON o.order_id = d.order_id
      WHERE d.order_id = delivery_locations.order_id
        AND d.rider_id = delivery_locations.rider_id
        AND (
          lower(coalesce(d.delivery_status, '')) IN ('out for delivery', 'delivery reported')
          OR lower(coalesce(o.status, '')) IN ('out for delivery', 'delivery reported')
        )
    )
  )
  WITH CHECK (
    (
      (
        (select auth.uid()) IS NOT NULL
        AND (rider_id = public.current_rider_id() OR public.is_moto_admin())
      )
      OR (select auth.uid()) IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.riders r
      WHERE r.id = delivery_locations.rider_id
        AND lower(coalesce(r.account_status, 'active')) = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.order_deliveries d
      LEFT JOIN public.orders o ON o.order_id = d.order_id
      WHERE d.order_id = delivery_locations.order_id
        AND d.rider_id = delivery_locations.rider_id
        AND (
          lower(coalesce(d.delivery_status, '')) IN ('out for delivery', 'delivery reported')
          OR lower(coalesce(o.status, '')) IN ('out for delivery', 'delivery reported')
        )
    )
  );

DROP POLICY IF EXISTS "delivery_locations_rider_delete" ON public.delivery_locations;
CREATE POLICY "delivery_locations_rider_delete" ON public.delivery_locations
  FOR DELETE
  USING (
    (
      (select auth.uid()) IS NOT NULL
      AND (rider_id = public.current_rider_id() OR public.is_moto_admin())
    )
    OR (
      (select auth.uid()) IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.order_deliveries d
        WHERE d.order_id = delivery_locations.order_id
          AND d.rider_id = delivery_locations.rider_id
      )
    )
  );
