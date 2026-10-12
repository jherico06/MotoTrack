import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import {
  formatExpectedDateRangeLabel,
  toDateInputValue,
} from '../../utils/deliveryDate.js';

/**
 * Read-only delivery window summary for the order details modal.
 * Date range is set when the admin assigns / updates the rider.
 */
export default function ExpectedDeliveryEditor({
  currentIso,
  endIso,
  isDarkMode = false,
}) {
  const start = toDateInputValue(currentIso);
  const end = toDateInputValue(endIso) || start;
  const label = formatExpectedDateRangeLabel(start, end);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, isDarkMode && { color: '#94A3B8' }]}>
        Expected delivery window
      </Text>
      <View
        style={[
          styles.box,
          isDarkMode && { backgroundColor: '#1C2422', borderColor: '#2D3748' },
        ]}
      >
        <BootstrapIcon name="calendar-range" size={15} color={isDarkMode ? '#5FBF9A' : '#1D4533'} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.primary, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={2}>
            {label || 'Not set yet'}
          </Text>
          <Text style={[styles.secondary, isDarkMode && { color: '#94A3B8' }]}>
            {label
              ? 'Set when assigning the delivery rider'
              : 'Use Assign / Update to pick a date range'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 4 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  primary: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  secondary: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
});
