/**
 * Flexible service quotation, additional charges, booking payments, pickup QR.
 * Reuses public.payments (extended with booking_id). Cache-first reads.
 * No mechanic login — Admin assigns mechanics with hourly rate snapshots.
 */

import { supabaseManager } from './supabaseClient.js';
import { notificationService } from './notificationService.js';
import { dataCache } from './cache/dataCache.js';
import {
  CACHE_TTL,
  CacheKeys,
  bookingInvalidationKeys,
  mechanicInvalidationKeys,
} from './cache/cacheKeys.js';
import {
  calcLaborCost,
  calcLineTotal,
  calcServiceTotals,
  calcDownpayment,
  roundMoney,
  FLEX_BOOKING_STATUS,
  formatPhp,
} from '../utils/serviceQuotation.js';

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function client() {
  return supabaseManager.getClient();
}

function notifyCustomer(userId, title, message, extra = {}) {
  try {
    notificationService?.addNotification?.({
      user_id: userId || 'guest',
      title,
      message,
      type: 'booking',
      link: 'bookings',
      ...extra,
    });
  } catch (_e) {}
}

function invalidateBookingCaches(bookingId, customerId) {
  dataCache.invalidateMany(bookingInvalidationKeys(bookingId, customerId));
}

async function appendStatusHistory(bookingId, fromStatus, toStatus, changedBy, notes) {
  const c = client();
  if (!c || !bookingId || !toStatus) return;
  try {
    await c.from('booking_status_history').insert([
      {
        history_id: newId('bsh'),
        booking_id: bookingId,
        from_status: fromStatus || null,
        to_status: toStatus,
        changed_by: changedBy || 'system',
        notes: notes || null,
      },
    ]);
  } catch (_e) {}
}

async function patchBooking(bookingId, patch) {
  const c = client();
  if (!c) return { success: false, error: 'Supabase unavailable' };
  const { data, error } = await c
    .from('bookings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .select(
      'booking_id, customer_id, status, estimated_service_total, final_service_total, remaining_balance, amount_paid, payment_status, downpayment_amount, downpayment_status, active_quotation_id, pickup_qr_token'
    )
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (data) {
    dataCache.set(CacheKeys.booking(bookingId), data, CACHE_TTL.BOOKING_DETAIL_MS);
    invalidateBookingCaches(bookingId, data.customer_id);
  }
  return { success: true, booking: data };
}

function normalizeQuotationRow(row, items = []) {
  if (!row) return null;
  return {
    ...row,
    id: row.quotation_id,
    items: items.map((it) => ({
      ...it,
      id: it.item_id,
      lineTotal: Number(it.line_total || 0),
      unitPrice: Number(it.unit_price || 0),
      quantity: Number(it.quantity || 0),
    })),
  };
}

function buildItemsFromInput(items = [], bookingId, quotationId) {
  return (items || []).map((it, idx) => {
    const qty = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0);
    const lineTotal = calcLineTotal(qty, unitPrice);
    return {
      item_id: it.item_id || it.id || newId('qti'),
      quotation_id: quotationId,
      booking_id: bookingId,
      item_type: it.item_type || it.itemType || (it.product_id || it.productId ? 'part' : 'other'),
      product_id: it.product_id || it.productId || null,
      product_name: it.product_name || it.productName || it.name || null,
      description: it.description || it.title || null,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
      unit_cost: Number(it.unit_cost ?? it.unitCost ?? 0),
      sort_order: it.sort_order ?? idx,
    };
  });
}

export const serviceQuotationService = {
  FLEX_BOOKING_STATUS,

  calcLaborCost,
  calcServiceTotals,
  calcDownpayment,
  formatPhp,

  /**
   * Create or update an estimated quotation with price snapshots.
   * Does NOT overwrite estimated hours with actual hours.
   */
  async upsertEstimatedQuotation(bookingId, payload = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    if (!bookingId) return { success: false, error: 'bookingId required' };

    const hourlyRate = Number(payload.hourly_rate ?? payload.hourlyRate ?? 0);
    const estimatedHours = Number(payload.estimated_labor_hours ?? payload.estimatedLaborHours ?? 0);
    const items = buildItemsFromInput(payload.items || [], bookingId, 'pending');
    const partsTotal = roundMoney(
      items.filter((i) => i.item_type === 'part').reduce((s, i) => s + i.line_total, 0)
    );
    const otherChargesTotal = roundMoney(
      items.filter((i) => i.item_type !== 'part').reduce((s, i) => s + i.line_total, 0) +
        Number(payload.other_charges_total ?? payload.otherChargesTotal ?? 0)
    );

    const totals = calcServiceTotals({
      hourlyRate,
      laborHours: estimatedHours,
      partsTotal,
      otherChargesTotal,
      additionalChargesTotal: Number(payload.additional_charges_total ?? 0),
      discountType: payload.discount_type ?? payload.discountType,
      discountValue: payload.discount_value ?? payload.discountValue,
    });

    const dp = calcDownpayment({
      totalAmount: totals.totalAmount,
      downpaymentType: payload.downpayment_type ?? payload.downpaymentType ?? 'percent',
      downpaymentPercent: payload.downpayment_percent ?? payload.downpaymentPercent ?? 30,
      downpaymentAmount: payload.downpayment_amount ?? payload.downpaymentAmount,
    });

    const quotationId = payload.quotation_id || payload.quotationId || newId('qt');
    const row = {
      quotation_id: quotationId,
      booking_id: bookingId,
      quotation_type: 'estimated',
      status: payload.status || 'draft',
      mechanic_id: payload.mechanic_id || payload.mechanicId || null,
      mechanic_name: payload.mechanic_name || payload.mechanicName || null,
      hourly_rate: hourlyRate,
      estimated_labor_hours: estimatedHours,
      actual_labor_hours: null,
      labor_cost: totals.laborCost,
      parts_total: totals.partsTotal,
      other_charges_total: totals.otherChargesTotal,
      additional_charges_total: totals.additionalChargesTotal,
      discount_type: payload.discount_type ?? payload.discountType ?? null,
      discount_value: Number(payload.discount_value ?? payload.discountValue ?? 0),
      discount_amount: totals.discountAmount,
      subtotal: totals.subtotal,
      total_amount: totals.totalAmount,
      downpayment_type: payload.downpayment_type ?? payload.downpaymentType ?? 'percent',
      downpayment_percent: Number(payload.downpayment_percent ?? payload.downpaymentPercent ?? 30),
      downpayment_amount: dp.downpaymentAmount,
      remaining_balance: dp.remainingBalance,
      notes: payload.notes || null,
      created_by: payload.created_by || payload.createdBy || 'admin',
      updated_at: new Date().toISOString(),
    };

    const { error } = await c.from('service_quotations').upsert([row], { onConflict: 'quotation_id' });
    if (error) return { success: false, error: error.message };

    // Replace items (snapshots)
    await c.from('service_quotation_items').delete().eq('quotation_id', quotationId);
    const itemRows = buildItemsFromInput(payload.items || [], bookingId, quotationId);
    if (itemRows.length) {
      const { error: itemErr } = await c.from('service_quotation_items').insert(itemRows);
      if (itemErr) return { success: false, error: itemErr.message };
    }

    // Freeze estimated snapshot: once quotation is sent/accepted, do not overwrite estimated_service_total.
    const existing = await this.getQuotationForBooking(bookingId, { force: true });
    const alreadySent =
      existing &&
      ['sent', 'accepted', 'declined'].includes(String(existing.status || '').toLowerCase());

    const bookingPatch = {
      mechanic_id: row.mechanic_id,
      mechanic: row.mechanic_name,
      quoted_hourly_rate: hourlyRate,
      estimated_labor_hours: estimatedHours,
      estimated_labor_cost: totals.laborCost,
      parts_total: totals.partsTotal,
      other_charges_total: totals.otherChargesTotal,
      discount_amount: totals.discountAmount,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      downpayment_type: row.downpayment_type,
      downpayment_percent: row.downpayment_percent,
      downpayment_amount: dp.downpaymentAmount,
      remaining_balance: dp.remainingBalance,
      active_quotation_id: quotationId,
    };
    if (!alreadySent) {
      bookingPatch.estimated_service_total = totals.totalAmount;
    }

    await patchBooking(bookingId, bookingPatch);

    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    const quotation = normalizeQuotationRow(row, itemRows);
    dataCache.set(CacheKeys.bookingQuotation(bookingId), quotation, CACHE_TTL.QUOTATION_MS);
    return { success: true, quotation };
  },

  async getQuotationForBooking(bookingId, { force = false } = {}) {
    if (!bookingId) return null;
    return dataCache.fetch(
      CacheKeys.bookingQuotation(bookingId),
      async () => {
        const c = client();
        if (!c) return null;
        const { data: q } = await c
          .from('service_quotations')
          .select(
            'quotation_id, booking_id, quotation_type, status, mechanic_id, mechanic_name, hourly_rate, estimated_labor_hours, actual_labor_hours, labor_cost, parts_total, other_charges_total, additional_charges_total, discount_type, discount_value, discount_amount, subtotal, total_amount, downpayment_type, downpayment_percent, downpayment_amount, remaining_balance, notes, sent_at, accepted_at, declined_at, created_at'
          )
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!q) return null;
        const { data: items } = await c
          .from('service_quotation_items')
          .select(
            'item_id, quotation_id, booking_id, item_type, product_id, product_name, description, quantity, unit_price, line_total, sort_order'
          )
          .eq('quotation_id', q.quotation_id)
          .order('sort_order', { ascending: true });
        return normalizeQuotationRow(q, items || []);
      },
      { ttlMs: CACHE_TTL.QUOTATION_MS, force, swr: !force }
    );
  },

  async sendQuotationToCustomer(bookingId, { customerId, customerUserId } = {}) {
    const quotation = await this.getQuotationForBooking(bookingId, { force: true });
    if (!quotation) return { success: false, error: 'No quotation to send' };

    const c = client();
    const nowIso = new Date().toISOString();
    await c
      .from('service_quotations')
      .update({ status: 'sent', sent_at: nowIso, updated_at: nowIso })
      .eq('quotation_id', quotation.quotation_id);

    const from = FLEX_BOOKING_STATUS.UNDER_INSPECTION;
    await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      current_stage: `Quotation sent • ${formatPhp(quotation.total_amount)} • Awaiting customer approval`,
    });
    await appendStatusHistory(
      bookingId,
      from,
      FLEX_BOOKING_STATUS.QUOTATION_SENT,
      'admin',
      'Quotation sent to customer'
    );
    await appendStatusHistory(
      bookingId,
      FLEX_BOOKING_STATUS.QUOTATION_SENT,
      FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      'admin'
    );

    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    notifyCustomer(
      customerUserId || customerId,
      'Service Quotation Available',
      `Your service quotation for booking ${bookingId} is ready. Estimated total ${formatPhp(quotation.total_amount)}. Review and accept or decline.`
    );
    return { success: true, quotation: { ...quotation, status: 'sent', sent_at: nowIso } };
  },

  async respondToQuotation(bookingId, accepted, { customerId, customerUserId } = {}) {
    const quotation = await this.getQuotationForBooking(bookingId, { force: true });
    if (!quotation) return { success: false, error: 'Quotation not found' };

    const c = client();
    const nowIso = new Date().toISOString();
    if (accepted) {
      await c
        .from('service_quotations')
        .update({ status: 'accepted', accepted_at: nowIso, updated_at: nowIso })
        .eq('quotation_id', quotation.quotation_id);

      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
        downpayment_status: 'Required',
        downpayment_amount: quotation.downpayment_amount,
        remaining_balance: quotation.remaining_balance,
        estimated_service_total: quotation.total_amount,
        current_stage: `Quotation accepted • Pay downpayment ${formatPhp(quotation.downpayment_amount)}`,
      });
      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
        FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
        'customer',
        'Quotation accepted'
      );
      notifyCustomer(
        customerUserId || customerId,
        'Downpayment Required',
        `Quotation accepted. Please pay the downpayment of ${formatPhp(quotation.downpayment_amount)} to confirm your service.`
      );
      try {
        notificationService?.notifyAdminNewBooking?.({
          bookingId,
          customerName: 'Customer',
          serviceType: 'Quotation Accepted',
          vehicleModel: '',
          date: '',
          timeSlot: '',
        });
      } catch (_e) {}
    } else {
      await c
        .from('service_quotations')
        .update({ status: 'declined', declined_at: nowIso, updated_at: nowIso })
        .eq('quotation_id', quotation.quotation_id);
      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
        current_stage: 'Customer declined quotation',
      });
      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
        FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
        'customer',
        'Quotation declined'
      );
      notifyCustomer(
        customerUserId || customerId,
        'Quotation Declined',
        `You declined the quotation for booking ${bookingId}. Contact the shop if you need a revised estimate.`
      );
    }
    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    return { success: true, accepted };
  },

  /**
   * Record booking payment into existing payments table.
   * Does not trust client-only success without a persisted row.
   */
  async recordBookingPayment({
    bookingId,
    customerId,
    amount,
    paymentType, // DOWNPAYMENT | FINAL_PAYMENT
    paymentMethod = 'GCash',
    transactionReference,
    status = 'Completed',
  }) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    if (!bookingId || !amount) return { success: false, error: 'bookingId and amount required' };

    // Authoritative booking read (bypass long-lived cache for payment ops)
    const { data: booking, error: bErr } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, status, downpayment_amount, remaining_balance, amount_paid, estimated_service_total, final_service_total, payment_status'
      )
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (bErr || !booking) return { success: false, error: bErr?.message || 'Booking not found' };

    const paymentId = newId('pay');
    const nowIso = new Date().toISOString();
    const ref = transactionReference || `BK-${paymentType}-${Date.now()}`;

    const { error: pErr } = await c.from('payments').insert([
      {
        payment_id: paymentId,
        order_id: null,
        booking_id: bookingId,
        customer_id: customerId || booking.customer_id,
        payment_method: paymentMethod,
        amount: roundMoney(amount),
        reference_number: ref,
        transaction_reference: ref,
        payment_type: paymentType,
        status,
        payment_date: nowIso,
        created_at: nowIso,
        verified_at: status === 'Completed' ? nowIso : null,
      },
    ]);
    if (pErr) return { success: false, error: pErr.message };

    const paidSoFar = roundMoney(Number(booking.amount_paid || 0) + Number(amount));
    let patch = {
      amount_paid: paidSoFar,
      payment_status: paymentType === 'DOWNPAYMENT' ? 'DOWNPAYMENT_PAID' : 'FULLY_PAID',
    };

    if (paymentType === 'DOWNPAYMENT') {
      patch = {
        ...patch,
        status: FLEX_BOOKING_STATUS.CONFIRMED,
        downpayment_status: 'Paid',
        downpayment_paid_at: nowIso,
        downpayment_method: paymentMethod,
        downpayment_ref: ref,
        remaining_balance: roundMoney(
          Number(booking.estimated_service_total || booking.remaining_balance || 0) - Number(amount)
        ),
        current_stage: `Downpayment paid (${formatPhp(amount)}) • Service confirmed`,
      };
      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
        FLEX_BOOKING_STATUS.CONFIRMED,
        'customer',
        'Downpayment paid'
      );
      notifyCustomer(
        customerId || booking.customer_id,
        'Downpayment Successful',
        `Downpayment of ${formatPhp(amount)} received. Your service booking ${bookingId} is confirmed.`
      );
    } else if (paymentType === 'FINAL_PAYMENT') {
      patch = {
        ...patch,
        status: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
        remaining_balance: 0,
        current_stage: 'Fully paid • Motorcycle ready for pickup',
      };
      // Generate pickup QR
      const qrToken = `MT-PKP-${bookingId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      patch.pickup_qr_token = qrToken;
      patch.pickup_qr_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await c.from('pickup_verifications').insert([
        {
          verification_id: newId('pkv'),
          booking_id: bookingId,
          customer_id: customerId || booking.customer_id,
          qr_token: qrToken,
          payment_status: 'FULLY_PAID',
          pickup_status: 'READY',
          qr_valid: true,
        },
      ]);

      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
        FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
        'customer',
        'Final payment paid'
      );
      notifyCustomer(
        customerId || booking.customer_id,
        'Motorcycle Ready for Pickup',
        `Final payment received. Booking ${bookingId} is ready for pickup. Show your pickup QR at the counter.`
      );
    }

    await patchBooking(bookingId, patch);
    dataCache.invalidate(CacheKeys.bookingPayments(bookingId));
    return {
      success: true,
      payment: {
        payment_id: paymentId,
        booking_id: bookingId,
        amount: roundMoney(amount),
        payment_type: paymentType,
        payment_method: paymentMethod,
        status,
        transaction_reference: ref,
        created_at: nowIso,
        verified_at: status === 'Completed' ? nowIso : null,
      },
      bookingPatch: patch,
    };
  },

  async getBookingPayments(bookingId, { force = false } = {}) {
    if (!bookingId) return [];
    return dataCache.fetch(
      CacheKeys.bookingPayments(bookingId),
      async () => {
        const c = client();
        if (!c) return [];
        const { data } = await c
          .from('payments')
          .select(
            'payment_id, booking_id, customer_id, amount, payment_type, payment_method, status, reference_number, transaction_reference, payment_date, verified_at, created_at'
          )
          .eq('booking_id', bookingId)
          .order('payment_date', { ascending: false });
        return data || [];
      },
      { ttlMs: CACHE_TTL.PAYMENTS_MS, force }
    );
  },

  /** Authoritative payment status — do not use stale cache for decisions */
  async verifyPaymentState(bookingId) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    const { data: booking } = await c
      .from('bookings')
      .select(
        'booking_id, status, payment_status, amount_paid, downpayment_status, remaining_balance, final_service_total, estimated_service_total, pickup_qr_token'
      )
      .eq('booking_id', bookingId)
      .maybeSingle();
    const payments = await this.getBookingPayments(bookingId, { force: true });
    return { success: true, booking, payments };
  },

  async recordInspection(bookingId, { findings, recommendedWork, photos, inspectedBy } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    const row = {
      inspection_id: newId('insp'),
      booking_id: bookingId,
      findings: findings || '',
      recommended_work: recommendedWork || '',
      photos: photos || [],
      inspected_by: inspectedBy || 'admin',
      inspected_at: new Date().toISOString(),
    };
    const { error } = await c.from('booking_inspections').insert([row]);
    if (error) return { success: false, error: error.message };

    await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
      inspection_notes: findings || '',
      inspection_started_at: row.inspected_at,
      current_stage: 'Inspection recorded • Prepare quotation',
    });
    await appendStatusHistory(
      bookingId,
      FLEX_BOOKING_STATUS.SCHEDULED,
      FLEX_BOOKING_STATUS.UNDER_INSPECTION,
      inspectedBy || 'admin'
    );
    return { success: true, inspection: row };
  },

  async setActualLaborHours(bookingId, actualHours, { hourlyRate } = {}) {
    const quotation = await this.getQuotationForBooking(bookingId, { force: true });
    const rate = Number(hourlyRate ?? quotation?.hourly_rate ?? 0);
    const hours = Number(actualHours || 0);
    const actualLaborCost = calcLaborCost(rate, hours);

    const partsTotal = Number(quotation?.parts_total || 0);
    const otherChargesTotal = Number(quotation?.other_charges_total || 0);
    const additionalChargesTotal = Number(quotation?.additional_charges_total || 0);
    const totals = calcServiceTotals({
      hourlyRate: rate,
      laborHours: hours,
      partsTotal,
      otherChargesTotal,
      additionalChargesTotal,
      discountType: quotation?.discount_type,
      discountValue: quotation?.discount_value,
    });

    // Preserve estimated_* on booking and quotation snapshot.
    // Only write actual_* + working final_service_total (finalized later by finalizeBilling).
    const c = client();
    if (quotation && c) {
      await c
        .from('service_quotations')
        .update({
          actual_labor_hours: hours,
          updated_at: new Date().toISOString(),
        })
        .eq('quotation_id', quotation.quotation_id);
    }

    const result = await patchBooking(bookingId, {
      actual_labor_hours: hours,
      actual_labor_cost: actualLaborCost,
      final_service_total: totals.totalAmount,
      quoted_hourly_rate: rate,
    });
    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    return { success: true, actualLaborCost, finalTotal: totals.totalAmount, ...result };
  },

  async createAdditionalCharge(bookingId, chargePayload = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const hourlyRate = Number(chargePayload.hourly_rate ?? chargePayload.hourlyRate ?? 0);
    const laborHours = Number(chargePayload.additional_labor_hours ?? chargePayload.laborHours ?? 0);
    const laborCost = calcLaborCost(hourlyRate, laborHours);
    const partsTotal = roundMoney(chargePayload.parts_total ?? chargePayload.partsTotal ?? 0);
    const otherAmount = roundMoney(chargePayload.other_amount ?? chargePayload.otherAmount ?? 0);
    const totalAmount = roundMoney(laborCost + partsTotal + otherAmount);

    const row = {
      charge_id: newId('bac'),
      booking_id: bookingId,
      title: chargePayload.title || 'Additional Work',
      description: chargePayload.description || '',
      additional_labor_hours: laborHours,
      hourly_rate: hourlyRate,
      labor_cost: laborCost,
      parts_total: partsTotal,
      other_amount: otherAmount,
      total_amount: totalAmount,
      items: chargePayload.items || [],
      status: 'pending',
      created_by: chargePayload.created_by || 'admin',
    };

    const { error } = await c.from('booking_additional_charges').insert([row]);
    if (error) return { success: false, error: error.message };

    await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      current_stage: `Additional work requires approval • ${formatPhp(totalAmount)}`,
    });
    await appendStatusHistory(
      bookingId,
      FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      'admin',
      row.title
    );

    notifyCustomer(
      chargePayload.customerUserId || chargePayload.customerId,
      'Additional Work Requires Approval',
      `${row.title}: ${formatPhp(totalAmount)}. Please review and accept or decline.`
    );
    invalidateBookingCaches(bookingId, chargePayload.customerId);
    return { success: true, charge: row };
  },

  async respondToAdditionalCharge(bookingId, chargeId, accepted, { customerId } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const { data: charge } = await c
      .from('booking_additional_charges')
      .select('*')
      .eq('charge_id', chargeId)
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (!charge) return { success: false, error: 'Charge not found' };

    const nowIso = new Date().toISOString();
    await c
      .from('booking_additional_charges')
      .update({
        status: accepted ? 'accepted' : 'declined',
        responded_at: nowIso,
        updated_at: nowIso,
      })
      .eq('charge_id', chargeId);

    if (accepted) {
      const quotation = await this.getQuotationForBooking(bookingId, { force: true });
      const addTotal = roundMoney(
        Number(quotation?.additional_charges_total || 0) + Number(charge.total_amount || 0)
      );
      if (quotation) {
        const totals = calcServiceTotals({
          hourlyRate: quotation.hourly_rate,
          laborHours: quotation.actual_labor_hours ?? quotation.estimated_labor_hours,
          partsTotal: quotation.parts_total,
          otherChargesTotal: quotation.other_charges_total,
          additionalChargesTotal: addTotal,
          discountType: quotation.discount_type,
          discountValue: quotation.discount_value,
        });
        await c
          .from('service_quotations')
          .update({
            additional_charges_total: addTotal,
            subtotal: totals.subtotal,
            discount_amount: totals.discountAmount,
            total_amount: totals.totalAmount,
            updated_at: nowIso,
          })
          .eq('quotation_id', quotation.quotation_id);
        await patchBooking(bookingId, {
          status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
          final_service_total: totals.totalAmount,
          current_stage: 'Additional work approved • Service continuing',
        });
      } else {
        await patchBooking(bookingId, {
          status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
          current_stage: 'Additional work approved • Service continuing',
        });
      }
      notifyCustomer(customerId, 'Additional Work Approved', `Approved additional charge for ${bookingId}.`);
    } else {
      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
        current_stage: 'Additional work declined • Continuing base scope',
      });
      notifyCustomer(customerId, 'Additional Work Declined', `Declined additional charge for ${bookingId}.`);
    }

    await appendStatusHistory(
      bookingId,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
      'customer',
      accepted ? 'Additional charge accepted' : 'Additional charge declined'
    );
    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    return { success: true, accepted };
  },

  async finalizeBilling(bookingId) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const { data: booking } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, amount_paid, estimated_service_total, final_service_total, actual_labor_cost, actual_labor_hours, quoted_hourly_rate, parts_total, other_charges_total, discount_amount, discount_type, discount_value'
      )
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (!booking) return { success: false, error: 'Booking not found' };

    const quotation = await this.getQuotationForBooking(bookingId, { force: true });

    // Final bill = actual labor + parts + accepted additional + other − discount.
    // Do not overwrite estimated_service_total (frozen at quotation send).
    const rate = Number(
      booking.quoted_hourly_rate || quotation?.hourly_rate || 0
    );
    const actualHours = Number(
      booking.actual_labor_hours ?? quotation?.actual_labor_hours ?? quotation?.estimated_labor_hours ?? 0
    );
    const partsTotal = Number(quotation?.parts_total ?? booking.parts_total ?? 0);
    const otherChargesTotal = Number(
      quotation?.other_charges_total ?? booking.other_charges_total ?? 0
    );
    const additionalChargesTotal = Number(quotation?.additional_charges_total ?? 0);
    const discountType = quotation?.discount_type ?? booking.discount_type;
    const discountValue = Number(
      quotation?.discount_value ?? booking.discount_value ?? 0
    );

    const totals = calcServiceTotals({
      hourlyRate: rate,
      laborHours: actualHours,
      partsTotal,
      otherChargesTotal,
      additionalChargesTotal,
      discountType,
      discountValue,
    });

    const finalTotal = totals.totalAmount;
    const paid = roundMoney(Number(booking.amount_paid || 0));
    const remaining = roundMoney(Math.max(0, finalTotal - paid));

    if (quotation && c) {
      await c
        .from('service_quotations')
        .update({
          actual_labor_hours: actualHours,
          labor_cost: totals.laborCost,
          additional_charges_total: additionalChargesTotal,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          total_amount: finalTotal,
          remaining_balance: remaining,
          quotation_type: 'final',
          updated_at: new Date().toISOString(),
        })
        .eq('quotation_id', quotation.quotation_id);
    }

    await patchBooking(bookingId, {
      status:
        remaining > 0
          ? FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT
          : FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      actual_labor_hours: actualHours,
      actual_labor_cost: totals.laborCost,
      final_service_total: finalTotal,
      remaining_balance: remaining,
      service_completed_at: new Date().toISOString(),
      current_stage:
        remaining > 0
          ? `Service completed • Remaining balance ${formatPhp(remaining)}`
          : 'Service completed • Ready for pickup',
    });

    if (remaining <= 0) {
      const qrToken = `MT-PKP-${bookingId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      await patchBooking(bookingId, {
        pickup_qr_token: qrToken,
        pickup_qr_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payment_status: 'FULLY_PAID',
      });
      await c.from('pickup_verifications').upsert(
        [
          {
            verification_id: newId('pkv'),
            booking_id: bookingId,
            customer_id: booking.customer_id,
            qr_token: qrToken,
            payment_status: 'FULLY_PAID',
            pickup_status: 'READY',
            qr_valid: true,
          },
        ],
        { onConflict: 'qr_token' }
      );
    }

    notifyCustomer(
      booking.customer_id,
      remaining > 0 ? 'Final Payment Required' : 'Service Completed',
      remaining > 0
        ? `Service completed. Remaining balance ${formatPhp(remaining)}.`
        : `Service completed for ${bookingId}. Your motorcycle is ready for pickup.`
    );
    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    return { success: true, finalTotal, remaining };
  },

  /** Generate (or return existing) pickup QR when booking is fully paid / ready */
  async ensurePickupQr(bookingId, { force = false } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const { data: booking } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, status, payment_status, amount_paid, final_service_total, remaining_balance, pickup_qr_token, pickup_qr_expires_at'
      )
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (!booking) return { success: false, error: 'Booking not found' };

    const fullyPaid =
      booking.payment_status === 'FULLY_PAID' ||
      Number(booking.remaining_balance || 0) <= 0;
    const ready =
      booking.status === FLEX_BOOKING_STATUS.READY_FOR_PICKUP ||
      booking.status === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
      fullyPaid;

    if (!ready && !fullyPaid) {
      return { success: false, error: 'Booking is not ready for pickup QR (payment incomplete)' };
    }

    if (booking.pickup_qr_token && !force) {
      return { success: true, qrToken: booking.pickup_qr_token, existing: true };
    }

    const qrToken = `MT-PKP-${bookingId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await patchBooking(bookingId, {
      pickup_qr_token: qrToken,
      pickup_qr_expires_at: expires,
      payment_status: 'FULLY_PAID',
      status: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      remaining_balance: 0,
      current_stage: 'Pickup QR generated • Ready for release',
    });
    await c.from('pickup_verifications').upsert(
      [
        {
          verification_id: newId('pkv'),
          booking_id: bookingId,
          customer_id: booking.customer_id,
          qr_token: qrToken,
          payment_status: 'FULLY_PAID',
          pickup_status: 'READY',
          qr_valid: true,
        },
      ],
      { onConflict: 'qr_token' }
    );
    invalidateBookingCaches(bookingId, booking.customer_id);
    return { success: true, qrToken, existing: false };
  },

  /** Additional work requests for a booking; filter by status ('pending' | 'accepted' | 'declined') or all. */
  async listAdditionalCharges(bookingId, { status } = {}) {
    const c = client();
    if (!c || !bookingId) return [];
    let q = c
      .from('booking_additional_charges')
      .select(
        'charge_id, booking_id, title, description, additional_labor_hours, hourly_rate, labor_cost, parts_total, other_amount, total_amount, status, created_at, responded_at'
      )
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return data || [];
  },

  async listPendingAdditionalCharges(bookingId) {
    return this.listAdditionalCharges(bookingId, { status: 'pending' });
  },

  /** Verify pickup QR — always hits Supabase (no stale cache for authorization) */
  async verifyPickupQr(qrToken, { verifiedBy = 'admin' } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    const token = String(qrToken || '').trim();
    if (!token) return { success: false, error: 'QR token required' };

    const { data: booking } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, customer_name, status, payment_status, pickup_qr_token, pickup_qr_expires_at, pickup_verified_at, amount_paid, final_service_total'
      )
      .eq('pickup_qr_token', token)
      .maybeSingle();

    if (!booking) return { success: false, error: 'Invalid pickup QR', qrValid: false };
    if (booking.pickup_verified_at) {
      return { success: false, error: 'Already picked up', qrValid: false, booking };
    }
    if (booking.pickup_qr_expires_at && new Date(booking.pickup_qr_expires_at) < new Date()) {
      return { success: false, error: 'QR expired', qrValid: false, booking };
    }
    if (
      booking.payment_status !== 'FULLY_PAID' &&
      Number(booking.amount_paid || 0) < Number(booking.final_service_total || 0)
    ) {
      return { success: false, error: 'Payment incomplete', qrValid: false, booking };
    }

    const nowIso = new Date().toISOString();
    await patchBooking(booking.booking_id, {
      status: FLEX_BOOKING_STATUS.COMPLETED,
      pickup_verified_at: nowIso,
      pickup_released_by: verifiedBy,
      released_at: nowIso,
      current_stage: `Picked up • Released by ${verifiedBy}`,
    });
    await c
      .from('pickup_verifications')
      .update({
        qr_valid: true,
        pickup_status: 'COMPLETED',
        verified_by: verifiedBy,
        verified_at: nowIso,
      })
      .eq('qr_token', token);

    await appendStatusHistory(
      booking.booking_id,
      FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      FLEX_BOOKING_STATUS.COMPLETED,
      verifiedBy,
      'Pickup QR verified'
    );
    notifyCustomer(
      booking.customer_id,
      'Pickup Completed',
      `Booking ${booking.booking_id} has been released. Thank you for choosing MotoTrack.`
    );
    return { success: true, qrValid: true, booking };
  },

  invalidateMechanicCache(mechanicId) {
    dataCache.invalidateMany(mechanicInvalidationKeys(mechanicId));
  },
};

export default serviceQuotationService;
