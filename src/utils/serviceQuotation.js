/**
 * Dynamic service quotation pricing helpers.
 * Labor Cost = Hourly Rate × Labor Hours (supports decimals).
 * Estimated Total = Labor + Parts + Other − Discount
 * Final Total = Actual Labor + Parts + Additional + Other − Discount
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

/**
 * @param {'fixed'|'percent'|string} discountType
 * @param {number} discountValue
 * @param {number} subtotalBeforeDiscount
 */
export function calcDiscountAmount(discountType, discountValue, subtotalBeforeDiscount) {
  const value = Number(discountValue || 0);
  const sub = Number(subtotalBeforeDiscount || 0);
  if (value <= 0 || sub <= 0) return 0;
  if (String(discountType || '').toLowerCase() === 'percent') {
    return roundMoney(Math.min(sub, (sub * value) / 100));
  }
  return roundMoney(Math.min(sub, value));
}

/**
 * @param {object} input
 * @param {number} input.hourlyRate
 * @param {number} input.laborHours
 * @param {number} [input.partsTotal]
 * @param {number} [input.otherChargesTotal]
 * @param {number} [input.additionalChargesTotal]
 * @param {'fixed'|'percent'} [input.discountType]
 * @param {number} [input.discountValue]
 */
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

/**
 * Downpayment: percent of total OR fixed amount.
 */
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

export function formatPhp(amount) {
  const n = Number(amount || 0);
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatLaborLine(hours, hourlyRate) {
  const h = Number(hours || 0);
  const rate = Number(hourlyRate || 0);
  const cost = calcLaborCost(rate, h);
  return `${h} hours × ${formatPhp(rate)} = ${formatPhp(cost)}`;
}

/** Canonical flexible booking statuses */
export const FLEX_BOOKING_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  UNDER_INSPECTION: 'UNDER_INSPECTION',
  QUOTATION_SENT: 'QUOTATION_SENT',
  AWAITING_CUSTOMER_APPROVAL: 'AWAITING_CUSTOMER_APPROVAL',
  AWAITING_DOWNPAYMENT: 'AWAITING_DOWNPAYMENT',
  CONFIRMED: 'CONFIRMED',
  SERVICE_IN_PROGRESS: 'SERVICE_IN_PROGRESS',
  SERVICE_COMPLETED: 'SERVICE_COMPLETED',
  AWAITING_FINAL_PAYMENT: 'AWAITING_FINAL_PAYMENT',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  CUSTOMER_DECLINED: 'CUSTOMER_DECLINED',
  ADDITIONAL_APPROVAL_REQUIRED: 'ADDITIONAL_APPROVAL_REQUIRED',
});

/** Map legacy package-flow labels ↔ flexible statuses for UI compatibility */
export function normalizeBookingStatus(status) {
  const s = String(status || '').trim();
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if (FLEX_BOOKING_STATUS[upper]) return FLEX_BOOKING_STATUS[upper];

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
  // Heuristic: no package price / unpaid deferral path
  return !booking.downpayment_paid && Number(booking.pricePhp || booking.package_price || 0) === 0;
}

export default {
  roundMoney,
  calcLaborCost,
  calcLineTotal,
  calcDiscountAmount,
  calcServiceTotals,
  calcDownpayment,
  formatPhp,
  formatLaborLine,
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  isFlexibleBooking,
};
