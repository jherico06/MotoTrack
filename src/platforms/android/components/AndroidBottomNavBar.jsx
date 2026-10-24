import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../../components/common/BootstrapIcon.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { androidTokens } from '../theme/index.js';

/**
 * AndroidBottomNavBar (Material Design 3 / M3)
 *
 * - Height: 80dp
 * - Surface container background with elevation 2
 * - M3 Active Pill Indicator container (64dp × 32dp pill around icon)
 * - Native Android ripple effects
 * - M3 Label Medium typography
 */
export default function AndroidBottomNavBar({
  activeTab = 'Home',
  onTabChange = () => {},
  wishlistCount: propWishlistCount,
  cartCount: propCartCount,
  currentUser: propCurrentUser,
}) {
  const { isDarkMode = false } = useTheme?.() || {};
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();
  const authCtx = useAuth();

  const user = propCurrentUser !== undefined ? propCurrentUser : authCtx?.currentUser;

  const isHomeActive = activeTab === 'Home' || activeTab === 'Shop' || activeTab === 'shop';
  const isServicesActive =
    activeTab === 'Services' || activeTab === 'services' || activeTab === 'Pitstop' || activeTab === 'pitstop';
  const isCustomizeActive =
    activeTab === 'Customize' || activeTab === 'customizer' || activeTab === 'Customizer';
  const isGarageActive =
    activeTab === 'Garage' || activeTab === 'garage' || activeTab === 'MyGarage' || activeTab === 'Fleet';
  const isOrdersActive = activeTab === 'Orders' || activeTab === 'orders';
  const isMoreActive =
    activeTab === 'More' ||
    activeTab === 'more' ||
    activeTab === 'menu' ||
    activeTab === 'Menu' ||
    activeTab === 'Dashboard' ||
    activeTab === 'dashboard' ||
    activeTab === 'Profile' ||
    activeTab === 'profile';

  const inactiveColor = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <View style={[styles.navBarWrapper, isDarkMode && { backgroundColor: '#181A1D', borderTopColor: '#2B3035' }]}>
      {/* 1. Shop */}
      <Pressable
        style={styles.navItem}
        onPress={() => onTabChange('Home')}
        android_ripple={{ color: androidTokens.colors.ripple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="Shop"
      >
        <View style={[styles.pillContainer, isHomeActive && (isDarkMode ? { backgroundColor: 'rgba(234, 88, 12, 0.22)' } : styles.pillActive)]}>
          <BootstrapIcon
            name={isHomeActive ? 'house-fill' : 'house'}
            size={21}
            color={isHomeActive ? androidTokens.colors.primary : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isDarkMode && { color: '#94A3B8' }, isHomeActive && styles.navLabelActive]}>Shop</Text>
      </Pressable>

      {/* 2. Services */}
      <Pressable
        style={styles.navItem}
        onPress={() => onTabChange('Services')}
        android_ripple={{ color: androidTokens.colors.ripple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="Services"
      >
        <View style={[styles.pillContainer, isServicesActive && (isDarkMode ? { backgroundColor: 'rgba(234, 88, 12, 0.22)' } : styles.pillActive)]}>
          <BootstrapIcon
            name={isServicesActive ? 'wrench-adjustable' : 'tools'}
            size={20}
            color={isServicesActive ? androidTokens.colors.primary : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isDarkMode && { color: '#94A3B8' }, isServicesActive && styles.navLabelActive]}>Services</Text>
      </Pressable>

      {/* 3. AI Customizer */}
      <Pressable
        style={styles.navItem}
        onPress={() => onTabChange('Customize')}
        android_ripple={{ color: androidTokens.colors.ripple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="Customizer"
      >
        <View style={[styles.pillContainer, isCustomizeActive && (isDarkMode ? { backgroundColor: 'rgba(234, 88, 12, 0.22)' } : styles.pillActive)]}>
          <BootstrapIcon
            name="magic"
            size={20}
            color={isCustomizeActive ? androidTokens.colors.primary : inactiveColor}
          />
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isDarkMode && { color: '#94A3B8' }, isCustomizeActive && styles.navLabelActive]}>
          Customizer
        </Text>
      </Pressable>

      {/* 4. Garage (My Bike Fleet) */}
      <Pressable
        style={styles.navItem}
        onPress={() => onTabChange('Garage')}
        android_ripple={{ color: androidTokens.colors.ripple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="Garage"
      >
        <View style={[styles.pillContainer, isGarageActive && (isDarkMode ? { backgroundColor: 'rgba(234, 88, 12, 0.22)' } : styles.pillActive)]}>
          <BootstrapIcon
            name="motorcycle"
            size={21}
            color={isGarageActive ? androidTokens.colors.primary : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isDarkMode && { color: '#94A3B8' }, isGarageActive && styles.navLabelActive]}>
          Garage
        </Text>
      </Pressable>

      {/* 5. Orders */}
      <Pressable
        style={styles.navItem}
        onPress={() => onTabChange('Orders')}
        android_ripple={{ color: androidTokens.colors.ripple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="Orders"
      >
        <View style={[styles.pillContainer, isOrdersActive && (isDarkMode ? { backgroundColor: 'rgba(234, 88, 12, 0.22)' } : styles.pillActive)]}>
          <BootstrapIcon
            name={isOrdersActive ? 'box-seam-fill' : 'box-seam'}
            size={20}
            color={isOrdersActive ? androidTokens.colors.primary : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isDarkMode && { color: '#94A3B8' }, isOrdersActive && styles.navLabelActive]}>Orders</Text>
      </Pressable>

      {/* 6. More */}
      <Pressable
        style={styles.navItem}
        onPress={() => onTabChange('More')}
        android_ripple={{ color: androidTokens.colors.ripple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="More"
      >
        <View style={[styles.pillContainer, isMoreActive && (isDarkMode ? { backgroundColor: 'rgba(234, 88, 12, 0.22)' } : styles.pillActive)]}>
          <BootstrapIcon
            name={isMoreActive ? 'person-circle' : 'grid'}
            size={21}
            color={isMoreActive ? androidTokens.colors.primary : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isDarkMode && { color: '#94A3B8' }, isMoreActive && styles.navLabelActive]}>
          {user ? 'Account' : 'More'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  navBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: 74,
    paddingBottom: 6,
    paddingTop: 6,
    paddingHorizontal: 6,
    elevation: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  pillContainer: {
    width: 58,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.16)', // M3 Active Indicator
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: androidTokens.colors.primary,
    fontWeight: '800',
  },
  aiBadge: {
    position: 'absolute',
    top: -2,
    right: 6,
    backgroundColor: '#EA580C',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
});
