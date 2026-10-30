/**
 * Server-side transactional email (Resend and/or Gmail SMTP).
 * Secrets stay on the server — never EXPO_PUBLIC_*.
 */

function brandWrapper({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <div style="background:#1D4533;padding:20px 24px;">
      <h1 style="margin:0;color:#FFFFFF;font-size:20px;letter-spacing:0.02em;">MotoTrack</h1>
      <p style="margin:6px 0 0;color:#C7D9CF;font-size:13px;">${title}</p>
    </div>
    <div style="padding:24px;color:#334155;font-size:15px;line-height:1.55;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#F8FAFC;color:#64748B;font-size:12px;">
      MotoTrack Administration · Do not share security codes or passwords.
    </div>
  </div>
</body>
</html>`;
}

async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, provider: 'resend' };

  const from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    'MotoTrack Security <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, provider: 'resend', error: detail || `Resend HTTP ${res.status}` };
  }
  return { ok: true, provider: 'resend' };
}

async function sendViaSmtp({ to, subject, html }) {
  const host = process.env.SMTP_HOST || (process.env.SMTP_USER ? 'smtp.gmail.com' : '');
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!host || !user || !pass) return { ok: false, skipped: true, provider: 'smtp' };

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    return {
      ok: false,
      provider: 'smtp',
      error: 'nodemailer is not installed. Run npm install nodemailer in server/.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
      auth: { user, pass: (pass || '').replace(/\s+/g, '') },
    });

    const from = process.env.EMAIL_FROM || `MotoTrack <${user}>`;
    await transporter.sendMail({ from, to, subject, html });
    return { ok: true, provider: 'smtp' };
  } catch (smtpErr) {
    console.error('[emailDispatch] SMTP sendMail error:', smtpErr);
    return {
      ok: false,
      provider: 'smtp',
      error: smtpErr?.message || 'SMTP transmission error',
    };
  }
}

export async function sendTransactionalEmail({ to, subject, html }) {
  const cleanTo = String(to || '')
    .trim()
    .toLowerCase();
  if (!cleanTo || !cleanTo.includes('@')) {
    return { success: false, error: 'Valid recipient email is required.' };
  }

  const errors = [];

  const resend = await sendViaResend({ to: cleanTo, subject, html });
  if (resend.ok) return { success: true, provider: resend.provider, dispatched: true };
  if (!resend.skipped && resend.error) errors.push(resend.error);

  const smtp = await sendViaSmtp({ to: cleanTo, subject, html });
  if (smtp.ok) return { success: true, provider: smtp.provider, dispatched: true };
  if (!smtp.skipped && smtp.error) errors.push(smtp.error);

  const allowDevFallback = String(process.env.ALLOW_EMAIL_DEV_FALLBACK || '').toLowerCase() === 'true';
  if (allowDevFallback) {
    console.warn(
      `[emailDispatch] DEV FALLBACK — email to ${cleanTo} not sent. Configure RESEND_API_KEY or SMTP_*. Subject: ${subject}`
    );
    return {
      success: true,
      provider: 'dev-fallback',
      dispatched: false,
      warning: 'Email provider not configured; OTP/credentials logged server-side only in development.',
    };
  }

  return {
    success: false,
    dispatched: false,
    error:
      errors[0] ||
      'No email provider configured. Set RESEND_API_KEY or SMTP_USER/SMTP_PASS (Gmail App Password) in server/.env',
  };
}

export async function sendStaffOtpEmail({ email, name, otpCode, role }) {
  const roleLabel = role === 'mechanic' ? 'Mechanic' : 'Rider';
  const html = brandWrapper({
    title: 'Staff email verification',
    bodyHtml: `
      <p>Hello <strong>${escapeHtml(name || 'Staff')}</strong>,</p>
      <p>Your MotoTrack <strong>${roleLabel}</strong> account was created by an administrator.
      Enter this verification code to confirm your email:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:800;color:#1D4533;margin:20px 0;">${escapeHtml(otpCode)}</p>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p style="color:#64748B;font-size:13px;">If you did not expect this email, please contact the MotoTrack administrator.</p>
    `,
  });

  return sendTransactionalEmail({
    to: email,
    subject: `${otpCode} is your MotoTrack verification code`,
    html,
  });
}

export async function sendStaffCredentialsEmail({
  email,
  name,
  role,
  temporaryPassword,
  loginUrl,
}) {
  const roleLabel = role === 'mechanic' ? 'Mechanic' : 'Rider';
  const loginLink = loginUrl || process.env.APP_LOGIN_URL || 'https://mototrack.app';
  const html = brandWrapper({
    title: 'Staff account ready',
    bodyHtml: `
      <p>Hello <strong>${escapeHtml(name || 'Staff')}</strong>,</p>
      <p>Your MotoTrack staff account has been successfully created.</p>
      <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin:18px 0;">
        <p style="margin:0 0 8px;"><strong>Role:</strong> ${roleLabel}</p>
        <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin:0;"><strong>Temporary Password:</strong>
          <code style="font-size:15px;background:#EEF2FF;padding:2px 8px;border-radius:4px;">${escapeHtml(temporaryPassword)}</code>
        </p>
      </div>
      <p><a href="${escapeHtml(loginLink)}" style="display:inline-block;background:#1D4533;color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">MotoTrack Login</a></p>
      <p style="margin-top:18px;">For security, please change your password after your first login.</p>
      <p style="color:#64748B;font-size:13px;">If you did not expect this account, please contact the MotoTrack administrator.</p>
      <p style="margin-top:20px;">Thank you,<br/>MotoTrack Administration</p>
    `,
  });

  return sendTransactionalEmail({
    to: email,
    subject: 'MotoTrack Staff Account',
    html,
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
