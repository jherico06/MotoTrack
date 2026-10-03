/**
 * Dynamic service quotation pricing helpers + canonical booking statuses.
 * Labor Cost = Hourly Rate × Labor Hours
 * Final Total = Actual Labor + Parts + Additional + Other − Discount
 *
 * Lifecycle (flexible garage):
 * Pending Review → Approved/Payment Required → Confirmed → Scheduled →
 * Inspection → Quotation → Customer Approved → In Service → Completed →
 * Final Payment → Ready for Pickup → Completed
 */

export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

export function calcLaborCost(hourlyRate, hours) {
  return roundMoney(Number(hourlyRate || 0) * Number(hours || 0));
}

export function calcLineTotal(quantity, unitPrice) {
  return roundMoney(Number(quantity || 0) * Number(unitPrice || 0));
}

export function calcDiscountAmount(discountType, discountValue, subtotalBeforeDiscount) {
  const value = Number(discountValue || 0);
  const sub = Number(subtotalBeforeDiscount || 0);
  if (value <= 0 || sub <= 0) return 0;
  if (String(discountType || '').toLowerCase() === 'percent') {
    return roundMoney(Math.min(sub, (sub * value) / 100));
  }
  return roundMoney(Math.min(sub, value));
}

export function calcServiceTotals(input = {}) {
  const laborCost = calcLaborCost(input.hourlyRate, input.laborHours);
  const partsTotal = roundMoney(input.partsTotal || 0);
  const otherChargesTotal = roundMoney(input.otherChargesTotal || 0);
  const additionalChargesTotal = roundMoney(input.additionalChargesTotal || 0);
  const subtotal = roundMoney(laborCost + partsTotal + otherChargesTotal + additionalChargesTotal);
  const discountAmount = calcDiscountAmount(input.discountType, input.discountValue, subtotal);
  const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  return {
    laborCost,
    partsTotal,
    otherChargesTotal,
    additionalChargesTotal,
    subtotal,
    discountAmount,
    totalAmount,
  };
}

export function calcDownpayment({
  totalAmount,
  downpaymentType = 'percent',
  downpaymentPercent = 30,
  downpaymentAmount = 0,
} = {}) {
  const total = roundMoney(totalAmount || 0);
  let dp = 0;
  if (String(downpaymentType).toLowerCase() === 'fixed') {
    dp = roundMoney(Math.min(total, Number(downpaymentAmount || 0)));
  } else {
    dp = roundMoney(Math.min(total, (total * Number(downpaymentPercent || 0)) / 100));
  }
  return {
    downpaymentAmount: dp,
    remainingBalance: roundMoney(Math.max(0, total - dp)),
  };
}

/** Default downpayment deadline hours after approval */
export const DEFAULT_DOWNPAYMENT_DEADLINE_HOURS = 48;

export function calcPaymentDeadline(fromDate = new Date(), hours = DEFAULT_DOWNPAYMENT_DEADLINE_HOURS) {
  const d = new Date(fromDate);
  d.setHours(d.getHours() + Number(hours || DEFAULT_DOWNPAYMENT_DEADLINE_HOURS));
  return d.toISOString();
}

export function formatPhp(amount, options = {}) {
  const n = Number(amount || 0);
  let minDigits = 0;
  let maxDigits = 2;

  if (typeof options === 'number') {
    minDigits = options;
    maxDigits = options;
  } else if (options && typeof options === 'object') {
    if (options.decimals === true) {
      minDigits = 2;
      maxDigits = 2;
    } else {
      if (typeof options.minimumFractionDigits === 'number') minDigits = options.minimumFractionDigits;
      if (typeof options.maximumFractionDigits === 'number') maxDigits = options.maximumFractionDigits;
    }
  }

  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits })}`;
}

export function formatPhpDecimals(amount) {
  return formatPhp(amount, { decimals: true });
}

export function formatLaborLine(hours, hourlyRate) {
  const h = Number(hours || 0);
  const rate = Number(hourlyRate || 0);
  const cost = calcLaborCost(rate, h);
  return `${h} hours × ${formatPhp(rate)} = ${formatPhp(cost)}`;
}

/**
 * Canonical flexible booking statuses.
 * Spec aliases (APPROVED_PAYMENT_REQUIRED, etc.) normalize to these codes.
 */
export const FLEX_BOOKING_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  NEEDS_INFORMATION: 'NEEDS_INFORMATION',
  /** After admin approve — customer must pay downpayment */
  APPROVED: 'APPROVED',
  AWAITING_DOWNPAYMENT: 'AWAITING_DOWNPAYMENT',
  CONFIRMED: 'CONFIRMED',
  SCHEDULED: 'SCHEDULED',
  UNDER_INSPECTION: 'UNDER_INSPECTION',
  ESTIMATE_SUBMITTED: 'ESTIMATE_SUBMITTED',
  QUOTATION_SENT: 'QUOTATION_SENT',
  AWAITING_CUSTOMER_APPROVAL: 'AWAITING_CUSTOMER_APPROVAL',
  SERVICE_IN_PROGRESS: 'SERVICE_IN_PROGRESS',
  ADDITIONAL_APPROVAL_REQUIRED: 'ADDITIONAL_APPROVAL_REQUIRED',
  SERVICE_COMPLETED: 'SERVICE_COMPLETED',
  FOR_FINAL_BILLING: 'FOR_FINAL_BILLING',
  AWAITING_FINAL_PAYMENT: 'AWAITING_FINAL_PAYMENT',
  FULLY_PAID: 'FULLY_PAID',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  CUSTOMER_DECLINED: 'CUSTOMER_DECLINED',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
});

export const QUOTATION_TYPE = Object.freeze({
  MECHANIC_ESTIMATE: 'mechanic_estimate',
  CUSTOMER: 'customer',
  ESTIMATED: 'estimated',
  FINAL: 'final',
});

/** Default catalog estimates used when admin approves without a custom estimate */
export const SERVICE_ESTIMATE_DEFAULTS = Object.freeze({
  PMS: { estimatedCost: 2500, downpaymentPercent: 30, label: 'Preventive Maintenance Service' },
  Repair: { estimatedCost: 3500, downpaymentPercent: 30, label: 'Mechanical Repair' },
  'Oil Change': { estimatedCost: 800, downpaymentPercent: 30, label: 'Oil Change' },
  'Brake Service': { estimatedCost: 1500, downpaymentPercent: 30, label: 'Brake Service' },
  'Tire Service': { estimatedCost: 1200, downpaymentPercent: 30, label: 'Tire Service' },
  'Engine Service': { estimatedCost: 4500, downpaymentPercent: 30, label: 'Engine Service' },
  Other: { estimatedCost: 2000, downpaymentPercent: 30, label: 'Other Service' },
  Customization: { estimatedCost: 5000, downpaymentPercent: 20, label: 'Customization' },
});

export function getServiceEstimateDefaults(serviceType) {
  const key = String(serviceType || 'Other');
  return SERVICE_ESTIMATE_DEFAULTS[key] || SERVICE_ESTIMATE_DEFAULTS.Other;
}

export function normalizeBookingStatus(status) {
  const s = String(status || '').trim();
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if (FLEX_BOOKING_STATUS[upper]) return FLEX_BOOKING_STATUS[upper];

  const aliasMap = {
    APPROVED_PAYMENT_REQUIRED: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    PAYMENT_PENDING: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    PAYMENT_REQUIRED: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
    FOR_INSPECTION: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    INSPECTION: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    QUOTATION_PENDING: FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED,
    AWAITING_CUSTOMER_DECISION: FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
    CUSTOMER_APPROVED: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    AWAITING_EXTRA_WORK_APPROVAL: FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
    ADDITIONAL_WORK_PENDING: FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
    AWAITING_BALANCE: FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
    FINAL_PAYMENT_PENDING: FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT,
    DECLINED: FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
    NEEDS_INFO: FLEX_BOOKING_STATUS.NEEDS_INFORMATION,
    EXPIRED: FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
  };
  if (aliasMap[upper]) return aliasMap[upper];

  const legacyMap = {
    Pending: FLEX_BOOKING_STATUS.PENDING_REVIEW,
    Confirmed: FLEX_BOOKING_STATUS.CONFIRMED,
    Rejected: FLEX_BOOKING_STATUS.REJECTED,
    Cancelled: FLEX_BOOKING_STATUS.CANCELLED,
    Inspection: FLEX_BOOKING_STATUS.UNDER_INSPECTION,
    'Estimate Pending': FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
    'In Progress': FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
    'Service Done': FLEX_BOOKING_STATUS.SERVICE_COMPLETED,
    Paid: FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
    Closed: FLEX_BOOKING_STATUS.COMPLETED,
  };
  return legacyMap[s] || s || FLEX_BOOKING_STATUS.PENDING_REVIEW;
}

export function isFlexibleBooking(booking) {
  if (!booking) return false;
  if (booking.booking_mode === 'package') return false;
  if (booking.booking_mode === 'flexible') return true;
  return !booking.downpayment_paid && Number(booking.pricePhp || booking.package_price || 0) === 0;
}

export function intervalsOverlap(startA, endA, startB, endB) {
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();
  if (![a0, a1, b0, b1].every(Number.isFinite)) return false;
  return a0 < b1 && b0 < a1;
}

export function appointmentEnd(startIso, durationMinutes) {
  const start = new Date(startIso).getTime();
  const mins = Math.max(1, Number(durationMinutes || 60));
  if (!Number.isFinite(start)) return null;
  return new Date(start + mins * 60 * 1000).toISOString();
}

export const TERMINAL_BOOKING_STATUSES = Object.freeze([
  FLEX_BOOKING_STATUS.COMPLETED,
  FLEX_BOOKING_STATUS.REJECTED,
  FLEX_BOOKING_STATUS.CANCELLED,
  FLEX_BOOKING_STATUS.CUSTOMER_DECLINED,
  FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
]);

export function isTerminalBookingStatus(status) {
  return TERMINAL_BOOKING_STATUSES.includes(normalizeBookingStatus(status));
}

export default {
  roundMoney,
  calcLaborCost,
  calcLineTotal,
  calcDiscountAmount,
  calcServiceTotals,
  calcDownpayment,
  calcPaymentDeadline,
  formatPhp,
  formatPhpDecimals,
  formatLaborLine,
  FLEX_BOOKING_STATUS,
  QUOTATION_TYPE,
  SERVICE_ESTIMATE_DEFAULTS,
  getServiceEstimateDefaults,
  normalizeBookingStatus,
  isFlexibleBooking,
  intervalsOverlap,
  appointmentEnd,
  TERMINAL_BOOKING_STATUSES,
  isTerminalBookingStatus,
  DEFAULT_DOWNPAYMENT_DEADLINE_HOURS,
};
