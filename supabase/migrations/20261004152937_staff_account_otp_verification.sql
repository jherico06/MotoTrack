-- Staff account email OTP verification workflow
-- Admin creates Rider/Mechanic → pending_verification → OTP → activate + credentials email

COMMENT ON COLUMN public.users.role IS 'admin | user | rider | mechanic';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMPTZ NULL;

-- Existing active accounts are treated as already verified
UPDATE public.users
SET email_verified = true
WHERE status = 'active'
  AND COALESCE(email_verified, false) = false;

COMMENT ON COLUMN public.users.status IS
  'active | inactive | disabled | pending_verification';
COMMENT ON COLUMN public.users.email_verified IS
  'True after staff/customer email OTP verification succeeds';
COMMENT ON COLUMN public.users.must_change_password IS
  'True when staff must change a temporary generated password on first login';
COMMENT ON COLUMN public.users.credentials_sent_at IS
  'Timestamp when temporary credentials email was last sent to staff';

ALTER TABLE public.otp_verifications
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'signup',
  ADD COLUMN IF NOT EXISTS otp_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS user_id TEXT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS invalidated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_otp_verifications_email_purpose
  ON public.otp_verifications (email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_user_purpose
  ON public.otp_verifications (user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON public.users (role, status);

COMMENT ON COLUMN public.otp_verifications.purpose IS
  'signup | staff_invite | staff_resend | password_reset';
COMMENT ON COLUMN public.otp_verifications.otp_hash IS
  'SHA-256 hash of OTP (preferred). Legacy rows may still store otp_code plaintext.';

-- Link mechanics.user_id is already present from garage_booking_workflow_v2.
-- Ensure riders.account_status can reflect pending invite state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'riders'
      AND column_name = 'account_status'
  ) THEN
    COMMENT ON COLUMN public.riders.account_status IS
      'Active | Inactive | Pending Verification';
  END IF;
END $$;
