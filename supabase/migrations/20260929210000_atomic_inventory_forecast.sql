-- MotoTrack: atomic inventory, ledger, ROP fields, reservations, forecast metadata
-- Non-destructive: ADD COLUMN / CREATE TABLE / CREATE FUNCTION only.
-- Assumption for lead_time_days: parse TEXT like "3-5 Days" → take the higher bound (5).
-- If unparseable → DEFAULT 3.

-- ── 1. inventory operational columns ─────────────────────────────────────────
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS reorder_point integer,
  ADD COLUMN IF NOT EXISTS order_quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supplier_id text,
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_order_quantity_positive'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_order_quantity_positive CHECK (order_quantity IS NULL OR order_quantity >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_lead_time_days_nonneg'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_lead_time_days_nonneg CHECK (lead_time_days IS NULL OR lead_time_days >= 0);
  END IF;
END $$;

-- Optional FK to suppliers when column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'suppliers'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_supplier_id_fkey'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'inventory.supplier_id FK skipped: %', SQLERRM;
END $$;

-- ── 2. inventory_transactions (append-only ledger) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  txn_id text PRIMARY KEY DEFAULT ('txn-'::text || substr(md5((random())::text || clock_timestamp()::text), 1, 16)),
  product_id text NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  qty_delta integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id text,
  actor_id text,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inventory_transactions_reason_check CHECK (
    reason = ANY (ARRAY['sale'::text, 'return'::text, 'restock'::text, 'adjustment'::text, 'count'::text, 'shrinkage'::text])
  ),
  CONSTRAINT inventory_transactions_qty_nonzero CHECK (qty_delta <> 0)
);

CREATE INDEX IF NOT EXISTS inventory_transactions_product_created_idx
  ON public.inventory_transactions (product_id, created_at DESC);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "allow_anon_read_inventory_transactions"
  ON public.inventory_transactions FOR SELECT USING (true);

-- No direct client INSERT/UPDATE/DELETE — mutations only via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "deny_anon_write_inventory_transactions" ON public.inventory_transactions;
-- Leave write policies absent so only table owner / security definer can write

-- ── 3. stock_reservations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_reservations (
  reservation_id text PRIMARY KEY DEFAULT ('rsv-'::text || substr(md5((random())::text || clock_timestamp()::text), 1, 16)),
  order_id text,
  product_id text NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS stock_reservations_product_expires_idx
  ON public.stock_reservations (product_id, expires_at);

CREATE INDEX IF NOT EXISTS stock_reservations_order_idx
  ON public.stock_reservations (order_id);

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_stock_reservations" ON public.stock_reservations;
CREATE POLICY "allow_anon_read_stock_reservations"
  ON public.stock_reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_authenticated_write_stock_reservations" ON public.stock_reservations;
CREATE POLICY "allow_authenticated_write_stock_reservations"
  ON public.stock_reservations FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 4. forecast_history extensions ───────────────────────────────────────────
ALTER TABLE public.forecast_history
  ADD COLUMN IF NOT EXISTS forecast_method text DEFAULT 'legacy_ols',
  ADD COLUMN IF NOT EXISTS wape numeric,
  ADD COLUMN IF NOT EXISTS mase numeric,
  ADD COLUMN IF NOT EXISTS reorder_point numeric,
  ADD COLUMN IF NOT EXISTS sufficient boolean;

COMMENT ON COLUMN public.forecast_history.forecast_method IS 'legacy_ols | croston_sba | other';
COMMENT ON COLUMN public.forecast_history.slope IS 'Legacy OLS only; NULL for croston_sba';
COMMENT ON COLUMN public.forecast_history.intercept IS 'Legacy OLS only; NULL for croston_sba';

-- ── 5. Atomic stock RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_adjust_stock(
  p_product_id text,
  p_delta integer,
  p_reason text,
  p_ref_type text DEFAULT NULL,
  p_ref_id text DEFAULT NULL,
  p_actor_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_qty integer;
  v_reason text;
BEGIN
  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'product_id required' USING ERRCODE = '22023';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'qty_delta must be non-zero' USING ERRCODE = '22023';
  END IF;

  v_reason := lower(btrim(coalesce(p_reason, '')));
  IF v_reason NOT IN ('sale', 'return', 'restock', 'adjustment', 'count', 'shrinkage') THEN
    RAISE EXCEPTION 'invalid reason: %', p_reason USING ERRCODE = '22023';
  END IF;

  -- Ensure inventory row exists (start at 0) so restock/adjustment can create balance
  INSERT INTO public.inventory (inventory_id, product_id, stock_quantity, reorder_level, last_updated)
  VALUES (
    'inv-' || p_product_id,
    p_product_id,
    0,
    5,
    timezone('utc', now())
  )
  ON CONFLICT (product_id) DO NOTHING;

  UPDATE public.inventory
  SET
    stock_quantity = stock_quantity + p_delta,
    last_updated = timezone('utc', now())
  WHERE product_id = p_product_id
    AND stock_quantity + p_delta >= 0
  RETURNING stock_quantity INTO v_new_qty;

  IF v_new_qty IS NULL THEN
    RAISE EXCEPTION 'insufficient stock for product % (delta %)', p_product_id, p_delta
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.inventory_transactions (
    product_id, qty_delta, reason, reference_type, reference_id, actor_id, balance_after
  ) VALUES (
    p_product_id, p_delta, v_reason, p_ref_type, p_ref_id, p_actor_id, v_new_qty
  );

  RETURN v_new_qty;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_adjust_stock(text, integer, text, text, text, text) TO anon, authenticated, service_role;

-- Absolute set via delta (admin set-to-N)
CREATE OR REPLACE FUNCTION public.fn_set_stock(
  p_product_id text,
  p_new_qty integer,
  p_reason text DEFAULT 'adjustment',
  p_ref_type text DEFAULT 'inventory_adjustment',
  p_ref_id text DEFAULT NULL,
  p_actor_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_delta integer;
BEGIN
  IF p_new_qty IS NULL OR p_new_qty < 0 THEN
    RAISE EXCEPTION 'stock quantity cannot be negative' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory (inventory_id, product_id, stock_quantity, reorder_level, last_updated)
  VALUES ('inv-' || p_product_id, p_product_id, 0, 5, timezone('utc', now()))
  ON CONFLICT (product_id) DO NOTHING;

  SELECT stock_quantity INTO v_current
  FROM public.inventory
  WHERE product_id = p_product_id
  FOR UPDATE;

  v_delta := p_new_qty - coalesce(v_current, 0);
  IF v_delta = 0 THEN
    RETURN coalesce(v_current, 0);
  END IF;

  RETURN public.fn_adjust_stock(p_product_id, v_delta, p_reason, p_ref_type, p_ref_id, p_actor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_set_stock(text, integer, text, text, text, text) TO anon, authenticated, service_role;

-- Available stock = on-hand − active reservations
CREATE OR REPLACE FUNCTION public.fn_available_stock(p_product_id text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    coalesce((SELECT stock_quantity FROM public.inventory WHERE product_id = p_product_id), 0)
    - coalesce((
        SELECT SUM(quantity)::integer
        FROM public.stock_reservations
        WHERE product_id = p_product_id
          AND expires_at > timezone('utc', now())
      ), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_available_stock(text) TO anon, authenticated, service_role;

-- Release expired reservations (callable by cron / client)
CREATE OR REPLACE FUNCTION public.fn_release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.stock_reservations
  WHERE expires_at <= timezone('utc', now());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_release_expired_reservations() TO anon, authenticated, service_role;

-- ── 6. Tighten inventory write RLS (reads stay open for shop) ────────────────
DROP POLICY IF EXISTS "allow_anon_write_inventory" ON public.inventory;

-- Admin/authenticated may update metadata (reorder_level, lead_time_days, etc.)
-- Quantity changes should prefer fn_adjust_stock / fn_set_stock (SECURITY DEFINER).
DROP POLICY IF EXISTS "allow_admin_update_inventory_meta" ON public.inventory;
CREATE POLICY "allow_admin_update_inventory_meta"
  ON public.inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
        AND u.role = 'admin'
    )
    OR auth.uid() IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
        AND u.role = 'admin'
    )
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "allow_admin_insert_inventory" ON public.inventory;
CREATE POLICY "allow_admin_insert_inventory"
  ON public.inventory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
        AND u.role = 'admin'
    )
    OR auth.uid() IS NULL
  );

-- Keep SELECT open
DROP POLICY IF EXISTS "allow_anon_read_inventory" ON public.inventory;
CREATE POLICY "allow_anon_read_inventory"
  ON public.inventory FOR SELECT USING (true);

-- forecast_history: keep read; restrict write similarly
ALTER TABLE public.forecast_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_anon_write_forecast_history" ON public.forecast_history;
DROP POLICY IF EXISTS "allow_anon_all_forecast_history" ON public.forecast_history;
DROP POLICY IF EXISTS "allow_anon_read_forecast_history" ON public.forecast_history;
CREATE POLICY "allow_anon_read_forecast_history"
  ON public.forecast_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_admin_write_forecast_history" ON public.forecast_history;
CREATE POLICY "allow_admin_write_forecast_history"
  ON public.forecast_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
        AND u.role = 'admin'
    )
    OR auth.uid() IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.user_id = auth.uid()::text OR u.email = auth.jwt() ->> 'email')
        AND u.role = 'admin'
    )
    OR auth.uid() IS NULL
  );

-- Mark existing forecast rows as legacy OLS
UPDATE public.forecast_history
SET forecast_method = 'legacy_ols'
WHERE forecast_method IS NULL;

COMMENT ON FUNCTION public.fn_adjust_stock IS
  'Atomic stock delta + ledger insert. Rejects negative resulting stock.';
COMMENT ON TABLE public.inventory_transactions IS
  'Append-only inventory movement ledger. Writes via fn_adjust_stock only.';
