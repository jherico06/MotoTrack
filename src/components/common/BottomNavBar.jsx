import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from './BootstrapIcon';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

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

  const user = propCurrentUser !== undefined ? propCurrentUser : authCtx?.currentUser;

  const isHomeActive = activeTab === 'Home' || activeTab === 'Shop' || activeTab === 'shop';
  const isGarageActive = activeTab === 'Garage' || activeTab === 'garage';
  const isCustomizeActive =
    activeTab === 'Customize' || activeTab === 'customizer' || activeTab === 'Customizer';
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
    <View style={navStyles.bottomNavWrapper}>
      {/* 1. Shop */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Home')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Shop"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="house" size={22} color={isHomeActive ? '#1D4533' : '#64748B'} />
        </View>
        <Text style={[navStyles.bottomNavLabel, isHomeActive && navStyles.bottomNavLabelActive]}>Shop</Text>
      </TouchableOpacity>

      {/* 2. Services */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Garage')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Services"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="tools" size={21} color={isGarageActive ? '#1D4533' : '#64748B'} />
        </View>
        <Text style={[navStyles.bottomNavLabel, isGarageActive && navStyles.bottomNavLabelActive]}>
          Services
        </Text>
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
          <BootstrapIcon name="magic" size={21} color={isCustomizeActive ? '#1D4533' : '#64748B'} />
          <View style={navStyles.aiBadge}>
            <Text style={navStyles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text style={[navStyles.bottomNavLabel, isCustomizeActive && navStyles.bottomNavLabelActive]}>
          Customizer
        </Text>
      </TouchableOpacity>

      {/* 4. Orders */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Orders')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Orders"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="box-seam" size={21} color={isOrdersActive ? '#1D4533' : '#64748B'} />
        </View>
        <Text style={[navStyles.bottomNavLabel, isOrdersActive && navStyles.bottomNavLabelActive]}>
          Orders
        </Text>
      </TouchableOpacity>

      {/* 5. More (Hamburger Icon in the LAST position) */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('More')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Menu and Dashboard choices"
      >
        <View style={navStyles.iconContainer}>
          <BootstrapIcon name="list" size={22} color={isMoreActive ? '#1D4533' : '#64748B'} />
        </View>
        <Text style={[navStyles.bottomNavLabel, isMoreActive && navStyles.bottomNavLabelActive]}>More</Text>
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
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bottomNavLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 3,
    letterSpacing: -0.1,
  },
  bottomNavLabelActive: {
    color: '#1D4533',
    fontWeight: '700',
  },
  aiBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#1D4533',
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
