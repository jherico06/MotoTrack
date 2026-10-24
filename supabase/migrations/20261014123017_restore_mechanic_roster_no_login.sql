-- =========================================================================
-- Restore mechanic pit-bay roster for admin management.
-- Technicians have NO login accounts — only admins manage roster / bookings.
-- Keeps legacy users.role = 'mechanic' accounts inactive (cannot sign in).
-- =========================================================================

-- 1) Re-activate soft-disabled roster rows (from remove_mechanic migration)
UPDATE public.mechanics
SET
  is_active = true,
  status = CASE
    WHEN lower(coalesce(status, '')) IN ('inactive', 'disabled', '') THEN 'Available'
    ELSE status
  END,
  user_id = NULL,
  updated_at = timezone('utc'::text, now())
WHERE coalesce(is_active, false) = false
   OR lower(coalesce(status, '')) IN ('inactive', 'disabled');

-- 2) Detach any remaining login links on active roster rows
UPDATE public.mechanics
SET
  user_id = NULL,
  updated_at = timezone('utc'::text, now())
WHERE user_id IS NOT NULL;

-- 3) Ensure mechanic login accounts stay blocked (roster ≠ account)
UPDATE public.users
SET
  status = 'inactive',
  updated_at = timezone('utc'::text, now())
WHERE role = 'mechanic'
  AND coalesce(status, '') NOT IN ('inactive', 'disabled', 'deleted');
