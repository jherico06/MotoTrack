-- =========================================================================
-- Migration 011: Secure single-use delivery confirmation tokens (QR / link)
-- Riders have no accounts. Admin shares a temporary token/QR; rider confirms
-- drop-off → order becomes Delivery Reported; admin then marks Delivered.
-- Token stores only a hash — never plaintext, never customer PII.
-- =========================================================================

-- Snapshot rider contact for ad-hoc assignment (no rider login required)
ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS rider_name TEXT,
  ADD COLUMN IF NOT EXISTS rider_contact TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_info TEXT;

-- Secure delivery confirmation token (hash only)
ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS confirmation_token_used_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS confirmation_token_invalidated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS confirmation_token_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS token_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_photo TEXT,
  ADD COLUMN IF NOT EXISTS delivery_issue_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_order_deliveries_token_hash
  ON public.order_deliveries(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

COMMENT ON COLUMN public.order_deliveries.confirmation_token_hash IS
  'SHA-256 hash of the single-use delivery confirmation token. Plaintext is never stored.';
COMMENT ON COLUMN public.order_deliveries.confirmation_token_expires_at IS
  'Token expiry (default 24h from generation). Configurable in app.';
COMMENT ON COLUMN public.order_deliveries.token_verified IS
  'True after rider successfully confirmed via valid token.';
COMMENT ON COLUMN public.order_deliveries.delivery_photo IS
  'Optional photo uploaded by rider on the public confirm page.';

-- Public-safe lookup: returns only non-sensitive fields needed for confirmation UI.
-- Token plaintext is never returned; callers pass sha256 hex of the token.
CREATE OR REPLACE FUNCTION public.get_delivery_confirm_preview(p_token_hash TEXT)
RETURNS TABLE (
  order_id TEXT,
  delivery_id TEXT,
  delivery_status TEXT,
  order_status TEXT,
  rider_name TEXT,
  rider_contact TEXT,
  item_count INTEGER,
  destination_hint TEXT,
  expected_delivery_at TIMESTAMP WITH TIME ZONE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  token_used BOOLEAN,
  token_invalidated BOOLEAN,
  token_expired BOOLEAN,
  is_valid BOOLEAN,
  invalid_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.order_deliveries%ROWTYPE;
  o public.orders%ROWTYPE;
  items_n INTEGER := 0;
  hint TEXT := '';
  used BOOLEAN;
  invalidated BOOLEAN;
  expired BOOLEAN;
  ofd BOOLEAN;
  reason TEXT := NULL;
  ok BOOLEAN := false;
BEGIN
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 16 THEN
    RETURN QUERY SELECT
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      0, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ,
      false, false, false, false, 'Invalid token'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO d
  FROM public.order_deliveries
  WHERE confirmation_token_hash = lower(trim(p_token_hash))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      0, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ,
      false, false, false, false, 'Token not found'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO o FROM public.orders WHERE orders.order_id = d.order_id LIMIT 1;

  SELECT coalesce(sum(oi.quantity), 0)::INTEGER INTO items_n
  FROM public.order_items oi
  WHERE oi.order_id = d.order_id;

  -- Masked destination: last segment of address only (barangay/city), no full address
  IF o.customer_address IS NOT NULL AND length(o.customer_address) > 0 THEN
    hint := trim(split_part(reverse(o.customer_address), ',', 1));
    hint := reverse(hint);
    IF length(hint) > 48 THEN
      hint := left(hint, 45) || '...';
    END IF;
  ELSE
    hint := 'Delivery address on file';
  END IF;

  used := d.confirmation_token_used_at IS NOT NULL OR coalesce(d.token_verified, false);
  invalidated := d.confirmation_token_invalidated_at IS NOT NULL;
  expired := d.confirmation_token_expires_at IS NOT NULL
             AND d.confirmation_token_expires_at < timezone('utc'::text, now());
  ofd := lower(coalesce(o.status, '')) IN ('out for delivery', 'shipped', 'in transit')
         OR lower(coalesce(d.delivery_status, '')) IN ('out for delivery', 'shipped', 'in transit');

  IF used THEN
    reason := 'Token already used';
  ELSIF invalidated THEN
    reason := 'Token invalidated';
  ELSIF expired THEN
    reason := 'Token expired';
  ELSIF NOT ofd THEN
    reason := 'Order is not out for delivery';
  ELSE
    ok := true;
  END IF;

  RETURN QUERY SELECT
    d.order_id,
    d.delivery_id,
    d.delivery_status,
    o.status,
    coalesce(d.rider_name, (SELECT r.name FROM public.riders r WHERE r.id = d.rider_id LIMIT 1)),
    coalesce(d.rider_contact, (SELECT r.phone FROM public.riders r WHERE r.id = d.rider_id LIMIT 1)),
    items_n,
    hint,
    d.expected_delivery_at,
    d.confirmation_token_expires_at,
    used,
    invalidated,
    expired,
    ok,
    reason;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_confirm_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_confirm_preview(TEXT) TO anon, authenticated;

-- Atomic rider confirm: validates token + order status, marks Delivery Reported, burns token
CREATE OR REPLACE FUNCTION public.confirm_delivery_by_token(
  p_token_hash TEXT,
  p_notes TEXT DEFAULT NULL,
  p_photo TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  order_id TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.order_deliveries%ROWTYPE;
  o public.orders%ROWTYPE;
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
  ofd BOOLEAN;
BEGIN
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 16 THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Invalid token'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO d
  FROM public.order_deliveries
  WHERE confirmation_token_hash = lower(trim(p_token_hash))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Token not found'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO o FROM public.orders WHERE orders.order_id = d.order_id FOR UPDATE;

  IF d.confirmation_token_used_at IS NOT NULL OR coalesce(d.token_verified, false) THEN
    RETURN QUERY SELECT false, d.order_id, 'Token already used'::TEXT;
    RETURN;
  END IF;
  IF d.confirmation_token_invalidated_at IS NOT NULL THEN
    RETURN QUERY SELECT false, d.order_id, 'Token invalidated'::TEXT;
    RETURN;
  END IF;
  IF d.confirmation_token_expires_at IS NOT NULL AND d.confirmation_token_expires_at < now_ts THEN
    RETURN QUERY SELECT false, d.order_id, 'Token expired'::TEXT;
    RETURN;
  END IF;

  ofd := lower(coalesce(o.status, '')) IN ('out for delivery', 'shipped', 'in transit');
  IF NOT ofd THEN
    RETURN QUERY SELECT false, d.order_id, 'Order is not out for delivery'::TEXT;
    RETURN;
  END IF;

  UPDATE public.order_deliveries SET
    delivery_status = 'Delivery Reported',
    rider_reported_delivered = true,
    rider_reported_at = now_ts,
    rider_reported_by = coalesce(d.rider_name, 'Rider (token)'),
    rider_report_notes = coalesce(nullif(trim(p_notes), ''), d.rider_report_notes),
    delivery_photo = coalesce(nullif(p_photo, ''), d.delivery_photo),
    proof_of_delivery = coalesce(nullif(p_photo, ''), d.proof_of_delivery),
    proof_uploaded_by = CASE
      WHEN nullif(p_photo, '') IS NOT NULL THEN coalesce(d.rider_name, 'Rider (token)')
      ELSE d.proof_uploaded_by
    END,
    proof_uploaded_at = CASE
      WHEN nullif(p_photo, '') IS NOT NULL THEN now_ts
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
  WHERE orders.order_id = d.order_id;

  INSERT INTO public.delivery_history (
    id, order_id, action, previous_status, new_status, performed_by, notes, metadata, created_at
  ) VALUES (
    'dh-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    d.order_id,
    'RIDER_TOKEN_CONFIRMED',
    o.status,
    'Delivery Reported',
    coalesce(d.rider_name, 'Rider (token)'),
    coalesce(nullif(trim(p_notes), ''), 'Rider confirmed delivery via secure QR/link'),
    jsonb_build_object(
      'token_verified', true,
      'has_photo', nullif(p_photo, '') IS NOT NULL,
      'rider_name', d.rider_name,
      'rider_contact', d.rider_contact
    ),
    now_ts
  );

  RETURN QUERY SELECT true, d.order_id, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_delivery_by_token(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_by_token(TEXT, TEXT, TEXT) TO anon, authenticated;
