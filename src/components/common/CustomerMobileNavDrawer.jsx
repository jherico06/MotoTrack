import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Linking,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import BrandLogo from './BrandLogo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';
import { isAdmin } from '../../utils/permissions.js';

/**
 * MotoTrack Customer Mobile Navigation Drawer
 *
 * Adopts the exact dark charcoal (#24272B) & racing orange (#EA580C) design
 * language of MotoTrack Enterprise AdminSidebar:
 * - 38-40px menu-item heights with 8px rounded corners
 * - Warm dark charcoal with deep racing orange (#EA580C) left accent indicator for active state
 * - Section headings in 10px uppercase bold (#6B7280) with 1.1px letter spacing
 * - Dedicated User Profile Card matching AdminSidebar footer (avatar, identity, role badge, profile settings, logout)
 * - Dark mode toggle & customer hotline support integration
 */
export default function CustomerMobileNavDrawer({
  isOpen,
  onClose,
  currentScreen = 'shop',
  onNavigateToScreen,
  currentUser: propUser,
  unreadNotifCount = 0,
  cartItemCount: propCartCount,
  onOpenCart,
  onLoginPress,
  onRegisterPress,
  onLogoutPress,
}) {
  const { currentUser: authUser, logout } = useAuth();
  const currentUser = propUser !== undefined ? propUser : authUser;
  const { wishlistCount } = useWishlist();
  const { cartItemCount: contextCartCount } = useCart();
  const cartItemCount = propCartCount !== undefined ? propCartCount : contextCartCount;
  const { isDarkMode, toggleDarkMode } = useTheme();
  const brandSettings = systemSettingsService.getSettings();

  const [isRendered, setIsRendered] = useState(isOpen);
  const slideAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const isClosingRef = useRef(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  // Prevent background scrolling while the drawer is open on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (isRendered) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }
  }, [isRendered]);

  const handleCloseWithAnimation = useCallback((callback) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      isClosingRef.current = false;
      setIsRendered(false);
      onClose?.();
      if (typeof callback === 'function') {
        callback();
      }
    });
  }, [slideAnim, fadeAnim, onClose]);

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setIsRendered(true);
      slideAnim.stopAnimation();
      fadeAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // Smooth easeOut spring
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else if (isRendered && !isClosingRef.current) {
      handleCloseWithAnimation();
    }
  }, [isOpen, isRendered, slideAnim, fadeAnim, handleCloseWithAnimation]);

  const userAvatarUri = useMemo(() => {
    const raw =
      currentUser?.avatar ||
      currentUser?.photoUri ||
      currentUser?.profile_image ||
      currentUser?.avatar_url ||
      currentUser?.photoURL ||
      '';
    if (
      typeof raw === 'string' &&
      raw.trim().length > 0 &&
      !raw.includes('ui-avatars.com')
    ) {
      return raw.trim();
    }
    return null;
  }, [currentUser]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [userAvatarUri]);

  if (!isRendered && !isOpen) return null;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-310, 0],
  });

  const backdropOpacity = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleNav = (screen, params) => {
    handleCloseWithAnimation(() => {
      if (screen === 'cart') {
        if (onOpenCart) onOpenCart();
        else onNavigateToScreen?.('cart', params);
      } else {
        onNavigateToScreen?.(screen, params);
      }
    });
  };

  const handleSignIn = () => {
    handleCloseWithAnimation(() => {
      if (onLoginPress) {
        onLoginPress();
      } else {
        onNavigateToScreen?.('login');
      }
    });
  };

  const handleCreateAccount = () => {
    handleCloseWithAnimation(() => {
      if (onRegisterPress) {
        onRegisterPress();
      } else {
        onNavigateToScreen?.('signup');
      }
    });
  };

  const handleLogout = () => {
    handleCloseWithAnimation(() => {
      if (onLogoutPress) {
        onLogoutPress();
      } else {
        logout?.();
        onNavigateToScreen?.('shop');
      }
    });
  };

  const handleCallPhone = () => {
    const phone = brandSettings?.contactPhone || '0987654321';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = `tel:${phone}`;
    } else {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
  };

  const handleSendEmail = () => {
    const email = brandSettings?.contactEmail || 'MotoTrack@motorparts.com';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = `mailto:${email}`;
    } else {
      Linking.openURL(`mailto:${email}`).catch(() => {});
    }
  };

  // ─── ADMIN-STYLE NAVIGATION GROUPS ───
  const servicesGroup = [
    {
      id: 'shop',
      label: 'Shop',
      icon: 'house',
      activeIcon: 'house-fill',
      screen: 'shop',
    },
    {
      id: 'book',
      label: 'Book a Service',
      icon: 'tools',
      activeIcon: 'tools',
      screen: 'garage',
    },

    {
      id: 'customizer',
      label: 'Customize',
      icon: 'magic',
      activeIcon: 'magic',
      screen: 'customizer',
      isAi: true,
    },
    {
      id: 'fleet',
      label: 'Garage',
      icon: 'bicycle',
      activeIcon: 'bicycle',
      screen: 'profile',
      params: { tab: 'garage' },
    },
  ];

  const ordersGroup = [
    {
      id: 'orders',
      label: 'Orders',
      icon: 'box-seam',
      activeIcon: 'box-seam-fill',
      screen: 'profile',
      params: { tab: 'orders' },
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      icon: 'heart',
      activeIcon: 'heart-fill',
      screen: 'wishlist',
      badge: wishlistCount > 0 ? wishlistCount : null,
    },
    {
      id: 'cart',
      label: 'Cart',
      icon: 'cart3',
      activeIcon: 'cart-fill',
      screen: 'cart',
      badge: cartItemCount > 0 ? cartItemCount : null,
      isCartBadge: true,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'bell',
      activeIcon: 'bell-fill',
      screen: 'profile',
      params: { tab: 'notifications' },
      badge: unreadNotifCount > 0 ? (unreadNotifCount > 9 ? '9+' : unreadNotifCount) : null,
      isWarningBadge: true,
    },
  ];

  const isUserAdmin = isAdmin(currentUser);

  return (
    <View style={drawerStyles.overlayWrapper}>
      {/* ─── SMOOTH FADE BACKDROP ─── */}
      <Animated.View
        style={[
          drawerStyles.backdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => handleCloseWithAnimation()}
          activeOpacity={1}
          accessibilityLabel="Close Navigation Menu"
        />
      </Animated.View>

      {/* ─── CHARCOAL DRAWER SURFACE (MATCHES ADMIN SIDEBAR) ─── */}
      <Animated.View
        style={[
          drawerStyles.drawerContainer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {/* ─── 1. CHARCOAL HEADER WITH BRAND LOGO & COMPACT CLOSE BTN ─── */}
        <View style={drawerStyles.drawerHeader}>
          <TouchableOpacity
            style={drawerStyles.logoArea}
            onPress={() => handleNav('shop')}
            activeOpacity={0.8}
            title="Go to MotoTrack Shop"
          >
            <BrandLogo size={32} textColor="#FFFFFF" accentColor="#EA580C" />
          </TouchableOpacity>

          <TouchableOpacity
            style={drawerStyles.closeBtn}
            onPress={() => handleCloseWithAnimation()}
            activeOpacity={0.7}
            accessibilityLabel="Close Menu"
          >
            <BootstrapIcon name="x-lg" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ─── 2. SCROLLABLE SIDEBAR BODY ─── */}
        <ScrollView
          style={drawerStyles.scrollArea}
          contentContainerStyle={drawerStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── GROUP 1: SERVICES & EXPLORE ── */}
          <Text style={drawerStyles.sectionHeadingText}>
            SERVICES & EXPLORE
          </Text>

          <View style={drawerStyles.navGroup}>
            {servicesGroup.map((item) => {
              const isActive = currentScreen === item.id || (item.id !== 'book' && item.id !== 'fleet' && currentScreen === item.screen);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    drawerStyles.navRow,
                    isActive && drawerStyles.navRowActive,
                  ]}
                  onPress={() => handleNav(item.screen, item.params)}
                  activeOpacity={0.8}
                >
                  {/* Left Active Accent Pill Bar */}
                  {isActive && <View style={drawerStyles.activeAccentBar} />}

                  <View style={drawerStyles.navIconWrap}>
                    <BootstrapIcon
                      name={isActive ? item.activeIcon : item.icon}
                      size={16}
                      color={isActive ? '#EA580C' : '#9CA3AF'}
                    />
                  </View>

                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        drawerStyles.navLabel,
                        isActive && drawerStyles.navLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>

                    {item.isAi && (
                      <View style={drawerStyles.aiBadge}>
                        <Text style={drawerStyles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── GROUP 2: ORDERS & SHOPPING ── */}
          <Text style={drawerStyles.sectionHeadingText}>
            ORDERS & SHOPPING
          </Text>

          <View style={drawerStyles.navGroup}>
            {ordersGroup.map((item) => {
              const isActive = currentScreen === item.id || (item.screen && currentScreen === item.screen && !item.params);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    drawerStyles.navRow,
                    isActive && drawerStyles.navRowActive,
                  ]}
                  onPress={() => handleNav(item.screen, item.params)}
                  activeOpacity={0.8}
                >
                  {/* Left Active Accent Pill Bar */}
                  {isActive && <View style={drawerStyles.activeAccentBar} />}

                  <View style={drawerStyles.navIconWrap}>
                    <BootstrapIcon
                      name={isActive ? item.activeIcon : item.icon}
                      size={16}
                      color={isActive ? '#EA580C' : '#9CA3AF'}
                    />
                  </View>

                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        drawerStyles.navLabel,
                        isActive && drawerStyles.navLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </View>

                  {/* Count Badges */}
                  {item.badge != null && (
                    <View
                      style={[
                        drawerStyles.badgePill,
                        (item.isCartBadge || item.isWarningBadge) && drawerStyles.badgePillAccent,
                      ]}
                    >
                      <Text style={drawerStyles.badgePillText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── GROUP 3: STORE ADMINISTRATION (IF ADMIN) ── */}
          {isUserAdmin && (
            <>
              <Text style={drawerStyles.sectionHeadingText}>
                ADMINISTRATION
              </Text>
              <View style={drawerStyles.navGroup}>
                <TouchableOpacity
                  style={[
                    drawerStyles.navRow,
                    currentScreen === 'admin' && drawerStyles.navRowActive,
                  ]}
                  onPress={() => handleNav('admin')}
                  activeOpacity={0.8}
                >
                  {currentScreen === 'admin' && <View style={drawerStyles.activeAccentBar} />}
                  <View style={drawerStyles.navIconWrap}>
                    <BootstrapIcon
                      name="shield-lock-fill"
                      size={16}
                      color="#EA580C"
                    />
                  </View>
                  <Text
                    style={[
                      drawerStyles.navLabel,
                      { color: '#FFFFFF', fontWeight: '600' },
                    ]}
                  >
                    Store Admin Console
                  </Text>
                  <View style={drawerStyles.adminBadge}>
                    <Text style={drawerStyles.adminBadgeText}>ADMIN</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ─── 3. USER PROFILE & ACCOUNT MANAGEMENT (ACCESSIBLE IN SIDEBAR) ─── */}
          <Text style={drawerStyles.sectionHeadingText}>
            ACCOUNT & PROFILE
          </Text>

          {currentUser ? (
            /* Logged In User Identity Card (Exact styling of AdminSidebar) */
            <View style={drawerStyles.profileContainer}>
              <TouchableOpacity
                style={drawerStyles.profileHeaderRow}
                onPress={() => handleNav('profile', { tab: 'profile' })}
                activeOpacity={0.85}
              >
                <View style={drawerStyles.avatarWrap}>
                  {userAvatarUri && !avatarLoadError ? (
                    <Image
                      source={{ uri: userAvatarUri }}
                      onError={() => setAvatarLoadError(true)}
                      style={drawerStyles.avatarImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={drawerStyles.profileName} numberOfLines={1}>
                    {currentUser.name || currentUser.firstName || 'MotoTrack Rider'}
                  </Text>
                  <Text style={drawerStyles.profileEmail} numberOfLines={1}>
                    {currentUser.email || 'Customer Account'}
                  </Text>
                </View>

                <View
                  style={[
                    drawerStyles.roleBadge,
                    isUserAdmin && { backgroundColor: 'rgba(234, 88, 12, 0.25)', borderColor: 'rgba(234, 88, 12, 0.45)' },
                  ]}
                >
                  <Text
                    style={[
                      drawerStyles.roleBadgeText,
                      isUserAdmin && { color: '#EA580C' },
                    ]}
                  >
                    {isUserAdmin ? 'Admin' : 'Rider'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Profile Dropdown Actions (Now readily accessible right inside mobile drawer) */}
              <View style={drawerStyles.profileActionsList}>
                <TouchableOpacity
                  style={drawerStyles.subActionRow}
                  onPress={() => handleNav('profile', { tab: 'profile' })}
                  activeOpacity={0.75}
                >
                  <BootstrapIcon name="person-circle" size={15} color="#9CA3AF" />
                  <Text style={drawerStyles.subActionLabel}>My Profile & Garage</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={drawerStyles.subActionRow}
                  onPress={() => handleNav('profile', { tab: 'settings' })}
                  activeOpacity={0.75}
                >
                  <BootstrapIcon name="gear" size={15} color="#9CA3AF" />
                  <Text style={drawerStyles.subActionLabel}>Account Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={drawerStyles.subActionRow}
                  onPress={toggleDarkMode}
                  activeOpacity={0.75}
                >
                  <BootstrapIcon
                    name={isDarkMode ? 'sun-fill' : 'moon-fill'}
                    size={15}
                    color={isDarkMode ? '#F59E0B' : '#9CA3AF'}
                  />
                  <Text style={drawerStyles.subActionLabel}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                  <View
                    style={[
                      drawerStyles.toggleSwitchTrack,
                      { backgroundColor: isDarkMode ? '#EA580C' : 'rgba(255, 255, 255, 0.2)' },
                    ]}
                  >
                    <View
                      style={[
                        drawerStyles.toggleSwitchThumb,
                        isDarkMode ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[drawerStyles.subActionRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)', paddingTop: 10 }]}
                  onPress={handleLogout}
                  activeOpacity={0.75}
                >
                  <BootstrapIcon name="box-arrow-right" size={15} color="#EF4444" />
                  <Text style={[drawerStyles.subActionLabel, { color: '#EF4444', fontWeight: '600' }]}>
                    Sign Out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Unauthenticated State */
            <View style={{ gap: 8, paddingHorizontal: 2, marginBottom: 12 }}>
              <TouchableOpacity
                style={drawerStyles.signInBtn}
                onPress={handleSignIn}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="person-fill" size={15} color="#FFFFFF" />
                <Text style={drawerStyles.signInBtnText}>Sign In to Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={drawerStyles.signUpBtn}
                onPress={handleCreateAccount}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="plus-circle" size={14} color="#CBD5E1" />
                <Text style={drawerStyles.signUpBtnText}>Create New Account</Text>
              </TouchableOpacity>

              {/* Theme Toggle for Guest */}
              <TouchableOpacity
                style={drawerStyles.guestThemeToggleRow}
                onPress={toggleDarkMode}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BootstrapIcon
                    name={isDarkMode ? 'sun-fill' : 'moon-fill'}
                    size={15}
                    color={isDarkMode ? '#F59E0B' : '#9CA3AF'}
                  />
                  <Text style={drawerStyles.subActionLabel}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                </View>
                <View
                  style={[
                    drawerStyles.toggleSwitchTrack,
                    { backgroundColor: isDarkMode ? '#EA580C' : 'rgba(255, 255, 255, 0.2)' },
                  ]}
                >
                  <View
                    style={[
                      drawerStyles.toggleSwitchThumb,
                      isDarkMode ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── 4. HOTLINE & SUPPORT CONTACT (MATCHING ADMIN SIDEBAR) ─── */}
          <View style={drawerStyles.supportCard}>
            <TouchableOpacity
              style={drawerStyles.supportCol}
              onPress={handleCallPhone}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="telephone-fill" size={13} color="#9CA3AF" />
              <View style={{ flex: 1 }}>
                <Text style={drawerStyles.supportSubLabel}>HOTLINE</Text>
                <Text style={drawerStyles.supportValue}>
                  {brandSettings?.contactPhone || '0987654321'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={drawerStyles.supportDivider} />

            <TouchableOpacity
              style={drawerStyles.supportCol}
              onPress={handleSendEmail}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="envelope-fill" size={13} color="#9CA3AF" />
              <View style={{ flex: 1 }}>
                <Text style={drawerStyles.supportSubLabel}>SUPPORT</Text>
                <Text style={drawerStyles.supportValue} numberOfLines={1}>
                  {brandSettings?.contactEmail || 'MotoTrack@parts.com'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ─── 5. FOOTER COPYRIGHT ─── */}
          <View style={drawerStyles.footerWrap}>
            <Text style={drawerStyles.copyrightText}>
              © 2026 {brandSettings?.storeName || 'MotoTrack'}. All Rights Reserved.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          willChange: 'opacity',
        }
      : {}),
  },
  drawerContainer: {
    width: 290,
    maxWidth: '85%',
    height: '100%',
    zIndex: 100000,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    backgroundColor: '#24272B', // Exact charcoal matching AdminSidebar
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)',
    ...(Platform.OS === 'web'
      ? {
          willChange: 'transform',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }
      : {}),
  },
  drawerHeader: {
    backgroundColor: '#24272B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
    minHeight: 60,
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sectionHeadingText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#6B7280',
    marginTop: 14,
    marginBottom: 5,
    paddingHorizontal: 10,
    fontFamily: Platform.select({
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: undefined,
    }),
  },
  navGroup: {
    gap: 2.5,
    marginBottom: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    position: 'relative',
  },
  navRowActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.16)', // Warm dark charcoal with orange undertone
  },
  activeAccentBar: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#EA580C',
  },
  navIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    fontFamily: Platform.select({
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: undefined,
    }),
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiBadge: {
    marginLeft: 6,
    backgroundColor: '#EA580C',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillAccent: {
    backgroundColor: '#EA580C',
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  adminBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(234, 88, 12, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: '#EA580C',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  profileName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  profileEmail: {
    color: '#9CA3AF',
    fontSize: 10.5,
    marginTop: 1,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  profileActionsList: {
    paddingTop: 8,
    gap: 3,
  },
  subActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    cursor: 'pointer',
  },
  subActionLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#CBD5E1',
    flex: 1,
  },
  toggleSwitchTrack: {
    width: 34,
    height: 18,
    borderRadius: 9,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  guestThemeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    cursor: 'pointer',
  },
  signInBtn: {
    backgroundColor: '#EA580C',
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  signUpBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  signUpBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  supportCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  supportCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    minWidth: 0,
  },
  supportSubLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  supportValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 1,
  },
  supportDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerWrap: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
});
