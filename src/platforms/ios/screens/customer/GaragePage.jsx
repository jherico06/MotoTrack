import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseGaragePage from '../../../../screens/mobile/customer/GaragePage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * GaragePage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - Cupertino-style fleet cards and service catalog
 * - Inset Grouped layout styling
 * - Smooth momentum scrolling and iOS safe-area handling
 * - Integrated with IosBottomNavBar
 */
export default function IosGaragePage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseGaragePage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});

