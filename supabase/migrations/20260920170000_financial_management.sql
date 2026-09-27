-- Additive Financial Management schema (backward compatible)
-- NEVER drops/renames existing tables or columns.

-- 1) Current catalog product cost
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10, 2) DEFAULT 0;

-- 2) Historical COGS snapshot on each sale line (NULL = pre-migration / unknown)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10, 2);

-- 3) Product cost change history
CREATE TABLE IF NOT EXISTS public.product_cost_history (
  history_id TEXT PRIMARY KEY DEFAULT ('pch-' || substr(md5(random()::text), 1, 12)),
  product_id TEXT REFERENCES public.products(product_id) ON DELETE SET NULL,
  previous_cost NUMERIC(10, 2),
  new_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4) Service catalog cost breakdown
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_cost NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS technician_cost NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_cost NUMERIC(10, 2) DEFAULT 0;

-- 5) Booking cost snapshots (historical)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS materials_cost NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS technician_cost NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS other_cost NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS total_service_cost NUMERIC(10, 2);

-- 6) Optional service cost audit records
CREATE TABLE IF NOT EXISTS public.service_cost_records (
  record_id TEXT PRIMARY KEY DEFAULT ('scr-' || substr(md5(random()::text), 1, 12)),
  service_id TEXT REFERENCES public.services(service_id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
  customer_price NUMERIC(10, 2) DEFAULT 0,
  parts_cost NUMERIC(10, 2) DEFAULT 0,
  materials_cost NUMERIC(10, 2) DEFAULT 0,
  technician_cost NUMERIC(10, 2) DEFAULT 0,
  other_cost NUMERIC(10, 2) DEFAULT 0,
  total_cost NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7) Business operating expenses (separate from customer payments)
CREATE TABLE IF NOT EXISTS public.financial_expenses (
  expense_id TEXT PRIMARY KEY DEFAULT ('exp-' || substr(md5(random()::text), 1, 12)),
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  payment_method TEXT DEFAULT 'Cash',
  receipt_url TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (match existing permissive demo pattern)
ALTER TABLE public.product_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_all_product_cost_history" ON public.product_cost_history;
CREATE POLICY "allow_anon_all_product_cost_history" ON public.product_cost_history
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_all_service_cost_records" ON public.service_cost_records;
CREATE POLICY "allow_anon_all_service_cost_records" ON public.service_cost_records
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_all_financial_expenses" ON public.financial_expenses;
CREATE POLICY "allow_anon_all_financial_expenses" ON public.financial_expenses
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.product_cost_history TO anon, authenticated;
GRANT ALL ON public.service_cost_records TO anon, authenticated;
GRANT ALL ON public.financial_expenses TO anon, authenticated;
