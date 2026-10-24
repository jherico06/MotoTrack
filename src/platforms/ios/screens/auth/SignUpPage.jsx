import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseSignUpPage from '../../../../screens/mobile/auth/SignUpPage.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * SignUpPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - HIG Inset Grouped registration form
 * - Cupertino-style inputs and OTP boxes
 * - Soft ambient button shadows and safe area clearance
 */
export default function IosSignUpPage(props) {
  return (
    <View style={styles.container}>
      <BaseSignUpPage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});
