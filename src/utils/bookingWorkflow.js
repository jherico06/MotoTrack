/**
 * Valid booking status transitions + display helpers + role gates.
 * Supports flexible workflow + legacy package labels.
 */
import { FLEX_BOOKING_STATUS, normalizeBookingStatus, formatPhp, formatPhpDecimals } from './serviceQuotation.js';

export { FLEX_BOOKING_STATUS, normalizeBookingStatus, formatPhp, formatPhpDecimals };

export const BOOKING_ROLES = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  MECHANIC: 'mechanic',
  SYSTEM: 'system',
});

export const TIMELINE_EVENTS = Object.freeze({
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_APPROVED: 'BOOKING_APPROVED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  NEEDS_INFORMATION: 'NEEDS_INFORMATION',
  INFORMATION_PROVIDED: 'INFORMATION_PROVIDED',
  MECHANIC_ASSIGNED: 'MECHANIC_ASSIGNED',
  APPOINTMENT_SCHEDULED: 'APPOINTMENT_SCHEDULED',
  APPOINTMENT_RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
  INSPECTION_STARTED: 'INSPECTION_STARTED',
  INSPECTION_COMPLETED: 'INSPECTION_COMPLETED',
  MECHANIC_ESTIMATE_SUBMITTED: 'MECHANIC_ESTIMATE_SUBMITTED',
  ADMIN_REVIEWED_ESTIMATE: 'ADMIN_REVIEWED_ESTIMATE',
  QUOTATION_SENT: 'QUOTATION_SENT',
  QUOTATION_ACCEPTED: 'QUOTATION_ACCEPTED',
  QUOTATION_DECLINED: 'QUOTATION_DECLINED',
  DOWNPAYMENT_RECORDED: 'DOWNPAYMENT_RECORDED',
  SERVICE_STARTED: 'SERVICE_STARTED',
  ADDITIONAL_WORK_REQUESTED: 'ADDITIONAL_WORK_REQUESTED',
  ADDITIONAL_WORK_SENT: 'ADDITIONAL_WORK_SENT',
  ADDITIONAL_WORK_APPROVED: 'ADDITIONAL_WORK_APPROVED',
  ADDITIONAL_WORK_DECLINED: 'ADDITIONAL_WORK_DECLINED',
  SERVICE_COMPLETED: 'SERVICE_COMPLETED',
  FINAL_BILL_GENERATED: 'FINAL_BILL_GENERATED',
  FINAL_PAYMENT_RECORDED: 'FINAL_PAYMENT_RECORDED',
  PICKUP_QR_GENERATED: 'PICKUP_QR_GENERATED',
  MOTORCYCLE_RELEASED: 'MOTORCYCLE_RELEASED',
  BOOKING_COMPLETED: 'BOOKING_COMPLETED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  STATUS_CHANGED: 'STATUS_CHANGED',
});

/**
 * Lifecycle:
 * Pending Review → Approved/Payment Required → Confirmed → Scheduled →
 * Inspection → Quotation → Customer Approved → In Service → Completed →
 * Final Payment → Ready for Pickup → Completed (via QR scan).
 * Cancel only before service starts. Customer decline / expiry are terminal.
 */
export const STATUS_TRANSITIONS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: [
    FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    FLEX_BOOKING_STATUS.APPROVED,
    FLEX_BOOKING_STATUS.REJECTED,
    FLEX_BOOKING_STATUS.NEEDS_INFORMATION,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.NEEDS_INFORMATION]: [
    FLEX_BOOKING_STATUS.PENDING_REVIEW,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.APPROVED]: [
    FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: [
    FLEX_BOOKING_STATUS.CONFIRMED,
    FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.CONFIRMED]: [
    FLEX_BOOKING_STATUS.SCHEDULED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.SCHEDULED]: [
    FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: [
    FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: [
    FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
    FLEX_BOOKING_STATUS.QUOTATION_SENT,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: [
    FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: [
    FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: [
    FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
    FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
    FLEX_BOOKING_STATUS.FOR_FINAL_BILLING,
  ],
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: [
    FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
  ],
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: [
    FLEX_BOOKING_STATUS.FOR_FINAL_BILLING,
    FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
    FLEX_BOOKING_STATUS.FULLY_PAID,
    FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
  ],
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: [
    FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
    FLEX_BOOKING_STATUS.FULLY_PAID,
    FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
  ],
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: [
    FLEX_BOOKING_STATUS.FULLY_PAID,
    FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
  ],
  [FLEX_BOOKING_STATUS.FULLY_PAID]: [
    FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
  ],
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: [
    FLEX_BOOKING_STATUS.COMPLETED,
  ],
  [FLEX_BOOKING_STATUS.COMPLETED]: [],
  [FLEX_BOOKING_STATUS.REJECTED]: [],
  [FLEX_BOOKING_STATUS.CANCELLED]: [],
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: [],
  [FLEX_BOOKING_STATUS.BOOKING_EXPIRED]: [],
});

/** Role → allowed target statuses (intersection with STATUS_TRANSITIONS still required) */
export const ROLE_ALLOWED_TARGETS = Object.freeze({
  [BOOKING_ROLES.CUSTOMER]: new Set([
    FLEX_BOOKING_STATUS.PENDING_REVIEW,
    FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ]),
  [BOOKING_ROLES.MECHANIC]: new Set([
    FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
    FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
    FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
    FLEX_BOOKING_STATUS.FOR_FINAL_BILLING,
  ]),
  [BOOKING_ROLES.ADMIN]: new Set(Object.values(FLEX_BOOKING_STATUS)),
  [BOOKING_ROLES.SYSTEM]: new Set(Object.values(FLEX_BOOKING_STATUS)),
});

export const STATUS_LABELS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 'Pending Review',
  [FLEX_BOOKING_STATUS.NEEDS_INFORMATION]: 'Needs Information',
  [FLEX_BOOKING_STATUS.APPROVED]: 'Approved — Payment Required',
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 'Approved — Payment Required',
  [FLEX_BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [FLEX_BOOKING_STATUS.SCHEDULED]: 'Scheduled',
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 'Inspection',
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: 'Quotation Pending',
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 'Quotation Sent',
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 'Awaiting Customer Decision',
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 'Service In Progress',
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 'Service Completed',
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: 'Final Bill',
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 'Final Payment Pending',
  [FLEX_BOOKING_STATUS.FULLY_PAID]: 'Fully Paid',
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 'Ready for Pickup',
  [FLEX_BOOKING_STATUS.COMPLETED]: 'Completed',
  [FLEX_BOOKING_STATUS.REJECTED]: 'Rejected',
  [FLEX_BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: 'Declined',
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 'Additional Work Pending',
  [FLEX_BOOKING_STATUS.BOOKING_EXPIRED]: 'Booking Expired',
  Pending: 'Pending Review',
  Confirmed: 'Confirmed',
  Inspection: 'Inspection',
  'Estimate Pending': 'Quotation Pending',
  'In Progress': 'Service In Progress',
  'Service Done': 'Service Completed',
  Paid: 'Fully Paid',
  Closed: 'Completed',
});

export const STATUS_COLORS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: { bg: '#FEF3C7', fg: '#D97706' },
  [FLEX_BOOKING_STATUS.NEEDS_INFORMATION]: { bg: '#FFEDD5', fg: '#C2410C' },
  [FLEX_BOOKING_STATUS.APPROVED]: { bg: '#FFEDD5', fg: '#EA580C' },
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: { bg: '#FFEDD5', fg: '#EA580C' },
  [FLEX_BOOKING_STATUS.CONFIRMED]: { bg: '#C8DDD3', fg: '#1D4533' },
  [FLEX_BOOKING_STATUS.SCHEDULED]: { bg: '#E0F2FE', fg: '#0284C7' },
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: { bg: '#EDE9FE', fg: '#7C3AED' },
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: { bg: '#E0E7FF', fg: '#4338CA' },
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: { bg: '#E0F2FE', fg: '#0284C7' },
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: { bg: '#FEF3C7', fg: '#D97706' },
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: { bg: '#FEF3C7', fg: '#B45309' },
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: { bg: '#DCFCE7', fg: '#16A34A' },
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: { bg: '#FFEDD5', fg: '#C2410C' },
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: { bg: '#FFEDD5', fg: '#C2410C' },
  [FLEX_BOOKING_STATUS.FULLY_PAID]: { bg: '#D1FAE5', fg: '#059669' },
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: { bg: '#C8DDD3', fg: '#1D4533' },
  [FLEX_BOOKING_STATUS.COMPLETED]: { bg: '#F1F5F9', fg: '#475569' },
  [FLEX_BOOKING_STATUS.REJECTED]: { bg: '#FEE2E2', fg: '#DC2626' },
  [FLEX_BOOKING_STATUS.CANCELLED]: { bg: '#FEE2E2', fg: '#DC2626' },
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: { bg: '#FEE2E2', fg: '#B91C1C' },
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: { bg: '#FEE2E2', fg: '#DC2626' },
  [FLEX_BOOKING_STATUS.BOOKING_EXPIRED]: { bg: '#FEE2E2', fg: '#991B1B' },
});

export function getAllowedNextStatuses(currentStatus) {
  const n = normalizeBookingStatus(currentStatus);
  return STATUS_TRANSITIONS[n] || [];
}

export function canTransition(fromStatus, toStatus) {
  const from = normalizeBookingStatus(fromStatus);
  const to = normalizeBookingStatus(toStatus);
  if (from === to) return true;
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

/**
 * Role-gated transition check. Services must call this before patching status.
 */
export function canRoleTransition(fromStatus, toStatus, role) {
  if (!canTransition(fromStatus, toStatus)) return false;
  const r = String(role || BOOKING_ROLES.SYSTEM).toLowerCase();
  const allowed = ROLE_ALLOWED_TARGETS[r] || ROLE_ALLOWED_TARGETS[BOOKING_ROLES.SYSTEM];
  return allowed.has(normalizeBookingStatus(toStatus));
}

export function assertTransition(fromStatus, toStatus, role = BOOKING_ROLES.SYSTEM) {
  if (!canRoleTransition(fromStatus, toStatus, role)) {
    const from = normalizeBookingStatus(fromStatus);
    const to = normalizeBookingStatus(toStatus);
    throw new Error(`Invalid status transition: ${from} → ${to} (role: ${role})`);
  }
  return true;
}

export function statusLabel(status) {
  const n = normalizeBookingStatus(status);
  return STATUS_LABELS[status] || STATUS_LABELS[n] || String(status || 'Unknown').replace(/_/g, ' ');
}

export function statusColor(status) {
  const n = normalizeBookingStatus(status);
  return STATUS_COLORS[n] || { bg: '#F1F5F9', fg: '#64748B' };
}

export function bookingQuotationTotal(b) {
  return Number(
    b?.final_service_total ||
      b?.estimated_service_total ||
      b?.total_price_with_estimates ||
      b?.package_price ||
      b?.pricePhp ||
      b?.price ||
      0
  );
}

export function bookingPaymentStatus(b) {
  if (b?.payment_status) return b.payment_status;
  if (b?.downpayment_status === 'Paid' || b?.downpayment_paid) {
    if (Number(b?.remaining_balance || 0) <= 0 && Number(b?.final_service_total || b?.estimated_service_total || 0) > 0) {
      return 'FULLY_PAID';
    }
    return 'DOWNPAYMENT_PAID';
  }
  return 'Unpaid';
}

/** Dashboard summary buckets */
export function computeBookingDashboardStats(bookings = []) {
  const bucket = (pred) => bookings.filter(pred).length;
  const n = (b) => normalizeBookingStatus(b.status);
  return {
    total: bookings.length,
    pending: bucket((b) => n(b) === FLEX_BOOKING_STATUS.PENDING_REVIEW || n(b) === FLEX_BOOKING_STATUS.NEEDS_INFORMATION),
    approved: bucket((b) => n(b) === FLEX_BOOKING_STATUS.APPROVED),
    scheduled: bucket((b) => n(b) === FLEX_BOOKING_STATUS.SCHEDULED),
    underInspection: bucket((b) => n(b) === FLEX_BOOKING_STATUS.UNDER_INSPECTION),
    estimateSubmitted: bucket((b) => n(b) === FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED),
    waitingCustomerApproval: bucket(
      (b) =>
        n(b) === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL ||
        n(b) === FLEX_BOOKING_STATUS.QUOTATION_SENT
    ),
    waitingDownpayment: bucket((b) => n(b) === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT),
    inProgress: bucket((b) => n(b) === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS),
    forFinalBilling: bucket((b) => n(b) === FLEX_BOOKING_STATUS.FOR_FINAL_BILLING),
    waitingFinalPayment: bucket((b) => n(b) === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT),
    readyForPickup: bucket((b) => n(b) === FLEX_BOOKING_STATUS.READY_FOR_PICKUP),
    completed: bucket((b) => n(b) === FLEX_BOOKING_STATUS.COMPLETED),
    additionalApproval: bucket((b) => n(b) === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED),
    cancelled: bucket(
      (b) =>
        n(b) === FLEX_BOOKING_STATUS.CANCELLED ||
        n(b) === FLEX_BOOKING_STATUS.REJECTED ||
        n(b) === FLEX_BOOKING_STATUS.CUSTOMER_DECLINED
    ),
  };
}

export const ADMIN_STATUS_FILTER_OPTIONS = [
  { key: 'All', label: 'All Bookings' },
  { key: FLEX_BOOKING_STATUS.PENDING_REVIEW, label: 'Pending Review' },
  { key: FLEX_BOOKING_STATUS.NEEDS_INFORMATION, label: 'Needs Information' },
  { key: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT, label: 'Payment Required' },
  { key: FLEX_BOOKING_STATUS.CONFIRMED, label: 'Confirmed' },
  { key: FLEX_BOOKING_STATUS.SCHEDULED, label: 'Scheduled' },
  { key: FLEX_BOOKING_STATUS.UNDER_INSPECTION, label: 'Inspection' },
  { key: FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED, label: 'Quotation Pending' },
  { key: FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL, label: 'Quotation' },
  { key: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS, label: 'In Service' },
  { key: FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED, label: 'Extra Work' },
  { key: FLEX_BOOKING_STATUS.FOR_FINAL_BILLING, label: 'Final Billing' },
  { key: FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT, label: 'Final Payment' },
  { key: FLEX_BOOKING_STATUS.READY_FOR_PICKUP, label: 'Ready for Pickup' },
  { key: FLEX_BOOKING_STATUS.COMPLETED, label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled / Rejected' },
];

/**
 * Status-gated admin action keys for the Work Order UI.
 */
export function getAdminActionsForStatus(currentStatus) {
  const n = normalizeBookingStatus(currentStatus);
  const actions = new Set();

  if (n === FLEX_BOOKING_STATUS.PENDING_REVIEW) {
    actions.add('approve');
    actions.add('reject');
    actions.add('request_info');
  }
  if (n === FLEX_BOOKING_STATUS.NEEDS_INFORMATION) {
    actions.add('request_info');
  }
  if (n === FLEX_BOOKING_STATUS.APPROVED || n === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT) {
    actions.add('record_payment');
  }
  if (n === FLEX_BOOKING_STATUS.CONFIRMED) {
    actions.add('assign_mechanic');
    actions.add('reschedule');
  }
  if (n === FLEX_BOOKING_STATUS.SCHEDULED) {
    actions.add('reschedule');
    actions.add('assign_mechanic');
  }
  if (n === FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED) {
    actions.add('review_estimate');
    actions.add('create_quotation');
    actions.add('send_quotation');
  }
  if (
    n === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
    n === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL
  ) {
    actions.add('send_quotation');
  }
  if (n === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
    actions.add('review_additional');
  }
  if (n === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED) {
    actions.add('send_additional');
  }
  if (
    n === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
    n === FLEX_BOOKING_STATUS.FOR_FINAL_BILLING
  ) {
    actions.add('finalize_bill');
    actions.add('record_payment');
  }
  if (n === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT || n === FLEX_BOOKING_STATUS.FULLY_PAID) {
    actions.add('record_payment');
  }
  if (n === FLEX_BOOKING_STATUS.READY_FOR_PICKUP) {
    actions.add('generate_qr');
    actions.add('verify_pickup');
  }

  return actions;
}

export function canAdminAction(currentStatus, actionKey) {
  return getAdminActionsForStatus(currentStatus).has(actionKey);
}

/** Mechanic action keys by status */
export function getMechanicActionsForStatus(currentStatus) {
  const n = normalizeBookingStatus(currentStatus);
  const actions = new Set();
  if (n === FLEX_BOOKING_STATUS.SCHEDULED) {
    actions.add('start_inspection');
  }
  if (n === FLEX_BOOKING_STATUS.UNDER_INSPECTION) {
    actions.add('save_inspection');
    actions.add('submit_estimate');
    actions.add('create_quotation');
  }
  if (n === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
    actions.add('update_progress');
    actions.add('create_additional');
    actions.add('complete_service');
  }
  return actions;
}

export function canMechanicAction(currentStatus, actionKey) {
  return getMechanicActionsForStatus(currentStatus).has(actionKey);
}

/** Customer-friendly labels */
export const CUSTOMER_STATUS_LABELS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 'Pending Review',
  [FLEX_BOOKING_STATUS.NEEDS_INFORMATION]: 'More Information Needed',
  [FLEX_BOOKING_STATUS.APPROVED]: 'Approved — Payment Required',
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 'Approved — Payment Required',
  [FLEX_BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [FLEX_BOOKING_STATUS.SCHEDULED]: 'Scheduled',
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 'Under Inspection',
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: 'Quotation Being Prepared',
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 'Quotation Ready',
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 'Awaiting Your Decision',
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 'Service In Progress',
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 'Additional Work Needs Your Approval',
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 'Service Completed',
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: 'Preparing Final Bill',
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 'Final Payment Required',
  [FLEX_BOOKING_STATUS.FULLY_PAID]: 'Fully Paid',
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 'Ready for Pickup',
  [FLEX_BOOKING_STATUS.COMPLETED]: 'Completed',
  [FLEX_BOOKING_STATUS.REJECTED]: 'Not Approved',
  [FLEX_BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: 'Quotation Declined',
  [FLEX_BOOKING_STATUS.BOOKING_EXPIRED]: 'Booking Expired',
});

export function customerStatusLabel(status) {
  const n = normalizeBookingStatus(status);
  return CUSTOMER_STATUS_LABELS[n] || statusLabel(status);
}

export const CUSTOMER_PROGRESS_STEPS = Object.freeze([
  { key: 'submitted', label: 'Booking Submitted' },
  { key: 'approved', label: 'Admin Approved' },
  { key: 'downpayment', label: 'Downpayment Paid' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'inspected', label: 'Inspection' },
  { key: 'quotation_accepted', label: 'Quotation Approved' },
  { key: 'in_progress', label: 'Service In Progress' },
  { key: 'service_completed', label: 'Service Completed' },
  { key: 'final_payment', label: 'Final Payment' },
  { key: 'ready', label: 'Ready for Pickup' },
  { key: 'completed', label: 'Completed' },
]);

const STATUS_RANK = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 0,
  [FLEX_BOOKING_STATUS.NEEDS_INFORMATION]: 0,
  [FLEX_BOOKING_STATUS.APPROVED]: 1,
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 1,
  [FLEX_BOOKING_STATUS.CONFIRMED]: 2,
  [FLEX_BOOKING_STATUS.SCHEDULED]: 3,
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 4,
  [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]: 4.5,
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 5,
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 5,
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 6,
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 6,
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 7,
  [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]: 7.5,
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 8,
  [FLEX_BOOKING_STATUS.FULLY_PAID]: 8.5,
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 9,
  [FLEX_BOOKING_STATUS.COMPLETED]: 10,
});

export function getCustomerProgress(status) {
  const n = normalizeBookingStatus(status);
  const rank = STATUS_RANK[n];
  const stepRank = {
    submitted: 0,
    approved: 1,
    downpayment: 2,
    scheduled: 3,
    inspected: 4,
    quotation_accepted: 5,
    in_progress: 6,
    service_completed: 7,
    final_payment: 8,
    ready: 9,
    completed: 10,
  };
  const negative =
    n === FLEX_BOOKING_STATUS.REJECTED ||
    n === FLEX_BOOKING_STATUS.CANCELLED ||
    n === FLEX_BOOKING_STATUS.CUSTOMER_DECLINED ||
    n === FLEX_BOOKING_STATUS.BOOKING_EXPIRED;
  return CUSTOMER_PROGRESS_STEPS.map((s) => ({
    ...s,
    done: negative ? s.key === 'submitted' : rank != null && rank >= stepRank[s.key],
    current: !negative && rank != null && rank < stepRank[s.key] && rank >= stepRank[s.key] - 1,
  }));
}

/** Build a timeline row payload for insert */
export function buildTimelineEvent({
  bookingId,
  eventType,
  description,
  actorId,
  actorRole = BOOKING_ROLES.SYSTEM,
  fromStatus,
  toStatus,
  metadata = {},
  notes,
} = {}) {
  return {
    booking_id: bookingId,
    event_type: eventType || TIMELINE_EVENTS.STATUS_CHANGED,
    description: description || notes || `Status → ${toStatus || 'unknown'}`,
    actor_id: actorId || null,
    actor_role: actorRole,
    from_status: fromStatus || null,
    to_status: toStatus || fromStatus || 'UNKNOWN',
    changed_by: actorId || actorRole || 'system',
    notes: notes || description || null,
    metadata: metadata || {},
  };
}
