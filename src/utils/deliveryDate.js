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

export function expectedDeliveryStatusText(value, prefix = 'Expected') {
  const label = formatExpectedDateLabel(value);
  return label ? `${prefix} ${label}` : '';
}

export default {
  toDateInputValue,
  todayDateInputValue,
  localYmd,
  addDaysDateInput,
  dateInputToIso,
  formatExpectedDateLabel,
  expectedDeliveryStatusText,
};
