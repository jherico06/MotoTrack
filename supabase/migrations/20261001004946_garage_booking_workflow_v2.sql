-- =========================================================================
-- Garage booking workflow v2: mechanic login link, appointment window,
-- estimate-vs-quotation separation, timeline events, manual payment fields.
-- Extends existing tables; does NOT create speculative service_* tables.
-- =========================================================================

-- 1) Mechanics linked to login users
ALTER TABLE public.mechanics
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(user_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mechanics_user_id_unique
  ON public.mechanics(user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.mechanics.user_id IS 'Linked MotoTrack login user (role=mechanic). One roster row per user.';

-- 2) Bookings: appointment window + assignment meta
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS appointment_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_by TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_mechanic_appointment
  ON public.bookings(mechanic_id, appointment_start)
  WHERE mechanic_id IS NOT NULL AND appointment_start IS NOT NULL;

COMMENT ON COLUMN public.bookings.appointment_start IS 'Scheduled appointment start (timestamptz). Used for overlap checks.';
COMMENT ON COLUMN public.bookings.estimated_duration_minutes IS 'Estimated bay duration in minutes for scheduling.';
COMMENT ON COLUMN public.bookings.assigned_by IS 'Admin user_id (or label) who last assigned the mechanic.';

-- 3) Quotations: keep mechanic estimate separate from customer quotation
ALTER TABLE public.service_quotations
  ADD COLUMN IF NOT EXISTS source_quotation_id TEXT REFERENCES public.service_quotations(quotation_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_service_quotations_source
  ON public.service_quotations(source_quotation_id)
  WHERE source_quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_quotations_type
  ON public.service_quotations(quotation_type);

COMMENT ON COLUMN public.service_quotations.quotation_type IS 'mechanic_estimate | customer | estimated | final';
COMMENT ON COLUMN public.service_quotations.source_quotation_id IS 'For customer quotations: points at the untouched mechanic_estimate row.';
COMMENT ON COLUMN public.service_quotations.expires_at IS 'Customer quotation expiration; expired quotes cannot be accepted.';
COMMENT ON COLUMN public.service_quotations.decline_reason IS 'Customer decline reason when status=declined.';

-- 4) Inspection detail fields
ALTER TABLE public.booking_inspections
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS safety_concerns TEXT;

COMMENT ON COLUMN public.booking_inspections.condition IS 'Overall motorcycle condition notes from inspection.';
COMMENT ON COLUMN public.booking_inspections.safety_concerns IS 'Safety concerns recorded during inspection.';

-- 5) Payments: manual recording metadata (cash/other now; gcash later)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS received_by TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.payments.received_by IS 'Admin who recorded the manual payment.';
COMMENT ON COLUMN public.payments.notes IS 'Optional notes for manual payment recording.';
COMMENT ON COLUMN public.payments.payment_method IS 'cash | other | GCash (legacy) | gcash (future gateway)';

-- 6) Timeline: extend booking_status_history (append-only)
ALTER TABLE public.booking_status_history
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_booking_status_history_event
  ON public.booking_status_history(booking_id, created_at);

COMMENT ON COLUMN public.booking_status_history.event_type IS 'Timeline event key e.g. BOOKING_CREATED, MECHANIC_ASSIGNED';
COMMENT ON COLUMN public.booking_status_history.description IS 'Human-readable timeline description';
COMMENT ON COLUMN public.booking_status_history.actor_id IS 'User/customer/mechanic id who performed the action';
COMMENT ON COLUMN public.booking_status_history.actor_role IS 'customer | admin | mechanic | system';
COMMENT ON COLUMN public.booking_status_history.metadata IS 'Optional structured payload for the event';

-- Backfill event_type from to_status where missing
UPDATE public.booking_status_history
SET event_type = COALESCE(event_type, 'STATUS_CHANGED'),
    description = COALESCE(description, notes, 'Status changed to ' || COALESCE(to_status, 'unknown')),
    actor_role = COALESCE(actor_role, 'system')
WHERE event_type IS NULL;
