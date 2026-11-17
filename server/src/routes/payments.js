import { Router } from 'express';
import {
  createGcashInvoice,
  verifyInvoiceAndSync,
  linkPaymentToBooking,
  refundBookingDownpayment,
} from '../services/xenditServerService.js';

const router = Router();

router.post('/xendit/create-invoice', async (req, res) => {
  try {
    const result = await createGcashInvoice(req.body || {});
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Failed to create Xendit GCash invoice.',
    });
  }
});

router.get('/xendit/invoice/:invoiceId/verify', async (req, res) => {
  try {
    const result = await verifyInvoiceAndSync(req.params.invoiceId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Failed to verify Xendit invoice.',
    });
  }
});

router.post('/xendit/link-booking', async (req, res) => {
  try {
    const result = await linkPaymentToBooking(req.body || {});
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Failed to link payment to booking.',
    });
  }
});

router.post('/xendit/webhook', async (req, res) => {
  try {
    const configuredToken = String(process.env.XENDIT_CALLBACK_TOKEN || '').trim();
    if (configuredToken) {
      const incomingToken = String(req.headers['x-callback-token'] || '').trim();
      if (incomingToken !== configuredToken) {
        return res.status(401).json({ success: false, error: 'Invalid callback token.' });
      }
    }

    const invoiceId = req.body?.id || req.body?.invoice_id;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Missing invoice id in webhook payload.' });
    }

    const verified = await verifyInvoiceAndSync(String(invoiceId));
    return res.json({ received: true, ...verified });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Webhook processing error.',
    });
  }
});

router.post('/xendit/refund', async (req, res) => {
  try {
    const { bookingId, reason, actorName } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'bookingId is required.',
      });
    }
    const result = await refundBookingDownpayment({ bookingId, reason, actorName });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Failed to process 50% downpayment refund.',
    });
  }
});

export default router;
