/** Local calendar helpers so YYYY-MM-DD does not shift across time zones. */

export function toDateInputValue(value) {
  if (!value) return '';
  const s = String(value).trim();
  const isoDay = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay && /^\d{4}-\d{2}-\d{2}$/.test(isoDay[1]) && !s.includes('T') && s.length <= 10) {
    return isoDay[1];
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDateInputValue() {
  return localYmd(new Date());
}

export function localYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysDateInput(days = 0, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + Number(days || 0));
  return localYmd(d);
}

export function dateInputToIso(dateStr) {
  const s = String(dateStr || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0).toISOString();
}

export function formatExpectedDateLabel(value) {
  const iso = dateInputToIso(value) || value;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRangeDayLabel(value) {
  const iso = dateInputToIso(value) || value;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. "Oct 24, 2026 - Oct 27, 2026" */
export function formatExpectedDateRangeLabel(startValue, endValue) {
  const start = formatRangeDayLabel(startValue);
  const end = formatRangeDayLabel(endValue || startValue);
  if (!start) return '';
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

export function normalizeDateRange(startValue, endValue) {
  const start = toDateInputValue(startValue);
  const end = toDateInputValue(endValue || startValue);
  if (!start) return { start: '', end: '' };
  if (!end) return { start, end: start };
  return start <= end ? { start, end } : { start: end, end: start };
}

export function expectedDeliveryStatusText(value, prefix = 'Expected', endValue = null) {
  if (endValue) {
    const range = formatExpectedDateRangeLabel(value, endValue);
    return range ? `${prefix} ${range}` : '';
  }
  const label = formatExpectedDateLabel(value);
  return label ? `${prefix} ${label}` : '';
}

function parseFlexibleDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date-only values are stored at local midnight or local noon. Those are not a scheduled clock time. */
function isDateOnlyStamp(date) {
  return (
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0 &&
    (date.getHours() === 0 || date.getHours() === 12)
  );
}

export function formatRiderDayLabel(value) {
  const d = parseFlexibleDate(value);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatClock(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Rider-facing delivery date. Uses expected_delivery_at / expected_delivery_end_at.
 * A clock time is included only when the stored value is not a date-only stamp.
 */
export function describeRiderDeliveryDate(startValue, endValue, now = new Date()) {
  const start = parseFlexibleDate(startValue);
  if (!start) return null;
  const end = parseFlexibleDate(endValue);
  const startKey = localYmd(start);
  const endKey = end ? localYmd(end) : startKey;
  const todayKey = localYmd(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = localYmd(tomorrow);
  const dueKey = endKey || startKey;

  let tone = 'scheduled';
  let title = 'Delivery';
  if (dueKey < todayKey) {
    tone = 'overdue';
    title = 'Delivery overdue';
  } else if (startKey === todayKey || (startKey < todayKey && dueKey >= todayKey)) {
    tone = 'today';
    title = 'Today';
  } else if (startKey === tomorrowKey) {
    tone = 'tomorrow';
    title = 'Tomorrow';
  }

  const startLabel = formatRiderDayLabel(start);
  const dateLabel =
    end && endKey !== startKey ? `${startLabel} – ${formatRiderDayLabel(end)}` : startLabel;

  let timeLabel = '';
  const startTimed = !isDateOnlyStamp(start);
  const endTimed = Boolean(end) && !isDateOnlyStamp(end);
  if (startTimed || endTimed) {
    const startClock = formatClock(start);
    const endClock = end ? formatClock(end) : '';
    if (end && endTimed && endClock && endClock !== startClock) {
      timeLabel = `${startClock} – ${endClock}`;
    } else if (startTimed) {
      timeLabel = startClock;
    }
  }

  return { tone, title, dateLabel, timeLabel };
}

export default {
  toDateInputValue,
  todayDateInputValue,
  localYmd,
  addDaysDateInput,
  dateInputToIso,
  formatExpectedDateLabel,
  formatExpectedDateRangeLabel,
  normalizeDateRange,
  expectedDeliveryStatusText,
  formatRiderDayLabel,
  describeRiderDeliveryDate,
};
