import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseLoginPage from '../../../../screens/mobile/auth/LoginPage.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * LoginPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - Cupertino-style rounded text inputs (12pt radius)
 * - Safe area handling with notch/island clearance
 * - Soft ambient button shadows
 */
export default function IosLoginPage(props) {
  return (
    <View style={styles.container}>
      <BaseLoginPage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});
