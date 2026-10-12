-- Token-dashboard riders (no Supabase auth session) can upsert GPS via access token.

CREATE OR REPLACE FUNCTION public.rider_upsert_delivery_location(
  p_token_hash TEXT,
  p_order_id TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_heading DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h TEXT := lower(trim(COALESCE(p_token_hash, '')));
  oid TEXT := trim(COALESCE(p_order_id, ''));
  preview JSONB;
  t public.rider_access_tokens%ROWTYPE;
  d public.order_deliveries%ROWTYPE;
  rid TEXT;
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  loc_id TEXT;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR abs(p_lat) > 90 OR abs(p_lng) > 180 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid coordinates');
  END IF;

  preview := public.get_rider_run_preview(h);
  IF NOT COALESCE((preview->>'is_valid')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(preview->>'invalid_reason', 'Access is not valid'));
  END IF;

  SELECT * INTO t FROM public.rider_access_tokens WHERE token_hash = h LIMIT 1;
  SELECT * INTO d FROM public.order_deliveries WHERE order_id = oid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery not found');
  END IF;

  IF NOT (
    (t.rider_id IS NOT NULL AND d.rider_id = t.rider_id)
    OR (
      t.rider_id IS NULL
      AND lower(trim(COALESCE(d.rider_name, ''))) = lower(trim(COALESCE(t.rider_name, '')))
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
  END IF;

  IF lower(trim(COALESCE(d.delivery_status, ''))) NOT IN ('out for delivery', 'delivery reported') THEN
    RETURN jsonb_build_object('success', false, 'error', 'GPS tracking is only active during Out for Delivery');
  END IF;

  rid := COALESCE(d.rider_id, t.rider_id);
  IF rid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rider id missing on delivery');
  END IF;

  SELECT id INTO loc_id FROM public.delivery_locations WHERE order_id = oid LIMIT 1;

  IF loc_id IS NULL THEN
    loc_id := 'dloc-' || substr(md5(random()::text), 1, 12);
    INSERT INTO public.delivery_locations (
      id, order_id, rider_id, latitude, longitude, accuracy, heading, speed, updated_at, created_at
    ) VALUES (
      loc_id, oid, rid, p_lat, p_lng, p_accuracy, p_heading, p_speed, now_ts, now_ts
    );
  ELSE
    UPDATE public.delivery_locations
    SET
      rider_id = rid,
      latitude = p_lat,
      longitude = p_lng,
      accuracy = p_accuracy,
      heading = p_heading,
      speed = p_speed,
      updated_at = now_ts
    WHERE order_id = oid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', loc_id,
    'order_id', oid,
    'rider_id', rid,
    'latitude', p_lat,
    'longitude', p_lng,
    'updated_at', now_ts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rider_upsert_delivery_location(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_upsert_delivery_location(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rider_clear_delivery_location(
  p_token_hash TEXT,
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h TEXT := lower(trim(COALESCE(p_token_hash, '')));
  oid TEXT := trim(COALESCE(p_order_id, ''));
  preview JSONB;
  t public.rider_access_tokens%ROWTYPE;
  d public.order_deliveries%ROWTYPE;
BEGIN
  preview := public.get_rider_run_preview(h);
  IF NOT COALESCE((preview->>'is_valid')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(preview->>'invalid_reason', 'Access is not valid'));
  END IF;

  SELECT * INTO t FROM public.rider_access_tokens WHERE token_hash = h LIMIT 1;
  SELECT * INTO d FROM public.order_deliveries WHERE order_id = oid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery not found');
  END IF;

  IF NOT (
    (t.rider_id IS NOT NULL AND d.rider_id = t.rider_id)
    OR (
      t.rider_id IS NULL
      AND lower(trim(COALESCE(d.rider_name, ''))) = lower(trim(COALESCE(t.rider_name, '')))
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
  END IF;

  DELETE FROM public.delivery_locations WHERE order_id = oid;
  RETURN jsonb_build_object('success', true, 'order_id', oid);
END;
$$;

REVOKE ALL ON FUNCTION public.rider_clear_delivery_location(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_clear_delivery_location(TEXT, TEXT) TO anon, authenticated;
