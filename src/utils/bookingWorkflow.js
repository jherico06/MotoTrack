/**
 * Valid admin booking status transitions + display helpers.
 * Supports flexible workflow + legacy package labels.
 */
import { FLEX_BOOKING_STATUS, normalizeBookingStatus, formatPhp } from './serviceQuotation';

export { FLEX_BOOKING_STATUS, normalizeBookingStatus, formatPhp };

/**
 * Diagram-locked forward-only transitions.
 * Cancel only before service starts. Customer decline is terminal.
 * COMPLETED only via admin QR scan (READY_FOR_PICKUP → COMPLETED).
 */
export const STATUS_TRANSITIONS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: [
    FLEX_BOOKING_STATUS.APPROVED,
    FLEX_BOOKING_STATUS.REJECTED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.APPROVED]: [
    FLEX_BOOKING_STATUS.SCHEDULED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.SCHEDULED]: [
    FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: [
    FLEX_BOOKING_STATUS.QUOTATION_SENT,
    FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: [
    FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: [
    FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: [
    FLEX_BOOKING_STATUS.CONFIRMED,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.CONFIRMED]: [
    FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    FLEX_BOOKING_STATUS.CANCELLED,
  ],
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: [
    FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
    FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
  ],
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: [
    FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
  ],
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: [
    FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
    FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
  ],
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: [
    FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
  ],
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: [
    FLEX_BOOKING_STATUS.COMPLETED,
  ],
  [FLEX_BOOKING_STATUS.COMPLETED]: [],
  [FLEX_BOOKING_STATUS.REJECTED]: [],
  [FLEX_BOOKING_STATUS.CANCELLED]: [],
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: [],
});

export const STATUS_LABELS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 'Pending Review',
  [FLEX_BOOKING_STATUS.APPROVED]: 'Approved',
  [FLEX_BOOKING_STATUS.SCHEDULED]: 'Scheduled',
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 'Under Inspection',
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 'Quotation Sent',
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 'Awaiting Customer Approval',
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 'Awaiting Downpayment',
  [FLEX_BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 'Service In Progress',
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 'Service Completed',
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 'Awaiting Final Payment',
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 'Ready for Pickup',
  [FLEX_BOOKING_STATUS.COMPLETED]: 'Completed',
  [FLEX_BOOKING_STATUS.REJECTED]: 'Rejected',
  [FLEX_BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: 'Customer Declined',
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 'Additional Approval Required',
  Pending: 'Pending Review',
  Confirmed: 'Confirmed',
  Inspection: 'Under Inspection',
  'Estimate Pending': 'Estimate Pending',
  'In Progress': 'In Progress',
  'Service Done': 'Service Done',
  Paid: 'Paid',
  Closed: 'Completed',
});

export const STATUS_COLORS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: { bg: '#FEF3C7', fg: '#D97706' },
  [FLEX_BOOKING_STATUS.APPROVED]: { bg: '#D1FAE5', fg: '#059669' },
  [FLEX_BOOKING_STATUS.SCHEDULED]: { bg: '#E0F2FE', fg: '#0284C7' },
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: { bg: '#EDE9FE', fg: '#7C3AED' },
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: { bg: '#E0F2FE', fg: '#0284C7' },
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: { bg: '#FEF3C7', fg: '#D97706' },
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: { bg: '#FFEDD5', fg: '#EA580C' },
  [FLEX_BOOKING_STATUS.CONFIRMED]: { bg: '#C8DDD3', fg: '#1D4533' },
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: { bg: '#FEF3C7', fg: '#B45309' },
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: { bg: '#DCFCE7', fg: '#16A34A' },
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: { bg: '#FFEDD5', fg: '#C2410C' },
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: { bg: '#C8DDD3', fg: '#1D4533' },
  [FLEX_BOOKING_STATUS.COMPLETED]: { bg: '#F1F5F9', fg: '#475569' },
  [FLEX_BOOKING_STATUS.REJECTED]: { bg: '#FEE2E2', fg: '#DC2626' },
  [FLEX_BOOKING_STATUS.CANCELLED]: { bg: '#FEE2E2', fg: '#DC2626' },
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: { bg: '#FEE2E2', fg: '#B91C1C' },
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: { bg: '#FEE2E2', fg: '#DC2626' },
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
    pending: bucket((b) => n(b) === FLEX_BOOKING_STATUS.PENDING_REVIEW),
    approved: bucket((b) => n(b) === FLEX_BOOKING_STATUS.APPROVED),
    scheduled: bucket((b) => n(b) === FLEX_BOOKING_STATUS.SCHEDULED),
    underInspection: bucket((b) => n(b) === FLEX_BOOKING_STATUS.UNDER_INSPECTION),
    waitingCustomerApproval: bucket(
      (b) =>
        n(b) === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL ||
        n(b) === FLEX_BOOKING_STATUS.QUOTATION_SENT
    ),
    waitingDownpayment: bucket((b) => n(b) === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT),
    inProgress: bucket((b) => n(b) === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS),
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
  { key: FLEX_BOOKING_STATUS.APPROVED, label: 'Approved' },
  { key: FLEX_BOOKING_STATUS.SCHEDULED, label: 'Scheduled' },
  { key: FLEX_BOOKING_STATUS.UNDER_INSPECTION, label: 'Under Inspection' },
  { key: FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL, label: 'Waiting Customer' },
  { key: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT, label: 'Waiting Downpayment' },
  { key: FLEX_BOOKING_STATUS.CONFIRMED, label: 'Confirmed' },
  { key: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS, label: 'In Progress' },
  { key: FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED, label: 'Additional Approval' },
  { key: FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT, label: 'Final Payment' },
  { key: FLEX_BOOKING_STATUS.READY_FOR_PICKUP, label: 'Ready for Pickup' },
  { key: FLEX_BOOKING_STATUS.COMPLETED, label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled / Rejected' },
];

/**
 * Status-gated admin action keys for the Work Order UI.
 * Only these actions should be enabled for the current status.
 */
export function getAdminActionsForStatus(currentStatus) {
  const n = normalizeBookingStatus(currentStatus);
  const actions = new Set();

  if (n === FLEX_BOOKING_STATUS.PENDING_REVIEW) {
    actions.add('approve');
    actions.add('reject');
  }
  if (n === FLEX_BOOKING_STATUS.APPROVED) {
    actions.add('assign_mechanic');
    actions.add('reschedule');
  }
  if (n === FLEX_BOOKING_STATUS.SCHEDULED) {
    actions.add('start_inspection');
    actions.add('reschedule');
    actions.add('assign_mechanic');
  }
  if (n === FLEX_BOOKING_STATUS.UNDER_INSPECTION) {
    actions.add('save_inspection');
    actions.add('create_quotation');
    actions.add('send_quotation');
  }
  if (
    n === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
    n === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL
  ) {
    actions.add('send_quotation');
  }
  if (n === FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT) {
    actions.add('record_payment');
  }
  if (n === FLEX_BOOKING_STATUS.CONFIRMED) {
    actions.add('start_service');
  }
  if (n === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS) {
    actions.add('update_progress');
    actions.add('create_additional');
    actions.add('complete_service');
  }
  if (n === FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED) {
    // Customer must respond; admin waits
  }
  if (
    n === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
    n === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT
  ) {
    actions.add('finalize_bill');
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

/** Customer-friendly labels — hide internal admin wording */
export const CUSTOMER_STATUS_LABELS = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 'Pending Review',
  [FLEX_BOOKING_STATUS.APPROVED]: 'Approved',
  [FLEX_BOOKING_STATUS.SCHEDULED]: 'Scheduled',
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 'Under Inspection',
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 'Quotation Ready',
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 'Awaiting Your Approval',
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 'Awaiting Downpayment',
  [FLEX_BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 'Service In Progress',
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 'Additional Work Needs Your Approval',
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 'Service Completed',
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 'Awaiting Final Payment',
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 'Ready for Pickup',
  [FLEX_BOOKING_STATUS.COMPLETED]: 'Completed',
  [FLEX_BOOKING_STATUS.REJECTED]: 'Not Approved',
  [FLEX_BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [FLEX_BOOKING_STATUS.CUSTOMER_DECLINED]: 'Quotation Declined',
});

export function customerStatusLabel(status) {
  const n = normalizeBookingStatus(status);
  return CUSTOMER_STATUS_LABELS[n] || statusLabel(status);
}

/** Ordered customer progress steps; each step lists the statuses at/after which it counts as done. */
export const CUSTOMER_PROGRESS_STEPS = Object.freeze([
  { key: 'submitted', label: 'Booking Submitted' },
  { key: 'approved', label: 'Admin Approved' },
  { key: 'inspected', label: 'Inspection Completed' },
  { key: 'quotation_accepted', label: 'Quotation Accepted' },
  { key: 'downpayment', label: 'Downpayment Paid' },
  { key: 'in_progress', label: 'Service In Progress' },
  { key: 'service_completed', label: 'Service Completed' },
  { key: 'final_payment', label: 'Final Payment' },
  { key: 'ready', label: 'Ready for Pickup' },
  { key: 'completed', label: 'Completed' },
]);

const STATUS_RANK = Object.freeze({
  [FLEX_BOOKING_STATUS.PENDING_REVIEW]: 0,
  [FLEX_BOOKING_STATUS.APPROVED]: 1,
  [FLEX_BOOKING_STATUS.SCHEDULED]: 1,
  [FLEX_BOOKING_STATUS.UNDER_INSPECTION]: 1.5,
  [FLEX_BOOKING_STATUS.QUOTATION_SENT]: 2,
  [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL]: 2,
  [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT]: 3,
  [FLEX_BOOKING_STATUS.CONFIRMED]: 4,
  [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS]: 5,
  [FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED]: 5,
  [FLEX_BOOKING_STATUS.SERVICE_COMPLETED]: 6,
  [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT]: 6,
  [FLEX_BOOKING_STATUS.READY_FOR_PICKUP]: 8,
  [FLEX_BOOKING_STATUS.COMPLETED]: 9,
});

/** Returns steps with done flag; terminal negative statuses mark nothing beyond submission. */
export function getCustomerProgress(status) {
  const n = normalizeBookingStatus(status);
  const rank = STATUS_RANK[n];
  const stepRank = {
    submitted: 0,
    approved: 1,
    inspected: 2,
    quotation_accepted: 3,
    downpayment: 4,
    in_progress: 5,
    service_completed: 6,
    final_payment: 8,
    ready: 8,
    completed: 9,
  };
  const negative =
    n === FLEX_BOOKING_STATUS.REJECTED ||
    n === FLEX_BOOKING_STATUS.CANCELLED ||
    n === FLEX_BOOKING_STATUS.CUSTOMER_DECLINED;
  return CUSTOMER_PROGRESS_STEPS.map((s) => ({
    ...s,
    done: negative ? s.key === 'submitted' : rank != null && rank >= stepRank[s.key],
    current: !negative && rank != null && rank < stepRank[s.key] && rank >= stepRank[s.key] - 1,
  }));
}
