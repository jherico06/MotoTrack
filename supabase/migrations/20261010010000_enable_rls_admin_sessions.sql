-- ==============================================================================
-- 20261010010000_enable_rls_admin_sessions.sql
-- Fix Security Advisor Issues: Enable RLS on public.admin_sessions & public.admin_pins
-- Revoke direct anon/public table access; keep access restricted to SECURITY DEFINER RPCs
-- ==============================================================================

-- 1. Ensure RLS is active on both tables
ALTER TABLE IF EXISTS public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_pins ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy permissive policies
DROP POLICY IF EXISTS "admin_sessions_permissive" ON public.admin_sessions;
DROP POLICY IF EXISTS "admin_pins_permissive" ON public.admin_pins;

-- 3. Direct table access is forbidden for public/anon;
-- all operations must go through the dedicated SECURITY DEFINER RPCs:
-- - verify_admin_pin(user_id, pin)
-- - validate_admin_session(user_id, session_token)
-- - lock_admin_session(user_id, session_token)
-- - set_admin_pin(user_id, current_pin, new_pin)
-- - reset_admin_pin(user_id, new_pin)
