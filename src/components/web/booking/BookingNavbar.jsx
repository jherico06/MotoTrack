// =========================================================================
// MotoTrack Minimalist Sticky Top Navigation Bar
// Logo, Core Links, Favorites, Notifications, Profile, Mobile Drawer
// =========================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from '../../common';

export default function BookingNavbar({
  activeNav = 'Book a Service',
  favoritesCount = 0,
  onOpenFavorites,
  onOpenNotifications,
  onOpenProfile,
  onNavigateToStore,
  onScrollToServices,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navLinks = [
    { key: 'Shop', label: 'Shop', isAction: false, onClick: () => onNavigateToStore?.() },
    { key: 'Book a Service', label: 'Book a Service', isAction: true, onClick: onScrollToServices },
    { key: 'Customize', label: 'Customize', isAction: false, onClick: () => onNavigateToStore?.('customizer') },
    { key: 'Garage', label: 'Garage', isAction: false, onClick: () => onNavigateToStore?.('garage') },
  ];

  return (
    <View style={navStyles.navWrapper}>
      <View style={navStyles.navInner}>
        {/* ─── LEFT: BRAND LOGO ─── */}
        <View style={navStyles.brandGroup}>
          <TouchableOpacity
            style={navStyles.logoWrap}
            onPress={onScrollToServices}
            activeOpacity={0.85}
          >
            <View style={navStyles.logoBadge}>
              <Text style={navStyles.logoLetter}>M</Text>
              <View style={navStyles.logoOrangeDot} />
            </View>
            <Text style={navStyles.logoText}>
              Moto<Text style={navStyles.logoSubText}>Track</Text>
            </Text>
          </TouchableOpacity>

          {/* Desktop Navigation Links */}
          <View style={navStyles.desktopLinks}>
            {navLinks.map((item) => {
              const isActive = item.key === activeNav;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[navStyles.navLinkBtn, isActive && navStyles.navLinkBtnActive]}
                  onPress={item.onClick}
                  activeOpacity={0.8}
                >
                  <Text style={[navStyles.navLinkText, isActive && navStyles.navLinkTextActive]}>
                    {item.label}
                  </Text>
                  {isActive && <View style={navStyles.activeDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── RIGHT: ACTIONS (FAVORITES, NOTIFICATIONS, PROFILE) ─── */}
        <View style={navStyles.actionsGroup}>
          {/* Favorites Button */}
          <TouchableOpacity
            style={navStyles.iconBtn}
            onPress={onOpenFavorites}
            activeOpacity={0.75}
            accessibilityLabel="Favorites"
          >
            <BootstrapIcon name="heart" size={15} color="#52525B" />
            {favoritesCount > 0 && (
              <View style={navStyles.badgeCount}>
                <Text style={navStyles.badgeCountText}>{favoritesCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Notifications Button */}
          <TouchableOpacity
            style={navStyles.iconBtn}
            onPress={onOpenNotifications}
            activeOpacity={0.75}
            accessibilityLabel="Notifications"
          >
            <BootstrapIcon name="bell" size={15} color="#52525B" />
            <View style={navStyles.unreadDot} />
          </TouchableOpacity>

          {/* Profile Hub / Avatar Button */}
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={navStyles.profileBtn}
              onPress={() => {
                if (onOpenProfile) onOpenProfile();
                else setProfileDropdownOpen(!profileDropdownOpen);
              }}
              activeOpacity={0.8}
            >
              <Text style={navStyles.profileBtnText}>Rider Hub</Text>
              <View style={navStyles.profileAvatar}>
                <BootstrapIcon name="person-fill" size={13} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {profileDropdownOpen && (
              <View style={navStyles.dropdownMenu}>
                <View style={navStyles.dropdownHeader}>
                  <Text style={navStyles.dropdownUserName}>Juan dela Cruz</Text>
                  <Text style={navStyles.dropdownUserSub}>Yamaha MT-09 SP Owner</Text>
                </View>
                <TouchableOpacity
                  style={navStyles.dropdownItem}
                  onPress={() => {
                    setProfileDropdownOpen(false);
                    onOpenFavorites?.();
                  }}
                >
                  <BootstrapIcon name="heart-fill" size={13} color="#EA580C" />
                  <Text style={navStyles.dropdownItemText}>Saved Packages ({favoritesCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={navStyles.dropdownItem}
                  onPress={() => {
                    setProfileDropdownOpen(false);
                    onOpenNotifications?.();
                  }}
                >
                  <BootstrapIcon name="bell-fill" size={13} color="#52525B" />
                  <Text style={navStyles.dropdownItemText}>Notifications & Updates</Text>
                </TouchableOpacity>
                <View style={navStyles.dropdownDivider} />
                <TouchableOpacity
                  style={navStyles.dropdownItem}
                  onPress={() => setProfileDropdownOpen(false)}
                >
                  <BootstrapIcon name="gear" size={13} color="#71717A" />
                  <Text style={[navStyles.dropdownItemText, { color: '#71717A' }]}>
                    Account Settings
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Mobile Hamburger Toggle */}
          <TouchableOpacity
            style={navStyles.mobileToggleBtn}
            onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
            activeOpacity={0.8}
            accessibilityLabel="Toggle Menu"
          >
            <BootstrapIcon
              name={mobileMenuOpen ? 'x-lg' : 'list'}
              size={18}
              color="#18181B"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── MOBILE SLIDE DRAWER ─── */}
      {mobileMenuOpen && (
        <View style={navStyles.mobileDrawer}>
          <View style={navStyles.mobileNavLinks}>
            {navLinks.map((item) => {
              const isActive = item.key === activeNav;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[navStyles.mobileNavItem, isActive && navStyles.mobileNavItemActive]}
                  onPress={() => {
                    setMobileMenuOpen(false);
                    item.onClick();
                  }}
                >
                  <Text style={[navStyles.mobileNavText, isActive && navStyles.mobileNavTextActive]}>
                    {item.label}
                  </Text>
                  {isActive && <BootstrapIcon name="chevron-right" size={13} color="#EA580C" />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={navStyles.mobileQuickActions}>
            <TouchableOpacity
              style={navStyles.mobileActionBtn}
              onPress={() => {
                setMobileMenuOpen(false);
                onOpenFavorites?.();
              }}
            >
              <BootstrapIcon name="heart" size={14} color="#52525B" />
              <Text style={navStyles.mobileActionText}>Favorites ({favoritesCount})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={navStyles.mobileActionBtn}
              onPress={() => {
                setMobileMenuOpen(false);
                onOpenNotifications?.();
              }}
            >
              <BootstrapIcon name="bell" size={14} color="#52525B" />
              <Text style={navStyles.mobileActionText}>Updates</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const navStyles = StyleSheet.create({
  navWrapper: {
    position: Platform.select({ web: 'sticky', default: 'relative' }),
    top: 0,
    zIndex: 100,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    width: '100%',
  },
  navInner: {
    maxWidth: 1280,
    marginHorizontal: 'auto',
    width: '100%',
    height: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E2227',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  logoOrangeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EA580C',
    marginLeft: 1,
    marginTop: 6,
  },
  logoText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.4,
  },
  logoSubText: {
    fontWeight: '400',
    color: '#71717A',
  },
  desktopLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...(Platform.OS === 'web' ? { '@media (max-width: 768px)': { display: 'none' } } : {}),
  },
  navLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    position: 'relative',
    cursor: 'pointer',
  },
  navLinkBtnActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
  },
  navLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#52525B',
  },
  navLinkTextActive: {
    fontWeight: '600',
    color: '#18181B',
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    left: '50%',
    marginLeft: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EA580C',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    position: 'relative',
    cursor: 'pointer',
  },
  badgeCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    cursor: 'pointer',
  },
  profileBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#18181B',
  },
  profileAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E2227',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 42,
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 200,
  },
  dropdownHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  dropdownUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  dropdownUserSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    cursor: 'pointer',
  },
  dropdownItemText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#27272A',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F4F4F5',
    marginVertical: 4,
  },
  mobileToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    cursor: 'pointer',
    ...(Platform.OS === 'web' ? { '@media (min-width: 769px)': { display: 'none' } } : {}),
  },
  mobileDrawer: {
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  mobileNavLinks: {
    gap: 4,
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  mobileNavItemActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  mobileNavText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#52525B',
  },
  mobileNavTextActive: {
    fontWeight: '600',
    color: '#EA580C',
  },
  mobileQuickActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
  },
  mobileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
  },
  mobileActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#27272A',
  },
});

