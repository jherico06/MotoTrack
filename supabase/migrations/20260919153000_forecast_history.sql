-- Forecast history for Sales Forecast & Stock Optimization module
CREATE TABLE IF NOT EXISTS public.forecast_history (
  forecast_id TEXT PRIMARY KEY DEFAULT ('fc-' || substr(md5(random()::text), 1, 12)),
  product_id TEXT REFERENCES public.products(product_id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  forecast_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  forecast_period TEXT NOT NULL DEFAULT 'week',
  period_label TEXT,
  period_key TEXT,
  predicted_quantity NUMERIC NOT NULL DEFAULT 0,
  actual_quantity NUMERIC,
  slope NUMERIC,
  intercept NUMERIC,
  safety_stock NUMERIC,
  current_stock NUMERIC,
  recommended_restock NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecast_history_product ON public.forecast_history(product_id);
CREATE INDEX IF NOT EXISTS idx_forecast_history_created ON public.forecast_history(created_at DESC);

ALTER TABLE public.forecast_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_anon_read_forecast_history ON public.forecast_history;
CREATE POLICY allow_anon_read_forecast_history ON public.forecast_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS allow_anon_write_forecast_history ON public.forecast_history;
CREATE POLICY allow_anon_write_forecast_history ON public.forecast_history
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_history TO anon, authenticated;
