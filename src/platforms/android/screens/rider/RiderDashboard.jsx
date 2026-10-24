import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseRiderDashboard from '../../../../screens/mobile/rider/RiderDashboard.jsx';
import { androidTokens } from '../../theme/index.js';

/**
 * RiderDashboard (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and tonal elevation for delivery dispatches
 * - M3 Status badges with tonal pill containers
 * - Native Android ripple effects on delivery actions
 */
export default function AndroidRiderDashboard(props) {
  return (
    <View style={styles.container}>
      <BaseRiderDashboard {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: androidTokens.colors.background,
  },
});
