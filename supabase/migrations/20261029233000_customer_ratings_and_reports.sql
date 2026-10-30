-- Migration: 20261029233000_customer_ratings_and_reports.sql
-- Customer Ratings, Feedback, and Experience Reports Management

CREATE TABLE IF NOT EXISTS public.customer_ratings_reports (
  id TEXT PRIMARY KEY,
  submission_type TEXT NOT NULL DEFAULT 'rating_review' CHECK (submission_type IN ('rating_review', 'customer_report')),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_id TEXT,
  rating NUMERIC(2,1) CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  category TEXT NOT NULL CHECK (category IN (
    'service_quality',
    'mechanic_experience',
    'product_quality',
    'delivery',
    'order_issues',
    'payment_issues',
    'general_feedback'
  )),
  message TEXT NOT NULL,
  transaction_type TEXT DEFAULT 'general' CHECK (transaction_type IN ('order', 'booking', 'product', 'general')),
  transaction_id TEXT,
  transaction_status TEXT,
  transaction_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Under Review', 'Resolved', 'Dismissed')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ratings_reports_created_at ON public.customer_ratings_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_reports_status ON public.customer_ratings_reports (status);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_reports_type ON public.customer_ratings_reports (submission_type);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_reports_category ON public.customer_ratings_reports (category);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_reports_tx_id ON public.customer_ratings_reports (transaction_id);

ALTER TABLE public.customer_ratings_reports ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow access for viewing
DROP POLICY IF EXISTS customer_ratings_reports_select_all ON public.customer_ratings_reports;
CREATE POLICY customer_ratings_reports_select_all ON public.customer_ratings_reports
  FOR SELECT USING (true);

-- Insert policy: Customers can submit ratings & reports
DROP POLICY IF EXISTS customer_ratings_reports_insert ON public.customer_ratings_reports;
CREATE POLICY customer_ratings_reports_insert ON public.customer_ratings_reports
  FOR INSERT WITH CHECK (true);

-- Update policy: Admin can update status & review notes
DROP POLICY IF EXISTS customer_ratings_reports_update ON public.customer_ratings_reports;
CREATE POLICY customer_ratings_reports_update ON public.customer_ratings_reports
  FOR UPDATE USING (true);

COMMENT ON TABLE public.customer_ratings_reports IS 'Unified customer ratings, reviews, and issue reports for MotoTrack admin review';

