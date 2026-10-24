import { Router } from 'express';
import { sendTransactionalEmail } from '../services/emailDispatchService.js';

const router = Router();

/**
 * POST /api/notify/email
 * Thin transactional email relay for client approval / status emails.
 * Secrets stay on the server (RESEND_API_KEY / SMTP_*).
 */
router.post('/email', async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim().toLowerCase();
    const subject = String(req.body?.subject || '').trim();
    const html = String(req.body?.html || '').trim();

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid recipient email is required.' });
    }
    if (!subject || !html) {
      return res.status(400).json({ success: false, error: 'subject and html are required.' });
    }
    if (subject.length > 200 || html.length > 100_000) {
      return res.status(400).json({ success: false, error: 'Email payload is too large.' });
    }

    const result = await sendTransactionalEmail({ to, subject, html });
    if (!result.success) {
      return res.status(503).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[notify/email]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send email.',
    });
  }
});

export default router;
