import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import OrderDeliveryCalendar from './OrderDeliveryCalendar.jsx';
import {
  addDaysDateInput,
  localYmd,
  formatExpectedDateLabel,
  formatExpectedDateRangeLabel,
  normalizeDateRange,
} from '../../utils/deliveryDate.js';

const QUICK_SINGLE = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In 3 days', days: 3 },
];

const QUICK_RANGE = [
  { label: 'Today–Tomorrow', startDays: 0, endDays: 1 },
  { label: '2–3 days', startDays: 2, endDays: 3 },
  { label: '3–5 days', startDays: 3, endDays: 5 },
  { label: 'This week', startDays: 0, endDays: 6 },
];

export default function ExpectedDateField({
  value,
  onChange,
  startDate,
  endDate,
  onRangeChange,
  mode = 'single',
  minDate,
  label,
  hint,
  isDarkMode = false,
  defaultOpen = true,
  showCalendar = true,
}) {
  const rangeMode = mode === 'range';
  const [calendarOpen, setCalendarOpen] = useState(defaultOpen && showCalendar);
  const min = minDate || localYmd(new Date());

  const range = rangeMode
    ? normalizeDateRange(startDate || value, endDate || startDate || value)
    : { start: value || '', end: value || '' };

  const formattedDisplay = rangeMode
    ? formatExpectedDateRangeLabel(range.start, range.end) || 'Select date range'
    : value
      ? formatExpectedDateLabel(value)
      : 'Select date';

  const resolvedLabel =
    label || (rangeMode ? 'Expected delivery window' : 'Expected delivery date');
  const resolvedHint =
    hint ||
    (rangeMode
      ? 'Pick a start and end date. Customers see this delivery window.'
      : 'Customer tracking will show this date.');

  const emitRange = (start, end) => {
    const next = normalizeDateRange(start, end || start);
    onRangeChange?.(next);
    onChange?.(next.start);
  };

  return (
    <View style={styles.container}>
      {resolvedLabel ? (
        <Text style={[styles.label, isDarkMode && { color: '#CBD5E1' }]}>
          {resolvedLabel} *
        </Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.inputWrap,
          isDarkMode && { backgroundColor: '#1C2422', borderColor: '#2D3748' },
        ]}
        onPress={() => {
          if (showCalendar) setCalendarOpen((prev) => !prev);
        }}
        activeOpacity={0.8}
        disabled={!showCalendar}
      >
        <View style={styles.inputLeft}>
          <BootstrapIcon name="calendar-event" size={15} color="#EA580C" />
          <Text style={[styles.dateDisplayText, isDarkMode && { color: '#F8FAFC' }]}>
            {formattedDisplay}
          </Text>
          {range.start ? (
            <View style={styles.selectedPill}>
              <Text style={styles.selectedPillText}>
                {rangeMode && range.end && range.end !== range.start
                  ? `${range.start} → ${range.end}`
                  : range.start}
              </Text>
            </View>
          ) : null}
        </View>

        {showCalendar ? (
          <View style={styles.toggleCalendarBtn}>
            <Text style={styles.toggleCalendarText}>
              {calendarOpen ? 'Hide' : 'Calendar'}
            </Text>
            <BootstrapIcon
              name={calendarOpen ? 'chevron-up' : 'chevron-down'}
              size={11}
              color="#EA580C"
            />
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.chips}>
        {(rangeMode ? QUICK_RANGE : QUICK_SINGLE).map((opt) => {
          if (rangeMode) {
            const startVal = addDaysDateInput(opt.startDays);
            const endVal = addDaysDateInput(opt.endDays);
            const active = range.start === startVal && range.end === endVal;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.chip,
                  active && styles.chipOn,
                  isDarkMode && !active && { backgroundColor: '#1C2422', borderColor: '#334155' },
                ]}
                onPress={() => emitRange(startVal, endVal)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.chipText,
                    active && styles.chipTextOn,
                    isDarkMode && !active && { color: '#94A3B8' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          }

          const dateVal = addDaysDateInput(opt.days);
          const active = value === dateVal;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[
                styles.chip,
                active && styles.chipOn,
                isDarkMode && !active && { backgroundColor: '#1C2422', borderColor: '#334155' },
              ]}
              onPress={() => onChange?.(dateVal)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextOn,
                  isDarkMode && !active && { color: '#94A3B8' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showCalendar && calendarOpen ? (
        <OrderDeliveryCalendar
          mode={rangeMode ? 'range' : 'single'}
          selectedDate={value}
          startDate={range.start}
          endDate={range.end}
          onSelectDate={(newDate) => onChange?.(newDate)}
          onRangeChange={({ start, end }) => emitRange(start, end)}
          minDate={min}
          isDarkMode={isDarkMode}
        />
      ) : null}

      {rangeMode && range.start && !range.end ? (
        <Text style={[styles.hint, isDarkMode && { color: '#64748B' }]}>
          Now tap an end date to finish the range.
        </Text>
      ) : null}

      {resolvedHint ? (
        <Text style={[styles.hint, isDarkMode && { color: '#64748B' }]}>{resolvedHint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#EA580C',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  inputLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  dateDisplayText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedPill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  toggleCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  toggleCalendarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 15,
  },
});
