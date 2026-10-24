import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseCustomizerPage from '../../../../screens/mobile/customer/CustomizerPage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { androidTokens } from '../../theme/index.js';

/**
 * CustomizerPage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and tonal elevation for AI studio tools
 * - M3 Assist Chips for build part selection
 * - Native Android ripple feedback on interactive elements
 * - Integrated with AndroidBottomNavBar
 */
export default function AndroidCustomizerPage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseCustomizerPage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: androidTokens.colors.background,
  },
});

