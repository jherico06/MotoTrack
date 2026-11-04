import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from './BootstrapIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { orderService } from '../../services/orders/orderService.js';
import { ANDROID_BOTTOM_INSET } from '../../utils/safeArea.js';

export default function BottomNavBar({
  activeTab = 'Home',
  onTabChange = () => {},
  wishlistCount: _propWishlistCount,
  cartCount: _propCartCount,
  currentUser: propCurrentUser,
  ordersCount: propOrdersCount,
  tabs: propTabs,
}) {
  const authCtx = useAuth();
  const { isDarkMode = false } = useTheme?.() || {};

  const user = propCurrentUser !== undefined ? propCurrentUser : authCtx?.currentUser;

  // Active tab normalizer
  const isShopActive =
    activeTab === 'Home' || activeTab === 'home' || activeTab === 'Shop' || activeTab === 'shop';
  const isServicesActive =
    activeTab === 'Services' || activeTab === 'services' || activeTab === 'Pitstop' || activeTab === 'pitstop';
  const isCustomizeActive =
    activeTab === 'Customize' || activeTab === 'customize' || activeTab === 'customizer' || activeTab === 'Customizer';
  const isGarageActive =
    activeTab === 'Garage' || activeTab === 'garage' || activeTab === 'MyGarage' || activeTab === 'Fleet';
  const isOrdersActive =
    activeTab === 'Orders' || activeTab === 'orders';
  const isMoreActive =
    activeTab === 'More' ||
    activeTab === 'more' ||
    activeTab === 'menu' ||
    activeTab === 'Menu' ||
    activeTab === 'Dashboard' ||
    activeTab === 'dashboard' ||
    activeTab === 'Profile' ||
    activeTab === 'profile' ||
    activeTab === 'Account' ||
    activeTab === 'account';

  // Compute live active orders count for badge (matching rider order badge)
  const ordersBadgeCount = useMemo(() => {
    if (typeof propOrdersCount === 'number') return propOrdersCount;
    if (!user || user.role === 'admin' || user.role === 'rider') return 0;
    try {
      const userId = user.id || user.user_id || user.customer_id;
      if (!userId) return 0;
      const userOrders = orderService.getOrders(userId);
      return (userOrders || []).filter(
        (o) => o && o.status !== 'delivered' && o.status !== 'cancelled'
      ).length;
    } catch {
      return 0;
    }
  }, [propOrdersCount, user]);

  // Customer Navigation Choices styled after the Rider Account Bottom Nav
  const customerTabs = useMemo(() => {
    if (Array.isArray(propTabs) && propTabs.length > 0) {
      return propTabs;
    }
    return [
      {
        id: 'Home',
        label: 'Shop',
        icon: 'house',
        activeIcon: 'house-fill',
        isActive: isShopActive,
        badge: 0,
      },
      {
        id: 'Services',
        label: 'Services',
        icon: 'tools',
        activeIcon: 'tools-fill',
        isActive: isServicesActive,
        badge: 0,
      },
      {
        id: 'Customize',
        label: 'Customizer',
        icon: 'magic',
        activeIcon: 'magic',
        isActive: isCustomizeActive,
        hasAiBadge: true,
        badge: 0,
      },
      {
        id: 'Garage',
        label: 'Garage',
        icon: 'motorcycle',
        activeIcon: 'motorcycle',
        isActive: isGarageActive,
        badge: 0,
      },
      {
        id: 'Orders',
        label: 'Orders',
        icon: 'box-seam',
        activeIcon: 'box-seam-fill',
        isActive: isOrdersActive,
        badge: ordersBadgeCount,
      },
      {
        id: 'More',
        label: 'More',
        icon: 'list',
        activeIcon: 'list',
        isActive: isMoreActive,
        badge: 0,
      },
    ];
  }, [
    propTabs,
    isShopActive,
    isServicesActive,
    isCustomizeActive,
    isGarageActive,
    isOrdersActive,
    isMoreActive,
    ordersBadgeCount,
  ]);

  const activeColor = '#EA580C';
  const inactiveColor = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <View
      style={[
        navStyles.bottomNavWrap,
        isDarkMode && navStyles.bottomNavWrapDark,
      ]}
    >
      <View style={navStyles.bottomNavInner}>
        {customerTabs.map((tab) => {
          const active = tab.isActive;
          return (
            <TouchableOpacity
              key={tab.id}
              style={navStyles.bottomNavItem}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <View style={navStyles.navIconContainer}>
                <BootstrapIcon
                  name={active ? tab.activeIcon : tab.icon}
                  size={20}
                  color={active ? activeColor : inactiveColor}
                />
                {tab.hasAiBadge ? (
                  <View style={navStyles.aiBadge}>
                    <Text style={navStyles.aiBadgeText}>AI</Text>
                  </View>
                ) : null}
                {tab.badge > 0 ? (
                  <View
                    style={[
                      navStyles.navCountBadge,
                      {
                        backgroundColor: activeColor,
                        borderColor: isDarkMode ? '#181A1D' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Text style={navStyles.navCountBadgeText}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  navStyles.bottomNavLabel,
                  {
                    color: active ? activeColor : inactiveColor,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const navStyles = StyleSheet.create({
  bottomNavWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 7,
    paddingBottom:
      Platform.OS === 'ios' ? 24 : Math.max(10, ANDROID_BOTTOM_INSET + 6),
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -2px 8px rgba(15, 23, 42, 0.04)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 8,
        }),
    zIndex: 100,
  },
  bottomNavWrapDark: {
    backgroundColor: '#181A1D',
    borderTopColor: '#2B3035',
    shadowColor: '#000000',
  },
  bottomNavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  bottomNavItem: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  navIconContainer: {
    position: 'relative',
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCountBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCountBadgeText: {
    fontFamily:
      Platform.OS === 'web'
        ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        : undefined,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  aiBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#EA580C',
    borderRadius: 5,
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomNavLabel: {
    fontFamily:
      Platform.OS === 'web'
        ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        : undefined,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: -0.1,
  },
});
