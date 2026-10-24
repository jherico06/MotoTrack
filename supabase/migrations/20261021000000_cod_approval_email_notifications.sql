-- Migration: Add COD order approval email notification tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cod_approval_email_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cod_approval_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cod_approval_email_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cod_approval_email_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cod_approval_email_recipient TEXT DEFAULT NULL;

COMMENT ON COLUMN public.orders.cod_approval_email_sent IS
  'Indicates if the customer confirmation email for COD approval was sent.';

COMMENT ON COLUMN public.orders.cod_approval_email_status IS
  'Status of the COD approval email: sent, failed, or skipped.';

COMMENT ON COLUMN public.orders.cod_approval_email_error IS
  'Error details if COD approval email failed to dispatch.';

COMMENT ON COLUMN public.orders.cod_approval_email_recipient IS
  'Recipient email address used when COD approval confirmation was sent.';
