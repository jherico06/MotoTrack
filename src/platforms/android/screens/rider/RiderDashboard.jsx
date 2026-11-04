import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseRiderDashboard from '../../../../screens/mobile/rider/RiderDashboard.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { getRiderPalette } from '../../../../components/mobile/rider/riderTheme.js';

/**
 * RiderDashboard (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and tonal elevation for delivery dispatches
 * - M3 Status badges with tonal pill containers
 * - Native Android ripple effects on delivery actions
 */
export default function AndroidRiderDashboard(props) {
  const { isDarkMode } = useTheme();
  const palette = getRiderPalette(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: palette.bgCanvas }]}>
      <BaseRiderDashboard {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

