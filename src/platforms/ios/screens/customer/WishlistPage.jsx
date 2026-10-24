import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseWishlistPage from '../../../../screens/mobile/customer/WishlistPage.jsx';
import { useTheme } from '../../../../context/ThemeContext.jsx';
import { iosTokens } from '../../theme/index.js';

/**
 * WishlistPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * - iOS Inset Grouped wishlist cards with rounded 16pt corners
 * - Soft ambient shadows
 * - iOS safe area handling
 * - Integrated with IosBottomNavBar
 */
export default function IosWishlistPage(props) {
  const { isDarkMode = false } = useTheme?.() || {};
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}>
      <BaseWishlistPage {...props} platform="ios" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: iosTokens.colors.background,
  },
});

