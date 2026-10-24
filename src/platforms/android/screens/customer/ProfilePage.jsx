import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseProfilePage from '../../../../screens/mobile/customer/ProfilePage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';

/**
 * ProfilePage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and tonal elevation
 * - M3 Scrollable Tab Row with active indicator
 * - Native Android ripple feedback on touchable cards
 * - Android Top App Bar styling
 */
export default function AndroidProfilePage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseProfilePage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
