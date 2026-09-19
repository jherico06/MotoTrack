import React from 'react';
import { View, Text } from 'react-native';

const ACCENT_KEY = {
  teal: 'statCardTealAccent',
  blue: 'statCardBlueAccent',
  cyan: 'statCardCyanAccent',
  amber: 'statCardWarningAccent',
  green: 'statCardSuccessAccent',
  red: 'statCardDangerAccent',
  purple: 'statCardPurpleAccent',
};

export default function AdminStatCard({
  styles,
  label,
  value,
  sub,
  accent = 'teal',
  valueColor,
}) {
  const accentStyle = styles[ACCENT_KEY[accent] || ACCENT_KEY.teal];

  return (
    <View style={[styles.statCard, accentStyle]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}
