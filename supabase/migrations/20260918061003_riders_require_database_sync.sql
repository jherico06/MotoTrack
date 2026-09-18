-- Riders are stored in public.riders (roster) + public.users (login when credentials exist).
-- Ensure write policies and uniqueness so every admin-created rider persists in the database.

ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_read_riders" ON public.riders;
CREATE POLICY "allow_anon_read_riders" ON public.riders
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "allow_anon_write_riders" ON public.riders;
CREATE POLICY "allow_anon_write_riders" ON public.riders
    FOR ALL
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Rider';
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS riders_username_unique_idx
  ON public.riders (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS riders_email_unique_idx
  ON public.riders (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS riders_user_id_unique_idx
  ON public.riders (user_id)
  WHERE user_id IS NOT NULL AND btrim(user_id) <> '';

COMMENT ON TABLE public.riders IS
  'Admin-managed delivery rider roster. Every rider must be stored here. Login accounts link via user_id to public.users (role = rider).';
