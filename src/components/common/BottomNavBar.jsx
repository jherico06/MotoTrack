import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from './BootstrapIcon.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function BottomNavBar({
  activeTab = 'Home',
  onTabChange = () => {},
  wishlistCount: propWishlistCount,
  cartCount: propCartCount,
  currentUser: propCurrentUser,
}) {
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();
  const authCtx = useAuth();
  const { isDarkMode } = useTheme?.() || { isDarkMode: false };

  const user = propCurrentUser !== undefined ? propCurrentUser : authCtx?.currentUser;

  const inactiveIconColor = isDarkMode ? '#94A3B8' : '#64748B';

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

  return (
    <View
      style={[
        navStyles.bottomNavWrapper,
        isDarkMode && {
          backgroundColor: '#181A1D',
          borderTopColor: '#2D3136',
          shadowColor: '#000000',
        },
      ]}
    >
      {/* 1. Shop */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Home')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Shop"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="house" size={21} color={isHomeActive ? '#EA580C' : inactiveIconColor} />
        </View>
        <Text
          numberOfLines={1}
          style={[navStyles.bottomNavLabel, isDarkMode && { color: '#94A3B8' }, isHomeActive && navStyles.bottomNavLabelActive]}
        >
          Shop
        </Text>
        {isHomeActive && <View style={navStyles.activeUnderline} />}
      </TouchableOpacity>

      {/* 2. Services */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Services')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Services"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="tools" size={20} color={isServicesActive ? '#EA580C' : inactiveIconColor} />
        </View>
        <Text
          numberOfLines={1}
          style={[navStyles.bottomNavLabel, isDarkMode && { color: '#94A3B8' }, isServicesActive && navStyles.bottomNavLabelActive]}
        >
          Services
        </Text>
        {isServicesActive && <View style={navStyles.activeUnderline} />}
      </TouchableOpacity>

      {/* 3. Customizer */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Customize')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Customizer"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="magic" size={20} color={isCustomizeActive ? '#EA580C' : inactiveIconColor} />
          <View style={navStyles.aiBadge}>
            <Text style={navStyles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={[navStyles.bottomNavLabel, isDarkMode && { color: '#94A3B8' }, isCustomizeActive && navStyles.bottomNavLabelActive]}
        >
          Customizer
        </Text>
        {isCustomizeActive && <View style={navStyles.activeUnderline} />}
      </TouchableOpacity>

      {/* 4. Garage (My Bike Fleet) */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Garage')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Garage"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="motorcycle" size={21} color={isGarageActive ? '#EA580C' : inactiveIconColor} />
        </View>
        <Text
          numberOfLines={1}
          style={[navStyles.bottomNavLabel, isDarkMode && { color: '#94A3B8' }, isGarageActive && navStyles.bottomNavLabelActive]}
        >
          Garage
        </Text>
        {isGarageActive && <View style={navStyles.activeUnderline} />}
      </TouchableOpacity>

      {/* 5. Orders */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Orders')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Orders"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="box-seam" size={20} color={isOrdersActive ? '#EA580C' : inactiveIconColor} />
        </View>
        <Text
          numberOfLines={1}
          style={[navStyles.bottomNavLabel, isDarkMode && { color: '#94A3B8' }, isOrdersActive && navStyles.bottomNavLabelActive]}
        >
          Orders
        </Text>
        {isOrdersActive && <View style={navStyles.activeUnderline} />}
      </TouchableOpacity>

      {/* 6. More */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('More')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Menu and Dashboard choices"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="list" size={21} color={isMoreActive ? '#EA580C' : inactiveIconColor} />
        </View>
        <Text
          numberOfLines={1}
          style={[navStyles.bottomNavLabel, isDarkMode && { color: '#94A3B8' }, isMoreActive && navStyles.bottomNavLabelActive]}
        >
          More
        </Text>
        {isMoreActive && <View style={navStyles.activeUnderline} />}
      </TouchableOpacity>
    </View>
  );
}

const navStyles = StyleSheet.create({
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    height: Platform.OS === 'ios' ? 76 : Platform.OS === 'android' ? 68 : 62,
    paddingBottom: Platform.OS === 'ios' ? 18 : Platform.OS === 'android' ? 12 : 6,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -3px 8px rgba(15, 23, 42, 0.05)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }),
    elevation: 10,
    zIndex: 1000,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 2,
  },
  iconContainer: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bottomNavLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  bottomNavLabelActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  aiBadge: {
    position: 'absolute',
    top: -3,
    right: -6,
    backgroundColor: '#EA580C',
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  activeUnderline: {
    width: 18,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#EA580C',
    marginTop: 2,
  },
});
