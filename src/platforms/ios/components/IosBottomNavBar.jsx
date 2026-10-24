import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../../components/common/BootstrapIcon.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { iosTokens } from '../theme/index.js';

/**
 * IosBottomNavBar (Apple Human Interface Guidelines)
 *
 * - Height: 50pt + bottom home indicator safe area inset (28pt)
 * - Translucent backdrop with top hairline border (#E5E5EA)
 * - SF-style glyph icons, active tint #EA580C, inactive tint #8E8E93
 * - Minimalist, high-density iOS label typography
 */
export default function IosBottomNavBar({
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

  const inactiveColor = isDarkMode ? '#94A3B8' : '#8E8E93';

  return (
    <View style={[styles.tabBarWrapper, isDarkMode && { backgroundColor: '#181A1D', borderTopColor: '#2B3035' }]}>
      {/* 1. Shop */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Home')}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Shop"
      >
        <View style={styles.iconContainer}>
          <BootstrapIcon
            name="house-fill"
            size={20}
            color={isHomeActive ? iosTokens.colors.brandAccent : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, isDarkMode && { color: '#94A3B8' }, isHomeActive && styles.tabLabelActive]}>Shop</Text>
      </TouchableOpacity>

      {/* 2. Services / Pitstop */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Services')}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Services"
      >
        <View style={styles.iconContainer}>
          <BootstrapIcon
            name="tools"
            size={19}
            color={isServicesActive ? iosTokens.colors.brandAccent : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, isDarkMode && { color: '#94A3B8' }, isServicesActive && styles.tabLabelActive]}>Services</Text>
      </TouchableOpacity>

      {/* 3. AI Customizer */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Customize')}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Customizer"
      >
        <View style={styles.iconContainer}>
          <BootstrapIcon
            name="magic"
            size={19}
            color={isCustomizeActive ? iosTokens.colors.brandAccent : inactiveColor}
          />
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, isDarkMode && { color: '#94A3B8' }, isCustomizeActive && styles.tabLabelActive]}>
          Customizer
        </Text>
      </TouchableOpacity>

      {/* 4. Garage (My Bike Fleet) */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Garage')}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Garage"
      >
        <View style={styles.iconContainer}>
          <BootstrapIcon
            name="motorcycle"
            size={20}
            color={isGarageActive ? iosTokens.colors.brandAccent : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, isDarkMode && { color: '#94A3B8' }, isGarageActive && styles.tabLabelActive]}>
          Garage
        </Text>
      </TouchableOpacity>

      {/* 5. Orders & Tracking */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Orders')}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Orders"
      >
        <View style={styles.iconContainer}>
          <BootstrapIcon
            name="box-seam-fill"
            size={19}
            color={isOrdersActive ? iosTokens.colors.brandAccent : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, isDarkMode && { color: '#94A3B8' }, isOrdersActive && styles.tabLabelActive]}>Orders</Text>
      </TouchableOpacity>

      {/* 6. More / Account */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('More')}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel="Account"
      >
        <View style={styles.iconContainer}>
          <BootstrapIcon
            name={user ? 'person-circle' : 'grid-fill'}
            size={20}
            color={isMoreActive ? iosTokens.colors.brandAccent : inactiveColor}
          />
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, isDarkMode && { color: '#94A3B8' }, isMoreActive && styles.tabLabelActive]}>
          {user ? 'Account' : 'More'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: iosTokens.colors.separator,
    height: 78,
    paddingBottom: 22, // Home indicator clearance
    paddingHorizontal: 8,
    ...iosTokens.shadows.bottomBar,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.1,
    marginTop: 3,
  },
  tabLabelActive: {
    color: iosTokens.colors.brandAccent,
    fontWeight: '700',
  },
  aiBadge: {
    position: 'absolute',
    top: -3,
    right: -10,
    backgroundColor: '#EA580C',
    borderRadius: 6,
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
