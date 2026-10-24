import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseRiderRunPage from '../../../../screens/mobile/rider/RiderRunPage.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * RiderRunPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - iOS Inset Grouped dispatch list
 * - Smooth camera QR scanner integration
 * - iOS safe area handling
 */
export default function IosRiderRunPage(props) {
  return (
    <View style={styles.container}>
      <BaseRiderRunPage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});
