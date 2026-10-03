import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon';
import OrderDeliveryCalendar from './OrderDeliveryCalendar';
import { addDaysDateInput, localYmd, formatExpectedDateLabel } from '../../utils/deliveryDate';

const QUICK_OPTIONS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In 3 days', days: 3 },
];

export default function ExpectedDateField({
  value,
  onChange,
  minDate,
  label = 'Expected delivery date',
  hint = 'Customer tracking will show this date.',
  isDarkMode = false,
  defaultOpen = true,
}) {
  const [showCalendar, setShowCalendar] = useState(defaultOpen);
  const min = minDate || localYmd(new Date());

  const formattedDisplay = value ? formatExpectedDateLabel(value) : 'Select date';

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, isDarkMode && { color: '#CBD5E1' }]}>{label} *</Text> : null}

      {/* Styled Date Bar with Toggle */}
      <TouchableOpacity
        style={[
          styles.inputWrap,
          isDarkMode && { backgroundColor: '#1C2422', borderColor: '#2D3748' },
        ]}
        onPress={() => setShowCalendar((prev) => !prev)}
        activeOpacity={0.8}
      >
        <View style={styles.inputLeft}>
          <BootstrapIcon name="calendar-event" size={15} color="#1D4533" />
          <Text style={[styles.dateDisplayText, isDarkMode && { color: '#F8FAFC' }]}>
            {formattedDisplay}
          </Text>
          {value ? (
            <View style={styles.selectedPill}>
              <Text style={styles.selectedPillText}>{value}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.toggleCalendarBtn}>
          <Text style={styles.toggleCalendarText}>
            {showCalendar ? 'Hide' : 'Calendar'}
          </Text>
          <BootstrapIcon
            name={showCalendar ? 'chevron-up' : 'chevron-down'}
            size={11}
            color="#1D4533"
          />
        </View>
      </TouchableOpacity>

      {/* Quick Selection Chips */}
      <View style={styles.chips}>
        {QUICK_OPTIONS.map((opt) => {
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
              onPress={() => {
                onChange?.(dateVal);
              }}
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

      {/* Order Calendar UI (inspired by BookingCalendar, scaled compactly for modal) */}
      {showCalendar && (
        <OrderDeliveryCalendar
          selectedDate={value}
          onSelectDate={(newDate) => {
            onChange?.(newDate);
          }}
          minDate={min}
          isDarkMode={isDarkMode}
        />
      )}

      {hint ? <Text style={[styles.hint, isDarkMode && { color: '#64748B' }]}>{hint}</Text> : null}
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
    borderColor: '#1D4533',
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
    backgroundColor: '#E8F0EC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4533',
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
    color: '#1D4533',
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
    backgroundColor: '#1D4533',
    borderColor: '#1D4533',
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
