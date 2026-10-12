import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { staffAccountService } from '../services/staffAccountService.js';
import { sendStaffCredentialsEmail } from '../services/emailDispatchService.js';

const router = Router();

/**
 * Admin: email temporary login credentials after creating a Rider/Mechanic.
 * Body: { name, email, role, temporaryPassword }
 * Never returns the password in the response.
 */
router.post('/send-temp-credentials', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const role = String(req.body?.role || '')
      .trim()
      .toLowerCase();
    const temporaryPassword = String(req.body?.temporaryPassword || '').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid staff email is required.' });
    }
    if (role !== 'rider' && role !== 'mechanic') {
      return res.status(400).json({ success: false, error: 'Role must be rider or mechanic.' });
    }
    if (!temporaryPassword || temporaryPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Temporary password is required.' });
    }

    const mail = await sendStaffCredentialsEmail({
      email,
      name: name || 'Staff',
      role,
      temporaryPassword,
      loginUrl: process.env.APP_LOGIN_URL,
    });

    if (!mail.success) {
      return res.status(502).json({
        success: false,
        error: mail.error || 'Could not send credentials email.',
        emailed: false,
      });
    }

    const reallySent = mail.dispatched !== false && mail.provider !== 'dev-fallback';
    return res.status(200).json({
      success: true,
      emailed: reallySent,
      provider: mail.provider || null,
      warning: mail.warning || (reallySent ? null : 'Email provider not configured; account was still created.'),
      message: reallySent
        ? `Temporary login credentials were sent to ${email}.`
        : `Account credentials email was not delivered to ${email}. Configure RESEND_API_KEY or Gmail SMTP in server/.env.`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to send credentials email.',
    });
  }
});


/** Admin: list rider/mechanic accounts */
router.get('/', requireAdmin, async (req, res) => {
  const role = String(req.query.role || '')
    .trim()
    .toLowerCase();
  const result = await staffAccountService.listStaff({ role: role || undefined });
  return res.status(result.success ? 200 : 400).json(result);
});

/** Admin: create pending Rider/Mechanic + send OTP email */
router.post('/create', requireAdmin, async (req, res) => {
  const { name, email, phone, role, roster } = req.body || {};
  const result = await staffAccountService.createStaffAccount(
    { name, email, phone, role, roster },
    req.admin
  );
  const status = result.success ? 201 : result.code === 'EMAIL_EXISTS' ? 409 : 400;
  return res.status(status).json(result);
});

/** Admin: resend OTP for a pending staff account */
router.post('/resend-otp', requireAdmin, async (req, res) => {
  const { userId, email } = req.body || {};
  const result = await staffAccountService.resendOtp({ userId, email }, { isAdmin: true });
  return res.status(result.success ? 200 : 400).json(result);
});

/** Public/staff: resend OTP (rate-limited) */
router.post('/verify/resend', async (req, res) => {
  const { email } = req.body || {};
  const result = await staffAccountService.resendOtp({ email }, { isAdmin: false });
  return res.status(result.success ? 200 : 400).json(result);
});

/** Public/staff: verify OTP → generate password → email credentials → activate */
router.post('/verify', async (req, res) => {
  const { email, otp } = req.body || {};
  const result = await staffAccountService.verifyOtp({ email, otp });
  return res.status(result.success ? 200 : 400).json(result);
});

/** Admin: rotate temp password + resend credentials email (no duplicate auth user) */
router.post('/resend-credentials', requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  const result = await staffAccountService.resendCredentials({ userId });
  return res.status(result.success ? 200 : 400).json(result);
});

/** Admin: disable / reactivate staff */
router.post('/status', requireAdmin, async (req, res) => {
  const { userId, status } = req.body || {};
  const result = await staffAccountService.setStaffStatus({ userId, status });
  return res.status(result.success ? 200 : 400).json(result);
});

/** Admin: Verify PIN on trusted backend with rate limiting & session tokens */
router.post('/pin/verify', async (req, res) => {
  try {
    const { userId, pin } = req.body || {};
    if (!userId || !pin) {
      return res.status(400).json({ success: false, error: 'User ID and PIN are required.' });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('verify_admin_pin', {
      p_user_id: String(userId).trim(),
      p_pin: String(pin).trim(),
    });
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(data?.success ? 200 : 401).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** Admin: Validate Admin Session Token */
router.post('/pin/validate-session', async (req, res) => {
  try {
    const { userId, sessionToken } = req.body || {};
    if (!sessionToken) {
      return res.status(400).json({ valid: false, error: 'Session token required.' });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('validate_admin_session', {
      p_user_id: userId ? String(userId).trim() : null,
      p_session_token: String(sessionToken).trim(),
    });
    if (error) {
      return res.status(500).json({ valid: false, error: error.message });
    }
    return res.status(200).json(data || { valid: false });
  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});

/** Admin: Change Admin PIN */
router.post('/pin/change', requireAdmin, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body || {};
    const userId = req.admin?.user_id;
    if (!currentPin || !newPin) {
      return res.status(400).json({ success: false, error: 'Current PIN and new PIN are required.' });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('set_admin_pin', {
      p_user_id: userId,
      p_current_pin: String(currentPin).trim(),
      p_new_pin: String(newPin).trim(),
    });
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(data?.success ? 200 : 400).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** Admin: Lock Admin Session */
router.post('/pin/lock', async (req, res) => {
  try {
    const { userId, sessionToken } = req.body || {};
    if (userId) {
      const supabase = getSupabaseAdmin();
      await supabase.rpc('lock_admin_session', {
        p_user_id: String(userId).trim(),
        p_session_token: sessionToken ? String(sessionToken).trim() : null,
      });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
