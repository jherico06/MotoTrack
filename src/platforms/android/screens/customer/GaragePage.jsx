import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseGaragePage from '../../../../screens/mobile/customer/GaragePage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';

/**
 * GaragePage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers for Fleet & Service catalog cards
 * - M3 Tonal elevation and native Android ripple feedback
 * - Android edge-to-edge status bar handling
 * - Integrated with AndroidBottomNavBar
 */
export default function AndroidGaragePage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseGaragePage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
