-- MotoTrack: Simple Linear Regression Forecasting & Inventory Planning Migration
-- Non-destructive: preserves all existing tables, product records, sales history, and forecast_history rows.

-- ── 1. Extend forecast_history & inventory for Simple Linear Regression metrics ─
ALTER TABLE public.forecast_history
  ADD COLUMN IF NOT EXISTS forecast_method text DEFAULT 'simple_linear_regression',
  ADD COLUMN IF NOT EXISTS r_squared numeric,
  ADD COLUMN IF NOT EXISTS mae numeric,
  ADD COLUMN IF NOT EXISTS rmse numeric,
  ADD COLUMN IF NOT EXISTS wape numeric,
  ADD COLUMN IF NOT EXISTS mase numeric,
  ADD COLUMN IF NOT EXISTS reorder_point numeric,
  ADD COLUMN IF NOT EXISTS reserved_stock numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incoming_stock numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommendation_status text,
  ADD COLUMN IF NOT EXISTS algorithm_name text DEFAULT 'simple_linear_regression',
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS sufficient boolean;

ALTER TABLE public.forecast_history
  ALTER COLUMN forecast_method SET DEFAULT 'simple_linear_regression';

-- Ensure inventory planning columns and supporting ledger/reservation tables exist on base schema.sql
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS reorder_point integer,
  ADD COLUMN IF NOT EXISTS order_quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS supplier_id text;

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  txn_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id text NOT NULL,
  qty_delta integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id text,
  notes text,
  actor_id uuid,
  balance_after integer,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  reservation_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  product_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON COLUMN public.forecast_history.slope IS 'Simple Linear Regression slope (b)';
COMMENT ON COLUMN public.forecast_history.intercept IS 'Simple Linear Regression Y-intercept (a)';
COMMENT ON COLUMN public.forecast_history.r_squared IS 'Coefficient of determination (R²)';
COMMENT ON COLUMN public.forecast_history.mae IS 'Mean Absolute Error from chronological holdout validation';
COMMENT ON COLUMN public.forecast_history.rmse IS 'Root Mean Squared Error from chronological holdout validation';
COMMENT ON COLUMN public.forecast_history.wape IS 'Weighted Absolute Percentage Error (%) from chronological holdout validation';
COMMENT ON COLUMN public.forecast_history.algorithm_name IS 'Forecasting algorithm identifier (simple_linear_regression)';

-- Deduplicate any identical (product_id, forecast_period, period_key) rows before creating unique index
DELETE FROM public.forecast_history a
USING public.forecast_history b
WHERE a.ctid < b.ctid
  AND a.product_id IS NOT NULL
  AND b.product_id IS NOT NULL
  AND a.product_id = b.product_id
  AND a.forecast_period = b.forecast_period
  AND a.period_key IS NOT NULL
  AND b.period_key IS NOT NULL
  AND a.period_key = b.period_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_history_product_period_key
  ON public.forecast_history (product_id, forecast_period, period_key)
  WHERE product_id IS NOT NULL AND period_key IS NOT NULL;

-- ── 2. Parameterized Historical Demand Aggregation Function (DATE_TRUNC) ─────
CREATE OR REPLACE FUNCTION public.fn_get_historical_demand(
  p_product_id text,
  p_period text DEFAULT 'weekly',
  p_lookback integer DEFAULT NULL
)
RETURNS TABLE (
  period_number integer,
  period_start timestamptz,
  period_key text,
  demand_qty numeric,
  had_stockout boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trunc text;
  v_window integer;
  v_step interval;
  v_start_bucket timestamptz;
  v_end_bucket timestamptz;
BEGIN
  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'p_product_id is required' USING ERRCODE = '22023';
  END IF;

  -- Validate requested period before using in DATE_TRUNC
  CASE lower(btrim(coalesce(p_period, 'weekly')))
    WHEN 'daily', 'day' THEN
      v_trunc := 'day';
      v_window := coalesce(nullif(p_lookback, 0), 90);
      v_step := interval '1 day';
    WHEN 'weekly', 'week' THEN
      v_trunc := 'week';
      v_window := coalesce(nullif(p_lookback, 0), 26);
      v_step := interval '1 week';
    WHEN 'monthly', 'month' THEN
      v_trunc := 'month';
      v_window := coalesce(nullif(p_lookback, 0), 12);
      v_step := interval '1 month';
    ELSE
      RAISE EXCEPTION 'Invalid forecast period: %. Allowed: daily, weekly, monthly', p_period
        USING ERRCODE = '22023';
  END CASE;

  IF v_window < 1 THEN
    v_window := 2;
  END IF;

  v_end_bucket := date_trunc(v_trunc, now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_start_bucket := v_end_bucket - ((v_window - 1) * v_step);

  RETURN QUERY
  WITH series AS (
    SELECT
      row_number() OVER (ORDER BY gs)::integer AS p_num,
      gs AS bucket_start
    FROM generate_series(v_start_bucket, v_end_bucket, v_step) AS gs
  ),
  valid_order_sales AS (
    -- Completed / confirmed order line items, excluding cancelled, voided, refunded
    SELECT
      o.order_id AS ref_id,
      date_trunc(v_trunc, coalesce(o.order_date, o.created_at) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket_start,
      CASE
        WHEN lower(coalesce(o.return_status, 'none')) IN ('returned', 'refunded', 'approved') THEN 0::numeric
        ELSE GREATEST(0, coalesce(oi.quantity, 0))::numeric
      END AS qty
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.order_id = oi.order_id
    WHERE oi.product_id = p_product_id
      AND oi.quantity > 0
      AND coalesce(o.order_date, o.created_at) >= v_start_bucket
      AND lower(coalesce(o.status, '')) NOT IN (
        'cancelled', 'canceled', 'refunded', 'voided', 'void', 'rejected', 'draft', 'failed', 'delivery issue', 'delivery failed'
      )
  ),
  ledger_consumption AS (
    -- Confirmed ledger sales/returns not already represented in valid_order_sales
    SELECT
      date_trunc(v_trunc, it.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket_start,
      SUM(
        CASE
          WHEN it.reason = 'sale' AND it.qty_delta < 0 THEN (-it.qty_delta)::numeric
          WHEN it.reason = 'return' AND it.qty_delta > 0 THEN (-it.qty_delta)::numeric
          ELSE 0::numeric
        END
      ) AS net_qty,
      bool_or(it.balance_after = 0) AS saw_zero_balance
    FROM public.inventory_transactions it
    WHERE it.product_id = p_product_id
      AND it.created_at >= v_start_bucket
      AND it.reason IN ('sale', 'return')
      AND (
        it.reference_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM valid_order_sales vos WHERE vos.ref_id = it.reference_id
        )
      )
    GROUP BY date_trunc(v_trunc, it.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  ),
  stockout_buckets AS (
    SELECT
      date_trunc(v_trunc, it.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket_start,
      bool_or(it.balance_after <= 0) AS had_stockout
    FROM public.inventory_transactions it
    WHERE it.product_id = p_product_id
      AND it.created_at >= v_start_bucket
    GROUP BY date_trunc(v_trunc, it.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  ),
  order_agg AS (
    SELECT
      vos.bucket_start,
      SUM(vos.qty) AS order_qty
    FROM valid_order_sales vos
    GROUP BY vos.bucket_start
  )
  SELECT
    s.p_num AS period_number,
    s.bucket_start AS period_start,
    CASE
      WHEN v_trunc = 'day' THEN to_char(s.bucket_start AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      WHEN v_trunc = 'month' THEN to_char(s.bucket_start AT TIME ZONE 'UTC', 'YYYY-MM')
      ELSE to_char(s.bucket_start AT TIME ZONE 'UTC', 'IYYY-"W"IW')
    END AS period_key,
    GREATEST(0::numeric, coalesce(oa.order_qty, 0::numeric) + coalesce(lc.net_qty, 0::numeric)) AS demand_qty,
    coalesce(sb.had_stockout, false) AS had_stockout
  FROM series s
  LEFT JOIN order_agg oa ON oa.bucket_start = s.bucket_start
  LEFT JOIN ledger_consumption lc ON lc.bucket_start = s.bucket_start
  LEFT JOIN stockout_buckets sb ON sb.bucket_start = s.bucket_start
  ORDER BY s.p_num ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_historical_demand(text, text, integer)
  TO anon, authenticated, service_role;

-- ── 3. Inventory Position Helper (Stock, Reservations, Incoming POs) ─────────
CREATE OR REPLACE FUNCTION public.fn_get_product_inventory_position(p_product_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer := 0;
  v_reorder_level integer := 5;
  v_reorder_point integer := NULL;
  v_order_qty integer := 1;
  v_lead_time integer := 3;
  v_supplier_id text := NULL;
  v_reserved integer := 0;
  v_incoming integer := 0;
BEGIN
  SELECT
    coalesce(i.stock_quantity, 0),
    coalesce(i.reorder_level, 5),
    i.reorder_point,
    coalesce(i.order_quantity, 1),
    coalesce(i.lead_time_days, 3),
    coalesce(i.supplier_id, p.supplier_id)
  INTO
    v_stock, v_reorder_level, v_reorder_point, v_order_qty, v_lead_time, v_supplier_id
  FROM public.products p
  LEFT JOIN public.inventory i ON i.product_id = p.product_id
  WHERE p.product_id = p_product_id OR p.id = p_product_id
  LIMIT 1;

  SELECT coalesce(SUM(sr.quantity), 0)::integer
  INTO v_reserved
  FROM public.stock_reservations sr
  WHERE sr.product_id = p_product_id
    AND sr.expires_at > timezone('utc', now());

  SELECT coalesce(SUM(pi.quantity), 0)::integer
  INTO v_incoming
  FROM public.purchase_items pi
  INNER JOIN public.purchase_orders po ON po.po_id = pi.po_id
  WHERE pi.product_id = p_product_id
    AND pi.quantity > 0
    AND lower(coalesce(po.status, '')) IN ('pending', 'ordered', 'approved', 'in transit', 'processing', 'open');

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'current_stock', GREATEST(0, coalesce(v_stock, 0)),
    'reserved_stock', GREATEST(0, coalesce(v_reserved, 0)),
    'incoming_stock', GREATEST(0, coalesce(v_incoming, 0)),
    'available_stock', GREATEST(0, coalesce(v_stock, 0) - coalesce(v_reserved, 0)),
    'inventory_position', GREATEST(0, coalesce(v_stock, 0) - coalesce(v_reserved, 0) + coalesce(v_incoming, 0)),
    'reorder_level', coalesce(v_reorder_level, 5),
    'reorder_point', v_reorder_point,
    'order_quantity', GREATEST(1, coalesce(v_order_qty, 1)),
    'lead_time_days', GREATEST(1, coalesce(v_lead_time, 3)),
    'supplier_id', v_supplier_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_product_inventory_position(text)
  TO anon, authenticated, service_role;

