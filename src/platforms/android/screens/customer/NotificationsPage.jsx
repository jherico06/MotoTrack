import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseNotificationsPage from '../../../../screens/mobile/customer/NotificationsPage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { androidTokens } from '../../theme/index.js';

/**
 * NotificationsPage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers for notifications
 * - M3 tonal status badges
 * - Native Android ripple feedback on alert cards
 * - Android edge-to-edge status bar handling
 */
export default function AndroidNotificationsPage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseNotificationsPage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: androidTokens.colors.background,
  },
});

