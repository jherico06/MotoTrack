-- ==============================================================================
-- 20261029210000_admin_pin_replace_default_pin.sql
-- Security & Functional Fix:
-- 1. Repair legacy 'sha256:admin123' bootstrap hash to valid 'sha256$' format.
-- 2. Remove plaintext 'admin_security_pin' exposure from public.system_settings.
-- 3. Enforce active admin role & status checks in all PIN RPCs.
-- 4. Require password hash verification & lockout protection in reset_admin_pin.
-- 5. Keep PINs scoped per admin user without overwriting other admins' PINs.
-- ==============================================================================

-- 0. Repair legacy bootstrap admin password hash format ('sha256:admin123' -> 'sha256$<hex>')
UPDATE public.users
SET password = 'sha256$6b376d8c7fbb66b46d2330c92bfd5cef79265d5e6d464da86e3eb1f0d36dffa0'
WHERE user_id = 'usr-admin-01'
  AND password = 'sha256:admin123';

-- Migrate any custom PIN previously stored in system_settings into admin_pins, then remove plaintext row
DO $$
DECLARE
    v_legacy_pin TEXT;
BEGIN
    SELECT trim(value) INTO v_legacy_pin
    FROM public.system_settings
    WHERE key = 'admin_security_pin'
    LIMIT 1;

    IF v_legacy_pin IS NOT NULL AND v_legacy_pin ~ '^[0-9]{4,6}$' THEN
        INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until, updated_at)
        SELECT 'usr-admin-01', v_legacy_pin, 0, NULL, now()
        WHERE EXISTS (SELECT 1 FROM public.users WHERE user_id = 'usr-admin-01')
        ON CONFLICT (user_id) DO UPDATE
        SET pin = EXCLUDED.pin, updated_at = now()
        WHERE public.admin_pins.pin = '2026';
    END IF;

    DELETE FROM public.system_settings WHERE key = 'admin_security_pin';
END $$;

-- 1. RPC: verify_admin_pin (strictly verifies active PIN; no permanent '2026' backdoor)
CREATE OR REPLACE FUNCTION public.verify_admin_pin(
    p_user_id TEXT,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_pin_rec RECORD;
    v_fallback_pin TEXT;
    v_current_pin TEXT;
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
    v_lock_seconds INT;
BEGIN
    -- Strictly resolve an active administrator by user_id or email
    SELECT user_id, email, role, status INTO v_user
    FROM public.users
    WHERE (user_id = p_user_id OR lower(email) = lower(p_user_id))
      AND lower(coalesce(role, '')) IN ('admin', 'administrator')
      AND lower(coalesce(status, 'active')) = 'active'
    LIMIT 1;

    IF NOT FOUND AND coalesce(trim(p_user_id), '') IN ('', 'usr-admin-01', 'admin@mototrack.com') THEN
        SELECT user_id, email, role, status INTO v_user
        FROM public.users
        WHERE user_id = 'usr-admin-01'
          AND lower(coalesce(role, '')) IN ('admin', 'administrator')
          AND lower(coalesce(status, 'active')) = 'active'
        LIMIT 1;
    END IF;

    IF v_user.user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized. Only active administrators can unlock the dashboard.'
        );
    END IF;

    -- Ensure record exists in admin_pins
    SELECT * INTO v_pin_rec
    FROM public.admin_pins
    WHERE user_id = v_user.user_id;

    IF NOT FOUND THEN
        SELECT pin INTO v_fallback_pin
        FROM public.admin_pins
        WHERE user_id = 'usr-admin-01'
        LIMIT 1;

        v_fallback_pin := coalesce(nullif(trim(v_fallback_pin), ''), '2026');

        INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until)
        VALUES (v_user.user_id, v_fallback_pin, 0, NULL)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
        RETURNING * INTO v_pin_rec;
    END IF;

    -- Check if lockout active
    IF v_pin_rec.locked_until IS NOT NULL AND v_pin_rec.locked_until > now() THEN
        v_lock_seconds := ceil(extract(epoch from (v_pin_rec.locked_until - now())));
        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'lockout_seconds', v_lock_seconds,
            'attempts_left', 0,
            'error', 'Security lockout active. Please wait ' || v_lock_seconds || 's before trying again.'
        );
    END IF;

    v_current_pin := trim(coalesce(nullif(trim(v_pin_rec.pin), ''), '2026'));

    -- Strictly match only the active PIN (once changed, default '2026' is no longer accepted)
    IF trim(p_pin) = v_current_pin THEN
        UPDATE public.admin_pins
        SET failed_attempts = 0, locked_until = NULL, updated_at = now()
        WHERE user_id = v_user.user_id;

        v_token := 'sec_adm_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text);
        v_expires_at := now() + interval '2 hours';

        INSERT INTO public.admin_sessions (user_id, session_token, unlocked_at, expires_at)
        VALUES (v_user.user_id, v_token, now(), v_expires_at);

        RETURN jsonb_build_object(
            'success', true,
            'session_token', v_token,
            'user_id', v_user.user_id,
            'is_default_pin', (v_current_pin = '2026'),
            'pin_length', length(v_current_pin),
            'unlocked_at', extract(epoch from now()) * 1000,
            'expires_at', extract(epoch from v_expires_at) * 1000
        );
    ELSE
        -- PIN Mismatch: increment failed attempts
        IF v_pin_rec.locked_until IS NOT NULL AND v_pin_rec.locked_until <= now() THEN
            UPDATE public.admin_pins
            SET failed_attempts = 1, locked_until = NULL, updated_at = now()
            WHERE user_id = v_user.user_id;

            RETURN jsonb_build_object(
                'success', false,
                'locked', false,
                'attempts_left', 2,
                'error', 'Incorrect Security PIN. 2 attempts remaining.'
            );
        ELSE
            UPDATE public.admin_pins
            SET failed_attempts = coalesce(failed_attempts, 0) + 1,
                locked_until = CASE WHEN coalesce(failed_attempts, 0) + 1 >= 3 THEN now() + interval '30 seconds' ELSE NULL END,
                updated_at = now()
            WHERE user_id = v_user.user_id
            RETURNING * INTO v_pin_rec;

            IF v_pin_rec.failed_attempts >= 3 THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'locked', true,
                    'lockout_seconds', 30,
                    'attempts_left', 0,
                    'error', '3 incorrect attempts reached. Please wait 30s before trying again.'
                );
            ELSE
                RETURN jsonb_build_object(
                    'success', false,
                    'locked', false,
                    'attempts_left', (3 - v_pin_rec.failed_attempts),
                    'error', 'Incorrect Security PIN. ' || (3 - v_pin_rec.failed_attempts) || ' attempt(s) remaining.'
                );
            END IF;
        END IF;
    END IF;
END;
$$;

-- 2. RPC: set_admin_pin (strictly requires current active PIN; replaces default PIN)
CREATE OR REPLACE FUNCTION public.set_admin_pin(
    p_user_id TEXT,
    p_current_pin TEXT,
    p_new_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_pin_rec RECORD;
    v_current_pin TEXT;
    v_clean_current TEXT;
    v_clean_new TEXT;
BEGIN
    v_clean_current := trim(coalesce(p_current_pin, ''));
    v_clean_new := trim(coalesce(p_new_pin, ''));

    IF length(v_clean_new) < 4 OR length(v_clean_new) > 6 OR v_clean_new !~ '^[0-9]+$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'New PIN must be 4 to 6 numeric digits (0-9).');
    END IF;

    -- Strictly resolve active target admin user
    SELECT user_id, email, role, status INTO v_user
    FROM public.users
    WHERE (user_id = p_user_id OR lower(email) = lower(p_user_id))
      AND lower(coalesce(role, '')) IN ('admin', 'administrator')
      AND lower(coalesce(status, 'active')) = 'active'
    LIMIT 1;

    IF NOT FOUND AND coalesce(trim(p_user_id), '') IN ('', 'usr-admin-01', 'admin@mototrack.com') THEN
        SELECT user_id, email, role, status INTO v_user
        FROM public.users
        WHERE user_id = 'usr-admin-01'
          AND lower(coalesce(role, '')) IN ('admin', 'administrator')
          AND lower(coalesce(status, 'active')) = 'active'
        LIMIT 1;
    END IF;

    IF v_user.user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Active administrator account not found.');
    END IF;

    SELECT * INTO v_pin_rec FROM public.admin_pins WHERE user_id = v_user.user_id;
    IF NOT FOUND THEN
        SELECT pin INTO v_current_pin
        FROM public.admin_pins
        WHERE user_id = 'usr-admin-01'
        LIMIT 1;

        v_current_pin := coalesce(nullif(trim(v_current_pin), ''), '2026');
    ELSE
        v_current_pin := trim(coalesce(nullif(trim(v_pin_rec.pin), ''), '2026'));
    END IF;

    -- Strictly require the active current PIN (do not allow '2026' if PIN was already changed)
    IF v_clean_current != v_current_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect.');
    END IF;

    IF v_clean_new = v_current_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'New PIN cannot be the same as your current PIN.');
    END IF;

    INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until, updated_at)
    VALUES (v_user.user_id, v_clean_new, 0, NULL, now())
    ON CONFLICT (user_id) DO UPDATE
    SET pin = v_clean_new, failed_attempts = 0, locked_until = NULL, updated_at = now();

    -- Only synchronize usr-admin-01 if the acting user IS the primary store administrator
    IF v_user.user_id != 'usr-admin-01'
       AND lower(coalesce(v_user.email, '')) = 'admin@mototrack.com'
       AND EXISTS (SELECT 1 FROM public.users WHERE user_id = 'usr-admin-01') THEN
        INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until, updated_at)
        VALUES ('usr-admin-01', v_clean_new, 0, NULL, now())
        ON CONFLICT (user_id) DO UPDATE
        SET pin = v_clean_new, failed_attempts = 0, locked_until = NULL, updated_at = now();
    END IF;

    -- Ensure no plaintext PIN remains in system_settings
    DELETE FROM public.system_settings WHERE key = 'admin_security_pin';

    RETURN jsonb_build_object(
        'success', true,
        'is_default_pin', (v_clean_new = '2026'),
        'pin_length', length(v_clean_new),
        'updated_at', now(),
        'message', 'Admin PIN updated successfully in Supabase.'
    );
END;
$$;

-- 3. RPC: reset_admin_pin (requires verified password hash & enforces lockout protection)
CREATE OR REPLACE FUNCTION public.reset_admin_pin(
    p_user_id TEXT,
    p_new_pin TEXT,
    p_password_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_pin_rec RECORD;
    v_clean_new TEXT;
    v_lock_seconds INT;
BEGIN
    v_clean_new := trim(coalesce(p_new_pin, ''));
    IF length(v_clean_new) < 4 OR length(v_clean_new) > 6 OR v_clean_new !~ '^[0-9]+$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'New PIN must be 4 to 6 numeric digits (0-9).');
    END IF;

    SELECT user_id, email, password, role, status INTO v_user
    FROM public.users
    WHERE (user_id = p_user_id OR lower(email) = lower(p_user_id))
      AND lower(coalesce(role, '')) IN ('admin', 'administrator')
      AND lower(coalesce(status, 'active')) = 'active'
    LIMIT 1;

    IF NOT FOUND AND coalesce(trim(p_user_id), '') IN ('', 'usr-admin-01', 'admin@mototrack.com') THEN
        SELECT user_id, email, password, role, status INTO v_user
        FROM public.users
        WHERE user_id = 'usr-admin-01'
          AND lower(coalesce(role, '')) IN ('admin', 'administrator')
          AND lower(coalesce(status, 'active')) = 'active'
        LIMIT 1;
    END IF;

    IF v_user.user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Active administrator account not found.');
    END IF;

    SELECT * INTO v_pin_rec FROM public.admin_pins WHERE user_id = v_user.user_id;
    IF v_pin_rec.locked_until IS NOT NULL AND v_pin_rec.locked_until > now() THEN
        v_lock_seconds := ceil(extract(epoch from (v_pin_rec.locked_until - now())));
        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'lockout_seconds', v_lock_seconds,
            'error', 'Security lockout active. Please wait ' || v_lock_seconds || 's before resetting PIN.'
        );
    END IF;

    -- Verify the admin's password hash on the backend before allowing PIN reset
    IF coalesce(trim(p_password_hash), '') = '' OR trim(p_password_hash) != trim(coalesce(v_user.password, '')) THEN
        INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until, updated_at)
        VALUES (v_user.user_id, coalesce(v_pin_rec.pin, '2026'), 1, NULL, now())
        ON CONFLICT (user_id) DO UPDATE
        SET failed_attempts = coalesce(public.admin_pins.failed_attempts, 0) + 1,
            locked_until = CASE WHEN coalesce(public.admin_pins.failed_attempts, 0) + 1 >= 3 THEN now() + interval '30 seconds' ELSE NULL END,
            updated_at = now();

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Admin password verification failed. Cannot reset Security PIN.'
        );
    END IF;

    INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until, updated_at)
    VALUES (v_user.user_id, v_clean_new, 0, NULL, now())
    ON CONFLICT (user_id) DO UPDATE
    SET pin = v_clean_new, failed_attempts = 0, locked_until = NULL, updated_at = now();

    IF v_user.user_id != 'usr-admin-01'
       AND lower(coalesce(v_user.email, '')) = 'admin@mototrack.com'
       AND EXISTS (SELECT 1 FROM public.users WHERE user_id = 'usr-admin-01') THEN
        INSERT INTO public.admin_pins (user_id, pin, failed_attempts, locked_until, updated_at)
        VALUES ('usr-admin-01', v_clean_new, 0, NULL, now())
        ON CONFLICT (user_id) DO UPDATE
        SET pin = v_clean_new, failed_attempts = 0, locked_until = NULL, updated_at = now();
    END IF;

    DELETE FROM public.system_settings WHERE key = 'admin_security_pin';

    RETURN jsonb_build_object(
        'success', true,
        'is_default_pin', (v_clean_new = '2026'),
        'pin_length', length(v_clean_new),
        'updated_at', now(),
        'message', 'Admin PIN reset successfully in Supabase.'
    );
END;
$$;

-- 4. RPC: get_admin_pin_status (returns non-sensitive metadata: is_default, pin_length, updated_at)
CREATE OR REPLACE FUNCTION public.get_admin_pin_status(
    p_user_id TEXT DEFAULT 'usr-admin-01'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_pin_rec RECORD;
    v_current_pin TEXT;
BEGIN
    SELECT user_id INTO v_user
    FROM public.users
    WHERE (user_id = p_user_id OR lower(email) = lower(p_user_id))
      AND lower(coalesce(role, '')) IN ('admin', 'administrator')
      AND lower(coalesce(status, 'active')) = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        SELECT user_id INTO v_user
        FROM public.users
        WHERE user_id = 'usr-admin-01'
        LIMIT 1;
    END IF;

    SELECT * INTO v_pin_rec
    FROM public.admin_pins
    WHERE user_id = coalesce(v_user.user_id, p_user_id);

    IF NOT FOUND THEN
        SELECT * INTO v_pin_rec
        FROM public.admin_pins
        WHERE user_id = 'usr-admin-01'
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_default', true,
            'pin_length', 4,
            'updated_at', NULL
        );
    END IF;

    v_current_pin := trim(coalesce(nullif(trim(v_pin_rec.pin), ''), '2026'));
    RETURN jsonb_build_object(
        'success', true,
        'is_default', (v_current_pin = '2026'),
        'pin_length', length(v_current_pin),
        'updated_at', v_pin_rec.updated_at
    );
END;
$$;

