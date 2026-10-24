import { getSupabaseAdmin } from './supabaseAdmin.js';
import {
  generateOtpCode,
  generateStrongPassword,
  generateUserId,
  generateUsername,
  hashOtp,
  hashPassword,
  sha256Hex,
} from '../utils/crypto.js';
import { sendStaffCredentialsEmail, sendStaffOtpEmail } from './emailDispatchService.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_RESENDS_PER_HOUR = 5;
// Only riders can be invited. Mechanics are an admin-managed roster (no accounts).
// "mechanic" role is kept only so legacy logins can still be listed / disabled.
const INVITABLE_STAFF_ROLES = new Set(['rider']);
const LEGACY_LISTABLE_ROLES = ['rider', 'mechanic'];
const MECHANIC_RETIRED_ERROR =
  'Mechanics are roster-only (no login). Only Rider staff accounts can be created.';
const PLACEHOLDER_PASSWORD_PREFIX = 'pending-invite:';

const emailOk = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

function normalizeRole(role) {
  const r = String(role || '')
    .trim()
    .toLowerCase();
  return INVITABLE_STAFF_ROLES.has(r) ? r : null;
}

function publicStaffUser(row) {
  if (!row) return null;
  return {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    status: row.status,
    email_verified: Boolean(row.email_verified),
    must_change_password: Boolean(row.must_change_password),
    credentials_sent_at: row.credentials_sent_at || null,
    username: row.username || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function invalidatePriorOtps(supabase, email, purpose = 'staff_invite') {
  await supabase
    .from('otp_verifications')
    .update({ invalidated: true })
    .ilike('email', email)
    .eq('purpose', purpose)
    .eq('verified', false)
    .eq('invalidated', false);
}

async function createAndSendOtp(supabase, { email, name, role, userId }) {
  const otpCode = generateOtpCode();
  const otpHash = hashOtp(otpCode, email);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const otpId = `otp-staff-${Date.now().toString(36)}-${sha256Hex(email).slice(0, 6)}`;

  await invalidatePriorOtps(supabase, email, 'staff_invite');

  const { error: otpError } = await supabase.from('otp_verifications').insert([
    {
      id: otpId,
      email,
      otp_code: '', // never store plaintext OTP long-term
      otp_hash: otpHash,
      purpose: 'staff_invite',
      user_id: userId,
      expires_at: expiresAt,
      verified: false,
      invalidated: false,
      attempts: 0,
      max_attempts: MAX_VERIFY_ATTEMPTS,
      last_sent_at: now.toISOString(),
      created_at: now.toISOString(),
    },
  ]);

  if (otpError) {
    return { success: false, error: otpError.message || 'Could not store verification code.' };
  }

  const mail = await sendStaffOtpEmail({ email, name, otpCode, role });
  if (!mail.success) {
    return {
      success: false,
      error: mail.error || 'Could not send verification email.',
      otpStored: true,
      userId,
    };
  }

  // Dev-only: never log the OTP or password in production paths.
  if (mail.provider === 'dev-fallback') {
    console.warn(`[staffAccount] DEV OTP for ${email}: ${otpCode} (expires ${expiresAt})`);
  }

  return {
    success: true,
    expiresAt,
    provider: mail.provider,
    warning: mail.warning || null,
  };
}

async function ensureRosterLink(supabase, { role, userId, name, email, phone, roster = {} }) {
  if (role === 'rider') {
    const { data: existing } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const shortName =
      String(roster.shortName || roster.short_name || '').trim() || name.split(' ')[0] || name;
    const riderId =
      String(roster.id || '').trim() ||
      `rider-${Date.now().toString(36)}-${sha256Hex(userId).slice(0, 4)}`;

    if (existing?.id) {
      await supabase
        .from('riders')
        .update({
          name,
          short_name: shortName,
          email,
          username: email,
          phone: phone || '',
          vehicle_info: roster.vehicleInfo || roster.vehicle_info || '',
          plate_number: roster.plateNumber || roster.plate_number || '',
          avatar: roster.avatar || null,
          notes: roster.notes || '',
          account_status: 'Pending Verification',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return { rosterId: existing.id };
    }

    const { error } = await supabase.from('riders').insert([
      {
        id: riderId,
        name,
        short_name: shortName,
        phone: phone || '',
        email,
        username: email,
        user_id: userId,
        account_status: 'Pending Verification',
        status: roster.status || 'Available',
        role: 'Rider',
        vehicle_info: roster.vehicleInfo || roster.vehicle_info || '',
        plate_number: roster.plateNumber || roster.plate_number || '',
        avatar: roster.avatar || null,
        notes: roster.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      console.warn('[staffAccount] rider roster link warning:', error.message);
      return { rosterWarning: error.message };
    }
    return { rosterId: riderId };
  }

  // Mechanic roster links are intentionally not created anymore (role retired).

  return {};
}

async function activateRoster(supabase, { role, userId }) {
  if (role === 'rider') {
    await supabase
      .from('riders')
      .update({
        account_status: 'Active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }
}

export const staffAccountService = {
  async listStaff({ role } = {}) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('users')
      .select(
        'user_id, name, email, phone, role, status, email_verified, must_change_password, credentials_sent_at, username, created_at, updated_at'
      )
      .in('role', LEGACY_LISTABLE_ROLES)
      .order('created_at', { ascending: false });

    if (role && LEGACY_LISTABLE_ROLES.includes(role)) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, staff: (data || []).map(publicStaffUser) };
  },

  async createStaffAccount({ name, email, phone = '', role, roster = {} }, admin) {
    const supabase = getSupabaseAdmin();
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '')
      .trim()
      .toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const safeRole = normalizeRole(role);

    if (!cleanName) return { success: false, error: 'Full name is required.' };
    if (!emailOk(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (String(role || '').trim().toLowerCase() === 'mechanic') {
      return { success: false, error: MECHANIC_RETIRED_ERROR, code: 'ROLE_RETIRED' };
    }
    if (!safeRole) {
      return { success: false, error: 'Role must be Rider.' };
    }

    const { data: existing } = await supabase
      .from('users')
      .select('user_id, email, role, status')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: 'This email address is already registered. Please use another email address.',
        code: 'EMAIL_EXISTS',
      };
    }

    const userId = generateUserId(safeRole);
    // Login uses email (same as customer sign-in)
    const username = cleanEmail;
    // Unusable placeholder until OTP verification generates a real password
    const placeholder = hashPassword(
      `${PLACEHOLDER_PASSWORD_PREFIX}${sha256Hex(`${userId}:${Date.now()}`)}`,
      cleanEmail
    );

    const { error: insertError } = await supabase.from('users').insert([
      {
        user_id: userId,
        name: cleanName,
        email: cleanEmail,
        username,
        phone: cleanPhone,
        password: placeholder,
        role: safeRole,
        status: 'pending_verification',
        email_verified: false,
        must_change_password: false,
        address: 'MotoTrack Delivery Staff',
        member_since: new Date().getFullYear().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      return { success: false, error: insertError.message || 'Could not create staff account.' };
    }

    await ensureRosterLink(supabase, {
      role: safeRole,
      userId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      roster: roster || {},
    });

    const otpRes = await createAndSendOtp(supabase, {
      email: cleanEmail,
      name: cleanName,
      role: safeRole,
      userId,
    });

    if (!otpRes.success) {
      return {
        success: true,
        partial: true,
        user: publicStaffUser({
          user_id: userId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: safeRole,
          status: 'pending_verification',
          email_verified: false,
          must_change_password: false,
        }),
        message:
          'Staff account created as pending, but the verification email could not be sent. Use Resend Verification.',
        emailError: otpRes.error,
        createdBy: admin?.user_id || null,
      };
    }

    // Best-effort Supabase Auth mirror (no password yet — created after verify)
    try {
      await supabase.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: false,
        user_metadata: {
          name: cleanName,
          role: safeRole,
          mototrack_user_id: userId,
        },
        app_metadata: { role: safeRole, mototrack_user_id: userId },
      });
    } catch (_e) {
      // Non-fatal: custom users table is source of truth for login
    }

    return {
      success: true,
      user: publicStaffUser({
        user_id: userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: safeRole,
        status: 'pending_verification',
        email_verified: false,
        must_change_password: false,
        username,
      }),
      expiresAt: otpRes.expiresAt,
      message: `Verification code sent to ${cleanEmail}. The staff member must verify their email before the account becomes active.`,
      warning: otpRes.warning,
    };
  },

  async resendOtp({ userId, email }, { isAdmin = false } = {}) {
    const supabase = getSupabaseAdmin();
    const cleanEmail = String(email || '')
      .trim()
      .toLowerCase();

    let query = supabase
      .from('users')
      .select('*')
      .in('role', ['rider'])
      .eq('status', 'pending_verification');

    if (userId) query = query.eq('user_id', String(userId).trim());
    else if (cleanEmail) query = query.ilike('email', cleanEmail);
    else return { success: false, error: 'Email or user id is required.' };

    const { data: user, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!user) {
      return {
        success: false,
        error: 'No pending staff account found for verification.',
      };
    }

    const { data: recent } = await supabase
      .from('otp_verifications')
      .select('id, last_sent_at, created_at')
      .ilike('email', user.email)
      .eq('purpose', 'staff_invite')
      .order('created_at', { ascending: false })
      .limit(MAX_RESENDS_PER_HOUR);

    const newest = recent?.[0];
    const lastSent = newest?.last_sent_at || newest?.created_at;
    if (lastSent && Date.now() - new Date(lastSent).getTime() < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSent).getTime())) / 1000
      );
      return {
        success: false,
        error: `Please wait ${waitSec}s before requesting another code.`,
        code: 'RESEND_COOLDOWN',
      };
    }

    const hourAgo = Date.now() - 60 * 60 * 1000;
    const sentLastHour = (recent || []).filter(
      (r) => new Date(r.last_sent_at || r.created_at).getTime() > hourAgo
    ).length;
    if (!isAdmin && sentLastHour >= MAX_RESENDS_PER_HOUR) {
      return {
        success: false,
        error: 'Too many verification emails requested. Please try again later.',
        code: 'RATE_LIMIT',
      };
    }

    const otpRes = await createAndSendOtp(supabase, {
      email: user.email,
      name: user.name,
      role: user.role,
      userId: user.user_id,
    });

    if (!otpRes.success) {
      return { success: false, error: otpRes.error || 'Could not resend verification code.' };
    }

    return {
      success: true,
      email: user.email,
      expiresAt: otpRes.expiresAt,
      message: `A new verification code was sent to ${user.email}.`,
      warning: otpRes.warning,
    };
  },

  async verifyOtp({ email, otp }) {
    const supabase = getSupabaseAdmin();
    const cleanEmail = String(email || '')
      .trim()
      .toLowerCase();
    const cleanOtp = String(otp || '').trim();

    if (!emailOk(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: 'Please enter the complete 6-digit verification code.' };
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .in('role', ['rider'])
      .maybeSingle();

    if (!user) {
      return { success: false, error: 'Staff account not found.' };
    }
    if (user.status === 'active' && user.email_verified) {
      return {
        success: false,
        error: 'This account is already verified. Please sign in with your credentials.',
        code: 'ALREADY_ACTIVE',
      };
    }
    if (user.status === 'disabled') {
      return { success: false, error: 'This account has been disabled. Contact the administrator.' };
    }

    const { data: otpRows, error: otpFetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .ilike('email', cleanEmail)
      .eq('purpose', 'staff_invite')
      .eq('verified', false)
      .eq('invalidated', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpFetchError) return { success: false, error: otpFetchError.message };
    const record = otpRows?.[0];
    if (!record) {
      return {
        success: false,
        error: 'No active verification code found. Please request a new code.',
      };
    }

    if (Number(record.attempts || 0) >= Number(record.max_attempts || MAX_VERIFY_ATTEMPTS)) {
      await supabase
        .from('otp_verifications')
        .update({ invalidated: true })
        .eq('id', record.id);
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new verification code.',
        code: 'MAX_ATTEMPTS',
      };
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await supabase
        .from('otp_verifications')
        .update({ invalidated: true })
        .eq('id', record.id);
      return {
        success: false,
        error: 'This verification code has expired. Please request a new code.',
        code: 'OTP_EXPIRED',
      };
    }

    const expectedHash = hashOtp(cleanOtp, cleanEmail);
    const legacyMatch = record.otp_code && String(record.otp_code) === cleanOtp;
    const hashMatch = record.otp_hash && record.otp_hash === expectedHash;

    if (!hashMatch && !legacyMatch) {
      const nextAttempts = Number(record.attempts || 0) + 1;
      await supabase
        .from('otp_verifications')
        .update({ attempts: nextAttempts })
        .eq('id', record.id);
      const remaining = Math.max(0, Number(record.max_attempts || MAX_VERIFY_ATTEMPTS) - nextAttempts);
      return {
        success: false,
        error: 'Invalid verification code. Please try again.',
        attemptsRemaining: remaining,
      };
    }

    await supabase
      .from('otp_verifications')
      .update({ verified: true, invalidated: true })
      .eq('id', record.id);

    const temporaryPassword = generateStrongPassword(14);
    const passwordHash = hashPassword(temporaryPassword, cleanEmail);
    const nowIso = new Date().toISOString();

    const { error: activateError } = await supabase
      .from('users')
      .update({
        password: passwordHash,
        status: 'active',
        email_verified: true,
        must_change_password: true,
        credentials_sent_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', user.user_id);

    if (activateError) {
      return {
        success: false,
        error: activateError.message || 'Could not activate the staff account.',
      };
    }

    await activateRoster(supabase, { role: user.role, userId: user.user_id });

    // Mirror password into Supabase Auth when possible
    try {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const authUser = (list?.users || []).find(
        (u) => String(u.email || '').toLowerCase() === cleanEmail
      );
      if (authUser) {
        await supabase.auth.admin.updateUserById(authUser.id, {
          password: temporaryPassword,
          email_confirm: true,
          app_metadata: {
            ...(authUser.app_metadata || {}),
            role: user.role,
            mototrack_user_id: user.user_id,
          },
        });
      } else {
        await supabase.auth.admin.createUser({
          email: cleanEmail,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { name: user.name, role: user.role, mototrack_user_id: user.user_id },
          app_metadata: { role: user.role, mototrack_user_id: user.user_id },
        });
      }
    } catch (_e) {
      // Non-fatal — app authenticates against public.users
    }

    const mail = await sendStaffCredentialsEmail({
      email: cleanEmail,
      name: user.name,
      role: user.role,
      temporaryPassword,
      loginUrl: process.env.APP_LOGIN_URL,
    });

    // Dev-only: when no email provider is configured, print credentials to the API console.
    if (mail.provider === 'dev-fallback') {
      console.warn(
        `[staffAccount] DEV TEMP PASSWORD for ${cleanEmail}: ${temporaryPassword} (must change on first login)`
      );
    }

    // Never return the password to the client/API response.
    return {
      success: true,
      user: publicStaffUser({
        ...user,
        status: 'active',
        email_verified: true,
        must_change_password: true,
        credentials_sent_at: nowIso,
      }),
      credentialsEmailed: Boolean(mail.success && mail.dispatched !== false),
      emailWarning: mail.success
        ? mail.warning || null
        : mail.error || 'Account activated, but credentials email failed. Ask admin to resend credentials.',
      message:
        mail.success && mail.dispatched !== false
          ? 'Email verified. Your temporary login password has been sent to your inbox.'
          : mail.success
            ? 'Email verified. Temporary password is in the API server console (email provider not configured).'
            : 'Email verified and account activated, but the credentials email could not be sent. Contact your administrator.',
    };
  },

  async resendCredentials({ userId }) {
    const supabase = getSupabaseAdmin();
    const id = String(userId || '').trim();
    if (!id) return { success: false, error: 'User id is required.' };

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', id)
      .in('role', ['rider'])
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!user) return { success: false, error: 'Staff account not found.' };

    if (user.status === 'pending_verification' || !user.email_verified) {
      return {
        success: false,
        error: 'Account is still pending email verification. Resend the OTP instead.',
        code: 'PENDING_VERIFICATION',
      };
    }

    const temporaryPassword = generateStrongPassword(14);
    const passwordHash = hashPassword(temporaryPassword, user.email);
    const nowIso = new Date().toISOString();

    const { error: updError } = await supabase
      .from('users')
      .update({
        password: passwordHash,
        must_change_password: true,
        credentials_sent_at: nowIso,
        status: user.status === 'disabled' ? 'disabled' : 'active',
        updated_at: nowIso,
      })
      .eq('user_id', id);

    if (updError) return { success: false, error: updError.message };

    try {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const authUser = (list?.users || []).find(
        (u) => String(u.email || '').toLowerCase() === String(user.email).toLowerCase()
      );
      if (authUser) {
        await supabase.auth.admin.updateUserById(authUser.id, { password: temporaryPassword });
      }
    } catch (_e) {}

    const mail = await sendStaffCredentialsEmail({
      email: user.email,
      name: user.name,
      role: user.role,
      temporaryPassword,
      loginUrl: process.env.APP_LOGIN_URL,
    });

    if (!mail.success) {
      return {
        success: false,
        error: mail.error || 'Password was rotated but credentials email failed.',
        passwordRotated: true,
      };
    }

    return {
      success: true,
      message: `Temporary credentials were emailed to ${user.email}.`,
      user: publicStaffUser({
        ...user,
        must_change_password: true,
        credentials_sent_at: nowIso,
      }),
    };
  },

  async setStaffStatus({ userId, status }) {
    const supabase = getSupabaseAdmin();
    const id = String(userId || '').trim();
    const next = String(status || '')
      .trim()
      .toLowerCase();
    if (!id) return { success: false, error: 'User id is required.' };
    if (!['active', 'disabled', 'inactive'].includes(next)) {
      return { success: false, error: 'Status must be active, inactive, or disabled.' };
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', id)
      .in('role', LEGACY_LISTABLE_ROLES)
      .maybeSingle();

    if (!user) return { success: false, error: 'Staff account not found.' };
    if (user.status === 'pending_verification' && next === 'active') {
      return {
        success: false,
        error: 'Cannot activate a pending account until email OTP verification completes.',
      };
    }

    const { error } = await supabase
      .from('users')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('user_id', id);

    if (error) return { success: false, error: error.message };

    if (user.role === 'rider') {
      await supabase
        .from('riders')
        .update({
          account_status: next === 'active' ? 'Active' : 'Inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', id);
    }

    return {
      success: true,
      user: publicStaffUser({ ...user, status: next }),
      message: `Staff account set to ${next}.`,
    };
  },

  async clearMustChangePassword(userId) {
    const supabase = getSupabaseAdmin();
    const id = String(userId || '').trim();
    const { error } = await supabase
      .from('users')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('user_id', id)
      .in('role', ['rider']);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
