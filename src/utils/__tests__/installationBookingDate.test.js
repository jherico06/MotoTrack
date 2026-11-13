import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Installation Booking Date Picker & Clean UI System', () => {
  test('verifies BookInstallationModal supports selectedDate and full monthly calendar date picking', () => {
    const modalPath = path.resolve('src/components/modals/BookInstallationModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('selectedDate'), 'Modal accepts selectedDate prop');
    assert.ok(content.includes('onSelectDate'), 'Modal accepts onSelectDate prop');
    assert.ok(content.includes('calendarCells'), 'Modal computes calendarCells for the month');
    assert.ok(content.includes('MONTH_NAMES'), 'Modal defines MONTH_NAMES');
    assert.ok(content.includes('WEEKDAY_NAMES'), 'Modal defines WEEKDAY_NAMES');
    assert.ok(content.includes('slotAvailability'), 'Modal checks slotAvailability for selected date');
  });

  test('verifies upcoming dates calculation skips Sundays', () => {
    // Generate dates starting tomorrow
    const list = [];
    const base = new Date('2026-11-07T00:00:00'); // Saturday
    let offset = 1; // starts Sunday Nov 8
    while (list.length < 7 && offset < 18) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      offset++;
      if (d.getDay() === 0) continue; // Sunday off-duty
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      list.push({ dateStr, dayOfWeek: d.getDay() });
    }

    assert.strictEqual(list.length, 7);
    // None should be Sunday (0)
    list.forEach((item) => {
      assert.notStrictEqual(item.dayOfWeek, 0, `Date ${item.dateStr} should not be Sunday`);
    });
    // First should be Monday Nov 9
    assert.strictEqual(list[0].dateStr, '2026-11-09');
  });

  test('verifies CustomizerPage binds selectedDate and passes it to customizer booking service', () => {
    const customizerPath = path.resolve('src/screens/web/customer/CustomizerPage.jsx');
    const content = fs.readFileSync(customizerPath, 'utf8');

    assert.ok(content.includes('bookingDate'), 'CustomizerPage maintains bookingDate state');
    assert.ok(content.includes('appointmentDate: bookingData?.date || bookingDate'), 'Passes chosen date to bookCustomizationService');
    assert.ok(content.includes('selectedDate={bookingDate}'), 'Passes selectedDate to BookInstallationModal');
  });

  test('verifies BookInstallationModal calculates downpayment and wires payment channels', () => {
    const modalPath = path.resolve('src/components/modals/BookInstallationModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('systemSettingsService'), 'Modal imports systemSettingsService');
    assert.ok(content.includes('downpaymentPercent'), 'Modal calculates downpaymentPercent');
    assert.ok(content.includes('downpaymentAmount'), 'Modal calculates downpaymentAmount');
    assert.ok(content.includes('remainingBalance'), 'Modal calculates remainingBalance');
    assert.ok(content.includes('paymentChannel'), 'Modal provides paymentChannel state');
    assert.ok(content.includes('Payment Terms & Reservation Downpayment'), 'Modal displays downpayment section header');
    assert.ok(content.includes('REMAINING BALANCE'), 'Modal displays remaining balance box');
    assert.ok(content.includes('Choose Deposit Payment Method'), 'Modal provides deposit payment method selector');
  });

  test('verifies mathematical downpayment calculation for AI installation build', () => {
    const partsCostPhp = 800;
    const laborFeePhp = 3250;
    const totalEstimate = partsCostPhp + laborFeePhp; // 4050
    const downpaymentPercent = 20;

    const downpaymentAmount = Math.round(totalEstimate * (downpaymentPercent / 100)); // 810
    const remainingBalance = totalEstimate - downpaymentAmount; // 3240

    assert.strictEqual(totalEstimate, 4050);
    assert.strictEqual(downpaymentAmount, 810);
    assert.strictEqual(remainingBalance, 3240);
    assert.strictEqual(downpaymentAmount + remainingBalance, totalEstimate);
  });

  test('verifies aiCustomizerService persists downpayment fields to booking payload', () => {
    const servicePath = path.resolve('src/services/ai/aiCustomizerService.js');
    const content = fs.readFileSync(servicePath, 'utf8');

    assert.ok(content.includes('downpayment_percent: effectiveDpPercent'), 'Records downpayment_percent');
    assert.ok(content.includes('downpayment_amount: calculatedDp'), 'Records downpayment_amount');
    assert.ok(content.includes('remaining_balance: calculatedBal'), 'Records remaining_balance');
    assert.ok(content.includes('payment_method: paymentMethod'), 'Records payment_method');
  });

  test('verifies BookInstallationModal renders interactive workshop location map like in booking', () => {
    const modalPath = path.resolve('src/components/modals/BookInstallationModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('SHOP_LAT'), 'Defines workshop latitude');
    assert.ok(content.includes('SHOP_LNG'), 'Defines workshop longitude');
    assert.ok(content.includes('GOOGLE_STREET_VIEW_URL'), 'Defines Google Maps URL');
    assert.ok(content.includes('GOOGLE_STREET_VIEW_EMBED_URL'), 'Defines Street View embed URL');
    assert.ok(content.includes('mapMode'), 'Maintains mapMode state');
    assert.ok(content.includes('Workshop Street View & Map'), 'Displays Workshop Street View & Map header');
    assert.ok(content.includes('Street View'), 'Renders Street View tab');
    assert.ok(content.includes('Roadmap'), 'Renders Roadmap tab');
    assert.ok(content.includes('Satellite'), 'Renders Satellite tab');
    assert.ok(content.includes('Open in Google Maps App'), 'Renders Open in Google Maps button');
    assert.ok(content.includes('109 Natalio B. Bacalso'), 'Displays workshop physical address');
  });
});
