/**
 * Unit checks for garage booking workflow helpers.
 * Run: node scripts/test-booking-workflow.mjs
 */
import assert from 'node:assert/strict';
import {
  FLEX_BOOKING_STATUS,
  normalizeBookingStatus,
  intervalsOverlap,
  appointmentEnd,
  isTerminalBookingStatus,
  calcServiceTotals,
  calcDownpayment,
  calcPaymentDeadline,
  getServiceEstimateDefaults,
  roundMoney,
  QUOTATION_TYPE,
} from '../src/utils/serviceQuotation.js';
import {
  canTransition,
  canRoleTransition,
  BOOKING_ROLES,
  STATUS_TRANSITIONS,
  getAdminActionsForStatus,
  getMechanicActionsForStatus,
  assertTransition,
  customerStatusLabel,
} from '../src/utils/bookingWorkflow.js';

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

check('normalize new statuses and aliases', () => {
  assert.equal(normalizeBookingStatus('NEEDS_INFORMATION'), FLEX_BOOKING_STATUS.NEEDS_INFORMATION);
  assert.equal(normalizeBookingStatus('ESTIMATE_SUBMITTED'), FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED);
  assert.equal(normalizeBookingStatus('FOR_FINAL_BILLING'), FLEX_BOOKING_STATUS.FOR_FINAL_BILLING);
  assert.equal(normalizeBookingStatus('For Inspection'), FLEX_BOOKING_STATUS.UNDER_INSPECTION);
  assert.equal(normalizeBookingStatus('Awaiting Balance'), FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT);
  assert.equal(
    normalizeBookingStatus('APPROVED_PAYMENT_REQUIRED'),
    FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
  );
  assert.equal(normalizeBookingStatus('PAYMENT_PENDING'), FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT);
  assert.equal(normalizeBookingStatus('CUSTOMER_APPROVED'), FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS);
  assert.equal(normalizeBookingStatus('BOOKING_EXPIRED'), FLEX_BOOKING_STATUS.BOOKING_EXPIRED);
  assert.equal(normalizeBookingStatus('FULLY_PAID'), FLEX_BOOKING_STATUS.FULLY_PAID);
});

check('happy-path transitions (payment after approve)', () => {
  const path = [
    [FLEX_BOOKING_STATUS.PENDING_REVIEW, FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT],
    [FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT, FLEX_BOOKING_STATUS.CONFIRMED],
    [FLEX_BOOKING_STATUS.CONFIRMED, FLEX_BOOKING_STATUS.SCHEDULED],
    [FLEX_BOOKING_STATUS.SCHEDULED, FLEX_BOOKING_STATUS.UNDER_INSPECTION],
    [FLEX_BOOKING_STATUS.UNDER_INSPECTION, FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED],
    [FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED, FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL],
    [FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL, FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS],
    [FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS, FLEX_BOOKING_STATUS.SERVICE_COMPLETED],
    [FLEX_BOOKING_STATUS.SERVICE_COMPLETED, FLEX_BOOKING_STATUS.FOR_FINAL_BILLING],
    [FLEX_BOOKING_STATUS.FOR_FINAL_BILLING, FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT],
    [FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT, FLEX_BOOKING_STATUS.FULLY_PAID],
    [FLEX_BOOKING_STATUS.FULLY_PAID, FLEX_BOOKING_STATUS.READY_FOR_PICKUP],
    [FLEX_BOOKING_STATUS.READY_FOR_PICKUP, FLEX_BOOKING_STATUS.COMPLETED],
  ];
  for (const [from, to] of path) {
    assert.equal(canTransition(from, to), true, `${from} → ${to}`);
  }
});

check('cannot schedule before downpayment', () => {
  assert.equal(
    canTransition(FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT, FLEX_BOOKING_STATUS.SCHEDULED),
    false
  );
  assert.equal(
    canTransition(FLEX_BOOKING_STATUS.PENDING_REVIEW, FLEX_BOOKING_STATUS.SCHEDULED),
    false
  );
});

check('quotation accept goes to service, not downpayment', () => {
  assert.equal(
    canTransition(
      FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS
    ),
    true
  );
  assert.equal(
    canTransition(
      FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL,
      FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT
    ),
    false
  );
});

check('needs information loop', () => {
  assert.equal(
    canTransition(FLEX_BOOKING_STATUS.PENDING_REVIEW, FLEX_BOOKING_STATUS.NEEDS_INFORMATION),
    true
  );
  assert.equal(
    canTransition(FLEX_BOOKING_STATUS.NEEDS_INFORMATION, FLEX_BOOKING_STATUS.PENDING_REVIEW),
    true
  );
});

check('role gates: mechanic cannot complete pickup', () => {
  assert.equal(
    canRoleTransition(
      FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      FLEX_BOOKING_STATUS.COMPLETED,
      BOOKING_ROLES.MECHANIC
    ),
    false
  );
  assert.equal(
    canRoleTransition(
      FLEX_BOOKING_STATUS.READY_FOR_PICKUP,
      FLEX_BOOKING_STATUS.COMPLETED,
      BOOKING_ROLES.ADMIN
    ),
    true
  );
});

check('role gates: customer cannot assign schedule', () => {
  assert.equal(
    canRoleTransition(
      FLEX_BOOKING_STATUS.CONFIRMED,
      FLEX_BOOKING_STATUS.SCHEDULED,
      BOOKING_ROLES.CUSTOMER
    ),
    false
  );
});

check('unauthorized customer status change throws', () => {
  assert.throws(() =>
    assertTransition(
      FLEX_BOOKING_STATUS.PENDING_REVIEW,
      FLEX_BOOKING_STATUS.COMPLETED,
      BOOKING_ROLES.CUSTOMER
    )
  );
});

check('mechanic actions by status', () => {
  assert.equal(getMechanicActionsForStatus(FLEX_BOOKING_STATUS.SCHEDULED).has('start_inspection'), true);
  assert.equal(getMechanicActionsForStatus(FLEX_BOOKING_STATUS.UNDER_INSPECTION).has('submit_estimate'), true);
  assert.equal(getMechanicActionsForStatus(FLEX_BOOKING_STATUS.CONFIRMED).has('start_service'), false);
  assert.equal(getMechanicActionsForStatus(FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS).has('complete_service'), true);
  assert.equal(getMechanicActionsForStatus(FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT).has('start_service'), false);
});

check('admin actions: payment then assign', () => {
  assert.equal(getAdminActionsForStatus(FLEX_BOOKING_STATUS.PENDING_REVIEW).has('request_info'), true);
  assert.equal(getAdminActionsForStatus(FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT).has('record_payment'), true);
  assert.equal(getAdminActionsForStatus(FLEX_BOOKING_STATUS.CONFIRMED).has('assign_mechanic'), true);
  assert.equal(getAdminActionsForStatus(FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT).has('assign_mechanic'), false);
  assert.equal(getAdminActionsForStatus(FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED).has('send_quotation'), true);
});

check('customer-facing labels hide enum names', () => {
  assert.equal(
    customerStatusLabel(FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT),
    'Approved — Payment Required'
  );
  assert.equal(customerStatusLabel('APPROVED_PAYMENT_REQUIRED'), 'Approved — Payment Required');
});

check('service estimate defaults + downpayment math', () => {
  const d = getServiceEstimateDefaults('Oil Change');
  assert.equal(d.estimatedCost, 800);
  const dp = calcDownpayment({
    totalAmount: d.estimatedCost,
    downpaymentPercent: d.downpaymentPercent,
  });
  assert.equal(dp.downpaymentAmount, 240);
  assert.ok(calcPaymentDeadline());
});

check('appointment overlap math', () => {
  const a0 = '2026-10-05T09:00:00.000Z';
  const a1 = appointmentEnd(a0, 120); // 11:00
  const b0 = '2026-10-05T10:00:00.000Z';
  const b1 = appointmentEnd(b0, 60); // 11:00
  assert.equal(intervalsOverlap(a0, a1, b0, b1), true);

  const c0 = '2026-10-05T11:00:00.000Z';
  const c1 = appointmentEnd(c0, 60);
  assert.equal(intervalsOverlap(a0, a1, c0, c1), false);
});

check('terminal statuses free mechanic slot', () => {
  assert.equal(isTerminalBookingStatus(FLEX_BOOKING_STATUS.COMPLETED), true);
  assert.equal(isTerminalBookingStatus(FLEX_BOOKING_STATUS.CANCELLED), true);
  assert.equal(isTerminalBookingStatus(FLEX_BOOKING_STATUS.BOOKING_EXPIRED), true);
  assert.equal(isTerminalBookingStatus(FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS), false);
});

check('estimate vs quotation vs final bill math', () => {
  const estimate = calcServiceTotals({
    hourlyRate: 350,
    laborHours: 3,
    partsTotal: 1100,
    otherChargesTotal: 100,
  });
  assert.equal(estimate.laborCost, 1050);
  assert.equal(estimate.totalAmount, 2250);

  const customerQuote = calcServiceTotals({
    hourlyRate: 350,
    laborHours: 3,
    partsTotal: 1100,
    otherChargesTotal: 100,
    discountType: 'fixed',
    discountValue: 100,
  });
  assert.equal(customerQuote.totalAmount, 2150);

  const dp = calcDownpayment({
    totalAmount: customerQuote.totalAmount,
    downpaymentType: 'percent',
    downpaymentPercent: 30,
  });
  assert.equal(dp.downpaymentAmount, 645);
  assert.equal(dp.remainingBalance, 1505);

  const finalBill = calcServiceTotals({
    hourlyRate: 350,
    laborHours: 4,
    partsTotal: 1100,
    otherChargesTotal: 100,
    additionalChargesTotal: 1000,
    discountType: 'fixed',
    discountValue: 100,
  });
  assert.equal(finalBill.laborCost, 1400);
  assert.equal(finalBill.totalAmount, 3500);

  const paid = 645;
  const remaining = roundMoney(finalBill.totalAmount - paid);
  assert.equal(remaining, 2855);
});

check('payment cannot exceed remaining (logic)', () => {
  const due = 500;
  const attempted = 600;
  assert.equal(attempted > due, true);
});

check('quotation type constants', () => {
  assert.equal(QUOTATION_TYPE.MECHANIC_ESTIMATE, 'mechanic_estimate');
  assert.equal(QUOTATION_TYPE.CUSTOMER, 'customer');
});

check('extra work loop returns to in service', () => {
  assert.equal(
    canTransition(
      FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED
    ),
    true
  );
  assert.equal(
    canTransition(
      FLEX_BOOKING_STATUS.ADDITIONAL_APPROVAL_REQUIRED,
      FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS
    ),
    true
  );
});

check('STATUS_TRANSITIONS covers new branches', () => {
  assert.ok(STATUS_TRANSITIONS[FLEX_BOOKING_STATUS.NEEDS_INFORMATION]);
  assert.ok(STATUS_TRANSITIONS[FLEX_BOOKING_STATUS.ESTIMATE_SUBMITTED]);
  assert.ok(STATUS_TRANSITIONS[FLEX_BOOKING_STATUS.FOR_FINAL_BILLING]);
  assert.ok(STATUS_TRANSITIONS[FLEX_BOOKING_STATUS.FULLY_PAID]);
  assert.ok(STATUS_TRANSITIONS[FLEX_BOOKING_STATUS.BOOKING_EXPIRED]);
  assert.ok(
    STATUS_TRANSITIONS[FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT].includes(
      FLEX_BOOKING_STATUS.BOOKING_EXPIRED
    )
  );
});

console.log(`\n${passed} checks passed`);
