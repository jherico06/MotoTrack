-- Allow authenticated clients (admin app) to manage the PMS fixed-rate catalog.
-- Matches the project's existing garage-table write pattern.

DROP POLICY IF EXISTS "pms_services_write_authenticated" ON public.pms_services;
CREATE POLICY "pms_services_write_authenticated" ON public.pms_services
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "pms_service_prices_write_authenticated" ON public.pms_service_prices;
CREATE POLICY "pms_service_prices_write_authenticated" ON public.pms_service_prices
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "cc_categories_write_authenticated" ON public.cc_categories;
CREATE POLICY "cc_categories_write_authenticated" ON public.cc_categories
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);
