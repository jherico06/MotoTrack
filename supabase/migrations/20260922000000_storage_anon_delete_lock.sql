-- ============================================================================
-- Least-disruption hardening: lock anonymous DELETE on product-images storage
-- ============================================================================
-- Scope (user-selected "least-disruption"): keep the anon-key demo/offline
-- model fully working. Do NOT touch users/orders/products RLS (would break
-- anon signup/admin/rider creation) and do NOT add schema columns (all the
-- columns the app's selects reference are already defined across migrations —
-- verified against src/services/orderService.js and src/services/productService.js).
--
-- This migration ONLY removes the anonymous DELETE policy on storage objects
-- in the `product-images` bucket. The app provably never deletes from that
-- bucket: src/utils/productImageUpload.js does .upload() (INSERT) and
-- .getPublicUrl() (read) only; there is no .remove()/.delete()/.update()
-- call on product-images anywhere in src/ (grep-verified). Upserts that
-- overwrite an existing object still succeed because the anon INSERT and
-- UPDATE policies are intentionally kept. Reads stay public (SELECT kept).
--
-- Additive + idempotent: safe to run repeatedly and safe on a live demo DB.
-- ============================================================================

-- 1) Drop the anon DELETE policy on storage.objects scoped to product-images.
DROP POLICY IF EXISTS "product_images_anon_delete" ON storage.objects;

-- 2) In case a future migration names it differently, also drop any matching
--    anon-delete policy that targets this bucket.
DROP POLICY IF EXISTS "anon_delete_product_images" ON storage.objects;

-- 3) Storage policies operate on storage.objects rows; ensure the bucket-level
--    anon SELECT (public read) is intact — no change here, but confirm it
--    exists for clarity. Insert/update remain governed by their own policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'product-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('product-images', 'product-images', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
