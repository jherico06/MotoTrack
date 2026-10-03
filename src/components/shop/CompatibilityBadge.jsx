/**
 * Compact compatibility status label for shop cards / product details.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COMPAT_STATUS } from '../../services/compatibilityService';

export default function CompatibilityBadge({ status, message, style }) {
  if (!status && !message) return null;

  const tone =
    status === COMPAT_STATUS.COMPATIBLE
      ? styles.ok
      : status === COMPAT_STATUS.INCOMPATIBLE
        ? styles.bad
        : status === COMPAT_STATUS.UNAVAILABLE
          ? styles.muted
          : styles.info;

  const textTone =
    status === COMPAT_STATUS.COMPATIBLE
      ? styles.okText
      : status === COMPAT_STATUS.INCOMPATIBLE
        ? styles.badText
        : status === COMPAT_STATUS.UNAVAILABLE
          ? styles.mutedText
          : styles.infoText;

  return (
    <View style={[styles.wrap, tone, style]}>
      <Text style={[styles.text, textTone]} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  ok: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  okText: { color: '#047857' },
  bad: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  badText: { color: '#B91C1C' },
  muted: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  mutedText: { color: '#64748B' },
  info: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  infoText: { color: '#1D4ED8' },
});
