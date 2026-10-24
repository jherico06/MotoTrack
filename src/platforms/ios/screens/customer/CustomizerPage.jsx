import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseCustomizerPage from '../../../../screens/mobile/customer/CustomizerPage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * CustomizerPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - Floating frosted studio controls
 * - Inset rounded 16pt toolbars
 * - iOS momentum preview scrolling
 * - Integrated with IosBottomNavBar
 */
export default function IosCustomizerPage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseCustomizerPage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});

