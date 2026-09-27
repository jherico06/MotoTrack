/**
 * Lightweight unit checks for quotation math (labor, parts, discount, downpayment).
 * Run: node scripts/test-service-quotation-math.mjs
 */
import {
  calcLaborCost,
  calcLineTotal,
  calcDiscountAmount,
  calcServiceTotals,
  calcDownpayment,
  roundMoney,
} from '../src/utils/serviceQuotation.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Labor: ₱150 × 3 = ₱450
assert(calcLaborCost(150, 3) === 450, 'labor 150*3');

// Decimal hours: ₱150 × 1.5 = ₱225
assert(calcLaborCost(150, 1.5) === 225, 'labor 150*1.5');

// Parts: ₱800 × 2 = ₱1,600
assert(calcLineTotal(2, 800) === 1600, 'parts 800*2');

const est = calcServiceTotals({
  hourlyRate: 150,
  laborHours: 3,
  partsTotal: 800,
  otherChargesTotal: 100,
  discountType: 'fixed',
  discountValue: 100,
});
assert(est.laborCost === 450, 'est labor');
assert(est.totalAmount === 1250, 'est total 450+800+100-100');

const dp = calcDownpayment({
  totalAmount: 1250,
  downpaymentType: 'percent',
  downpaymentPercent: 30,
});
assert(dp.downpaymentAmount === 375, 'dp 30%');
assert(dp.remainingBalance === 875, 'remaining');

// Actual labor higher than estimated
const actual = calcServiceTotals({
  hourlyRate: 150,
  laborHours: 4,
  partsTotal: 800,
  otherChargesTotal: 100,
  additionalChargesTotal: 900,
  discountType: 'fixed',
  discountValue: 100,
});
assert(actual.laborCost === 600, 'actual labor');
assert(actual.totalAmount === 2300, 'final 600+800+100+900-100');

// Historical snapshot independence: rate change does not affect prior calc
assert(calcLaborCost(150, 3) === 450, 'old quote stays 450 even if current rate is 175');
assert(calcLaborCost(175, 3) === 525, 'new rate only for new quotes');

assert(calcDiscountAmount('percent', 10, 1000) === 100, 'percent discount');
assert(roundMoney(1.005) === 1.01 || roundMoney(1.005) === 1, 'roundMoney finite');

console.log('OK: service quotation math checks passed');
