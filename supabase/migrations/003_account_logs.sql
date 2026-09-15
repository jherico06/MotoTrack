-- =========================================================================
-- Migration 003: Account Activity and Security Logs
-- Tracks critical account actions (Email change, Password change, Profile
-- updates, Security events, and Order milestones).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.account_logs (
    log_id TEXT PRIMARY KEY DEFAULT ('log-' || substr(md5(random()::text), 1, 12)),
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'EMAIL_CHANGED' | 'PASSWORD_CHANGED' | 'PROFILE_UPDATED' | 'LOGIN_SUCCESS' | 'ORDER_PLACED' | 'SECURITY_ALERT'
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT DEFAULT '127.0.0.1',
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_logs_user_id ON public.account_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_account_logs_created_at ON public.account_logs(created_at DESC);

-- Row Level Security
ALTER TABLE public.account_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_logs_select" ON public.account_logs;
CREATE POLICY "account_logs_select" ON public.account_logs
    FOR SELECT
    USING (
        user_id = (SELECT auth.uid()::text) 
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin')
        OR true -- Permissive for demo/client-side mode
    );

DROP POLICY IF EXISTS "account_logs_insert" ON public.account_logs;
CREATE POLICY "account_logs_insert" ON public.account_logs
    FOR INSERT
    WITH CHECK (true);
