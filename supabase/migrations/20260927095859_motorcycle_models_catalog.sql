-- =========================================================================
-- Admin-managed motorcycle models catalog (brand + model only).
-- Reuses existing customer_motorcycles + product_compatibility.
-- Does NOT replace garage bikes or product tables.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.motorcycle_models (
  model_id TEXT PRIMARY KEY DEFAULT ('mm-' || substr(md5(random()::text), 1, 12)),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT motorcycle_models_brand_model_unique UNIQUE (brand, model)
);

CREATE INDEX IF NOT EXISTS idx_motorcycle_models_brand
  ON public.motorcycle_models(brand);
CREATE INDEX IF NOT EXISTS idx_motorcycle_models_active
  ON public.motorcycle_models(is_active);

COMMENT ON TABLE public.motorcycle_models IS
  'Admin catalog of brand+model pairs for shop parts compatibility.';

-- Optional link from product_compatibility to catalog (nullable; brand/model remain source of truth)
ALTER TABLE public.product_compatibility
  ADD COLUMN IF NOT EXISTS model_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_compatibility_model_id_fkey'
      AND table_name = 'product_compatibility'
  ) THEN
    ALTER TABLE public.product_compatibility
      ADD CONSTRAINT product_compatibility_model_id_fkey
      FOREIGN KEY (model_id) REFERENCES public.motorcycle_models(model_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'product_compatibility model_id FK skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_compatibility_model_id
  ON public.product_compatibility(model_id);

-- RLS — match existing permissive demo pattern
ALTER TABLE public.motorcycle_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_motorcycle_models" ON public.motorcycle_models;
CREATE POLICY "allow_anon_read_motorcycle_models"
  ON public.motorcycle_models FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_anon_write_motorcycle_models" ON public.motorcycle_models;
CREATE POLICY "allow_anon_write_motorcycle_models"
  ON public.motorcycle_models FOR ALL USING (true) WITH CHECK (true);

-- Seed common PH models (idempotent)
INSERT INTO public.motorcycle_models (model_id, brand, model, is_active)
VALUES
  ('mm-honda-click125', 'Honda', 'Click 125', true),
  ('mm-honda-click150', 'Honda', 'Click 150', true),
  ('mm-honda-click160', 'Honda', 'Click 160', true),
  ('mm-honda-beat', 'Honda', 'Beat', true),
  ('mm-honda-pcx160', 'Honda', 'PCX 160', true),
  ('mm-honda-adv160', 'Honda', 'ADV 160', true),
  ('mm-yamaha-mio', 'Yamaha', 'Mio', true),
  ('mm-yamaha-mioi125', 'Yamaha', 'Mio i 125', true),
  ('mm-yamaha-nmax', 'Yamaha', 'NMAX', true),
  ('mm-yamaha-nmax155', 'Yamaha', 'NMAX 155', true),
  ('mm-yamaha-aerox155', 'Yamaha', 'Aerox 155', true),
  ('mm-suzuki-raider150', 'Suzuki', 'Raider 150', true),
  ('mm-suzuki-raiderr150', 'Suzuki', 'Raider R150', true),
  ('mm-kawasaki-ninja400', 'Kawasaki', 'Ninja 400', true),
  ('mm-kawasaki-klx150', 'Kawasaki', 'KLX150', true)
ON CONFLICT (brand, model) DO NOTHING;

DROP TRIGGER IF EXISTS trg_motorcycle_models_updated_at ON public.motorcycle_models;
CREATE TRIGGER trg_motorcycle_models_updated_at
  BEFORE UPDATE ON public.motorcycle_models
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
