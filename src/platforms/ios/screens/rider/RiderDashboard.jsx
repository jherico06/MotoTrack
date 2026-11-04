import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseRiderDashboard from '../../../../screens/mobile/rider/RiderDashboard.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { getRiderPalette } from '../../../../components/mobile/rider/riderTheme.js';

/**
 * RiderDashboard (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - Turn-by-turn HUD feel
 * - Cupertino-style delivery cards with soft ambient shadows
 * - iOS safe area handling for rider telemetry
 */
export default function IosRiderDashboard(props) {
  const { isDarkMode } = useTheme();
  const palette = getRiderPalette(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: palette.bgCanvas }]}>
      <BaseRiderDashboard {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

