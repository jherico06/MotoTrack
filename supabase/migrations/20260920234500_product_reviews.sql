-- Customer product reviews for store product detail pages
CREATE TABLE IF NOT EXISTS public.product_reviews (
  review_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  order_id TEXT,
  customer_name TEXT NOT NULL DEFAULT 'Rider',
  rating NUMERIC(2,1) NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON public.product_reviews (created_at DESC);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_reviews_select_all ON public.product_reviews;
CREATE POLICY product_reviews_select_all ON public.product_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS product_reviews_insert_authenticated ON public.product_reviews;
CREATE POLICY product_reviews_insert_authenticated ON public.product_reviews
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.product_reviews IS 'Customer product reviews shown on store product detail';
