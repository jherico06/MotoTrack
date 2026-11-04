import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseLoginPage from '../../../../screens/mobile/auth/LoginPage.jsx';

/**
 * LoginPage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and Outlined text inputs
 * - Native Android ripple effects
 * - Android edge-to-edge status bar handling
 */
export default function AndroidLoginPage(props) {
  return (
    <View style={styles.container}>
      <BaseLoginPage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2227',
  },
});
