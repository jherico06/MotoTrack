/**
 * Flexible service quotation, additional charges, booking payments, pickup QR.
 * Reuses public.payments (extended with booking_id). Cache-first reads.
 * Mechanic estimates stay separate from admin-reviewed customer quotations.
 * Payments are recorded manually by admin (cash/other) — no GCash gateway yet.
 */

import { supabaseManager } from './supabaseClient.js';
import { storageAdapter } from './storageAdapter.js';
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
  QUOTATION_TYPE,
  formatPhp,
  normalizeBookingStatus,
} from '../utils/serviceQuotation.js';
import {
  BOOKING_ROLES,
  TIMELINE_EVENTS,
  assertTransition,
} from '../utils/bookingWorkflow.js';
import { bookingTimelineService } from './bookingTimelineService.js';

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

async function appendStatusHistory(
  bookingId,
  fromStatus,
  toStatus,
  changedBy,
  notes,
  { eventType, actorId, actorRole, metadata, description } = {}
) {
  if (!bookingId || !toStatus) return;
  await bookingTimelineService.append({
    bookingId,
    eventType: eventType || TIMELINE_EVENTS.STATUS_CHANGED,
    description: description || notes || `Status → ${toStatus}`,
    actorId: actorId || changedBy || null,
    actorRole: actorRole || BOOKING_ROLES.SYSTEM,
    fromStatus,
    toStatus,
    metadata,
    notes,
  });
}

function syncLocalBooking(bookingId, patch) {
  try {
    const raw = storageAdapter.getItem('mototrack_garage_bookings');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const updated = list.map((b) =>
          (b?.id === bookingId || b?.booking_id === bookingId)
            ? { ...b, ...patch, updated_at: new Date().toISOString() }
            : b
        );
        storageAdapter.setItem('mototrack_garage_bookings', JSON.stringify(updated));
      }
    }
  } catch (_e) {}
}

async function patchBooking(bookingId, patch) {
  syncLocalBooking(bookingId, patch);
  const c = client();
  if (!c) return { success: true, booking: { booking_id: bookingId, ...patch } };
  const { data, error } = await c
    .from('bookings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .select(
      'booking_id, customer_id, status, estimated_service_total, final_service_total, remaining_balance, amount_paid, payment_status, downpayment_amount, downpayment_status, active_quotation_id, pickup_qr_token'
    )
    .maybeSingle();
  if (error) {
    return { success: true, booking: { booking_id: bookingId, ...patch } };
  }
  if (data) {
    dataCache.set(CacheKeys.booking(bookingId), data, CACHE_TTL.BOOKING_DETAIL_MS);
    invalidateBookingCaches(bookingId, data.customer_id);
  }
  return { success: true, booking: data || { booking_id: bookingId, ...patch } };
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

  async getQuotationForBooking(bookingId, { force = false, preferType = 'customer' } = {}) {
    if (!bookingId) return null;
    return dataCache.fetch(
      `${CacheKeys.bookingQuotation(bookingId)}:${preferType}`,
      async () => {
        const c = client();
        if (!c) return null;
        let q = null;
        if (preferType === 'customer') {
          const { data } = await c
            .from('service_quotations')
            .select('*')
            .eq('booking_id', bookingId)
            .in('quotation_type', [QUOTATION_TYPE.CUSTOMER, 'estimated', 'final', QUOTATION_TYPE.ESTIMATED, QUOTATION_TYPE.FINAL])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          q = data;
        }
        if (!q && preferType === 'mechanic_estimate') {
          const { data } = await c
            .from('service_quotations')
            .select('*')
            .eq('booking_id', bookingId)
            .eq('quotation_type', QUOTATION_TYPE.MECHANIC_ESTIMATE)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          q = data;
        }
        if (!q) {
          const { data } = await c
            .from('service_quotations')
            .select('*')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          q = data;
        }
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

  async getMechanicEstimate(bookingId, { force = false } = {}) {
    return this.getQuotationForBooking(bookingId, { force, preferType: 'mechanic_estimate' });
  },

  /**
   * Admin creates/updates a customer quotation from (or independent of) the mechanic estimate.
   * Does not overwrite the mechanic_estimate row.
   */
  async upsertCustomerQuotation(bookingId, payload = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    if (!bookingId) return { success: false, error: 'bookingId required' };

    const sourceId = payload.source_quotation_id || payload.sourceQuotationId || null;
    const hourlyRate = Number(payload.hourly_rate ?? payload.hourlyRate ?? 0);
    const estimatedHours = Number(payload.estimated_labor_hours ?? payload.estimatedLaborHours ?? 0);
    const quotationId = payload.quotation_id || payload.quotationId || newId('qt');
    const items = buildItemsFromInput(payload.items || [], bookingId, quotationId);
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

    const expiresAt =
      payload.expires_at ||
      payload.expiresAt ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const row = {
      quotation_id: quotationId,
      booking_id: bookingId,
      quotation_type: QUOTATION_TYPE.CUSTOMER,
      status: payload.status || 'draft',
      source_quotation_id: sourceId,
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
      expires_at: expiresAt,
      notes: payload.notes || null,
      created_by: payload.created_by || payload.createdBy || 'admin',
      updated_at: new Date().toISOString(),
    };

    const { error } = await c.from('service_quotations').upsert([row], { onConflict: 'quotation_id' });
    if (error) return { success: false, error: error.message };

    await c.from('service_quotation_items').delete().eq('quotation_id', quotationId);
    const itemRows = buildItemsFromInput(payload.items || [], bookingId, quotationId);
    if (itemRows.length) {
      const { error: itemErr } = await c.from('service_quotation_items').insert(itemRows);
      if (itemErr) return { success: false, error: itemErr.message };
    }

    await patchBooking(bookingId, {
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
      estimated_service_total: totals.totalAmount,
      active_quotation_id: quotationId,
    });

    await appendStatusHistory(
      bookingId,
      FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
      FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
      'admin',
      'Admin reviewed estimate / prepared customer quotation',
      {
        eventType: TIMELINE_EVENTS.ADMIN_REVIEWED_ESTIMATE,
        actorRole: BOOKING_ROLES.ADMIN,
        metadata: { quotation_id: quotationId, source_quotation_id: sourceId },
      }
    );

    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    const quotation = normalizeQuotationRow(row, itemRows);
    return { success: true, quotation };
  },

  async sendQuotationToCustomer(bookingId, { customerId, customerUserId, expiresAt } = {}) {
    let quotation = await this.getQuotationForBooking(bookingId, { force: true, preferType: 'customer' });
    if (!quotation) return { success: false, error: 'No quotation to send' };

    const c = client();
    const nowIso = new Date().toISOString();
    const exp =
      expiresAt ||
      quotation.expires_at ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await c
      .from('service_quotations')
      .update({
        status: 'sent',
        sent_at: nowIso,
        expires_at: exp,
        quotation_type: QUOTATION_TYPE.CUSTOMER,
        updated_at: nowIso,
      })
      .eq('quotation_id', quotation.quotation_id);

    const { data: booking } = await c
      .from('bookings')
      .select('booking_id, status, customer_id')
      .eq('booking_id', bookingId)
      .maybeSingle();
    const from = booking?.status || FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED;

    try {
      assertTransition(from, FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL, BOOKING_ROLES.ADMIN);
    } catch (e) {
      // Allow from QUOTATION_SENT / ESTIMATE_SUBMITTED / UNDER_INSPECTION (legacy)
      const allowedFrom = [
        FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
        FLEX_BOOKING_STATUS.QUOTATION_SENT,
        FLEX_BOOKING_STATUS.UNDER_INSPECTION,
        FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      ];
      if (!allowedFrom.includes(normalizeBookingStatus(from))) {
        return { success: false, error: e.message };
      }
    }

    await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      active_quotation_id: quotation.quotation_id,
      estimated_service_total: quotation.total_amount,
      downpayment_amount: quotation.downpayment_amount,
      remaining_balance: quotation.remaining_balance,
      current_stage: `Quotation sent • ${formatPhp(quotation.total_amount)} • Awaiting customer decision`,
    });
    await appendStatusHistory(
      bookingId,
      from,
      FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      'admin',
      'Quotation sent to customer',
      {
        eventType: TIMELINE_EVENTS.QUOTATION_SENT,
        actorRole: BOOKING_ROLES.ADMIN,
        metadata: { quotation_id: quotation.quotation_id, expires_at: exp },
      }
    );

    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    notifyCustomer(
      customerUserId || customerId || booking?.customer_id,
      'Service Quotation Available',
      `Your service quotation for booking ${bookingId} is ready. Estimated total ${formatPhp(quotation.total_amount)}. Review and accept or decline.`
    );
    return {
      success: true,
      quotation: { ...quotation, status: 'sent', sent_at: nowIso, expires_at: exp },
    };
  },

  async respondToQuotation(bookingId, accepted, { customerId, customerUserId, declineReason } = {}) {
    const quotation = await this.getQuotationForBooking(bookingId, { force: true, preferType: 'customer' });
    if (!quotation) return { success: false, error: 'Quotation not found' };

    if (quotation.expires_at && new Date(quotation.expires_at) < new Date()) {
      return { success: false, error: 'Quotation has expired. Contact the shop for a revised estimate.' };
    }

    const c = client();
    const nowIso = new Date().toISOString();
    if (accepted) {
      await c
        .from('service_quotations')
        .update({ status: 'accepted', accepted_at: nowIso, updated_at: nowIso })
        .eq('quotation_id', quotation.quotation_id);

      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
        estimated_service_total: quotation.total_amount,
        remaining_balance: roundMoney(
          Math.max(
            0,
            Number(quotation.total_amount || 0) - Number(quotation.downpayment_amount || 0)
          )
        ),
        current_stage: `Quotation accepted • Service in progress • ${formatPhp(quotation.total_amount)}`,
      });
      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
        FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
        'customer',
        'Quotation accepted — service started',
        {
          eventType: TIMELINE_EVENTS.QUOTATION_ACCEPTED,
          actorId: customerId,
          actorRole: BOOKING_ROLES.CUSTOMER,
        }
      );
      notifyCustomer(
        customerUserId || customerId,
        'Quotation Accepted',
        `You accepted the quotation for booking ${bookingId}. Service is now in progress.`
      );
    } else {
      const reason = String(declineReason || '').trim();
      if (!reason) return { success: false, error: 'Decline reason is required' };

      await c
        .from('service_quotations')
        .update({
          status: 'declined',
          declined_at: nowIso,
          decline_reason: reason,
          updated_at: nowIso,
        })
        .eq('quotation_id', quotation.quotation_id);
      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
        current_stage: `Customer declined quotation: ${reason.slice(0, 80)}`,
      });
      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
        FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
        'customer',
        reason,
        {
          eventType: TIMELINE_EVENTS.QUOTATION_DECLINED,
          actorId: customerId,
          actorRole: BOOKING_ROLES.CUSTOMER,
          metadata: { decline_reason: reason },
        }
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
   * Admin-only manual payment recording (cash | other).
   * Inserts payments row first, then updates booking status.
   * Amount cannot exceed remaining due.
   */
  async recordBookingPayment({
    bookingId,
    customerId,
    amount,
    paymentType, // DOWNPAYMENT | FINAL_PAYMENT
    paymentMethod = 'cash',
    transactionReference,
    status = 'Completed',
    receivedBy,
    notes,
  }) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    if (!bookingId || !amount) return { success: false, error: 'bookingId and amount required' };

    const method = String(paymentMethod || 'cash').toLowerCase();
    if (!['cash', 'other', 'gcash'].includes(method)) {
      return { success: false, error: 'paymentMethod must be cash, other, or gcash' };
    }

    const { data: booking, error: bErr } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, status, downpayment_amount, remaining_balance, amount_paid, estimated_service_total, final_service_total, payment_status'
      )
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (bErr || !booking) return { success: false, error: bErr?.message || 'Booking not found' };

    const amt = roundMoney(amount);
    if (amt <= 0) return { success: false, error: 'Amount must be greater than zero' };

    const paidSoFarBefore = roundMoney(Number(booking.amount_paid || 0));
    let due = 0;
    if (paymentType === 'DOWNPAYMENT') {
      due = roundMoney(Number(booking.downpayment_amount || 0));
      if (due <= 0) due = amt;
      if (amt > due + 0.009) {
        return { success: false, error: `Downpayment cannot exceed ${formatPhp(due)}` };
      }
    } else {
      const finalTotal = roundMoney(
        Number(booking.final_service_total || booking.estimated_service_total || 0)
      );
      due = roundMoney(Math.max(0, finalTotal - paidSoFarBefore));
      if (booking.remaining_balance != null && Number(booking.remaining_balance) >= 0) {
        due = roundMoney(Math.min(due, Number(booking.remaining_balance)));
      }
      if (amt > due + 0.009) {
        return { success: false, error: `Payment cannot exceed remaining balance ${formatPhp(due)}` };
      }
    }

    const paymentId = newId('pay');
    const nowIso = new Date().toISOString();
    const ref = transactionReference || `BK-${paymentType}-${Date.now()}`;

    const paymentRecord = {
      payment_id: paymentId,
      order_id: null,
      booking_id: bookingId,
      customer_id: customerId || booking?.customer_id,
      payment_method: method,
      amount: amt,
      reference_number: ref,
      transaction_reference: ref,
      payment_type: paymentType,
      status,
      payment_date: nowIso,
      created_at: nowIso,
      verified_at: status === 'Completed' ? nowIso : null,
      received_by: receivedBy || 'admin',
      notes: notes || null,
    };

    // Save payment locally
    try {
      const payKey = `mototrack_booking_payments_${bookingId}`;
      const existingRaw = storageAdapter.getItem(payKey);
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      storageAdapter.setItem(payKey, JSON.stringify([paymentRecord, ...(Array.isArray(existingList) ? existingList : [])]));
    } catch (_e) {}

    if (c) {
      try {
        await c.from('payments').insert([paymentRecord]);
      } catch (_e) {}
    }

    const paidSoFar = roundMoney(paidSoFarBefore + amt);
    let patch = {
      amount_paid: paidSoFar,
      payment_status: paymentType === 'DOWNPAYMENT' ? 'DOWNPAYMENT_PAID' : 'PARTIAL',
    };

    if (paymentType === 'DOWNPAYMENT') {
      const est = roundMoney(Number(booking.estimated_service_total || 0));
      patch = {
        ...patch,
        status: FLEX_BOOKING_STATUS.CONFIRMED,
        downpayment_status: 'Paid',
        downpayment_paid_at: nowIso,
        downpayment_method: method,
        downpayment_ref: ref,
        remaining_balance: roundMoney(Math.max(0, est - paidSoFar)),
        current_stage: `Downpayment recorded (${formatPhp(amt)} via ${method}) • Confirmed`,
      };
      await appendStatusHistory(
        bookingId,
        FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
        FLEX_BOOKING_STATUS.CONFIRMED,
        receivedBy || 'admin',
        `Downpayment recorded (${method})`,
        {
          eventType: TIMELINE_EVENTS.DOWNPAYMENT_RECORDED,
          actorRole: BOOKING_ROLES.ADMIN,
          actorId: receivedBy,
          metadata: { amount: amt, method, payment_id: paymentId },
        }
      );
      notifyCustomer(
        customerId || booking.customer_id,
        'Payment Confirmed',
        `Downpayment of ${formatPhp(amt)} was recorded. Your booking ${bookingId} is confirmed. A mechanic will be assigned next.`
      );
    } else if (paymentType === 'FINAL_PAYMENT') {
      const finalTotal = roundMoney(
        Number(booking.final_service_total || booking.estimated_service_total || 0)
      );
      const remaining = roundMoney(Math.max(0, finalTotal - paidSoFar));
      if (remaining <= 0) {
        const qrToken = `MT-PKP-${bookingId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        patch = {
          ...patch,
          status: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
          remaining_balance: 0,
          payment_status: 'FULLY_PAID',
          pickup_qr_token: qrToken,
          pickup_qr_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          current_stage: 'Fully paid • Motorcycle ready for pickup',
        };
        await c.from('pickup_verifications').upsert(
          [
            {
              verification_id: newId('pkv'),
              booking_id: bookingId,
              customer_id: customerId || booking.customer_id,
              qr_token: qrToken,
              payment_status: 'FULLY_PAID',
              pickup_status: 'READY',
              qr_valid: true,
            },
          ],
          { onConflict: 'qr_token' }
        );
        await appendStatusHistory(
          bookingId,
          normalizeBookingStatus(booking.status),
          FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
          receivedBy || 'admin',
          'Final payment recorded — ready for pickup',
          {
            eventType: TIMELINE_EVENTS.FINAL_PAYMENT_RECORDED,
            actorRole: BOOKING_ROLES.ADMIN,
            actorId: receivedBy,
            metadata: { amount: amt, method, payment_id: paymentId },
          }
        );
        await appendStatusHistory(
          bookingId,
          FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
          FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
          receivedBy || 'admin',
          'Pickup QR generated',
          {
            eventType: TIMELINE_EVENTS.PICKUP_QR_GENERATED,
            actorRole: BOOKING_ROLES.ADMIN,
            metadata: { qr_token: qrToken },
          }
        );
        notifyCustomer(
          customerId || booking.customer_id,
          'Motorcycle Ready for Pickup',
          `Final payment recorded. Booking ${bookingId} is ready for pickup. Show your pickup QR at the counter.`
        );
      } else {
        patch = {
          ...patch,
          status: FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
          remaining_balance: remaining,
          current_stage: `Partial payment recorded • Remaining ${formatPhp(remaining)}`,
        };
        await appendStatusHistory(
          bookingId,
          normalizeBookingStatus(booking.status),
          FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
          receivedBy || 'admin',
          `Partial final payment (${formatPhp(amt)})`,
          {
            eventType: TIMELINE_EVENTS.FINAL_PAYMENT_RECORDED,
            actorRole: BOOKING_ROLES.ADMIN,
            actorId: receivedBy,
            metadata: { amount: amt, remaining, payment_id: paymentId },
          }
        );
        notifyCustomer(
          customerId || booking.customer_id,
          'Payment Recorded',
          `Payment of ${formatPhp(amt)} recorded. Remaining balance ${formatPhp(remaining)}.`
        );
      }
    }

    await patchBooking(bookingId, patch);
    dataCache.invalidate(CacheKeys.bookingPayments(bookingId));
    return {
      success: true,
      payment: {
        payment_id: paymentId,
        booking_id: bookingId,
        amount: amt,
        payment_type: paymentType,
        payment_method: method,
        status,
        transaction_reference: ref,
        received_by: receivedBy || 'admin',
        notes: notes || null,
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
        let dbPayments = [];
        const c = client();
        if (c) {
          try {
            const { data } = await c
              .from('payments')
              .select(
                'payment_id, booking_id, customer_id, amount, payment_type, payment_method, status, reference_number, transaction_reference, payment_date, verified_at, created_at, received_by, notes'
              )
              .eq('booking_id', bookingId)
              .order('payment_date', { ascending: false });
            dbPayments = Array.isArray(data) ? data : [];
          } catch (_e) {}
        }

        // Merge with locally stored payments
        let localPayments = [];
        try {
          const raw = storageAdapter.getItem(`mototrack_booking_payments_${bookingId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localPayments = parsed;
          }
        } catch (_e) {}

        const map = new Map();
        [...dbPayments, ...localPayments].forEach((p) => {
          if (p?.payment_id && !map.has(p.payment_id)) map.set(p.payment_id, p);
        });

        // Also check if local booking has downpayment recorded directly
        try {
          const rawBks = storageAdapter.getItem('mototrack_garage_bookings');
          if (rawBks) {
            const bks = JSON.parse(rawBks);
            const found = bks.find((b) => b?.id === bookingId || b?.booking_id === bookingId);
            if (
              found &&
              (found.downpayment_status === 'Paid' ||
                found.payment_status === 'DOWNPAYMENT_PAID' ||
                Number(found.amount_paid || 0) > 0)
            ) {
              const hasDp = Array.from(map.values()).some((p) => p.payment_type === 'DOWNPAYMENT');
              if (!hasDp) {
                const syntheticDp = {
                  payment_id: found.downpayment_ref || `DP-SYNTH-${bookingId}`,
                  booking_id: bookingId,
                  amount: Number(found.amount_paid || found.downpayment_amount || 135),
                  payment_type: 'DOWNPAYMENT',
                  payment_method: found.downpayment_method || 'Counter Cash',
                  reference_number: found.downpayment_ref || `MT-DP-${bookingId}`,
                  transaction_reference: found.downpayment_ref || `MT-DP-${bookingId}`,
                  status: 'Completed',
                  payment_date: found.downpayment_paid_at || found.updated_at || new Date().toISOString(),
                  created_at: found.downpayment_paid_at || found.updated_at || new Date().toISOString(),
                  received_by: 'Admin Cashier (Verified)',
                };
                map.set(syntheticDp.payment_id, syntheticDp);
              }
            }
          }
        } catch (_e) {}

        return Array.from(map.values());
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

  async finalizeBilling(bookingId, { actorId } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const { data: booking } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, status, amount_paid, estimated_service_total, final_service_total, actual_labor_cost, actual_labor_hours, quoted_hourly_rate, parts_total, other_charges_total, discount_amount, discount_type, discount_value'
      )
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (!booking) return { success: false, error: 'Booking not found' };

    const quotation = await this.getQuotationForBooking(bookingId, { force: true, preferType: 'customer' });

    const { data: acceptedExtra } = await c
      .from('booking_additional_charges')
      .select('total_amount')
      .eq('booking_id', bookingId)
      .eq('status', 'accepted');
    const additionalChargesTotal = roundMoney(
      (acceptedExtra || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
    );

    const rate = Number(booking.quoted_hourly_rate || quotation?.hourly_rate || 0);
    const actualHours = Number(
      booking.actual_labor_hours ?? quotation?.actual_labor_hours ?? quotation?.estimated_labor_hours ?? 0
    );
    const partsTotal = Number(quotation?.parts_total ?? booking.parts_total ?? 0);
    const otherChargesTotal = Number(
      quotation?.other_charges_total ?? booking.other_charges_total ?? 0
    );
    const discountType = quotation?.discount_type ?? booking.discount_type;
    const discountValue = Number(quotation?.discount_value ?? booking.discount_value ?? 0);

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
          updated_at: new Date().toISOString(),
        })
        .eq('quotation_id', quotation.quotation_id);
    }

    const nextStatus =
      remaining > 0
        ? FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT
        : FLEX_BOOKING_STATUS.READY_FOR_PICKUP;

    await patchBooking(bookingId, {
      status: remaining > 0 ? FLEX_BOOKING_STATUS.FOR_FINAL_BILLING : nextStatus,
      actual_labor_hours: actualHours,
      actual_labor_cost: totals.laborCost,
      final_service_total: finalTotal,
      remaining_balance: remaining,
      service_completed_at: new Date().toISOString(),
      current_stage:
        remaining > 0
          ? `Final bill ${formatPhp(finalTotal)} • Remaining ${formatPhp(remaining)}`
          : 'Final bill settled • Ready for pickup',
    });

    // Move FOR_FINAL_BILLING → AWAITING_FINAL_PAYMENT when balance remains
    if (remaining > 0) {
      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
      });
    }

    if (remaining <= 0) {
      const qrToken = `MT-PKP-${bookingId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      await patchBooking(bookingId, {
        status: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
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
      await appendStatusHistory(
        bookingId,
        booking.status,
        FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
        actorId || 'admin',
        'Pickup QR generated',
        {
          eventType: TIMELINE_EVENTS.PICKUP_QR_GENERATED,
          actorRole: BOOKING_ROLES.ADMIN,
          metadata: { qr_token: qrToken },
        }
      );
    }

    await appendStatusHistory(
      bookingId,
      booking.status,
      remaining > 0 ? FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT : FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      actorId || 'admin',
      `Final bill generated: ${formatPhp(finalTotal)}`,
      {
        eventType: TIMELINE_EVENTS.FINAL_BILL_GENERATED,
        actorRole: BOOKING_ROLES.ADMIN,
        actorId,
        metadata: { finalTotal, remaining, actualHours },
      }
    );

    notifyCustomer(
      booking.customer_id,
      remaining > 0 ? 'Final Payment Required' : 'Service Completed',
      remaining > 0
        ? `Service completed. Remaining balance ${formatPhp(remaining)}. Pay at the shop — admin will record payment.`
        : `Service completed for ${bookingId}. Your motorcycle is ready for pickup.`
    );
    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    return { success: true, finalTotal, remaining, laborCost: totals.laborCost, additionalChargesTotal };
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

  /**
   * Preview or confirm pickup QR.
   * confirm:false → validation preview only.
   * confirm:true (default) → release motorcycle and complete booking.
   */
  async verifyPickupQr(qrToken, { verifiedBy = 'admin', confirm = true } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    const token = String(qrToken || '').trim();
    if (!token) return { success: false, error: 'QR token required' };

    const { data: booking } = await c
      .from('bookings')
      .select(
        'booking_id, customer_id, customer_name, bike_brand, bike_model, plate_number, service_title, package_name, service_type, motorcycle_id, status, payment_status, pickup_qr_token, pickup_qr_expires_at, pickup_verified_at, amount_paid, final_service_total, remaining_balance'
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
    if (normalizeBookingStatus(booking.status) !== FLEX_BOOKING_STATUS.READY_FOR_PICKUP) {
      return {
        success: false,
        error: 'Booking is not Ready for Pickup',
        qrValid: false,
        booking,
      };
    }
    if (
      booking.payment_status !== 'FULLY_PAID' &&
      (Number(booking.remaining_balance || 0) > 0 ||
        Number(booking.amount_paid || 0) < Number(booking.final_service_total || 0))
    ) {
      return { success: false, error: 'Payment incomplete', qrValid: false, booking };
    }

    if (!confirm) {
      return {
        success: true,
        preview: true,
        qrValid: true,
        booking,
        message: 'QR valid — confirm motorcycle release',
      };
    }

    return this.confirmPickupRelease(token, { verifiedBy, booking });
  },

  async confirmPickupRelease(qrToken, { verifiedBy = 'admin', booking: knownBooking } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    const token = String(qrToken || '').trim();

    let booking = knownBooking;
    if (!booking) {
      const preview = await this.verifyPickupQr(token, { verifiedBy, confirm: false });
      if (!preview.success) return preview;
      booking = preview.booking;
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
        pickup_status: 'COMPLETED',
        qr_valid: false,
        verified_by: verifiedBy,
        verified_at: nowIso,
      })
      .eq('qr_token', token);

    await appendStatusHistory(
      booking.booking_id,
      FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      FLEX_BOOKING_STATUS.COMPLETED,
      verifiedBy,
      'Motorcycle released',
      {
        eventType: TIMELINE_EVENTS.MOTORCYCLE_RELEASED,
        actorRole: BOOKING_ROLES.ADMIN,
        actorId: verifiedBy,
        metadata: { motorcycle_id: booking.motorcycle_id, scan_time: nowIso },
      }
    );
    await appendStatusHistory(
      booking.booking_id,
      FLEX_BOOKING_STATUS.COMPLETED,
      FLEX_BOOKING_STATUS.COMPLETED,
      verifiedBy,
      'Booking completed',
      {
        eventType: TIMELINE_EVENTS.BOOKING_COMPLETED,
        actorRole: BOOKING_ROLES.ADMIN,
        actorId: verifiedBy,
      }
    );

    notifyCustomer(
      booking.customer_id,
      'Motorcycle Released',
      `Booking ${booking.booking_id} is complete. Thank you for choosing MotoTrack Garage.`
    );
    invalidateBookingCaches(booking.booking_id, booking.customer_id);
    return { success: true, qrValid: true, booking: { ...booking, status: FLEX_BOOKING_STATUS.COMPLETED } };
  },

  /** Admin sends a mechanic_draft additional charge to the customer */
  async sendAdditionalChargeToCustomer(bookingId, chargeId, { customerId, actorId } = {}) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const { data: charge } = await c
      .from('booking_additional_charges')
      .select('*')
      .eq('charge_id', chargeId)
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (!charge) return { success: false, error: 'Charge not found' };

    await c
      .from('booking_additional_charges')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('charge_id', chargeId);

    const { data: booking } = await c
      .from('bookings')
      .select('booking_id, status, customer_id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      current_stage: `Additional work requires approval • ${formatPhp(charge.total_amount)}`,
    });
    await appendStatusHistory(
      bookingId,
      booking?.status,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      actorId || 'admin',
      charge.title,
      {
        eventType: TIMELINE_EVENTS.ADDITIONAL_WORK_SENT,
        actorRole: BOOKING_ROLES.ADMIN,
        metadata: { charge_id: chargeId },
      }
    );
    notifyCustomer(
      customerId || booking?.customer_id,
      'Additional Work Requires Approval',
      `${charge.title}: ${formatPhp(charge.total_amount)}. Please review and accept or decline.`
    );
    invalidateBookingCaches(bookingId, customerId || booking?.customer_id);
    return { success: true, charge: { ...charge, status: 'pending' } };
  },

  async getTimeline(bookingId, opts) {
    return bookingTimelineService.list(bookingId, opts);
  },

  invalidateMechanicCache(mechanicId) {
    dataCache.invalidateMany(mechanicInvalidationKeys(mechanicId));
  },
};

export default serviceQuotationService;
