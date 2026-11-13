// =========================================================================
// MotoTrack - Complete Rescheduling Management System Service
// Preserves original booking, payment, and appointment history.
// Manages customer and admin reschedule requests, availability validation,
// alternative schedule proposals, and full audit trails.
// =========================================================================

import { storageAdapter } from '../system/storageAdapter.js';
import { garageService } from './garageService.js';
import { notificationService } from '../notifications/notificationService.js';
import { normalizeBookingStatus, FLEX_BOOKING_STATUS } from '../../utils/serviceQuotation.js';

const STORAGE_KEY_RESCHEDULES = 'mototrack_booking_reschedule_requests';

export const RESCHEDULE_STATUS = Object.freeze({
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  ALTERNATIVE_SUGGESTED: 'Alternative Suggested',
  ALTERNATIVE_ACCEPTED: 'Alternative Accepted',
  ALTERNATIVE_REJECTED: 'Alternative Rejected',
});

export const RESCHEDULE_INITIATOR = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
});

export const GARAGE_OPERATING_HOURS = Object.freeze({
  openDays: [1, 2, 3, 4, 5, 6], // Monday (1) to Saturday (6). Sunday (0) closed.
  openTime: '09:00 AM',
  closeTime: '06:00 PM',
  maxBays: 3,
});

export const STANDARD_TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 12:00 PM',
  '01:00 PM - 02:30 PM',
  '02:30 PM - 04:00 PM',
  '04:00 PM - 05:30 PM',
];

export const RESCHEDULE_REASONS = [
  'Work / Personal schedule conflict',
  'Motorcycle issue worsened / Need earlier date',
  'Motorcycle not available / In transit',
  'Inclement weather conditions',
  'Emergency travel',
  'Waiting for aftermarket parts delivery',
  'Other operational reason',
];

export const ADMIN_RESCHEDULE_REASONS = [
  'Assigned technician unavailable / Sick leave',
  'Pit bay undergoing routine maintenance',
  'Workshop capacity overload / Workload rebalancing',
  'Parts delivery delay for service package',
  'Emergency workshop maintenance',
  'Severe weather / Power interruption',
  'Other operational issue',
];

function generateRequestId() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RR-${new Date().getFullYear()}-${rand}`;
}

export const rescheduleService = {
  // ─── LOCAL STORAGE PERSISTENCE ───
  getLocalRequests() {
    try {
      const raw = storageAdapter.getItem(STORAGE_KEY_RESCHEDULES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  },

  saveLocalRequests(requests) {
    try {
      storageAdapter.setItem(STORAGE_KEY_RESCHEDULES, JSON.stringify(requests));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent('mototrack_reschedule_requests_updated', { detail: requests })
        );
      }
    } catch (_e) {}
  },

  // ─── QUERY API ───
  getAllRequests(filter = {}) {
    const list = this.getLocalRequests();
    const statusFilter = filter.status || 'All';
    const bookingId = filter.bookingId;
    const customerId = filter.customerId;

    return list.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) {
        if (statusFilter === 'Pending Review' && r.status !== RESCHEDULE_STATUS.PENDING_REVIEW && r.status !== RESCHEDULE_STATUS.ALTERNATIVE_SUGGESTED) {
          return false;
        }
        if (r.status !== statusFilter) return false;
      }
      if (bookingId && r.booking_id !== bookingId) return false;
      if (customerId && r.customer_id !== customerId && r.user_id !== customerId) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getRequestById(requestId) {
    const list = this.getLocalRequests();
    return list.find((r) => r.id === requestId || r.request_id === requestId) || null;
  },

  getPendingRequestForBooking(bookingId) {
    const list = this.getLocalRequests();
    return list.find(
      (r) =>
        r.booking_id === bookingId &&
        (r.status === RESCHEDULE_STATUS.PENDING_REVIEW ||
         r.status === RESCHEDULE_STATUS.ALTERNATIVE_SUGGESTED)
    ) || null;
  },

  getBookingRescheduleHistory(bookingId) {
    const list = this.getLocalRequests();
    return list
      .filter((r) => r.booking_id === bookingId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // ─── VALIDATION RULES (SECTION E) ───
  canBookingBeRescheduled(booking) {
    if (!booking) {
      return { canReschedule: false, reason: 'Booking record not found.' };
    }

    const flexStatus = normalizeBookingStatus(booking.status);
    const rawStatus = String(booking.status || '').toLowerCase();

    // 1. A booking cannot be rescheduled if already Completed or Cancelled
    if (
      flexStatus === FLEX_BOOKING_STATUS.COMPLETED ||
      flexStatus === FLEX_BOOKING_STATUS.CANCELLED ||
      flexStatus === FLEX_BOOKING_STATUS.REJECTED ||
      rawStatus === 'completed' ||
      rawStatus === 'cancelled' ||
      rawStatus === 'rejected'
    ) {
      return {
        canReschedule: false,
        reason: 'This booking is already completed, cancelled, or rejected and cannot be rescheduled.',
      };
    }

    // 2. A booking currently In Service cannot be rescheduled
    if (
      flexStatus === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS ||
      rawStatus === 'in progress' ||
      rawStatus === 'in service'
    ) {
      return {
        canReschedule: false,
        reason: 'This motorcycle is currently in the service bay undergoing active maintenance and cannot be rescheduled.',
      };
    }

    // 3. Outstanding customer quotation
    if (
      flexStatus === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL ||
      flexStatus === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
      flexStatus === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED
    ) {
      return {
        canReschedule: false,
        reason: 'There is an outstanding repair quotation for this booking. Please approve or decline the quotation before rescheduling.',
      };
    }

    // 8. Prevent duplicate pending reschedule requests
    const pending = this.getPendingRequestForBooking(booking.booking_id || booking.id);
    if (pending) {
      return {
        canReschedule: false,
        reason: `A reschedule request (#${pending.id}) is already pending review for this booking.`,
        pendingRequest: pending,
      };
    }

    return { canReschedule: true };
  },

  validateSlotAvailability(dateStr, timeSlot, excludeBookingId = null) {
    if (!dateStr) {
      return { available: false, reason: 'Please select a valid appointment date.' };
    }

    // Prevent selection of past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requested = new Date(dateStr + 'T00:00:00');
    if (isNaN(requested.getTime())) {
      return { available: false, reason: 'Invalid date format.' };
    }
    if (requested < today) {
      return { available: false, reason: 'Past dates cannot be selected for an appointment.' };
    }

    // Respect Monday–Saturday 9:00 AM–6:00 PM (Sunday is closed)
    const dayOfWeek = requested.getDay();
    if (!GARAGE_OPERATING_HOURS.openDays.includes(dayOfWeek)) {
      return {
        available: false,
        isClosed: true,
        reason: 'The workshop is closed on Sundays. Operating hours are Monday to Saturday, 9:00 AM – 6:00 PM.',
      };
    }

    // Check garage capacity & conflicts
    const allBookings = garageService.getLocalBookings();
    const activeOnDate = allBookings.filter((b) => {
      const bId = b.id || b.booking_id;
      if (excludeBookingId && bId === excludeBookingId) return false;
      const bDate = (b.appointment_date || b.preferred_date || b.date || '').split('T')[0];
      const bStatus = normalizeBookingStatus(b.status);
      return (
        bDate === dateStr &&
        bStatus !== FLEX_BOOKING_STATUS.CANCELLED &&
        bStatus !== FLEX_BOOKING_STATUS.REJECTED
      );
    });

    if (activeOnDate.length >= 15) {
      return {
        available: false,
        isFullyBooked: true,
        reason: `All daily pit bay capacity slots for ${dateStr} are currently reserved. Please select another date.`,
      };
    }

    // Check time slot conflicts if a time slot was provided
    if (timeSlot) {
      const activeInSlot = activeOnDate.filter((b) => {
        const bSlot = b.time_slot || b.preferred_time || b.time || '';
        return bSlot.toLowerCase().trim() === timeSlot.toLowerCase().trim();
      });

      if (activeInSlot.length >= GARAGE_OPERATING_HOURS.maxBays) {
        return {
          available: false,
          reason: `All ${GARAGE_OPERATING_HOURS.maxBays} pit bays are reserved for the ${timeSlot} slot on ${dateStr}. Please choose a different window.`,
          slotConflict: true,
          occupiedCount: activeInSlot.length,
          maxBays: GARAGE_OPERATING_HOURS.maxBays,
        };
      }
    }

    return {
      available: true,
      dailyBooked: activeOnDate.length,
      maxBays: GARAGE_OPERATING_HOURS.maxBays,
    };
  },

  // ─── A. CUSTOMER RESCHEDULE REQUEST ───
  async createCustomerRescheduleRequest({
    booking,
    requestedDate,
    requestedTimeSlot,
    reason,
    notes = '',
  }) {
    const bookingId = booking.booking_id || booking.id;
    const canResched = this.canBookingBeRescheduled(booking);
    if (!canResched.canReschedule) {
      throw new Error(canResched.reason);
    }

    const avail = this.validateSlotAvailability(requestedDate, requestedTimeSlot, bookingId);
    if (!avail.available) {
      throw new Error(avail.reason);
    }

    const originalDate = (booking.appointment_date || booking.preferred_date || booking.date || '').split('T')[0];
    const originalTime = booking.time_slot || booking.preferred_time || booking.time || '09:00 AM - 10:30 AM';
    const customerName = booking.customer_name || booking.userName || 'Customer';
    const customerPhone = booking.customer_phone || booking.userPhone || '';
    const customerEmail = booking.customer_email || booking.userEmail || '';
    const bikeBrand = booking.bike_brand || booking.bikeBrand || 'Motorcycle';
    const bikeModel = booking.bike_model || booking.bikeModel || '';
    const plateNumber = booking.plate_number || booking.bikePlate || 'TEMP-PLATE';
    const serviceTitle = booking.service_title || booking.package_name || booking.serviceName || 'Service Package';

    const requestId = generateRequestId();
    const nowIso = new Date().toISOString();

    const requestObj = {
      id: requestId,
      request_id: requestId,
      booking_id: bookingId,
      customer_id: booking.customer_id || booking.user_id || 'guest',
      user_id: booking.customer_id || booking.user_id || 'guest',
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      motorcycle_model: `${bikeBrand} ${bikeModel}`.trim(),
      plate_number: plateNumber,
      service_title: serviceTitle,
      original_date: originalDate,
      original_time_slot: originalTime,
      original_mechanic: booking.mechanic || 'Pending Assignment',
      original_bay: booking.bay_number || booking.bay || 'Pit Bay',
      requested_date: requestedDate,
      requested_time_slot: requestedTimeSlot,
      reason: reason || 'Schedule conflict',
      notes: notes || '',
      requested_by: RESCHEDULE_INITIATOR.CUSTOMER,
      status: RESCHEDULE_STATUS.PENDING_REVIEW,
      admin_notes: null,
      alternative_date: null,
      alternative_time_slot: null,
      alternative_reason: null,
      created_at: nowIso,
      updated_at: nowIso,
      resolved_at: null,
      resolved_by: null,
    };

    // 1. Save request in reschedule store
    const allRequests = this.getLocalRequests();
    allRequests.unshift(requestObj);
    this.saveLocalRequests(allRequests);

    // 2. Mark booking as having a pending reschedule, but DO NOT modify original schedule
    const allBookings = garageService.getLocalBookings();
    const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
    if (bIdx >= 0) {
      const existingHistory = Array.isArray(allBookings[bIdx].reschedule_history)
        ? allBookings[bIdx].reschedule_history
        : [];
      allBookings[bIdx] = {
        ...allBookings[bIdx],
        has_pending_reschedule: true,
        active_reschedule_id: requestId,
        active_reschedule_request: requestObj,
        reschedule_history: [requestObj, ...existingHistory],
      };
      garageService.saveLocalBookings(allBookings);
    }

    // 3. Notify Admin of new request
    try {
      notificationService?.addNotification?.({
        user_id: 'admin',
        title: 'New Reschedule Request',
        message: `Customer ${customerName} requested to reschedule booking #${bookingId} from ${originalDate} to ${requestedDate} (${requestedTimeSlot}). Reason: ${reason}`,
        type: 'booking',
        link: 'bookings',
        meta: { bookingId, requestId, requestedDate, requestedTimeSlot },
      });

      // 4. Notify Customer of request submission
      notificationService?.addNotification?.({
        user_id: booking.customer_id || booking.user_id || 'guest',
        customer_email: customerEmail,
        customer_name: customerName,
        title: 'Reschedule Request Received',
        message: `Your request to reschedule booking #${bookingId} to ${requestedDate} (${requestedTimeSlot}) has been received and is pending admin review. Your current appointment remains active.`,
        type: 'booking',
        link: 'bookings',
        meta: { bookingId, requestId },
      });
    } catch (_e) {}

    return requestObj;
  },

  // ─── C1. ADMIN APPROVE RESCHEDULE ───
  async approveRescheduleRequest(requestId, { adminName = 'Admin', mechanic, bay, adminNotes } = {}) {
    const request = this.getRequestById(requestId);
    if (!request) throw new Error('Reschedule request not found.');

    const bookingId = request.booking_id;
    const allBookings = garageService.getLocalBookings();
    const booking = allBookings.find((b) => (b.id || b.booking_id) === bookingId);
    if (!booking) throw new Error('Target booking record not found.');

    const targetDate = request.requested_date;
    const targetSlot = request.requested_time_slot;

    // Validate availability again immediately before committing approval!
    const avail = this.validateSlotAvailability(targetDate, targetSlot, bookingId);
    if (!avail.available) {
      throw new Error(`Cannot approve: ${avail.reason}`);
    }

    const nowIso = new Date().toISOString();

    // 1. Update Request Record
    request.status = RESCHEDULE_STATUS.APPROVED;
    request.resolved_at = nowIso;
    request.resolved_by = adminName;
    request.updated_at = nowIso;
    if (adminNotes) request.admin_notes = adminNotes;

    const allRequests = this.getLocalRequests();
    const rIdx = allRequests.findIndex((r) => r.id === requestId);
    if (rIdx >= 0) allRequests[rIdx] = request;
    this.saveLocalRequests(allRequests);

    // 2. Update Booking Schedule while PRESERVING downpayment, payment records & adding schedule history
    const prevHistory = Array.isArray(booking.schedule_history) ? booking.schedule_history : [];
    const newHistoryEntry = {
      date: request.original_date,
      time_slot: request.original_time_slot,
      rescheduled_to_date: targetDate,
      rescheduled_to_time: targetSlot,
      changed_at: nowIso,
      changed_by: adminName,
      type: 'Customer Request Approved',
      reason: request.reason,
      notes: adminNotes || request.notes || '',
    };

    const assignedMech = mechanic || request.original_mechanic || booking.mechanic || 'Pending Assignment';
    const assignedBay = bay || request.original_bay || booking.bay_number || 'Pit Bay';

    const updatedBooking = {
      ...booking,
      appointment_date: targetDate,
      preferred_date: targetDate,
      date: targetDate,
      time_slot: targetSlot,
      preferred_time: targetSlot,
      time: targetSlot,
      mechanic: assignedMech,
      bay_number: assignedBay,
      has_pending_reschedule: false,
      active_reschedule_id: null,
      active_reschedule_request: null,
      schedule_history: [newHistoryEntry, ...prevHistory],
      current_stage: `Rescheduled to ${targetDate} (${targetSlot}) • Confirmed`,
      // Retain all payment details unchanged
      downpayment_amount: booking.downpayment_amount,
      downpayment_status: booking.downpayment_status,
      downpayment_paid: booking.downpayment_paid,
      amount_paid: booking.amount_paid,
      payment_status: booking.payment_status,
    };

    const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
    if (bIdx >= 0) {
      allBookings[bIdx] = updatedBooking;
      garageService.saveLocalBookings(allBookings);
    }

    // Persist to Supabase if possible
    try {
      await garageService.syncBookingToSupabase(updatedBooking);
    } catch (_e) {}

    // 3. Notify Customer of confirmed approval
    try {
      notificationService?.addNotification?.({
        user_id: booking.customer_id || booking.user_id || 'guest',
        customer_email: booking.customer_email || booking.userEmail,
        customer_name: booking.customer_name || booking.userName,
        title: 'Appointment Rescheduled & Confirmed!',
        message: `Your reschedule request for booking #${bookingId} was APPROVED. Your new appointment is on ${targetDate} (${targetSlot}). Your slot is guaranteed.`,
        type: 'booking',
        link: 'bookings',
        meta: { bookingId, targetDate, targetSlot },
      });
    } catch (_e) {}

    return { request, updatedBooking };
  },

  // ─── C2. ADMIN REJECT RESCHEDULE ───
  async rejectRescheduleRequest(requestId, { adminName = 'Admin', reason } = {}) {
    if (!reason || !reason.trim()) {
      throw new Error('An admin rejection reason is required.');
    }

    const request = this.getRequestById(requestId);
    if (!request) throw new Error('Reschedule request not found.');

    const bookingId = request.booking_id;
    const allBookings = garageService.getLocalBookings();
    const booking = allBookings.find((b) => (b.id || b.booking_id) === bookingId);
    if (!booking) throw new Error('Target booking record not found.');

    const nowIso = new Date().toISOString();

    // 1. Update Request Record
    request.status = RESCHEDULE_STATUS.REJECTED;
    request.resolved_at = nowIso;
    request.resolved_by = adminName;
    request.admin_notes = reason.trim();
    request.updated_at = nowIso;

    const allRequests = this.getLocalRequests();
    const rIdx = allRequests.findIndex((r) => r.id === requestId);
    if (rIdx >= 0) allRequests[rIdx] = request;
    this.saveLocalRequests(allRequests);

    // 2. Keep original booking active, clear pending flag, log rejection to history
    const prevHistory = Array.isArray(booking.schedule_history) ? booking.schedule_history : [];
    const updatedBooking = {
      ...booking,
      has_pending_reschedule: false,
      active_reschedule_id: null,
      active_reschedule_request: null,
      schedule_history: [
        {
          date: booking.appointment_date,
          time_slot: booking.time_slot,
          changed_at: nowIso,
          changed_by: adminName,
          type: 'Customer Request Rejected',
          reason: reason.trim(),
        },
        ...prevHistory,
      ],
    };

    const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
    if (bIdx >= 0) {
      allBookings[bIdx] = updatedBooking;
      garageService.saveLocalBookings(allBookings);
    }

    // 3. Notify Customer of rejection
    try {
      notificationService?.addNotification?.({
        user_id: booking.customer_id || booking.user_id || 'guest',
        customer_email: booking.customer_email || booking.userEmail,
        customer_name: booking.customer_name || booking.userName,
        title: 'Reschedule Request Declined',
        message: `Your reschedule request for booking #${bookingId} could not be accommodated. Reason: ${reason}. Your original appointment on ${request.original_date} (${request.original_time_slot}) remains active.`,
        type: 'booking',
        link: 'bookings',
        meta: { bookingId, reason },
      });
    } catch (_e) {}

    return { request, updatedBooking };
  },

  // ─── C3. ADMIN SUGGEST ALTERNATIVE SCHEDULE ───
  async suggestAlternativeSchedule(
    requestId,
    { adminName = 'Admin', alternativeDate, alternativeTimeSlot, reason = '' } = {}
  ) {
    if (!alternativeDate || !alternativeTimeSlot) {
      throw new Error('Please select both an alternative date and arrival window.');
    }

    const request = this.getRequestById(requestId);
    if (!request) throw new Error('Reschedule request not found.');

    const bookingId = request.booking_id;
    const allBookings = garageService.getLocalBookings();
    const booking = allBookings.find((b) => (b.id || b.booking_id) === bookingId);
    if (!booking) throw new Error('Target booking record not found.');

    // Validate alternative date & slot
    const avail = this.validateSlotAvailability(alternativeDate, alternativeTimeSlot, bookingId);
    if (!avail.available) {
      throw new Error(`Alternative slot unavailable: ${avail.reason}`);
    }

    const nowIso = new Date().toISOString();

    // 1. Update Request Record to Alternative Suggested
    request.status = RESCHEDULE_STATUS.ALTERNATIVE_SUGGESTED;
    request.alternative_date = alternativeDate;
    request.alternative_time_slot = alternativeTimeSlot;
    request.alternative_reason = reason.trim() || 'Garage operational adjustment';
    request.admin_notes = reason.trim();
    request.updated_at = nowIso;
    request.resolved_by = adminName;

    const allRequests = this.getLocalRequests();
    const rIdx = allRequests.findIndex((r) => r.id === requestId);
    if (rIdx >= 0) allRequests[rIdx] = request;
    this.saveLocalRequests(allRequests);

    // 2. Keep original booking active, update active_reschedule_request
    const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
    if (bIdx >= 0) {
      allBookings[bIdx] = {
        ...allBookings[bIdx],
        has_pending_reschedule: true,
        active_reschedule_id: requestId,
        active_reschedule_request: request,
      };
      garageService.saveLocalBookings(allBookings);
    }

    // 3. Notify Customer of suggested schedule
    try {
      notificationService?.addNotification?.({
        user_id: booking.customer_id || booking.user_id || 'guest',
        customer_email: booking.customer_email || booking.userEmail,
        customer_name: booking.customer_name || booking.userName,
        title: 'Alternative Schedule Suggested',
        message: `For booking #${bookingId}, the workshop proposed an alternative slot: ${alternativeDate} (${alternativeTimeSlot}). Reason: ${reason || 'Workshop schedule rebalancing'}. Please review and accept or keep your original date.`,
        type: 'booking',
        link: 'bookings',
        meta: { bookingId, requestId, alternativeDate, alternativeTimeSlot },
      });
    } catch (_e) {}

    return request;
  },

  // ─── I. CUSTOMER ACCEPTS OR REJECTS ALTERNATIVE SCHEDULE ───
  async customerRespondToAlternative(requestId, { accepted, customerNotes = '' } = {}) {
    const request = this.getRequestById(requestId);
    if (!request) throw new Error('Reschedule request not found.');

    const bookingId = request.booking_id;
    const allBookings = garageService.getLocalBookings();
    const booking = allBookings.find((b) => (b.id || b.booking_id) === bookingId);
    if (!booking) throw new Error('Target booking record not found.');

    const nowIso = new Date().toISOString();

    if (accepted) {
      // Revalidate alternative availability
      const avail = this.validateSlotAvailability(
        request.alternative_date,
        request.alternative_time_slot,
        bookingId
      );
      if (!avail.available) {
        throw new Error(`Cannot confirm alternative: ${avail.reason}`);
      }

      // 1. Mark request Approved / Alternative Accepted
      request.status = RESCHEDULE_STATUS.APPROVED;
      request.resolved_at = nowIso;
      request.updated_at = nowIso;
      request.customer_response = 'Accepted alternative';
      if (customerNotes) request.notes = `${request.notes ? request.notes + ' | ' : ''}Customer response: ${customerNotes}`;

      const allRequests = this.getLocalRequests();
      const rIdx = allRequests.findIndex((r) => r.id === requestId);
      if (rIdx >= 0) allRequests[rIdx] = request;
      this.saveLocalRequests(allRequests);

      // 2. Commit alternative date & time to booking
      const prevHistory = Array.isArray(booking.schedule_history) ? booking.schedule_history : [];
      const updatedBooking = {
        ...booking,
        appointment_date: request.alternative_date,
        preferred_date: request.alternative_date,
        date: request.alternative_date,
        time_slot: request.alternative_time_slot,
        preferred_time: request.alternative_time_slot,
        time: request.alternative_time_slot,
        has_pending_reschedule: false,
        active_reschedule_id: null,
        active_reschedule_request: null,
        schedule_history: [
          {
            date: request.original_date,
            time_slot: request.original_time_slot,
            rescheduled_to_date: request.alternative_date,
            rescheduled_to_time: request.alternative_time_slot,
            changed_at: nowIso,
            changed_by: 'Customer (Accepted Alternative)',
            type: 'Alternative Schedule Accepted',
            notes: customerNotes,
          },
          ...prevHistory,
        ],
        current_stage: `Rescheduled to ${request.alternative_date} (${request.alternative_time_slot}) • Confirmed`,
      };

      const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
      if (bIdx >= 0) {
        allBookings[bIdx] = updatedBooking;
        garageService.saveLocalBookings(allBookings);
      }

      // Notify both parties
      try {
        notificationService?.addNotification?.({
          user_id: 'admin',
          title: 'Customer Accepted Alternative Schedule',
          message: `Customer ${booking.customer_name} accepted the alternative slot for booking #${bookingId}: ${request.alternative_date} (${request.alternative_time_slot}).`,
          type: 'booking',
          link: 'bookings',
        });
        notificationService?.addNotification?.({
          user_id: booking.customer_id || booking.user_id || 'guest',
          title: 'New Schedule Confirmed!',
          message: `Your service booking #${bookingId} is confirmed for ${request.alternative_date} (${request.alternative_time_slot}). See you at the workshop!`,
          type: 'booking',
          link: 'bookings',
        });
      } catch (_e) {}

      return { success: true, updatedBooking };
    } else {
      // Customer rejected the alternative schedule -> Retain original appointment!
      request.status = RESCHEDULE_STATUS.ALTERNATIVE_REJECTED;
      request.resolved_at = nowIso;
      request.updated_at = nowIso;
      request.customer_response = 'Declined alternative';

      const allRequests = this.getLocalRequests();
      const rIdx = allRequests.findIndex((r) => r.id === requestId);
      if (rIdx >= 0) allRequests[rIdx] = request;
      this.saveLocalRequests(allRequests);

      // Keep original booking active, clear pending flag
      const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
      if (bIdx >= 0) {
        allBookings[bIdx] = {
          ...allBookings[bIdx],
          has_pending_reschedule: false,
          active_reschedule_id: null,
          active_reschedule_request: null,
        };
        garageService.saveLocalBookings(allBookings);
      }

      try {
        notificationService?.addNotification?.({
          user_id: 'admin',
          title: 'Customer Declined Alternative Schedule',
          message: `Customer ${booking.customer_name} declined the alternative schedule for booking #${bookingId}. Their original appointment on ${request.original_date} remains active.`,
          type: 'booking',
          link: 'bookings',
        });
        notificationService?.addNotification?.({
          user_id: booking.customer_id || booking.user_id || 'guest',
          title: 'Original Appointment Retained',
          message: `You declined the alternative schedule. Your original appointment for booking #${bookingId} on ${request.original_date} (${request.original_time_slot}) remains active.`,
          type: 'booking',
          link: 'bookings',
        });
      } catch (_e) {}

      return { success: true, originalRetained: true };
    }
  },

  // ─── D. ADMIN-INITIATED RESCHEDULING ───
  async createAdminInitiatedReschedule({
    bookingId,
    newDate,
    newTimeSlot,
    reason,
    notes = '',
    adminName = 'Admin',
    newMechanic,
    newBay,
  }) {
    if (!reason || !reason.trim()) {
      throw new Error('Please select or provide an admin rescheduling reason.');
    }
    if (!newDate || !newTimeSlot) {
      throw new Error('Please specify both the new date and arrival time window.');
    }

    const allBookings = garageService.getLocalBookings();
    const booking = allBookings.find((b) => (b.id || b.booking_id) === bookingId);
    if (!booking) throw new Error('Booking record not found.');

    const flexStatus = normalizeBookingStatus(booking.status);
    if (
      flexStatus === FLEX_BOOKING_STATUS.COMPLETED ||
      flexStatus === FLEX_BOOKING_STATUS.CANCELLED ||
      flexStatus === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS
    ) {
      throw new Error(`Cannot reschedule booking currently in status ${flexStatus}.`);
    }

    // Validate availability before replacing schedule
    const avail = this.validateSlotAvailability(newDate, newTimeSlot, bookingId);
    if (!avail.available) {
      throw new Error(avail.reason);
    }

    const nowIso = new Date().toISOString();
    const originalDate = (booking.appointment_date || booking.preferred_date || booking.date || '').split('T')[0];
    const originalTime = booking.time_slot || booking.preferred_time || booking.time || '09:00 AM - 10:30 AM';

    // 1. Record completed reschedule request in history
    const requestId = generateRequestId();
    const requestRecord = {
      id: requestId,
      request_id: requestId,
      booking_id: bookingId,
      customer_id: booking.customer_id || booking.user_id || 'guest',
      user_id: booking.customer_id || booking.user_id || 'guest',
      customer_name: booking.customer_name || booking.userName || 'Customer',
      customer_phone: booking.customer_phone || booking.userPhone || '',
      customer_email: booking.customer_email || booking.userEmail || '',
      motorcycle_model: `${booking.bike_brand || ''} ${booking.bike_model || ''}`.trim(),
      plate_number: booking.plate_number || booking.bikePlate || 'TEMP-PLATE',
      service_title: booking.service_title || booking.package_name || 'Service Package',
      original_date: originalDate,
      original_time_slot: originalTime,
      original_mechanic: booking.mechanic || 'Unassigned',
      original_bay: booking.bay_number || 'Pit Bay',
      requested_date: newDate,
      requested_time_slot: newTimeSlot,
      reason: reason.trim(),
      notes: notes || '',
      requested_by: RESCHEDULE_INITIATOR.ADMIN,
      status: RESCHEDULE_STATUS.APPROVED,
      admin_notes: notes || reason,
      created_at: nowIso,
      updated_at: nowIso,
      resolved_at: nowIso,
      resolved_by: adminName,
    };

    const allRequests = this.getLocalRequests();
    allRequests.unshift(requestRecord);
    this.saveLocalRequests(allRequests);

    // 2. Update booking schedule with preserved payment details
    const prevHistory = Array.isArray(booking.schedule_history) ? booking.schedule_history : [];
    const updatedBooking = {
      ...booking,
      appointment_date: newDate,
      preferred_date: newDate,
      date: newDate,
      time_slot: newTimeSlot,
      preferred_time: newTimeSlot,
      time: newTimeSlot,
      mechanic: newMechanic || booking.mechanic,
      bay_number: newBay || booking.bay_number || 'Pit Bay',
      has_pending_reschedule: false,
      active_reschedule_id: null,
      active_reschedule_request: null,
      schedule_history: [
        {
          date: originalDate,
          time_slot: originalTime,
          rescheduled_to_date: newDate,
          rescheduled_to_time: newTimeSlot,
          changed_at: nowIso,
          changed_by: `${adminName} (Workshop)`,
          type: 'Admin Initiated Reschedule',
          reason: reason.trim(),
          notes: notes || '',
        },
        ...prevHistory,
      ],
      current_stage: `Rescheduled by workshop to ${newDate} (${newTimeSlot}) • Confirmed`,
      // Retain payments
      downpayment_amount: booking.downpayment_amount,
      downpayment_status: booking.downpayment_status,
      downpayment_paid: booking.downpayment_paid,
      amount_paid: booking.amount_paid,
      payment_status: booking.payment_status,
    };

    const bIdx = allBookings.findIndex((b) => (b.id || b.booking_id) === bookingId);
    if (bIdx >= 0) {
      allBookings[bIdx] = updatedBooking;
      garageService.saveLocalBookings(allBookings);
    }

    try {
      await garageService.syncBookingToSupabase(updatedBooking);
    } catch (_e) {}

    // 3. Notify Customer with reason and admin details
    try {
      notificationService?.addNotification?.({
        user_id: booking.customer_id || booking.user_id || 'guest',
        customer_email: booking.customer_email || booking.userEmail,
        customer_name: booking.customer_name || booking.userName,
        title: 'Appointment Rescheduled by Workshop',
        message: `Your booking #${bookingId} was rescheduled by MotoTrack to ${newDate} (${newTimeSlot}). Reason: ${reason}.${notes ? ` Note: ${notes}` : ''}`,
        type: 'booking',
        link: 'bookings',
        meta: { bookingId, newDate, newTimeSlot, reason, adminName },
      });
    } catch (_e) {}

    return { request: requestRecord, updatedBooking };
  },
};

