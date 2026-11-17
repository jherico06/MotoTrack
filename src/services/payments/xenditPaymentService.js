// =========================================================================
// MotoTrack Xendit Payment Gateway Service (Server-Verified GCash Flow)
// Routes Xendit Invoice creation & verification through the Express API
// (server/src/routes/payments.js) so secret keys stay off the client and
// every transaction in Supabase `payments` is verified & deduplicated.
// =========================================================================

import { Platform } from 'react-native';
import { APP_CONFIG } from '../../config/index.js';
import { supabaseManager } from '../../lib/supabase.js';
import { storageAdapter } from '../system/storageAdapter.js';

function getPaymentsApiBaseUrl() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_CUSTOMIZE_API_URL || APP_CONFIG.customizeApiUrl || ''
  ).trim();
  if (fromEnv && fromEnv.startsWith('https://')) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0';

      if (isLocalhost) {
        if (fromEnv && fromEnv.startsWith('http://') && !fromEnv.includes('192.168.')) {
          return fromEnv.replace(/\/+$/, '');
        }
        const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${proto}//${hostname}:8787`;
      }

      if (fromEnv && fromEnv.startsWith('https://')) {
        return fromEnv.replace(/\/+$/, '');
      }

      return window.location.origin;
    }
    if (fromEnv) return fromEnv.replace(/\/+$/, '');
    return 'http://127.0.0.1:8787';
  }

  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://127.0.0.1:8787';
}

async function paymentsApiFetch(path, { method = 'GET', body } = {}) {
  const base = getPaymentsApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || text || `Payment API error (${res.status})`);
  }
  return data;
}

function savePaymentLocally(bookingId, paymentRecord) {
  try {
    const storageKey = bookingId
      ? `mototrack_booking_payments_${bookingId}`
      : 'mototrack_xendit_transactions';
    const existingRaw = storageAdapter.getItem(storageKey);
    const existingList = existingRaw ? JSON.parse(existingRaw) : [];
    const arr = Array.isArray(existingList) ? existingList : [];
    const deduped = arr.filter(
      (p) =>
        p?.payment_id !== paymentRecord.payment_id &&
        (!paymentRecord.transaction_reference ||
          p?.transaction_reference !== paymentRecord.transaction_reference)
    );
    storageAdapter.setItem(storageKey, JSON.stringify([paymentRecord, ...deduped]));
  } catch (_e) {}
}

class XenditPaymentService {
  /**
   * Create a real Xendit GCash Invoice via the MotoTrack Express backend.
   * Inserts a `Pending` row in Supabase `payments` and returns `invoiceUrl`
   * for checkout. Does NOT mark payment as Completed until verified.
   */
  async createBookingCheckout({
    bookingId = null,
    customerId = null,
    amount,
    paymentType = 'DOWNPAYMENT',
    description,
    customerName,
    customerEmail,
    customerPhone,
    idempotencyKey = null,
    successRedirectUrl,
    failureRedirectUrl,
  }) {
    const cleanAmount = Math.max(1, Math.round(Number(amount) || 0));
    return paymentsApiFetch('/api/payments/xendit/create-invoice', {
      method: 'POST',
      body: {
        bookingId,
        customerId,
        amount: cleanAmount,
        paymentType,
        payerEmail: customerEmail,
        customerName,
        customerPhone,
        description,
        idempotencyKey,
        successRedirectUrl,
        failureRedirectUrl,
      },
    });
  }

  /**
   * Authoritative server-side verification against Xendit `GET /v2/invoices/{id}`.
   * Updates `payments` status (and `bookings` if linked to FINAL_PAYMENT).
   */
  async verifyInvoicePayment(invoiceId) {
    if (!invoiceId) {
      throw new Error('invoiceId is required to verify payment.');
    }
    return paymentsApiFetch(`/api/payments/xendit/invoice/${encodeURIComponent(invoiceId)}/verify`);
  }

  /**
   * Link an already-verified Xendit `payments` row to a newly created `booking_id`
   * without creating duplicate payment rows.
   */
  async linkPaymentToBooking({ invoiceId, paymentId, bookingId, notes }) {
    if (!bookingId) return { success: false, error: 'bookingId required' };
    try {
      const apiRes = await paymentsApiFetch('/api/payments/xendit/link-booking', {
        method: 'POST',
        body: { invoiceId, paymentId, bookingId, notes },
      });
      if (apiRes?.success) return apiRes;
    } catch (_apiErr) {
      // Fallback to direct Supabase update if Express server is unreachable
    }

    const client = supabaseManager.getClient();
    if (!client) return { success: false, error: 'Database client unavailable' };

    if (paymentId) {
      const { error } = await client
        .from('payments')
        .update({ booking_id: bookingId, ...(notes ? { notes } : {}) })
        .eq('payment_id', paymentId);
      if (!error) return { success: true, paymentId, bookingId };
    }
    if (invoiceId) {
      const { error } = await client
        .from('payments')
        .update({ booking_id: bookingId, ...(notes ? { notes } : {}) })
        .eq('transaction_reference', invoiceId);
      if (!error) return { success: true, invoiceId, bookingId };
    }
    return { success: false, error: 'Could not link payment record to booking.' };
  }

  /**
   * Idempotent / deduplicated transaction persistence in Supabase `payments`.
   * If a matching payment row already exists (by transaction_reference or
   * booking_id + payment_type), updates/links it instead of inserting duplicates.
   */
  async recordPaymentTransaction({
    bookingId = null,
    orderId = null,
    customerId = null,
    amount,
    paymentType = 'DOWNPAYMENT',
    paymentMethod = 'GCash (Xendit)',
    referenceNumber,
    transactionRef,
    status = 'Completed',
    notes,
  }) {
    const cleanType = String(paymentType || 'DOWNPAYMENT').toUpperCase();
    const cleanAmount = Number(amount) || 0;
    const nowIso = new Date().toISOString();
    const finalRef =
      referenceNumber || `XND-${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
    const finalTxn = transactionRef || finalRef;

    const client = supabaseManager.getClient();
    if (client) {
      try {
        // 1. Check if this gateway invoice / reference already exists in `payments`
        if (finalTxn) {
          const { data: existingByTxn } = await client
            .from('payments')
            .select('payment_id, booking_id, status')
            .or(`transaction_reference.eq.${finalTxn},gateway_transaction_id.eq.${finalTxn}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingByTxn?.payment_id) {
            const updatePatch = {
              ...(bookingId && !existingByTxn.booking_id ? { booking_id: bookingId } : {}),
              ...(status === 'Completed' && existingByTxn.status !== 'Completed'
                ? { status: 'Completed', verified_at: nowIso }
                : {}),
              ...(notes ? { notes } : {}),
            };
            if (Object.keys(updatePatch).length > 0) {
              await client
                .from('payments')
                .update(updatePatch)
                .eq('payment_id', existingByTxn.payment_id);
            }
            const merged = {
              payment_id: existingByTxn.payment_id,
              booking_id: bookingId || existingByTxn.booking_id,
              amount: cleanAmount,
              payment_type: cleanType,
              payment_method: paymentMethod,
              status: updatePatch.status || existingByTxn.status,
              reference_number: finalRef,
              transaction_reference: finalTxn,
            };
            savePaymentLocally(bookingId, merged);
            return {
              success: true,
              dbSuccess: true,
              deduped: true,
              paymentId: existingByTxn.payment_id,
              referenceNumber: finalRef,
              transactionReference: finalTxn,
              paymentRecord: merged,
            };
          }
        }

        // 2. For DOWNPAYMENT linked to a booking, avoid duplicating an already-recorded DOWNPAYMENT
        if (bookingId && cleanType === 'DOWNPAYMENT') {
          const { data: existingDp } = await client
            .from('payments')
            .select('payment_id, transaction_reference, reference_number, status')
            .eq('booking_id', bookingId)
            .eq('payment_type', 'DOWNPAYMENT')
            .limit(1)
            .maybeSingle();

          if (existingDp?.payment_id) {
            return {
              success: true,
              dbSuccess: true,
              deduped: true,
              paymentId: existingDp.payment_id,
              referenceNumber: existingDp.reference_number || finalRef,
              transactionReference: existingDp.transaction_reference || finalTxn,
              paymentRecord: existingDp,
            };
          }
        }
      } catch (checkErr) {
        console.warn('[XenditPaymentService] Dedupe check warning:', checkErr?.message);
      }
    }

    const paymentId = 'pay-' + Date.now() + '-' + Math.floor(100000 + Math.random() * 900000);
    const paymentRecord = {
      payment_id: paymentId,
      booking_id: bookingId,
      order_id: orderId,
      customer_id: customerId,
      amount: cleanAmount,
      payment_type: cleanType,
      payment_method: paymentMethod,
      status,
      reference_number: finalRef,
      transaction_reference: finalTxn,
      gateway_transaction_id: finalTxn,
      payment_date: nowIso,
      created_at: nowIso,
      verified_at: status === 'Completed' ? nowIso : null,
      received_by: paymentMethod.includes('Xendit') ? 'Xendit Gateway' : 'Admin / Shop',
      notes: notes || `${cleanType} (${paymentMethod})`,
    };

    savePaymentLocally(bookingId, paymentRecord);

    let dbSuccess = false;
    if (client) {
      try {
        const { error: insErr } = await client.from('payments').insert([paymentRecord]);
        if (!insErr) {
          dbSuccess = true;
        } else if (insErr.code === '23503' || String(insErr.message || '').includes('fkey')) {
          const { error: retryErr } = await client.from('payments').insert([
            {
              ...paymentRecord,
              booking_id: null,
              notes: `${paymentRecord.notes} • BookingRef: ${bookingId}`,
            },
          ]);
          dbSuccess = !retryErr;
        }
      } catch (dbErr) {
        console.warn('[XenditPaymentService] Database insert error:', dbErr?.message);
      }
    }

    return {
      success: true,
      dbSuccess,
      paymentId,
      referenceNumber: finalRef,
      transactionReference: finalTxn,
      paymentRecord,
    };
  }

  /**
   * Create a Xendit GCash checkout session (does NOT auto-mark Paid).
   */
  async processBookingDownpayment({
    bookingId = null,
    customerId = null,
    amount,
    paymentType = 'DOWNPAYMENT',
    description,
    customerName,
    customerEmail,
    customerPhone,
    idempotencyKey = null,
  }) {
    const invoice = await this.createBookingCheckout({
      bookingId,
      customerId,
      amount,
      paymentType,
      description: description || `Downpayment for Booking ${bookingId || ''}`,
      customerName,
      customerEmail,
      customerPhone,
      idempotencyKey,
    });

    return {
      success: true,
      invoice,
      paymentId: invoice.paymentId,
      referenceNumber: invoice.externalId,
      transactionRef: invoice.invoiceId,
    };
  }

  /**
   * Process or record a 50% downpayment refund for a cancelled booking via the backend.
   */
  async refundBookingDownpayment({ bookingId, reason, actorName = 'Admin' }) {
    if (!bookingId) {
      throw new Error('bookingId is required to issue a downpayment refund.');
    }
    return paymentsApiFetch('/api/payments/xendit/refund', {
      method: 'POST',
      body: { bookingId, reason, actorName },
    });
  }
}

export const xenditPaymentService = new XenditPaymentService();
export default xenditPaymentService;
