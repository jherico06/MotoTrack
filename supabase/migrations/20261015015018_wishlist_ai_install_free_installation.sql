-- Wishlist for AI install previews + Free Installation promo type + booking link

-- 1) Allow FREE_INSTALLATION promo type (per-product via promo_products)
ALTER TABLE public.promos DROP CONSTRAINT IF EXISTS promos_promo_type_check;
ALTER TABLE public.promos
  ADD CONSTRAINT promos_promo_type_check
  CHECK (promo_type IN ('FREE_SHIPPING', 'PERCENT_OFF', 'FREE_INSTALLATION'));

COMMENT ON COLUMN public.promos.promo_type IS 'FREE_SHIPPING | PERCENT_OFF | FREE_INSTALLATION';

-- 2) Link bookings to saved AI customizations
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customization_id TEXT REFERENCES public.customizations(customization_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installation_fee_waived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installation_promo_id TEXT REFERENCES public.promos(promo_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_customization_id
  ON public.bookings(customization_id)
  WHERE customization_id IS NOT NULL;

COMMENT ON COLUMN public.bookings.customization_id IS 'Optional FK to AI install customization preview';
COMMENT ON COLUMN public.bookings.installation_fee_waived IS 'True when FREE_INSTALLATION promo applied';
COMMENT ON COLUMN public.bookings.installation_promo_id IS 'Promo that waived installation fee';

-- 3) Customer wishlist: products and/or AI customization builds
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  wishlist_item_id TEXT PRIMARY KEY DEFAULT ('wish-' || substr(md5(random()::text), 1, 12)),
  user_id TEXT NOT NULL,
  customer_id TEXT,
  item_type TEXT NOT NULL DEFAULT 'product'
    CHECK (item_type IN ('product', 'customization')),
  product_id TEXT REFERENCES public.products(product_id) ON DELETE CASCADE,
  customization_id TEXT REFERENCES public.customizations(customization_id) ON DELETE CASCADE,
  preview_image_url TEXT,
  title TEXT,
  snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT wishlist_items_target_check CHECK (
    (item_type = 'product' AND product_id IS NOT NULL AND customization_id IS NULL)
    OR (item_type = 'customization' AND customization_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_product
  ON public.wishlist_items(user_id, product_id)
  WHERE item_type = 'product' AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_customization
  ON public.wishlist_items(user_id, customization_id)
  WHERE item_type = 'customization' AND customization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON public.wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_created_at ON public.wishlist_items(created_at DESC);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlist_items_select_own" ON public.wishlist_items;
CREATE POLICY "wishlist_items_select_own"
  ON public.wishlist_items FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "wishlist_items_write" ON public.wishlist_items;
CREATE POLICY "wishlist_items_write"
  ON public.wishlist_items FOR ALL TO public
  USING (true) WITH CHECK (true);
