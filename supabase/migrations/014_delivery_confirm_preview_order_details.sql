-- =========================================================================
-- Migration 014: Expand delivery confirm preview with order details for riders
-- Token-gated (SECURITY DEFINER). Full address/items only when token hash matches.
-- =========================================================================

DROP FUNCTION IF EXISTS public.get_delivery_confirm_preview(TEXT);

CREATE FUNCTION public.get_delivery_confirm_preview(p_token_hash TEXT)
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
  invalid_reason TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  payment_method TEXT,
  total_amount NUMERIC,
  shipping_fee NUMERIC,
  discount_amount NUMERIC,
  items_summary TEXT,
  items JSONB
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
  items_json JSONB := '[]'::JSONB;
BEGIN
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 16 THEN
    RETURN QUERY SELECT
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      0, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ,
      false, false, false, false, 'Invalid token'::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, '[]'::JSONB;
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
      false, false, false, false, 'Token not found'::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, '[]'::JSONB;
    RETURN;
  END IF;

  SELECT * INTO o FROM public.orders WHERE orders.order_id = d.order_id LIMIT 1;

  SELECT coalesce(sum(oi.quantity), 0)::INTEGER INTO items_n
  FROM public.order_items oi
  WHERE oi.order_id = d.order_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', coalesce(p.name, 'Motorcycle Part'),
        'brand', coalesce(p.brand, 'MotoTrack'),
        'quantity', coalesce(oi.quantity, 1),
        'price', coalesce(oi.cost, p.price, 0),
        'size', oi.size,
        'image', p.image
      )
      ORDER BY oi.order_item_id
    ),
    '[]'::JSONB
  )
  INTO items_json
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.product_id = oi.product_id OR p.id = oi.product_id
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
    reason,
    o.customer_name,
    o.customer_phone,
    o.customer_address,
    o.payment_method,
    coalesce(o.grand_total, o.total_amount, 0)::NUMERIC,
    coalesce(o.shipping_fee, 0)::NUMERIC,
    coalesce(o.discount_amount, 0)::NUMERIC,
    o.items_summary,
    items_json;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_confirm_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_confirm_preview(TEXT) TO anon, authenticated;
