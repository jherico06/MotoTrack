import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from './BootstrapIcon';
import { useWishlist } from '../../context/WishlistContext';

export default function BottomNavBar({
  activeTab = 'Home',
  onTabChange = () => {},
  wishlistCount: propWishlistCount,
}) {
  const wishlistCtx = useWishlist();
  const count = propWishlistCount !== undefined ? propWishlistCount : wishlistCtx?.wishlistCount || 0;

  const isDashboard = activeTab === 'Dashboard' || activeTab === 'Profile';

  return (
    <View style={navStyles.bottomNavWrapper}>
      {/* 1. Home / Shop */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Home')}
        activeOpacity={0.75}
      >
        {activeTab === 'Home' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <BootstrapIcon
          name="house-door-fill"
          size={19}
          color={activeTab === 'Home' ? '#0C6258' : '#64748B'}
        />
        <Text style={[navStyles.bottomNavLabel, activeTab === 'Home' && navStyles.bottomNavLabelActive]}>
          Shop
        </Text>
      </TouchableOpacity>

      {/* 2. Garage (PMS & Service) */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Garage')}
        activeOpacity={0.75}
      >
        {activeTab === 'Garage' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <BootstrapIcon name="tools" size={18} color={activeTab === 'Garage' ? '#0C6258' : '#64748B'} />
        <Text style={[navStyles.bottomNavLabel, activeTab === 'Garage' && navStyles.bottomNavLabelActive]}>
          Garage
        </Text>
      </TouchableOpacity>

      {/* 3. CENTER: Customer Dashboard (Prominent Elevated Button) */}
      <TouchableOpacity
        style={navStyles.centerNavItem}
        onPress={() => onTabChange('Dashboard')}
        activeOpacity={0.85}
      >
        <View style={[navStyles.centerNavButton, isDashboard && navStyles.centerNavButtonActive]}>
          <BootstrapIcon name="speedometer2" size={22} color="#FFFFFF" />
        </View>
        <Text style={[navStyles.centerNavLabel, isDashboard && navStyles.centerNavLabelActive]}>
          Dashboard
        </Text>
      </TouchableOpacity>

      {/* 4. AI Customizer Studio */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Customize')}
        activeOpacity={0.75}
      >
        {activeTab === 'Customize' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <View style={{ position: 'relative' }}>
          <BootstrapIcon name="magic" size={18} color={activeTab === 'Customize' ? '#0C6258' : '#64748B'} />
          <View style={[navStyles.navBadge, { backgroundColor: '#0C6258', top: -6, right: -12 }]}>
            <Text style={[navStyles.navBadgeText, { fontSize: 8 }]}>AI</Text>
          </View>
        </View>
        <Text style={[navStyles.bottomNavLabel, activeTab === 'Customize' && navStyles.bottomNavLabelActive]}>
          Customizer
        </Text>
      </TouchableOpacity>

      {/* 5. Orders (replacing Saved/Favorites) */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Orders')}
        activeOpacity={0.75}
      >
        {activeTab === 'Orders' || activeTab === 'orders' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <View style={{ position: 'relative' }}>
          <BootstrapIcon
            name="box-seam-fill"
            size={18}
            color={activeTab === 'Orders' || activeTab === 'orders' ? '#0C6258' : '#64748B'}
          />
        </View>
        <Text
          style={[
            navStyles.bottomNavLabel,
            (activeTab === 'Orders' || activeTab === 'orders') && navStyles.bottomNavLabelActive,
          ]}
        >
          Orders
        </Text>
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
    borderTopColor: '#E2E8F0',
    height: Platform.OS === 'ios' ? 78 : 68,
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 20,
    zIndex: 1000,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 4,
  },
  bottomNavActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0C6258',
    marginBottom: 3,
  },
  bottomNavActiveDotHidden: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 3,
  },
  bottomNavLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3,
    letterSpacing: -0.2,
  },
  bottomNavLabelActive: {
    color: '#0C6258',
    fontWeight: '800',
  },
  centerNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  centerNavButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  centerNavButtonActive: {
    backgroundColor: '#0C6258',
    shadowColor: '#047857',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    transform: [{ scale: 1.05 }],
  },
  centerNavLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F766E',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  centerNavLabelActive: {
    color: '#0C6258',
    fontWeight: '800',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});
