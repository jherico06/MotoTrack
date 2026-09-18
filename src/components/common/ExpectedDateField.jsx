import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import BootstrapIcon from './BootstrapIcon';
import { addDaysDateInput, localYmd } from '../../utils/deliveryDate';

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
}) {
  const min = minDate || localYmd(new Date());

  return (
    <View>
      {label ? <Text style={styles.label}>{label} *</Text> : null}
      <View style={styles.inputWrap}>
        <BootstrapIcon name="calendar3" size={16} color="#0C6258" />
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={value || ''}
            min={min}
            onChange={(e) => onChange?.(e.target.value)}
            style={webInputStyle}
          />
        ) : (
          <TextInput
            style={styles.nativeInput}
            value={value || ''}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />
        )}
      </View>
      <View style={styles.chips}>
        {QUICK_OPTIONS.map((opt) => {
          const dateVal = addDaysDateInput(opt.days);
          const active = value === dateVal;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.chip, active && styles.chipOn]}
              onPress={() => onChange?.(dateVal)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const webInputStyle = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 14,
  fontWeight: '700',
  color: '#0F172A',
  backgroundColor: 'transparent',
  fontFamily: 'inherit',
  minHeight: 22,
};

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#0C6258',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 8 : 10,
    backgroundColor: '#FFFFFF',
  },
  nativeInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A', padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#0C6258', borderColor: '#0C6258' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  chipTextOn: { color: '#FFFFFF' },
  hint: { fontSize: 11, color: '#64748B', marginTop: 6, lineHeight: 15 },
});
