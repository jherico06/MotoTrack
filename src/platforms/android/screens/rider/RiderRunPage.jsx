import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseRiderRunPage from '../../../../screens/mobile/rider/RiderRunPage.jsx';
import { androidTokens } from '../../theme/index.js';

/**
 * RiderRunPage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers for run tracking
 * - M3 Status badges and native ripple actions
 * - Android edge-to-edge status bar handling
 */
export default function AndroidRiderRunPage(props) {
  return (
    <View style={styles.container}>
      <BaseRiderRunPage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: androidTokens.colors.background,
  },
});
