-- =========================================================================
-- Rider delivery dashboard: temporary hashed access tokens (no rider login).
-- Stores customer lat/lng + landmark so riders can navigate in Google Maps.
-- Public RPCs only — plaintext tokens and the token table are never exposed.
-- =========================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_landmark TEXT;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS landmark TEXT;

CREATE TABLE IF NOT EXISTS public.rider_access_tokens (
  access_id TEXT PRIMARY KEY DEFAULT ('rat-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
  rider_key TEXT NOT NULL,
  rider_id TEXT,
  rider_name TEXT,
  rider_contact TEXT,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invalidated_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rider_access_tokens_hash
  ON public.rider_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_rider_access_tokens_rider_key
  ON public.rider_access_tokens(rider_key);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_coords
  ON public.orders(delivery_lat, delivery_lng)
  WHERE delivery_lat IS NOT NULL;

COMMENT ON TABLE public.rider_access_tokens IS
  'Temporary rider dashboard access. Only SHA-256 hashes are stored; plaintext is shown once to admin.';

ALTER TABLE public.rider_access_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rider_access_tokens FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._rider_access_area(p_address TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(reverse(split_part(reverse(COALESCE(p_address, '')), ',', 1))), ''),
    'Unspecified area'
  );
$$;

CREATE OR REPLACE FUNCTION public._rider_access_is_active_status(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(p_status, ''))) IN (
    'ready for delivery',
    'out for delivery',
    'shipped',
    'in transit',
    'delivery issue',
    'delivery failed',
    'failed',
    'rescheduled',
    'delivery reported',
    'reported'
  );
$$;

CREATE OR REPLACE FUNCTION public._rider_access_is_done_status(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(p_status, ''))) IN (
    'delivered',
    'cancelled',
    'canceled',
    'returned'
  );
$$;

REVOKE ALL ON FUNCTION public._rider_access_area(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._rider_access_is_active_status(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._rider_access_is_done_status(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_rider_access_token(
  p_token_hash TEXT,
  p_rider_id TEXT DEFAULT NULL,
  p_rider_name TEXT DEFAULT NULL,
  p_rider_contact TEXT DEFAULT NULL,
  p_ttl_hours INTEGER DEFAULT 48,
  p_created_by TEXT DEFAULT NULL,
  p_force_new BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  ttl INTEGER := GREATEST(COALESCE(p_ttl_hours, 48), 1);
  new_exp TIMESTAMPTZ := now_ts + make_interval(hours => ttl);
  h TEXT := lower(trim(COALESCE(p_token_hash, '')));
  rkey TEXT;
  existing public.rider_access_tokens%ROWTYPE;
  reused BOOLEAN := false;
BEGIN
  IF length(h) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token hash');
  END IF;

  rkey := COALESCE(
    NULLIF(trim(COALESCE(p_rider_id, '')), ''),
    'adhoc:' || lower(trim(COALESCE(p_rider_name, ''))) || '|' ||
      regexp_replace(COALESCE(p_rider_contact, ''), '[^0-9]', '', 'g')
  );

  IF rkey IS NULL OR rkey = '' OR rkey = 'adhoc:|' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rider identity is required');
  END IF;

  SELECT * INTO existing
  FROM public.rider_access_tokens
  WHERE rider_key = rkey
    AND invalidated_at IS NULL
    AND expires_at > now_ts
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing.access_id IS NOT NULL AND NOT COALESCE(p_force_new, false) AND existing.token_hash = h THEN
    UPDATE public.rider_access_tokens SET
      expires_at = new_exp,
      rider_id = COALESCE(NULLIF(trim(COALESCE(p_rider_id, '')), ''), existing.rider_id),
      rider_name = COALESCE(NULLIF(trim(COALESCE(p_rider_name, '')), ''), existing.rider_name),
      rider_contact = COALESCE(NULLIF(trim(COALESCE(p_rider_contact, '')), ''), existing.rider_contact),
      updated_at = now_ts
    WHERE access_id = existing.access_id;
    reused := true;
    RETURN jsonb_build_object(
      'success', true,
      'reused', true,
      'access_id', existing.access_id,
      'expires_at', new_exp,
      'rider_key', rkey
    );
  END IF;

  IF existing.access_id IS NOT NULL THEN
    UPDATE public.rider_access_tokens
    SET invalidated_at = now_ts, updated_at = now_ts
    WHERE rider_key = rkey
      AND invalidated_at IS NULL;
  END IF;

  INSERT INTO public.rider_access_tokens (
    rider_key, rider_id, rider_name, rider_contact, token_hash,
    expires_at, created_by, created_at, updated_at
  ) VALUES (
    rkey,
    NULLIF(trim(COALESCE(p_rider_id, '')), ''),
    NULLIF(trim(COALESCE(p_rider_name, '')), ''),
    NULLIF(trim(COALESCE(p_rider_contact, '')), ''),
    h,
    new_exp,
    NULLIF(trim(COALESCE(p_created_by, '')), ''),
    now_ts,
    now_ts
  );

  RETURN jsonb_build_object(
    'success', true,
    'reused', reused,
    'expires_at', new_exp,
    'rider_key', rkey
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_rider_access_token(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_rider_access_token(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_rider_run_preview(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  h TEXT := lower(trim(COALESCE(p_token_hash, '')));
  t public.rider_access_tokens%ROWTYPE;
  active_n INTEGER := 0;
  done_n INTEGER := 0;
  deliveries JSONB := '[]'::jsonb;
  expired BOOLEAN;
  invalidated BOOLEAN;
  reason TEXT := NULL;
  ok BOOLEAN := false;
BEGIN
  IF length(h) < 16 THEN
    RETURN jsonb_build_object('is_valid', false, 'invalid_reason', 'Invalid token', 'deliveries', '[]'::jsonb);
  END IF;

  SELECT * INTO t
  FROM public.rider_access_tokens
  WHERE token_hash = h
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'invalid_reason', 'Access link not found', 'deliveries', '[]'::jsonb);
  END IF;

  expired := t.expires_at IS NOT NULL AND t.expires_at < now_ts;
  invalidated := t.invalidated_at IS NOT NULL;

  SELECT
    COUNT(*) FILTER (
      WHERE public._rider_access_is_active_status(COALESCE(d.delivery_status, o.status))
    ),
    COUNT(*) FILTER (
      WHERE public._rider_access_is_done_status(COALESCE(d.delivery_status, o.status))
    )
  INTO active_n, done_n
  FROM public.order_deliveries d
  JOIN public.orders o ON o.order_id = d.order_id
  WHERE (
    (t.rider_id IS NOT NULL AND d.rider_id = t.rider_id)
    OR (
      t.rider_id IS NULL
      AND lower(trim(COALESCE(d.rider_name, ''))) = lower(trim(COALESCE(t.rider_name, '')))
      AND regexp_replace(COALESCE(d.rider_contact, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(t.rider_contact, ''), '[^0-9]', '', 'g')
    )
  );

  IF invalidated THEN
    reason := 'Access link invalidated';
  ELSIF expired THEN
    reason := 'Access period ended';
  ELSIF active_n = 0 THEN
    reason := 'All assigned deliveries completed';
  ELSE
    ok := true;
  END IF;

  IF ok THEN
    UPDATE public.rider_access_tokens
    SET last_used_at = now_ts
    WHERE access_id = t.access_id;

    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.area, x.customer_name), '[]'::jsonb)
    INTO deliveries
    FROM (
      SELECT
        o.order_id,
        d.delivery_id,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        COALESCE(NULLIF(trim(o.delivery_landmark), ''), NULLIF(trim(o.delivery_notes), ''), NULLIF(trim(d.delivery_notes), '')) AS landmark,
        COALESCE(d.delivery_status, o.status) AS delivery_status,
        o.status AS order_status,
        o.delivery_lat,
        o.delivery_lng,
        o.payment_method,
        o.items_summary,
        o.items_count,
        d.expected_delivery_at,
        d.rider_name,
        d.rider_contact,
        d.vehicle_info,
        public._rider_access_area(o.customer_address) AS area,
        COALESCE(d.token_verified, false) AS token_verified,
        COALESCE(d.rider_reported_delivered, false) AS rider_reported_delivered
      FROM public.order_deliveries d
      JOIN public.orders o ON o.order_id = d.order_id
      WHERE (
        (t.rider_id IS NOT NULL AND d.rider_id = t.rider_id)
        OR (
          t.rider_id IS NULL
          AND lower(trim(COALESCE(d.rider_name, ''))) = lower(trim(COALESCE(t.rider_name, '')))
          AND regexp_replace(COALESCE(d.rider_contact, ''), '[^0-9]', '', 'g')
              = regexp_replace(COALESCE(t.rider_contact, ''), '[^0-9]', '', 'g')
        )
      )
      AND public._rider_access_is_active_status(COALESCE(d.delivery_status, o.status))
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'is_valid', ok,
    'invalid_reason', reason,
    'expires_at', t.expires_at,
    'expired', expired,
    'invalidated', invalidated,
    'rider_name', t.rider_name,
    'rider_contact', t.rider_contact,
    'active_count', active_n,
    'completed_count', done_n,
    'deliveries', COALESCE(deliveries, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_rider_run_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rider_run_preview(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rider_update_delivery_status(
  p_token_hash TEXT,
  p_order_id TEXT,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  h TEXT := lower(trim(COALESCE(p_token_hash, '')));
  oid TEXT := trim(COALESCE(p_order_id, ''));
  next_status TEXT := trim(COALESCE(p_new_status, ''));
  t public.rider_access_tokens%ROWTYPE;
  d public.order_deliveries%ROWTYPE;
  o public.orders%ROWTYPE;
  preview JSONB;
  allowed BOOLEAN := false;
  prev_status TEXT;
BEGIN
  preview := public.get_rider_run_preview(h);
  IF NOT COALESCE((preview->>'is_valid')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(preview->>'invalid_reason', 'Access is not valid'));
  END IF;

  SELECT * INTO t FROM public.rider_access_tokens WHERE token_hash = h LIMIT 1;

  SELECT * INTO d FROM public.order_deliveries WHERE order_id = oid FOR UPDATE;
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

  SELECT * INTO o FROM public.orders WHERE order_id = oid FOR UPDATE;
  prev_status := COALESCE(d.delivery_status, o.status);

  IF lower(next_status) IN ('out for delivery', 'shipped', 'in transit') THEN
    next_status := 'Out for Delivery';
    allowed := public._rider_access_is_active_status(prev_status)
               AND NOT public._rider_access_is_done_status(prev_status)
               AND lower(prev_status) NOT IN ('delivery reported', 'reported');
  ELSIF lower(next_status) IN ('delivery issue', 'delivery failed', 'failed') THEN
    next_status := 'Delivery Issue';
    allowed := lower(prev_status) IN ('out for delivery', 'shipped', 'in transit', 'delivery issue', 'ready for delivery');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Riders can only mark On the way or Delivery issue. Scan the order QR to confirm drop-off.');
  END IF;

  IF NOT allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change status from ' || COALESCE(prev_status, 'unknown'));
  END IF;

  UPDATE public.order_deliveries SET
    delivery_status = next_status,
    delivery_issue_notes = CASE
      WHEN next_status = 'Delivery Issue' THEN COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), d.delivery_issue_notes)
      ELSE d.delivery_issue_notes
    END,
    updated_at = now_ts
  WHERE delivery_id = d.delivery_id;

  UPDATE public.orders SET
    status = next_status,
    estimated_delivery = CASE
      WHEN next_status = 'Out for Delivery' THEN 'Out for delivery — rider en route'
      WHEN next_status = 'Delivery Issue' THEN 'Delivery issue reported by rider'
      ELSE estimated_delivery
    END,
    updated_at = now_ts
  WHERE order_id = oid;

  INSERT INTO public.delivery_history (
    id, order_id, action, previous_status, new_status, performed_by, notes, metadata, created_at
  ) VALUES (
    'dh-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    oid,
    CASE WHEN next_status = 'Delivery Issue' THEN 'RIDER_STATUS_ISSUE' ELSE 'RIDER_STATUS_OUT' END,
    prev_status,
    next_status,
    COALESCE(t.rider_name, d.rider_name, 'Rider'),
    COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Updated from rider dashboard'),
    jsonb_build_object('via', 'rider_access_token', 'rider_name', t.rider_name),
    now_ts
  );

  RETURN jsonb_build_object('success', true, 'order_id', oid, 'delivery_status', next_status);
END;
$$;

REVOKE ALL ON FUNCTION public.rider_update_delivery_status(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_update_delivery_status(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rider_confirm_delivery_by_qr(
  p_access_hash TEXT,
  p_order_id TEXT,
  p_confirm_token_hash TEXT,
  p_notes TEXT DEFAULT NULL,
  p_photo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  ah TEXT := lower(trim(COALESCE(p_access_hash, '')));
  ch TEXT := lower(trim(COALESCE(p_confirm_token_hash, '')));
  oid TEXT := trim(COALESCE(p_order_id, ''));
  t public.rider_access_tokens%ROWTYPE;
  d public.order_deliveries%ROWTYPE;
  o public.orders%ROWTYPE;
  preview JSONB;
  ofd BOOLEAN;
BEGIN
  preview := public.get_rider_run_preview(ah);
  IF NOT COALESCE((preview->>'is_valid')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(preview->>'invalid_reason', 'Access is not valid'));
  END IF;

  IF length(ch) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Scan the customer order QR to confirm this delivery');
  END IF;

  SELECT * INTO t FROM public.rider_access_tokens WHERE token_hash = ah LIMIT 1;
  SELECT * INTO d FROM public.order_deliveries WHERE order_id = oid FOR UPDATE;
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

  IF d.confirmation_token_hash IS NULL OR length(trim(d.confirmation_token_hash)) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No order QR on file. Ask the store to print the packing label.');
  END IF;

  IF lower(trim(d.confirmation_token_hash)) <> ch THEN
    RETURN jsonb_build_object('success', false, 'error', 'That QR does not match this order. Scan the label on this parcel.');
  END IF;

  SELECT * INTO o FROM public.orders WHERE order_id = oid FOR UPDATE;

  IF d.confirmation_token_used_at IS NOT NULL OR COALESCE(d.token_verified, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order was already confirmed');
  END IF;
  IF d.confirmation_token_invalidated_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order QR is no longer valid');
  END IF;

  ofd := lower(COALESCE(o.status, '')) IN ('out for delivery', 'shipped', 'in transit')
      OR lower(COALESCE(d.delivery_status, '')) IN ('out for delivery', 'shipped', 'in transit');
  IF NOT ofd THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mark this stop as On the way before scanning the QR');
  END IF;

  UPDATE public.order_deliveries SET
    delivery_status = 'Delivery Reported',
    rider_reported_delivered = true,
    rider_reported_at = now_ts,
    rider_reported_by = COALESCE(t.rider_name, d.rider_name, 'Rider'),
    rider_report_notes = COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), d.rider_report_notes),
    delivery_photo = COALESCE(NULLIF(p_photo, ''), d.delivery_photo),
    proof_of_delivery = COALESCE(NULLIF(p_photo, ''), d.proof_of_delivery),
    proof_uploaded_by = CASE
      WHEN NULLIF(p_photo, '') IS NOT NULL THEN COALESCE(t.rider_name, d.rider_name, 'Rider')
      ELSE d.proof_uploaded_by
    END,
    proof_uploaded_at = CASE
      WHEN NULLIF(p_photo, '') IS NOT NULL THEN now_ts
      ELSE d.proof_uploaded_at
    END,
    token_verified = true,
    confirmation_token_used_at = now_ts,
    updated_at = now_ts
  WHERE delivery_id = d.delivery_id;

  UPDATE public.orders SET
    status = 'Delivery Reported',
    estimated_delivery = 'Delivery reported — awaiting admin confirmation',
    updated_at = now_ts
  WHERE order_id = oid;

  INSERT INTO public.delivery_history (
    id, order_id, action, previous_status, new_status, performed_by, notes, metadata, created_at
  ) VALUES (
    'dh-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    oid,
    'RIDER_QR_CONFIRMED',
    o.status,
    'Delivery Reported',
    COALESCE(t.rider_name, d.rider_name, 'Rider'),
    COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Rider scanned order QR from dashboard'),
    jsonb_build_object('via', 'rider_access_token', 'token_verified', true),
    now_ts
  );

  RETURN jsonb_build_object('success', true, 'order_id', oid, 'delivery_status', 'Delivery Reported');
END;
$$;

REVOKE ALL ON FUNCTION public.rider_confirm_delivery_by_qr(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_confirm_delivery_by_qr(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rider_save_delivery_coords(
  p_token_hash TEXT,
  p_order_id TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
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

  UPDATE public.orders
  SET delivery_lat = p_lat, delivery_lng = p_lng, updated_at = timezone('utc'::text, now())
  WHERE order_id = oid
    AND (delivery_lat IS NULL OR delivery_lng IS NULL);

  RETURN jsonb_build_object('success', true, 'order_id', oid, 'delivery_lat', p_lat, 'delivery_lng', p_lng);
END;
$$;

REVOKE ALL ON FUNCTION public.rider_save_delivery_coords(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_save_delivery_coords(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
