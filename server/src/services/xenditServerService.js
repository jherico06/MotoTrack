import { getSupabaseAdmin } from './supabaseAdmin.js';

const XENDIT_API_URL = 'https://api.xendit.co';

function getXenditSecretKey() {
  return String(
    process.env.XENDIT_SECRET_KEY || process.env.EXPO_PUBLIC_XENDIT_SECRET_KEY || ''
  ).trim();
}

function getXenditAuthHeader() {
  const key = getXenditSecretKey();
  if (!key) return '';
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function mapXenditStatus(xenditStatus) {
  const upper = String(xenditStatus || '').toUpperCase();
  if (upper === 'PAID' || upper === 'SETTLED') {
    return { paid: true, expired: false, paymentStatus: 'Completed', xenditStatus: upper };
  }
  if (upper === 'EXPIRED' || upper === 'FAILED') {
    return { paid: false, expired: true, paymentStatus: 'Failed', xenditStatus: upper };
  }
  return { paid: false, expired: false, paymentStatus: 'Pending', xenditStatus: upper || 'PENDING' };
}

async function fetchXenditInvoice(invoiceId) {
  const auth = getXenditAuthHeader();
  if (!auth) {
    throw new Error('XENDIT_SECRET_KEY is not configured on the server.');
  }
  const res = await fetch(`${XENDIT_API_URL}/v2/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.message || text || `Xendit returned HTTP ${res.status}`);
  }
  return data;
}

async function applyFinalPaymentToBooking(bookingId, paymentRow) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !bookingId) return null;

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'booking_id, customer_id, status, payment_status, amount_paid, downpayment_amount, final_service_total, estimated_service_total, estimated_total, quoted_service_rate, package_price, price_php, price, remaining_balance, pickup_qr_token'
    )
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!booking) return null;

  const { data: completedRows } = await supabase
    .from('payments')
    .select('payment_id, amount, status')
    .eq('booking_id', bookingId)
    .eq('status', 'Completed');

  const totalPaidFromLedger = roundMoney(
    (Array.isArray(completedRows) ? completedRows : []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    )
  );
  const previousPaid = Number(booking.amount_paid || booking.downpayment_amount || 0);
  const paidSoFar = Math.max(totalPaidFromLedger, roundMoney(previousPaid + Number(paymentRow?.amount || 0)));

  const totalCost = roundMoney(
    Number(
      booking.final_service_total ||
        booking.estimated_service_total ||
        booking.estimated_total ||
        booking.quoted_service_rate ||
        booking.package_price ||
        booking.price_php ||
        booking.price ||
        paidSoFar
    )
  );
  const remaining = roundMoney(Math.max(0, totalCost - paidSoFar));
  const nowIso = new Date().toISOString();

  const patch = {
    amount_paid: paidSoFar,
    remaining_balance: remaining,
    payment_status: remaining <= 0 ? 'FULLY_PAID' : 'PARTIAL',
    updated_at: nowIso,
  };

  if (remaining <= 0) {
    const qrToken =
      booking.pickup_qr_token ||
      `MT-PKP-${bookingId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    patch.status = 'READY_FOR_PICKUP';
    patch.pickup_qr_token = qrToken;
    patch.pickup_qr_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    patch.current_stage = 'Fully paid via GCash (Xendit) • Ready for pickup';

    await supabase.from('pickup_verifications').upsert(
      [
        {
          verification_id: newId('pkv'),
          booking_id: bookingId,
          customer_id: booking.customer_id || paymentRow?.customer_id || null,
          qr_token: qrToken,
          payment_status: 'FULLY_PAID',
          pickup_status: 'READY',
          qr_valid: true,
        },
      ],
      { onConflict: 'qr_token' }
    );
  } else {
    patch.current_stage = `Partial GCash payment recorded • Remaining ₱${remaining.toLocaleString()}`;
  }

  await supabase.from('bookings').update(patch).eq('booking_id', bookingId);

  await supabase.from('booking_status_history').insert([
    {
      history_id: newId('bsh'),
      booking_id: bookingId,
      from_status: booking.status || null,
      to_status: patch.status || booking.status || 'READY_FOR_PICKUP',
      changed_by: 'Customer (Xendit GCash)',
      event_type: 'FINAL_PAYMENT_RECORDED',
      description: `GCash remaining balance verified (₱${Number(paymentRow?.amount || 0).toLocaleString()})`,
      actor_id: booking.customer_id || paymentRow?.customer_id || null,
      actor_role: 'customer',
      metadata: {
        payment_id: paymentRow?.payment_id || null,
        transaction_reference: paymentRow?.transaction_reference || null,
        amount: Number(paymentRow?.amount || 0),
        remaining_balance: remaining,
      },
      created_at: nowIso,
    },
  ]);

  return patch;
}

export async function createGcashInvoice({
  amount,
  externalId,
  bookingId = null,
  customerId = null,
  paymentType = 'DOWNPAYMENT',
  payerEmail,
  customerName,
  customerPhone,
  description,
  successRedirectUrl,
  failureRedirectUrl,
  idempotencyKey = null,
}) {
  const auth = getXenditAuthHeader();
  if (!auth) {
    throw new Error('XENDIT_SECRET_KEY is not configured on the server.');
  }

  const supabase = getSupabaseAdmin();
  const cleanType = String(paymentType || 'DOWNPAYMENT').toUpperCase();
  let parsedAmount = roundMoney(amount);

  if (bookingId && cleanType === 'FINAL_PAYMENT' && supabase) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_id, remaining_balance, final_service_total, estimated_service_total, amount_paid')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found.`);
    }
    const dbTotal = Number(booking.final_service_total || booking.estimated_service_total || 0);
    const dbPaid = Number(booking.amount_paid || 0);
    const dbRemaining =
      booking.remaining_balance != null
        ? Number(booking.remaining_balance)
        : Math.max(0, dbTotal - dbPaid);

    if (dbRemaining <= 0) {
      throw new Error('This booking has no remaining balance due.');
    }
    if (!parsedAmount || parsedAmount > dbRemaining) {
      parsedAmount = roundMoney(dbRemaining);
    }
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
    throw new Error('Payment amount must be at least ₱1.');
  }

  // Idempotency replay: reuse non-expired invoice for the same idempotencyKey
  if (idempotencyKey && supabase) {
    const { data: existing } = await supabase
      .from('payments')
      .select('payment_id, booking_id, amount, status, reference_number, transaction_reference, gateway_transaction_id')
      .eq('idempotency_key', idempotencyKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingInvoiceId = existing?.gateway_transaction_id || existing?.transaction_reference;
    if (existing && existingInvoiceId && existing.status !== 'Failed') {
      try {
        const live = await fetchXenditInvoice(existingInvoiceId);
        const mapped = mapXenditStatus(live?.status);
        if (!mapped.expired) {
          return {
            success: true,
            reused: true,
            invoiceId: live.id,
            invoiceUrl: live.invoice_url,
            externalId: live.external_id || existing.reference_number,
            status: mapped.xenditStatus,
            paid: mapped.paid,
            paymentStatus: mapped.paymentStatus,
            amount: Number(live.amount || existing.amount),
            paymentId: existing.payment_id,
            bookingId: existing.booking_id,
          };
        }
      } catch (_err) {
        // Proceed to create a fresh invoice if lookup failed
      }
    }
  }

  const extId =
    externalId ||
    `BK-${cleanType === 'FINAL_PAYMENT' ? 'FIN' : 'DP'}-${bookingId || Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const payload = {
    external_id: extId,
    amount: Math.max(1, Math.round(parsedAmount)),
    payer_email: payerEmail || 'customer@mototrack.ph',
    description: description || `MotoTrack ${cleanType === 'FINAL_PAYMENT' ? 'Final Balance' : 'Downpayment'}`,
    currency: 'PHP',
    payment_methods: ['GCASH'],
    customer: {
      given_names: customerName || 'Valued Rider',
      email: payerEmail || 'customer@mototrack.ph',
      mobile_number: customerPhone || '09170000000',
    },
    ...(successRedirectUrl ? { success_redirect_url: successRedirectUrl } : {}),
    ...(failureRedirectUrl ? { failure_redirect_url: failureRedirectUrl } : {}),
  };

  const res = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok || !data?.id || !data?.invoice_url) {
    throw new Error(data?.message || text || `Xendit invoice creation failed (HTTP ${res.status})`);
  }

  const nowIso = new Date().toISOString();
  const paymentId = newId('pay');
  const paymentRow = {
    payment_id: paymentId,
    booking_id: bookingId || null,
    order_id: null,
    customer_id: customerId || null,
    amount: roundMoney(data.amount ?? parsedAmount),
    payment_type: cleanType,
    payment_method: 'GCash (Xendit)',
    status: 'Pending',
    reference_number: data.external_id || extId,
    transaction_reference: data.id,
    gateway_transaction_id: data.id,
    idempotency_key: idempotencyKey || null,
    payment_date: nowIso,
    created_at: nowIso,
    verified_at: null,
    received_by: 'Xendit Gateway',
    notes: `${description || cleanType} via Xendit GCash`,
  };

  if (supabase) {
    const { error: insErr } = await supabase.from('payments').insert([paymentRow]);
    if (insErr && (insErr.code === '23503' || String(insErr.message || '').includes('fkey'))) {
      await supabase.from('payments').insert([
        {
          ...paymentRow,
          booking_id: null,
          notes: `${paymentRow.notes} • BookingRef: ${bookingId}`,
        },
      ]);
    }
  }

  return {
    success: true,
    invoiceId: data.id,
    invoiceUrl: data.invoice_url,
    externalId: data.external_id || extId,
    status: data.status || 'PENDING',
    paid: false,
    paymentStatus: 'Pending',
    amount: roundMoney(data.amount ?? parsedAmount),
    expiryDate: data.expiry_date || null,
    paymentId,
    bookingId: bookingId || null,
  };
}

export async function verifyInvoiceAndSync(invoiceId) {
  if (!invoiceId) {
    throw new Error('invoiceId is required.');
  }
  const invoice = await fetchXenditInvoice(invoiceId);
  const mapped = mapXenditStatus(invoice?.status);
  const supabase = getSupabaseAdmin();

  let paymentRow = null;
  let bookingPatch = null;

  if (supabase) {
    const { data: existing } = await supabase
      .from('payments')
      .select(
        'payment_id, booking_id, customer_id, amount, payment_type, payment_method, status, reference_number, transaction_reference, verified_at'
      )
      .or(`transaction_reference.eq.${invoiceId},gateway_transaction_id.eq.${invoiceId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    paymentRow = existing || null;
    const wasAlreadyCompleted = paymentRow?.status === 'Completed';
    const nowIso = new Date().toISOString();

    if (paymentRow) {
      const updateFields = {
        status: mapped.paymentStatus,
        payment_method: 'GCash (Xendit)',
        ...(mapped.paid && !paymentRow.verified_at ? { verified_at: invoice.paid_at || nowIso } : {}),
        ...(mapped.paid ? { verified_by: 'Xendit API Verification' } : {}),
      };
      await supabase
        .from('payments')
        .update(updateFields)
        .eq('payment_id', paymentRow.payment_id);

      paymentRow = { ...paymentRow, ...updateFields };

      if (
        mapped.paid &&
        !wasAlreadyCompleted &&
        paymentRow.booking_id &&
        String(paymentRow.payment_type || '').toUpperCase() === 'FINAL_PAYMENT'
      ) {
        bookingPatch = await applyFinalPaymentToBooking(paymentRow.booking_id, paymentRow);
      }
    }
  }

  return {
    success: true,
    invoiceId: invoice.id,
    externalId: invoice.external_id,
    xenditStatus: mapped.xenditStatus,
    paid: mapped.paid,
    expired: mapped.expired,
    paymentStatus: mapped.paymentStatus,
    amount: Number(invoice.amount || paymentRow?.amount || 0),
    paidAmount: Number(invoice.paid_amount || (mapped.paid ? invoice.amount : 0) || 0),
    paidAt: invoice.paid_at || paymentRow?.verified_at || null,
    paymentMethod: invoice.payment_channel || invoice.payment_method || 'GCASH',
    invoiceUrl: invoice.invoice_url || null,
    paymentId: paymentRow?.payment_id || null,
    bookingId: paymentRow?.booking_id || null,
    bookingPatch,
  };
}

export async function linkPaymentToBooking({ invoiceId, paymentId, bookingId, notes }) {
  if (!bookingId) {
    throw new Error('bookingId is required.');
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { success: false, error: 'Supabase client unavailable' };
  }

  let match = null;
  if (paymentId) {
    const { data } = await supabase
      .from('payments')
      .select('payment_id, booking_id, status, notes, transaction_reference')
      .eq('payment_id', paymentId)
      .maybeSingle();
    match = data;
  }
  if (!match && invoiceId) {
    const { data } = await supabase
      .from('payments')
      .select('payment_id, booking_id, status, notes, transaction_reference')
      .or(`transaction_reference.eq.${invoiceId},gateway_transaction_id.eq.${invoiceId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    match = data;
  }

  if (!match) {
    return { success: false, error: 'Payment transaction not found to link.' };
  }

  const updateFields = {
    booking_id: bookingId,
    ...(notes ? { notes } : {}),
  };

  const { error } = await supabase
    .from('payments')
    .update(updateFields)
    .eq('payment_id', match.payment_id);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    paymentId: match.payment_id,
    bookingId,
  };
}

export async function refundBookingDownpayment({ bookingId, reason, actorName = 'Admin' }) {
  if (!bookingId) {
    throw new Error('bookingId is required.');
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase admin client is not configured on the server.');
  }

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select(
      'booking_id, customer_id, status, downpayment_amount, amount_paid, payment_status, refund_status, refund_amount, refunded_at, notes'
    )
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (bookingErr) {
    throw new Error(`Failed to fetch booking: ${bookingErr.message}`);
  }
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found.`);
  }

  const alreadyRefunded =
    booking.refunded_at &&
    Number(booking.refund_amount || 0) > 0 &&
    !String(booking.refund_status || '').toLowerCase().includes('pending');

  if (alreadyRefunded) {
    return {
      success: true,
      alreadyRefunded: true,
      bookingId,
      refundAmount: roundMoney(booking.refund_amount),
      refundStatus: booking.refund_status || '50% Refunded',
      paymentStatus: booking.payment_status || 'Partially Refunded',
      refundedAt: booking.refunded_at,
    };
  }

  const { data: dpRows } = await supabase
    .from('payments')
    .select(
      'payment_id, amount, status, payment_method, transaction_reference, gateway_transaction_id, notes'
    )
    .eq('booking_id', bookingId)
    .eq('payment_type', 'DOWNPAYMENT')
    .order('created_at', { ascending: false })
    .limit(5);

  const dpPayment =
    (dpRows || []).find((p) => String(p.status || '').toLowerCase() === 'completed') ||
    (dpRows || [])[0] ||
    null;

  const paidDp = roundMoney(
    Number(dpPayment?.amount || booking.amount_paid || booking.downpayment_amount || 0)
  );
  if (paidDp <= 0) {
    throw new Error('No verified downpayment amount found for this booking.');
  }

  const halfDp = roundMoney(paidDp * 0.5);
  const nowIso = new Date().toISOString();
  const reasonText =
    String(reason || '').trim() || '50% downpayment refund upon customer cancellation';

  let xenditRefunded = false;
  let xenditRefundId = null;
  let xenditNote = '';
  const xenditRef = dpPayment?.transaction_reference || dpPayment?.gateway_transaction_id || null;

  if (
    xenditRef &&
    !String(xenditRef).startsWith('LOCAL-') &&
    !String(xenditRef).startsWith('DP-') &&
    !String(xenditRef).startsWith('XEN-')
  ) {
    try {
      const res = await fetch('https://api.xendit.co/refunds', {
        method: 'POST',
        headers: {
          Authorization: getXenditAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: xenditRef,
          amount: halfDp,
          currency: 'PHP',
          reason: 'REQUESTED_BY_CUSTOMER',
          metadata: {
            booking_id: bookingId,
            policy: '50_percent_cancellation_refund',
            actor: actorName,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.id) {
        xenditRefunded = true;
        xenditRefundId = json.id;
        xenditNote = `Xendit Refund ID: ${json.id}`;
      } else {
        xenditNote = `Manual GCash refund (${json?.message || 'Xendit invoice auto-refund unavailable'})`;
      }
    } catch (err) {
      xenditNote = `Manual GCash refund (${err?.message || 'Xendit refund request failed'})`;
    }
  } else {
    xenditNote = 'Manual GCash refund recorded by admin';
  }

  const channel = xenditRefunded ? 'Xendit GCash Refund' : 'Manual GCash Refund';
  const refundNotes = `${reasonText} · 50% of ₱${paidDp.toLocaleString()} = ₱${halfDp.toLocaleString()} (${xenditNote})`;

  if (dpPayment?.payment_id) {
    const existingNotes = dpPayment.notes ? `${dpPayment.notes} • ` : '';
    await supabase
      .from('payments')
      .update({
        refund_amount: halfDp,
        refund_status: 'Partially Refunded',
        refund_reason: reasonText,
        refunded_at: nowIso,
        notes: `${existingNotes}50% Refund Issued: ₱${halfDp}${xenditRefundId ? ` (${xenditRefundId})` : ''}`,
      })
      .eq('payment_id', dpPayment.payment_id);
  }

  await supabase
    .from('bookings')
    .update({
      refund_status: '50% Refunded',
      refund_amount: halfDp,
      refund_notes: refundNotes,
      refunded_at: nowIso,
      payment_status: 'Partially Refunded',
      current_stage: `Cancelled · 50% Downpayment Refunded (₱${halfDp.toLocaleString()})`,
      updated_at: nowIso,
    })
    .eq('booking_id', bookingId);

  try {
    await supabase.from('booking_status_history').insert([
      {
        history_id: newId('HIS'),
        booking_id: bookingId,
        from_status: booking.status || 'CANCELLED',
        to_status: booking.status || 'CANCELLED',
        event_type: 'DOWNPAYMENT_REFUNDED',
        description: refundNotes,
        changed_by: actorName || 'Admin',
        actor_role: 'admin',
        notes: refundNotes,
        metadata: {
          refund_amount: halfDp,
          downpayment_amount: paidDp,
          percentage: 50,
          channel,
          xendit_refund_id: xenditRefundId,
        },
      },
    ]);
  } catch (histErr) {
    console.warn('booking_status_history refund insert failed:', histErr?.message || histErr);
  }

  return {
    success: true,
    bookingId,
    downpaymentAmount: paidDp,
    refundAmount: halfDp,
    refundStatus: '50% Refunded',
    paymentStatus: 'Partially Refunded',
    xenditRefunded,
    xenditRefundId,
    channel,
    refundNotes,
    refundedAt: nowIso,
  };
}
