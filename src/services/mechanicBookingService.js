/**
 * Mechanic-facing booking operations.
 * Mechanics only see bookings assigned to their roster id.
 * They cannot approve bookings, send customer quotations, record payments, or release motorcycles.
 */
import { supabaseManager } from './supabaseClient.js';
import { notificationService } from './notificationService.js';
import { dataCache } from './cache/dataCache.js';
import { CACHE_TTL, CacheKeys, bookingInvalidationKeys } from './cache/cacheKeys.js';
import {
  calcServiceTotals,
  calcLineTotal,
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
  canMechanicAction,
} from '../utils/bookingWorkflow.js';
import { bookingTimelineService } from './bookingTimelineService.js';
import { garageService } from './garageService.js';

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function client() {
  return supabaseManager.getClient();
}

function invalidate(bookingId, customerId) {
  dataCache.invalidateMany(bookingInvalidationKeys(bookingId, customerId));
}

async function getBooking(bookingId) {
  const c = client();
  if (!c || !bookingId) return null;
  const { data } = await c
    .from('bookings')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  return data;
}

async function patchBooking(bookingId, patch) {
  const c = client();
  if (!c) return { success: false, error: 'Supabase unavailable' };
  const { data, error } = await c
    .from('bookings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .select('*')
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (data) invalidate(bookingId, data.customer_id);
  return { success: true, booking: data };
}

function assertAssigned(booking, mechanicId) {
  if (!booking) throw new Error('Booking not found');
  if (String(booking.mechanic_id) !== String(mechanicId)) {
    throw new Error('Unauthorized: booking is not assigned to this mechanic');
  }
}

function buildItems(items = [], bookingId, quotationId) {
  return (items || []).map((it, idx) => {
    const qty = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0);
    return {
      item_id: it.item_id || it.id || newId('qti'),
      quotation_id: quotationId,
      booking_id: bookingId,
      item_type: it.item_type || it.itemType || (it.product_id || it.productId ? 'part' : 'other'),
      product_id: it.product_id || it.productId || null,
      product_name: it.product_name || it.productName || it.name || null,
      description: it.description || it.reason || it.title || null,
      quantity: qty,
      unit_price: unitPrice,
      line_total: calcLineTotal(qty, unitPrice),
      unit_cost: Number(it.unit_cost ?? it.unitCost ?? 0),
      sort_order: it.sort_order ?? idx,
    };
  });
}

export const mechanicBookingService = {
  FLEX_BOOKING_STATUS,
  canMechanicAction,

  /** Resolve roster mechanic for a logged-in user */
  async getMechanicForUser(userId, { force = false } = {}) {
    if (!userId) return null;
    const mechanics = await garageService.fetchMechanics({ force });
    const linked = (mechanics || []).find(
      (m) => String(m.user_id || m.userId) === String(userId)
    );
    if (linked) return linked;

    // Also query live if local map missing user_id
    const c = client();
    if (!c) return null;
    const { data } = await c
      .from('mechanics')
      .select(
        'id, name, short_name, specialization, experience, certifications, avatar, bay, status, phone, email, rating, hourly_rate, is_active, user_id'
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      shortName: data.short_name,
      specialization: data.specialization,
      hourlyRate: Number(data.hourly_rate ?? 150),
      hourly_rate: Number(data.hourly_rate ?? 150),
      isActive: data.is_active !== false,
      user_id: data.user_id,
      bay: data.bay,
      status: data.status,
      avatar: data.avatar,
    };
  },

  async linkUserToMechanic(mechanicId, userId) {
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };
    if (!mechanicId) return { success: false, error: 'mechanicId required' };

    // Clear previous link on this user
    if (userId) {
      await c.from('mechanics').update({ user_id: null }).eq('user_id', userId);
    }
    const { data, error } = await c
      .from('mechanics')
      .update({ user_id: userId || null, updated_at: new Date().toISOString() })
      .eq('id', mechanicId)
      .select('*')
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    dataCache.invalidate(CacheKeys.mechanicsList());
    return { success: true, mechanic: data };
  },

  async listAssignedBookings(mechanicId, { force = false } = {}) {
    if (!mechanicId) return [];
    return dataCache.fetch(
      `mechanic-bookings:${mechanicId}`,
      async () => {
        const c = client();
        if (!c) {
          const all = await garageService.fetchBookings({ force: true }).catch(() => []);
          return (all || []).filter((b) => String(b.mechanic_id) === String(mechanicId));
        }
        const { data, error } = await c
          .from('bookings')
          .select('*')
          .eq('mechanic_id', mechanicId)
          .order('appointment_start', { ascending: true, nullsFirst: false });
        if (error) {
          console.warn('listAssignedBookings:', error.message);
          return [];
        }
        return data || [];
      },
      { ttlMs: CACHE_TTL.BOOKING_LIST_MS, force }
    );
  },

  async getAssignedBooking(bookingId, mechanicId) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    return booking;
  },

  async startInspection(bookingId, mechanicId, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    assertTransition(booking.status, FLEX_BOOKING_STATUS.UNDER_INSPECTION, BOOKING_ROLES.MECHANIC);

    const result = await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
      inspection_started_at: new Date().toISOString(),
      current_stage: 'For Inspection • Mechanic inspecting motorcycle',
    });
    if (!result.success) return result;

    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.INSPECTION_STARTED,
      description: 'Inspection started',
      actorId: actorId || mechanicId,
      actorRole: BOOKING_ROLES.MECHANIC,
      fromStatus: booking.status,
      toStatus: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    });
    return result;
  },

  async saveInspection(bookingId, mechanicId, payload = {}, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const row = {
      inspection_id: payload.inspection_id || newId('insp'),
      booking_id: bookingId,
      findings: payload.findings || payload.problemsFound || '',
      recommended_work: payload.recommendedWork || payload.recommended_work || '',
      condition: payload.condition || '',
      safety_concerns: payload.safetyConcerns || payload.safety_concerns || '',
      photos: payload.photos || [],
      inspected_by: actorId || mechanicId,
      inspected_at: new Date().toISOString(),
    };

    const { error } = await c.from('booking_inspections').upsert([row], { onConflict: 'inspection_id' });
    if (error) {
      // fallback insert if upsert conflict target missing
      const { error: e2 } = await c.from('booking_inspections').insert([row]);
      if (e2) return { success: false, error: e2.message };
    }

    await patchBooking(bookingId, {
      inspection_notes: row.findings,
      inspection_checklist: payload.checklist || null,
      inspection_odometer: payload.odometer || null,
      current_stage: 'Inspection findings saved • Prepare estimate',
    });

    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.INSPECTION_COMPLETED,
      description: 'Inspection findings recorded',
      actorId: actorId || mechanicId,
      actorRole: BOOKING_ROLES.MECHANIC,
      fromStatus: booking.status,
      toStatus: normalizeBookingStatus(booking.status),
      metadata: { inspection_id: row.inspection_id },
    });

    return { success: true, inspection: row };
  },

  /**
   * Submit mechanic estimate (does NOT become customer quotation).
   * Status: UNDER_INSPECTION → ESTIMATE_SUBMITTED
   */
  async submitEstimate(bookingId, mechanicId, payload = {}, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    assertTransition(booking.status, FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED, BOOKING_ROLES.MECHANIC);

    const mechanics = await garageService.fetchMechanics({ force: true });
    const mech = (mechanics || []).find((m) => String(m.id) === String(mechanicId));
    const hourlyRate = Number(
      payload.hourly_rate ?? payload.hourlyRate ?? mech?.hourlyRate ?? mech?.hourly_rate ?? booking.quoted_hourly_rate ?? 150
    );
    const estimatedHours = Number(payload.estimated_labor_hours ?? payload.estimatedLaborHours ?? 0);
    const otherChargesTotal = Number(payload.other_charges_total ?? payload.otherChargesTotal ?? 0);

    const quotationId = newId('qt');
    const itemRows = buildItems(payload.items || [], bookingId, quotationId);
    const partsTotal = roundMoney(
      itemRows.filter((i) => i.item_type === 'part').reduce((s, i) => s + i.line_total, 0)
    );
    const otherFromItems = roundMoney(
      itemRows.filter((i) => i.item_type !== 'part').reduce((s, i) => s + i.line_total, 0)
    );
    const totals = calcServiceTotals({
      hourlyRate,
      laborHours: estimatedHours,
      partsTotal,
      otherChargesTotal: otherChargesTotal + otherFromItems,
    });

    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const row = {
      quotation_id: quotationId,
      booking_id: bookingId,
      quotation_type: QUOTATION_TYPE.MECHANIC_ESTIMATE,
      status: 'submitted',
      mechanic_id: mechanicId,
      mechanic_name: mech?.name || booking.mechanic || null,
      hourly_rate: hourlyRate,
      estimated_labor_hours: estimatedHours,
      labor_cost: totals.laborCost,
      parts_total: totals.partsTotal,
      other_charges_total: totals.otherChargesTotal,
      additional_charges_total: 0,
      discount_amount: 0,
      discount_value: 0,
      subtotal: totals.subtotal,
      total_amount: totals.totalAmount,
      notes: payload.notes || payload.mechanicNotes || null,
      created_by: actorId || mechanicId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await c.from('service_quotations').insert([row]);
    if (error) return { success: false, error: error.message };
    if (itemRows.length) {
      await c.from('service_quotation_items').insert(itemRows);
    }

    const result = await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
      quoted_hourly_rate: hourlyRate,
      estimated_labor_hours: estimatedHours,
      estimated_labor_cost: totals.laborCost,
      parts_total: totals.partsTotal,
      other_charges_total: totals.otherChargesTotal,
      estimated_service_total: totals.totalAmount,
      current_stage: `Mechanic estimate submitted • ${formatPhp(totals.totalAmount)} • Awaiting admin review`,
    });
    if (!result.success) return result;

    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.MECHANIC_ESTIMATE_SUBMITTED,
      description: `Mechanic estimate submitted (${formatPhp(totals.totalAmount)})`,
      actorId: actorId || mechanicId,
      actorRole: BOOKING_ROLES.MECHANIC,
      fromStatus: booking.status,
      toStatus: FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
      metadata: { quotation_id: quotationId, total: totals.totalAmount },
    });

    try {
      notificationService?.addNotification?.({
        user_id: 'admin',
        title: 'Mechanic Estimate Ready',
        message: `Estimate for booking ${bookingId}: ${formatPhp(totals.totalAmount)}. Review and create customer quotation.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    dataCache.invalidate(`mechanic-bookings:${mechanicId}`);
    dataCache.invalidate(CacheKeys.bookingQuotation(bookingId));
    return { success: true, estimate: { ...row, items: itemRows }, booking: result.booking };
  },

  async startService(bookingId, mechanicId, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    assertTransition(booking.status, FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS, BOOKING_ROLES.MECHANIC);

    const result = await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
      service_started_at: new Date().toISOString(),
      service_progress: 25,
      current_stage: `Service started • ${booking.mechanic || 'Mechanic'}`,
    });
    if (!result.success) return result;

    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.SERVICE_STARTED,
      description: 'Service started',
      actorId: actorId || mechanicId,
      actorRole: BOOKING_ROLES.MECHANIC,
      fromStatus: booking.status,
      toStatus: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    });

    try {
      notificationService?.addNotification?.({
        user_id: booking.customer_id || booking.user_id || 'guest',
        title: 'Service Started',
        message: `Work on your motorcycle for booking #${bookingId} has started.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return result;
  },

  async recordWorkProgress(bookingId, mechanicId, payload = {}, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    const status = normalizeBookingStatus(booking.status);
    if (status !== FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
      return { success: false, error: 'Service is not in progress' };
    }

    const patch = {
      service_notes: payload.serviceNotes || payload.service_notes || booking.service_notes,
      actual_labor_hours:
        payload.actualLaborHours != null
          ? Number(payload.actualLaborHours)
          : booking.actual_labor_hours,
      service_progress:
        payload.progress != null ? Number(payload.progress) : booking.service_progress,
    };
    if (payload.partsUsedTotal != null) {
      patch.parts_total = Number(payload.partsUsedTotal);
    }
    if (Array.isArray(payload.photos) && payload.photos.length) {
      const prev = Array.isArray(booking.media_urls) ? booking.media_urls : [];
      patch.media_urls = [...prev, ...payload.photos];
    }
    if (patch.actual_labor_hours != null && booking.quoted_hourly_rate) {
      patch.actual_labor_cost = roundMoney(
        Number(patch.actual_labor_hours) * Number(booking.quoted_hourly_rate)
      );
    }

    const result = await patchBooking(bookingId, {
      ...patch,
      current_stage: 'Service in progress • Work notes updated',
    });
    return result;
  },

  /**
   * Additional work request — mechanic_draft until admin sends to customer.
   */
  async requestAdditionalWork(bookingId, mechanicId, chargePayload = {}, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    assertTransition(
      booking.status,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      BOOKING_ROLES.MECHANIC
    );

    const c = client();
    if (!c) return { success: false, error: 'Supabase unavailable' };

    const hourlyRate = Number(
      chargePayload.hourly_rate ?? chargePayload.hourlyRate ?? booking.quoted_hourly_rate ?? 0
    );
    const laborHours = Number(
      chargePayload.additional_labor_hours ?? chargePayload.laborHours ?? 0
    );
    const laborCost = roundMoney(hourlyRate * laborHours);
    const partsTotal = roundMoney(chargePayload.parts_total ?? chargePayload.partsTotal ?? 0);
    const otherAmount = roundMoney(chargePayload.other_amount ?? chargePayload.otherAmount ?? 0);
    const totalAmount = roundMoney(laborCost + partsTotal + otherAmount);

    const row = {
      charge_id: newId('bac'),
      booking_id: bookingId,
      title: chargePayload.title || 'Additional Work',
      description: chargePayload.description || chargePayload.reason || '',
      additional_labor_hours: laborHours,
      hourly_rate: hourlyRate,
      labor_cost: laborCost,
      parts_total: partsTotal,
      other_amount: otherAmount,
      total_amount: totalAmount,
      items: chargePayload.items || [],
      status: 'mechanic_draft',
      created_by: actorId || mechanicId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await c.from('booking_additional_charges').insert([row]);
    if (error) return { success: false, error: error.message };

    // Stay in SERVICE_IN_PROGRESS until admin sends; timeline records the request
    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.ADDITIONAL_WORK_REQUESTED,
      description: `Additional work requested: ${row.title} (${formatPhp(totalAmount)})`,
      actorId: actorId || mechanicId,
      actorRole: BOOKING_ROLES.MECHANIC,
      fromStatus: booking.status,
      toStatus: booking.status,
      metadata: { charge_id: row.charge_id, total: totalAmount, status: 'mechanic_draft' },
    });

    try {
      notificationService?.addNotification?.({
        user_id: 'admin',
        title: 'Additional Work Request',
        message: `Mechanic requested extra work on ${bookingId}: ${row.title} (${formatPhp(totalAmount)}). Review before sending to customer.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return { success: true, charge: row };
  },

  /** Mechanic marks work finished → SERVICE_COMPLETED (admin then finalizes billing) */
  async submitServiceCompletion(bookingId, mechanicId, payload = {}, { actorId } = {}) {
    const booking = await getBooking(bookingId);
    assertAssigned(booking, mechanicId);
    assertTransition(booking.status, FLEX_BOOKING_STATUS.SERVICE_COMPLETED, BOOKING_ROLES.MECHANIC);

    const actualHours = Number(
      payload.actualLaborHours ?? payload.actual_labor_hours ?? booking.actual_labor_hours ?? 0
    );
    const rate = Number(booking.quoted_hourly_rate || 0);
    const actualLaborCost = roundMoney(actualHours * rate);

    const result = await patchBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
      actual_labor_hours: actualHours,
      actual_labor_cost: actualLaborCost,
      parts_total:
        payload.partsUsedTotal != null ? Number(payload.partsUsedTotal) : booking.parts_total,
      service_notes: payload.serviceNotes || payload.service_notes || booking.service_notes,
      service_completed_at: new Date().toISOString(),
      service_progress: 100,
      current_stage: 'Service completed by mechanic • Awaiting admin final billing',
    });
    if (!result.success) return result;

    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.SERVICE_COMPLETED,
      description: `Service completed • Actual labor ${actualHours} hrs`,
      actorId: actorId || mechanicId,
      actorRole: BOOKING_ROLES.MECHANIC,
      fromStatus: booking.status,
      toStatus: FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
      metadata: { actual_labor_hours: actualHours },
    });

    try {
      notificationService?.addNotification?.({
        user_id: 'admin',
        title: 'Service Completed',
        message: `Mechanic marked booking ${bookingId} complete. Review final bill.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    dataCache.invalidate(`mechanic-bookings:${mechanicId}`);
    return result;
  },
};

export default mechanicBookingService;
