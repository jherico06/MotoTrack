-- New products start unrated (no fake 5.0 stars).
ALTER TABLE public.products ALTER COLUMN rating SET DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN reviews SET DEFAULT 0;

-- Strip leftover admin-form compare-at (₱42,500) that was never a real promo.
UPDATE public.products
SET old_price = NULL
WHERE old_price IS NOT NULL
  AND old_price = 42500
  AND price < 30000;

UPDATE public.products
SET old_price = NULL
WHERE old_price IS NOT NULL
  AND price > 0
  AND ((old_price - price) / old_price) >= 0.90
  AND old_price >= 10000;

-- Engine oil was showing "From ₱18,500" because Pirelli tire sizes leaked onto it.
UPDATE public.products
SET sizes = '[]'::jsonb
WHERE lower(name) LIKE '%engine oil%'
  AND (
    sizes::text ILIKE '%ZR17%'
    OR sizes::text ILIKE '%/70%'
    OR sizes::text ILIKE '%/55%'
  );

-- Reset denormalized rating/review counts, then rebuild from real product_reviews.
UPDATE public.products SET rating = 0, reviews = 0;

UPDATE public.products p
SET
  reviews = sub.cnt,
  rating = sub.avg_rating
FROM (
  SELECT
    product_id,
    COUNT(*)::int AS cnt,
    ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM public.product_reviews
  GROUP BY product_id
) sub
WHERE p.product_id = sub.product_id;
