-- =========================================================================
-- Migration 009: Schema normalization — reduce redundancy, enforce FKs
-- Source of truth rules:
--   stock      → public.inventory.stock_quantity
--   category   → public.products.category_id → categories
--   rider      → public.order_deliveries.rider_id → riders
--   order life → public.orders.status (single status on order)
--   delivery   → public.order_deliveries (OTP, proof, confirm flags)
-- =========================================================================

-- -------------------------------------------------------------------------
-- A. Categories: moto categories; remap products from text category
-- -------------------------------------------------------------------------
INSERT INTO public.categories (category_id, name, description)
VALUES
  ('cat-01', 'Drivetrain', 'Chains, sprockets and drive components'),
  ('cat-02', 'Tires', 'Racing and street tire sets'),
  ('cat-03', 'Accessories', 'Bags, mounts and rider accessories'),
  ('cat-04', 'Exhaust', 'Titanium & carbon high-performance exhaust systems'),
  ('cat-05', 'Brakes', 'Calipers, rotors and racing pads'),
  ('cat-06', 'Engine', 'Fuel, ignition and engine management'),
  ('cat-07', 'Suspension', 'Forks, shocks and geometry parts'),
  ('cat-08', 'Maintenance', 'Oils, filters and service consumables')
ON CONFLICT (category_id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

UPDATE public.products p
SET category_id = CASE lower(trim(coalesce(p.category, '')))
  WHEN 'exhaust' THEN 'cat-04'
  WHEN 'drivetrain' THEN 'cat-01'
  WHEN 'tires' THEN 'cat-02'
  WHEN 'engine' THEN 'cat-06'
  WHEN 'suspension' THEN 'cat-07'
  WHEN 'maintenance' THEN 'cat-08'
  WHEN 'brakes' THEN 'cat-05'
  WHEN 'accessories' THEN 'cat-03'
  ELSE coalesce(NULLIF(p.category_id, ''), 'cat-03')
END;

-- Ensure every product has a valid category before NOT NULL
UPDATE public.products
SET category_id = 'cat-03'
WHERE category_id IS NULL
   OR category_id NOT IN (SELECT category_id FROM public.categories);

ALTER TABLE public.products
  ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE public.products DROP COLUMN IF EXISTS category;

-- -------------------------------------------------------------------------
-- B. Stock: inventory is the only quantity; sync then drop products.stock
-- -------------------------------------------------------------------------
DELETE FROM public.inventory a
USING public.inventory b
WHERE a.product_id = b.product_id
  AND a.ctid < b.ctid;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_id_key UNIQUE (product_id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

INSERT INTO public.inventory (inventory_id, product_id, stock_quantity, reorder_level, last_updated)
SELECT
  'inv-' || p.product_id,
  p.product_id,
  coalesce(p.stock, 0),
  5,
  timezone('utc'::text, now())
FROM public.products p
ON CONFLICT (product_id) DO UPDATE
SET stock_quantity = EXCLUDED.stock_quantity,
    last_updated = timezone('utc'::text, now());

ALTER TABLE public.products DROP COLUMN IF EXISTS stock;

-- -------------------------------------------------------------------------
-- C. Delivery / rider: FK only; remove denormalized copies
-- -------------------------------------------------------------------------
ALTER TABLE public.order_deliveries
  DROP COLUMN IF EXISTS rider_name,
  DROP COLUMN IF EXISTS rider_contact,
  DROP COLUMN IF EXISTS vehicle_info,
  DROP COLUMN IF EXISTS rider_plate,
  DROP COLUMN IF EXISTS rider_avatar;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS rider_name,
  DROP COLUMN IF EXISTS rider_contact,
  DROP COLUMN IF EXISTS rider_vehicle,
  DROP COLUMN IF EXISTS rider_plate,
  DROP COLUMN IF EXISTS rider_avatar,
  DROP COLUMN IF EXISTS rider_id,
  DROP COLUMN IF EXISTS delivery_status,
  DROP COLUMN IF EXISTS customer_delivery_confirmed,
  DROP COLUMN IF EXISTS customer_delivery_confirmed_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_deliveries' AND column_name = 'rider_id'
  ) THEN
    ALTER TABLE public.order_deliveries ADD COLUMN rider_id TEXT;
  END IF;
END $$;

ALTER TABLE public.order_deliveries
  DROP CONSTRAINT IF EXISTS order_deliveries_rider_id_fkey;

ALTER TABLE public.order_deliveries
  ADD CONSTRAINT order_deliveries_rider_id_fkey
  FOREIGN KEY (rider_id) REFERENCES public.riders(id)
  ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- D. Orders money / id cleanup
-- -------------------------------------------------------------------------
UPDATE public.orders
SET grand_total = coalesce(grand_total, total, total_amount)
WHERE grand_total IS NULL;

ALTER TABLE public.orders DROP COLUMN IF EXISTS total;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id IS DISTINCT FROM order_id) THEN
      ALTER TABLE public.orders DROP COLUMN id;
    END IF;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- E. Bookings: mechanic via FK only
-- -------------------------------------------------------------------------
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_mechanic_id_fkey;

UPDATE public.bookings b
SET mechanic_id = NULL
WHERE mechanic_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.mechanics m WHERE m.id = b.mechanic_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'mechanic_id'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_mechanic_id_fkey
      FOREIGN KEY (mechanic_id) REFERENCES public.mechanics(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.bookings DROP COLUMN IF EXISTS mechanic;

-- -------------------------------------------------------------------------
-- F. Customers identity: kept for now (name/email NOT NULL in legacy schema).
--    Prefer joining users via customers.user_id in app reads.
-- -------------------------------------------------------------------------

-- -------------------------------------------------------------------------
-- G. Indexes
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_rider_id ON public.order_deliveries(rider_id);

COMMENT ON TABLE public.inventory IS 'Normalized stock levels — single source of truth for quantity';
COMMENT ON COLUMN public.products.category_id IS 'FK to categories; category name via join';
COMMENT ON COLUMN public.order_deliveries.rider_id IS 'FK to riders; rider profile joined at read time';
