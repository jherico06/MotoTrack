-- PMS vs Repair catalog categories for fixed-rate services
-- Admin may reassign; seed matches MotoTrack service organization spec.

ALTER TABLE public.pms_services
  ADD COLUMN IF NOT EXISTS catalog_category TEXT NOT NULL DEFAULT 'PMS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pms_services_catalog_category_check'
  ) THEN
    ALTER TABLE public.pms_services
      ADD CONSTRAINT pms_services_catalog_category_check
      CHECK (catalog_category IN ('PMS', 'Repair'));
  END IF;
END $$;

COMMENT ON COLUMN public.pms_services.catalog_category IS
  'Browse category: PMS (Preventive Maintenance) or Repair. Admin-editable.';

-- Seed / re-align categories per product spec
UPDATE public.pms_services SET catalog_category = 'PMS'
WHERE id IN (
  'pms-minor-tune-up',
  'pms-major-tune-up',
  'pms-replace-lubricate-cable',
  'pms-replace-front-fork-oil',
  'pms-battery-recharging',
  'pms-replace-drive-chain'
);

UPDATE public.pms_services SET catalog_category = 'Repair'
WHERE id IN (
  'pms-top-overhaul',
  'pms-major-engine-overhaul',
  'pms-replace-brake-pads',
  'pms-replace-brake-shoe',
  'pms-replace-swing-arm-bushing',
  'pms-replace-steering-ball',
  'pms-replace-front-hub-bearing',
  'pms-replace-rear-hub-bearing',
  'pms-replace-head-light-bulb',
  'pms-replace-tail-light-bulb',
  'pms-replace-signal-light-bulb',
  'pms-replace-panel-bulb',
  'pms-replace-wiring-harness',
  'pms-overhaul-carburetor',
  'pms-replace-starter-motor',
  'pms-replace-cam-sprocket-chain'
);

-- Align display names with the published service list
UPDATE public.pms_services
SET name = 'Replace Steering Ball/Bearing', updated_at = timezone('utc'::text, now())
WHERE id = 'pms-replace-steering-ball';

UPDATE public.pms_services
SET name = 'Replace Cam Sprocket and Chain', updated_at = timezone('utc'::text, now())
WHERE id = 'pms-replace-cam-sprocket-chain';

CREATE INDEX IF NOT EXISTS idx_pms_services_catalog_category
  ON public.pms_services (catalog_category)
  WHERE is_active = true;
