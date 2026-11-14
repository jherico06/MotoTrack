// =========================================================================
// Unit tests for MotoTrack Promo Date Picker utilities & PromosAdminPanel wiring
// =========================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  toLocalYmd,
  parseYmd,
  addDaysYmd,
  endOfMonthYmd,
  startOfNextMonthYmd,
  formatPromoDateDisplay,
  buildMonthCalendarWeeks,
} from '../promoDate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

describe('Promo Date Utilities', () => {
  it('parses valid YYYY-MM-DD and rejects impossible calendar dates', () => {
    const valid = parseYmd('2026-10-05');
    assert.ok(valid instanceof Date);
    assert.equal(toLocalYmd(valid), '2026-10-05');

    assert.equal(parseYmd('2026-02-31'), null);
    assert.equal(parseYmd('2026-11-31'), null);
    assert.equal(parseYmd('invalid'), null);
  });

  it('adds days and calculates month boundary presets accurately', () => {
    assert.equal(addDaysYmd('2026-10-28', 7), '2026-11-04');
    assert.equal(endOfMonthYmd('2026-02-10'), '2026-02-28');
    assert.equal(endOfMonthYmd('2024-02-10'), '2024-02-29');
    assert.equal(startOfNextMonthYmd('2026-12-15'), '2027-01-01');
  });

  it('formats promo display labels cleanly', () => {
    assert.equal(formatPromoDateDisplay('2026-10-05'), 'Oct 5, 2026');
    assert.equal(formatPromoDateDisplay('2026-11-04'), 'Nov 4, 2026');
    assert.equal(formatPromoDateDisplay(''), '');
  });

  it('builds 7-day calendar weeks with range highlights and minDate disabling', () => {
    const weeks = buildMonthCalendarWeeks(2026, 9, {
      startDate: '2026-10-05',
      endDate: '2026-10-10',
      minDate: '2026-10-05',
      todayYmd: '2026-10-07',
    });

    assert.ok(weeks.length >= 4);
    weeks.forEach((week) => assert.equal(week.length, 7));

    const cells = weeks.flat().filter((c) => !c.isEmpty);
    assert.equal(cells.length, 31);

    const byDate = Object.fromEntries(cells.map((c) => [c.dateStr, c]));
    assert.equal(byDate['2026-10-04'].isDisabled, true);
    assert.equal(byDate['2026-10-05'].isStart, true);
    assert.equal(byDate['2026-10-05'].isDisabled, false);
    assert.equal(byDate['2026-10-07'].isInRange, true);
    assert.equal(byDate['2026-10-07'].isToday, true);
    assert.equal(byDate['2026-10-10'].isEnd, true);
  });
});

describe('PromosAdminPanel & DateRangeCalendarPicker Integration', () => {
  it('wires DateRangeCalendarPicker into PromosAdminPanel Start/End Date fields', () => {
    const panelSrc = fs.readFileSync(
      path.join(repoRoot, 'src/components/admin/PromosAdminPanel.jsx'),
      'utf8'
    );
    const pickerSrc = fs.readFileSync(
      path.join(repoRoot, 'src/components/common/DateRangeCalendarPicker.jsx'),
      'utf8'
    );

    assert.ok(/DateRangeCalendarPicker/.test(panelSrc));
    assert.ok(/toggleDatePicker\('startDate'\)/.test(panelSrc));
    assert.ok(/toggleDatePicker\('endDate'\)/.test(panelSrc));
    assert.ok(/handlePickPromoDate/.test(panelSrc));
    assert.equal(/fontWeight:\s*['"](800|900)['"]/.test(pickerSrc), false);
    assert.ok(/tabular-nums/.test(pickerSrc));
  });
});

