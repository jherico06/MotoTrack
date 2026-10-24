import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseSignUpPage from '../../../../screens/mobile/auth/SignUpPage.jsx';
import { androidTokens } from '../../theme/index.js';

/**
 * SignUpPage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and Outlined fields
 * - M3 OTP input boxes with active indicator
 * - Native Android ripple feedback on registration actions
 */
export default function AndroidSignUpPage(props) {
  return (
    <View style={styles.container}>
      <BaseSignUpPage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: androidTokens.colors.background,
  },
});
