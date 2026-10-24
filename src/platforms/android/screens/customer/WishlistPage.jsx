import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseWishlistPage from '../../../../screens/mobile/customer/WishlistPage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';

/**
 * WishlistPage (Android Native Implementation - Material Design 3)
 *
 * - M3 Surface Containers and tonal elevation for saved part cards
 * - M3 Action Chips for quick add-to-cart and booking
 * - Native Android ripple feedback on interactive rows
 * - Integrated with AndroidBottomNavBar
 */
export default function AndroidWishlistPage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseWishlistPage {...props} platform="android" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
