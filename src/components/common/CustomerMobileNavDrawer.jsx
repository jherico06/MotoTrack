import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import BrandLogo from './BrandLogo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';
import { isAdmin } from '../../utils/permissions.js';

export default function CustomerMobileNavDrawer({
  isOpen,
  onClose,
  currentScreen = 'shop',
  onNavigateToScreen,
  unreadNotifCount = 0,
}) {
  const { currentUser, logout } = useAuth();
  const { wishlistCount } = useWishlist();
  const { cartItemCount } = useCart();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const brandSettings = systemSettingsService.getSettings();

  if (!isOpen) return null;

  const handleNav = (screen, params) => {
    onClose?.();
    onNavigateToScreen?.(screen, params);
  };

  const navItems = [
    {
      id: 'shop',
      label: 'Shop & Parts Catalog',
      icon: 'house',
      activeIcon: 'house-fill',
      screen: 'shop',
    },
    {
      id: 'garage',
      label: 'Book a Service (Garage)',
      icon: 'tools',
      activeIcon: 'tools',
      screen: 'garage',
    },
    {
      id: 'customizer',
      label: 'AI Build Studio (Customize)',
      icon: 'magic',
      activeIcon: 'magic',
      screen: 'customizer',
      isAi: true,
    },
    {
      id: 'fleet',
      label: 'My Motorcycle Fleet',
      icon: 'motorcycle',
      activeIcon: 'motorcycle',
      screen: 'profile',
      params: { tab: 'garage' },
    },
    {
      id: 'orders',
      label: 'My Orders & Tracking',
      icon: 'box-seam',
      activeIcon: 'box-seam-fill',
      screen: 'profile',
      params: { tab: 'orders' },
    },
    {
      id: 'wishlist',
      label: 'Favorites / Wishlist',
      icon: 'heart',
      activeIcon: 'heart-fill',
      screen: 'wishlist',
      badge: wishlistCount > 0 ? wishlistCount : null,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'bell',
      activeIcon: 'bell-fill',
      screen: 'profile',
      params: { tab: 'notifications' },
      badge: unreadNotifCount > 0 ? (unreadNotifCount > 9 ? '9+' : unreadNotifCount) : null,
    },
  ];

  if (isAdmin(currentUser)) {
    navItems.push({
      id: 'admin',
      label: 'Store Admin Console',
      icon: 'shield-lock',
      activeIcon: 'shield-lock-fill',
      screen: 'admin',
      isAdminOnly: true,
    });
  }

  return (
    <View style={drawerStyles.overlayWrapper}>
      {/* Dimmed Backdrop */}
      <TouchableOpacity
        style={drawerStyles.backdrop}
        onPress={onClose}
        activeOpacity={1}
        accessibilityLabel="Close Navigation Menu"
      />

      {/* Drawer Surface */}
      <View
        style={[
          drawerStyles.drawerContainer,
          { backgroundColor: isDarkMode ? '#181A1D' : '#FFFFFF' },
        ]}
      >
        {/* Top Header */}
        <View
          style={[
            drawerStyles.drawerHeader,
            {
              backgroundColor: '#24272B',
              borderBottomColor: isDarkMode ? '#2D3136' : '#1E2124',
            },
          ]}
        >
          <TouchableOpacity
            style={drawerStyles.logoArea}
            onPress={() => handleNav('shop')}
            activeOpacity={0.8}
          >
            <BrandLogo size={32} textColor="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={drawerStyles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Close Menu"
          >
            <BootstrapIcon name="x-lg" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Nav List */}
        <ScrollView
          style={drawerStyles.scrollArea}
          contentContainerStyle={drawerStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Main Navigation */}
          <Text
            style={[
              drawerStyles.sectionHeading,
              { color: isDarkMode ? '#94A3B8' : '#64748B' },
            ]}
          >
            NAVIGATION
          </Text>

          {navItems.map((item) => {
            const isActive = currentScreen === item.id || currentScreen === item.screen;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  drawerStyles.navRow,
                  isActive && {
                    backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED',
                    borderColor: '#EA580C',
                  },
                ]}
                onPress={() => handleNav(item.screen, item.params)}
                activeOpacity={0.75}
              >
                <View style={drawerStyles.navIconWrap}>
                  <BootstrapIcon
                    name={isActive ? item.activeIcon : item.icon}
                    size={17}
                    color={isActive ? '#EA580C' : isDarkMode ? '#CBD5E1' : '#334155'}
                  />
                  {item.isAi && (
                    <View style={drawerStyles.aiBadge}>
                      <Text style={drawerStyles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    drawerStyles.navLabel,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    isActive && { color: '#EA580C', fontWeight: '600' },
                    item.isAdminOnly && { color: '#EA580C', fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>

                {item.badge != null && (
                  <View style={drawerStyles.badgePill}>
                    <Text style={drawerStyles.badgePillText}>{item.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View
            style={[
              drawerStyles.divider,
              { backgroundColor: isDarkMode ? '#2D3136' : '#F1F5F9' },
            ]}
          />

          {/* User Account / Profile Section */}
          <Text
            style={[
              drawerStyles.sectionHeading,
              { color: isDarkMode ? '#94A3B8' : '#64748B' },
            ]}
          >
            ACCOUNT
          </Text>

          {currentUser ? (
            <View
              style={[
                drawerStyles.userCard,
                {
                  backgroundColor: isDarkMode ? '#24272B' : '#F8FAFC',
                  borderColor: isDarkMode ? '#374151' : '#E2E8F0',
                },
              ]}
            >
              <View style={drawerStyles.userInfoRow}>
                <View style={drawerStyles.userAvatar}>
                  <Text style={drawerStyles.userAvatarLetter}>
                    {(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      drawerStyles.userName,
                      { color: isDarkMode ? '#FFFFFF' : '#0F172A' },
                    ]}
                    numberOfLines={1}
                  >
                    {currentUser.name || 'MotoTrack Customer'}
                  </Text>
                  <Text
                    style={[
                      drawerStyles.userEmail,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                    numberOfLines={1}
                  >
                    {currentUser.email}
                  </Text>
                </View>
              </View>

              <View style={drawerStyles.userActionsRow}>
                <TouchableOpacity
                  style={[drawerStyles.userActionBtn, { flex: 1 }]}
                  onPress={() => handleNav('profile', { tab: 'garage' })}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="person-circle" size={14} color="#EA580C" />
                  <Text style={drawerStyles.userActionBtnText}>My Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[drawerStyles.userActionBtn, drawerStyles.logoutBtn]}
                  onPress={() => {
                    onClose?.();
                    logout();
                    onNavigateToScreen?.('shop');
                  }}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="box-arrow-right" size={14} color="#EF4444" />
                  <Text style={[drawerStyles.userActionBtnText, { color: '#EF4444' }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={drawerStyles.signInBtn}
                onPress={() => handleNav('login')}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="person-fill" size={15} color="#FFFFFF" />
                <Text style={drawerStyles.signInBtnText}>Sign In to Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  drawerStyles.signUpBtn,
                  { borderColor: isDarkMode ? '#374151' : '#CBD5E1' },
                ]}
                onPress={() => handleNav('signup')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    drawerStyles.signUpBtnText,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Create New Account
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View
            style={[
              drawerStyles.divider,
              { backgroundColor: isDarkMode ? '#2D3136' : '#F1F5F9' },
            ]}
          />

          {/* Quick Preferences: Theme */}
          <TouchableOpacity
            style={[
              drawerStyles.themeToggleRow,
              {
                backgroundColor: isDarkMode ? '#24272B' : '#F8FAFC',
                borderColor: isDarkMode ? '#374151' : '#E2E8F0',
              },
            ]}
            onPress={toggleDarkMode}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <BootstrapIcon
                name={isDarkMode ? 'sun-fill' : 'moon-fill'}
                size={16}
                color={isDarkMode ? '#F59E0B' : '#64748B'}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                }}
              >
                {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </Text>
            </View>
            <View
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                backgroundColor: isDarkMode ? '#EA580C' : '#CBD5E1',
                padding: 2,
                justifyContent: 'center',
                alignItems: isDarkMode ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>
          </TouchableOpacity>

          {/* Store Info Footer */}
          <View style={{ marginTop: 24, paddingBottom: 16 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: isDarkMode ? '#64748B' : '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Hotline & Support
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                color: isDarkMode ? '#CBD5E1' : '#475569',
                fontWeight: '600',
              }}
            >
              📞 {brandSettings.contactPhone || '1800-3232-8686'}
            </Text>
            <Text
              style={{
                fontSize: 11.5,
                color: isDarkMode ? '#94A3B8' : '#64748B',
                marginTop: 2,
              }}
            >
              ✉️ {brandSettings.contactEmail || 'support@mototrack.ph'}
            </Text>
            <Text
              style={{
                fontSize: 10.5,
                color: isDarkMode ? '#64748B' : '#94A3B8',
                marginTop: 10,
              }}
            >
              © 2026 {brandSettings.storeName || 'MotoTrack'}. All Rights Reserved.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const drawerStyles = StyleSheet.create({
  overlayWrapper: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}),
  },
  drawerContainer: {
    width: 290,
    maxWidth: '85%',
    height: '100%',
    zIndex: 100000,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.25)',
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    minHeight: 60,
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
    cursor: 'pointer',
  },
  navIconWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  aiBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EA580C',
    borderRadius: 4,
    paddingHorizontal: 2.5,
    paddingVertical: 0.5,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 6.5,
    fontWeight: '600',
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  badgePill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 14,
    width: '100%',
  },
  userCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarLetter: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 11,
  },
  userActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 8,
  },
  userActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
    justifyContent: 'center',
  },
  userActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
  },
  signInBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  signUpBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  signUpBtnText: {
    fontWeight: '700',
    fontSize: 12.5,
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
