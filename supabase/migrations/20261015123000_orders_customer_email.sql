-- Store customer email on orders so approval / status emails can be sent reliably.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

COMMENT ON COLUMN public.orders.customer_email IS
  'Customer email at order time; used for approval and status notifications.';

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON public.orders (customer_email)
  WHERE customer_email IS NOT NULL;
