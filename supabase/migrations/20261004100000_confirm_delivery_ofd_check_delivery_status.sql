-- Align confirm_delivery_by_token OFD check with preview:
-- allow either orders.status OR order_deliveries.delivery_status to be out-for-delivery.
-- Also clarify already-used / invalidated token error messages for riders.

CREATE OR REPLACE FUNCTION public.confirm_delivery_by_token(
  p_token_hash text,
  p_notes text DEFAULT NULL::text,
  p_photo text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, order_id text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    RETURN QUERY SELECT false, d.order_id, 'Token already used — delivery already reported. Waiting for store admin.'::TEXT;
    RETURN;
  END IF;
  IF d.confirmation_token_invalidated_at IS NOT NULL THEN
    RETURN QUERY SELECT false, d.order_id, 'Token invalidated — ask store to regenerate QR and re-print label.'::TEXT;
    RETURN;
  END IF;

  ofd := lower(coalesce(o.status, '')) IN ('out for delivery', 'shipped', 'in transit')
         OR lower(coalesce(d.delivery_status, '')) IN ('out for delivery', 'shipped', 'in transit');
  IF NOT ofd THEN
    RETURN QUERY SELECT false, d.order_id, 'Order is not out for delivery — rider must start delivery first.'::TEXT;
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
    confirmation_token_expires_at = NULL,
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
$function$;
