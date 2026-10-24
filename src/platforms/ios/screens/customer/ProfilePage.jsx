import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseProfilePage from '../../../../screens/mobile/customer/ProfilePage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * ProfilePage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - HIG Inset Grouped list styles
 * - Cupertino segmented tab control
 * - SF-style icons with soft ambient shadows
 * - iOS safe area and fluid momentum scrolling
 */
export default function IosProfilePage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseProfilePage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});

