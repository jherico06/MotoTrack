-- Tokens no longer time-expire; they stay valid until used, delivered, or invalidated.

UPDATE public.order_deliveries
SET confirmation_token_expires_at = NULL
WHERE confirmation_token_hash IS NOT NULL
  AND confirmation_token_used_at IS NULL
  AND confirmation_token_invalidated_at IS NULL;

COMMENT ON COLUMN public.order_deliveries.confirmation_token_expires_at IS
  'Unused. Tokens do not time-expire; they stay valid until used, delivered, or invalidated.';
