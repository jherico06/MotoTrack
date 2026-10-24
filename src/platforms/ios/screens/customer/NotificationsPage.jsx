import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseNotificationsPage from '../../../../screens/mobile/customer/NotificationsPage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * NotificationsPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - iOS Inset Grouped notification rows
 * - Hairline separators (#C6C6C8) between alerts
 * - SF-style icons with soft ambient shadows
 * - iOS safe area handling
 */
export default function IosNotificationsPage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseNotificationsPage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});

