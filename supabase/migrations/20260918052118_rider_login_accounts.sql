-- Rider login accounts: Admin-created users.role = 'rider'
-- Riders cannot self-register. Only Active riders may sign in.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
  ON public.users (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

COMMENT ON COLUMN public.users.role IS 'admin | user | rider';

ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Rider';

CREATE UNIQUE INDEX IF NOT EXISTS riders_username_unique_idx
  ON public.riders (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS riders_email_unique_idx
  ON public.riders (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS riders_user_id_unique_idx
  ON public.riders (user_id)
  WHERE user_id IS NOT NULL AND btrim(user_id) <> '';

CREATE INDEX IF NOT EXISTS idx_riders_account_status ON public.riders (account_status);
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON public.riders (user_id);

ALTER TABLE public.order_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_by_rider_id TEXT;
