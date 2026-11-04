import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseSignUpPage from '../../../../screens/mobile/auth/SignUpPage.jsx';

/**
 * SignUpPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - HIG Inset Grouped registration form
 * - Cupertino-style inputs and pale-gray rounded pills
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
    backgroundColor: '#1E2227',
  },
});
