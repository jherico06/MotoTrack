-- Products + inventory write policies for admin catalog management.
-- Initial schema only granted SELECT on products; fresh migrates then
-- "succeed" into local cache while DB inserts/updates are blocked by RLS.
-- Matches the allow_anon_* write pattern used elsewhere in this project.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Keep (or restore) public read
DROP POLICY IF EXISTS "allow_anon_read_products" ON public.products;
CREATE POLICY "allow_anon_read_products" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_read_inventory" ON public.inventory;
CREATE POLICY "allow_anon_read_inventory" ON public.inventory
  FOR SELECT USING (true);

-- Admin/catalog writes (anon + authenticated) — same model as suppliers/mechanics
DROP POLICY IF EXISTS "allow_anon_write_products" ON public.products;
DROP POLICY IF EXISTS "Public Write products" ON public.products;
DROP POLICY IF EXISTS "products_public_write" ON public.products;
CREATE POLICY "allow_anon_write_products" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_write_inventory" ON public.inventory;
DROP POLICY IF EXISTS "Public Write inventory" ON public.inventory;
DROP POLICY IF EXISTS "inventory_public_write" ON public.inventory;
CREATE POLICY "allow_anon_write_inventory" ON public.inventory
  FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for product / color photos (public read, anon upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  6291456,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_anon_insert" ON storage.objects;
CREATE POLICY "product_images_anon_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_anon_update" ON storage.objects;
CREATE POLICY "product_images_anon_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_anon_delete" ON storage.objects;
CREATE POLICY "product_images_anon_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images');
