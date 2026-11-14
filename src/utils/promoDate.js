/**
 * Pure local-calendar date utilities for promo validity date pickers.
 * Keeps YYYY-MM-DD math independent of UTC midnight shifts.
 */

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const CALENDAR_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CALENDAR_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Formats a Date instance as local YYYY-MM-DD. */
export function toLocalYmd(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses strict YYYY-MM-DD into a local Date without rollover bugs, or returns null. */
export function parseYmd(ymd) {
  if (typeof ymd !== 'string') return null;
  const trimmed = ymd.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/** Returns local YYYY-MM-DD offset by N calendar days from baseYmd (or today). */
export function addDaysYmd(baseYmd, days = 0) {
  const base = parseYmd(baseYmd) || new Date();
  const shifted = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(days || 0));
  return toLocalYmd(shifted);
}

/** Returns the last calendar day of baseYmd's month (or current month) in YYYY-MM-DD. */
export function endOfMonthYmd(baseYmd) {
  const base = parseYmd(baseYmd) || new Date();
  return toLocalYmd(new Date(base.getFullYear(), base.getMonth() + 1, 0));
}

/** Returns the 1st day of the month following baseYmd (or current month) in YYYY-MM-DD. */
export function startOfNextMonthYmd(baseYmd) {
  const base = parseYmd(baseYmd) || new Date();
  return toLocalYmd(new Date(base.getFullYear(), base.getMonth() + 1, 1));
}

/** Formats YYYY-MM-DD into a readable label such as "Oct 5, 2026". */
export function formatPromoDateDisplay(ymd) {
  const d = parseYmd(ymd);
  if (!d) return '';
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Builds a 7-column matrix of day cells for a month view.
 * Marks start/end range bounds, in-range days, today, and minDate restrictions.
 */
export function buildMonthCalendarWeeks(
  year,
  monthIndex,
  { startDate = '', endDate = '', minDate = '', todayYmd = toLocalYmd() } = {}
) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({
      key: `lead-${i}`,
      day: null,
      dateStr: null,
      isEmpty: true,
    });
  }

  const normalizedStart = parseYmd(startDate) ? startDate.trim() : '';
  const normalizedEnd = parseYmd(endDate) ? endDate.trim() : '';
  const normalizedMin = parseYmd(minDate) ? minDate.trim() : '';

  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isStart = Boolean(normalizedStart && dateStr === normalizedStart);
    const isEnd = Boolean(normalizedEnd && dateStr === normalizedEnd);
    const isInRange = Boolean(
      normalizedStart &&
      normalizedEnd &&
      normalizedEnd >= normalizedStart &&
      dateStr > normalizedStart &&
      dateStr < normalizedEnd
    );
    const isDisabled = Boolean(normalizedMin && dateStr < normalizedMin);

    cells.push({
      key: dateStr,
      day: d,
      dateStr,
      isEmpty: false,
      isDisabled,
      isStart,
      isEnd,
      isSelected: isStart || isEnd,
      isInRange,
      isToday: dateStr === todayYmd,
    });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i += 1) {
    cells.push({
      key: `trail-${i}`,
      day: null,
      dateStr: null,
      isEmpty: true,
    });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

