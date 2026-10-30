-- ==============================================================================
-- Migration: Contract service_history legacy and temporary backup tables
-- Phase: CONTRACT (Rule 3: Use RESTRICT, never CASCADE)
-- ==============================================================================

BEGIN;

-- 1. Drop temporary safety backup table
DROP TABLE IF EXISTS public._backup_service_history_20261025 RESTRICT;

-- 2. Drop legacy table with RESTRICT
DROP TABLE IF EXISTS public.service_history_legacy RESTRICT;

COMMIT;
