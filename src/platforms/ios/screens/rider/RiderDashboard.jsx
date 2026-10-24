import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseRiderDashboard from '../../../../screens/mobile/rider/RiderDashboard.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * RiderDashboard (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - Turn-by-turn HUD feel
 * - Cupertino-style delivery cards with soft ambient shadows
 * - iOS safe area handling for rider telemetry
 */
export default function IosRiderDashboard(props) {
  return (
    <View style={styles.container}>
      <BaseRiderDashboard {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});
