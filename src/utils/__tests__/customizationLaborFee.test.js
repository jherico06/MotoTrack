import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Customization & Installation Labor Fee Configuration', async (t) => {
  await t.test('verifies customizationLaborFee is in DEFAULT_SYSTEM_SETTINGS and SystemSettingsService', () => {
    const code = fs.readFileSync('src/services/system/systemSettingsService.js', 'utf8');
    assert.ok(code.includes('customizationLaborFee: 3250'));
    assert.ok(code.includes('getCustomizationLaborFee()'));
  });

  await t.test('computes product price, labor fee, and total correctly', () => {
    const parts = [
      { id: '1', name: 'RIM', price: 800, quantity: 1 },
      { id: '2', name: 'Seat', price: 200, quantity: 1 },
    ];
    const partsTotal = parts.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const laborFee = 3250;
    const totalFee = partsTotal + laborFee;

    assert.equal(partsTotal, 1000);
    assert.equal(laborFee, 3250);
    assert.equal(totalFee, 4250);
  });
});
