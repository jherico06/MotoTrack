import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import BrandLogo from '../../common/BrandLogo.jsx';
import { colors } from '../../../styles/theme.js';

export const RIDER_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'speedometer2',
    description: 'Overview of activities',
  },
  {
    id: 'deliveries',
    label: 'My Deliveries',
    icon: 'truck',
    description: 'Assigned orders & confirmation',
  },
  {
    id: 'history',
    label: 'Delivery History',
    icon: 'clock-history',
    description: 'Completed orders record',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'bell-fill',
    description: 'Assignments & announcements',
  },
  {
    id: 'account',
    label: 'Account',
    icon: 'person-circle',
    description: 'Profile & security',
  },
];

export default function RiderNavBar({
  activeTab = 'dashboard',
  onSelectTab,
  assignedCount = 0,
  unreadNotifsCount = 0,
  riderName = 'Rider',
  riderVehicle = '',
  riderAvatar = '',
  dutyStatus = 'Available',
  onToggleDuty,
  onLogout,
  isMobile = false,
  isTablet = false,
}) {
  const isAvailable = String(dutyStatus || '').toLowerCase() === 'available';

  // ─── MOBILE BOTTOM BAR ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <View style={styles.mobileBottomNav} accessibilityRole="navigation">
        {RIDER_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const badgeCount =
            item.id === 'deliveries'
              ? assignedCount
              : item.id === 'notifications'
                ? unreadNotifsCount
                : 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.mobileNavItem,
                isActive && styles.mobileNavItemActive,
              ]}
              onPress={() => onSelectTab?.(item.id)}
              activeOpacity={0.7}
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.mobileIconWrap}>
                <BootstrapIcon
                  name={item.icon}
                  size={19}
                  color={isActive ? colors.racingOrange : '#64748B'}
                />
                {badgeCount > 0 ? (
                  <View style={styles.mobileBadge}>
                    <Text style={styles.mobileBadgeText}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.mobileNavLabel,
                  isActive && styles.mobileNavLabelActive,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ─── DESKTOP & TABLET SIDEBAR ────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.sidebar,
        isTablet ? styles.sidebarTablet : styles.sidebarDesktop,
      ]}
      accessibilityRole="navigation"
    >
      {/* ─── BRAND HEADER ─── */}
      <View style={styles.sidebarHeader}>
        <View style={styles.brandRow}>
          <BrandLogo size={32} />
          {!isTablet && (
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.brandTitle}>MotoTrack</Text>
                <View style={styles.riderTag}>
                  <Text style={styles.riderTagText}>RIDER</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>Delivery Portal</Text>
            </View>
          )}
        </View>

        {/* DUTY STATUS PILL */}
        <TouchableOpacity
          style={[
            styles.dutyPill,
            isAvailable ? styles.dutyPillAvailable : styles.dutyPillOff,
            isTablet && { alignSelf: 'center', paddingHorizontal: 6 },
          ]}
          onPress={onToggleDuty}
          activeOpacity={0.8}
          accessibilityLabel={`Status: ${dutyStatus}. Click to toggle.`}
        >
          <View
            style={[
              styles.dutyDot,
              isAvailable ? styles.dutyDotAvailable : styles.dutyDotOff,
            ]}
          />
          {!isTablet && (
            <Text
              style={[
                styles.dutyText,
                isAvailable ? styles.dutyTextAvailable : styles.dutyTextOff,
              ]}
            >
              {isAvailable ? 'On Duty · Available' : 'Off Duty'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── NAVIGATION LINKS ─── */}
      <View style={styles.navSection}>
        <Text style={[styles.navSectionLabel, isTablet && { display: 'none' }]}>
          MAIN MENU
        </Text>
        <View style={styles.navGroup}>
          {RIDER_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const badgeCount =
              item.id === 'deliveries'
                ? assignedCount
                : item.id === 'notifications'
                  ? unreadNotifsCount
                  : 0;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  isActive && styles.navItemActive,
                  isTablet && styles.navItemTablet,
                ]}
                onPress={() => onSelectTab?.(item.id)}
                activeOpacity={0.8}
                accessibilityLabel={item.label}
                accessibilityState={{ selected: isActive }}
              >
                {/* Active Indicator Bar (Left) */}
                {isActive && !isTablet ? <View style={styles.activeBar} /> : null}

                <View
                  style={[
                    styles.navIconBox,
                    isActive && styles.navIconBoxActive,
                  ]}
                >
                  <BootstrapIcon
                    name={item.icon}
                    size={17}
                    color={isActive ? colors.racingOrange : '#94A3B8'}
                  />
                </View>

                {!isTablet && (
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[
                        styles.navLabel,
                        isActive && styles.navLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                )}

                {badgeCount > 0 ? (
                  <View
                    style={[
                      styles.countBadge,
                      isActive && styles.countBadgeActive,
                      isTablet && styles.countBadgeTablet,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        isActive && styles.countBadgeTextActive,
                      ]}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ─── FOOTER / RIDER PROFILE CARD ─── */}
      <View style={styles.sidebarFooter}>
        <TouchableOpacity
          style={[styles.profileCard, isTablet && styles.profileCardTablet]}
          onPress={() => onSelectTab?.('account')}
          activeOpacity={0.85}
          accessibilityLabel="Open Rider Account"
        >
          {riderAvatar ? (
            <Image source={{ uri: riderAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {String(riderName || 'R').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {!isTablet && (
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {riderName}
              </Text>
              <Text style={styles.profileVehicle} numberOfLines={1}>
                {riderVehicle || 'MotoTrack Courier'}
              </Text>
            </View>
          )}

          {!isTablet && onLogout ? (
            <TouchableOpacity
              onPress={onLogout}
              style={styles.logoutBtn}
              accessibilityLabel="Log out of rider account"
            >
              <BootstrapIcon name="box-arrow-right" size={15} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Desktop & Tablet Sidebar Styles ─────────────────────────────────────────
  sidebar: {
    backgroundColor: '#24272B', // MotoTrack Signature Charcoal
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 50,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        height: '100vh',
        userSelect: 'none',
      },
      default: {
        flex: 1,
      },
    }),
  },
  sidebarDesktop: {
    width: 256,
  },
  sidebarTablet: {
    width: 76,
    alignItems: 'center',
  },
  sidebarHeader: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    fontFamily: 'Inter',
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 1,
    fontFamily: 'Inter',
  },
  riderTag: {
    backgroundColor: 'rgba(234, 88, 12, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.45)',
  },
  riderTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EA580C', // Racing Orange
    letterSpacing: 0.6,
  },
  dutyPill: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  dutyPillAvailable: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  dutyPillOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  dutyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dutyDotAvailable: {
    backgroundColor: '#10B981',
  },
  dutyDotOff: {
    backgroundColor: '#94A3B8',
  },
  dutyText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Inter',
  },
  dutyTextAvailable: {
    color: '#34D399',
  },
  dutyTextOff: {
    color: '#94A3B8',
  },
  navSection: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  navSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  navGroup: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    position: 'relative',
    ...Platform.select({
      web: {
        transition: 'all 0.16s ease-in-out',
        cursor: 'pointer',
      },
    }),
  },
  navItemTablet: {
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.14)',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: '#EA580C', // Racing Orange Active Indicator
  },
  navIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#CBD5E1',
    fontFamily: 'Inter',
  },
  navLabelActive: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeActive: {
    backgroundColor: '#EA580C',
  },
  countBadgeTablet: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
    fontFamily: 'Inter',
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  sidebarFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    ...Platform.select({
      web: {
        transition: 'background-color 0.15s ease',
        cursor: 'pointer',
      },
    }),
  },
  profileCardTablet: {
    justifyContent: 'center',
    padding: 6,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#EA580C',
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EA580C',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  profileMeta: {
    flex: 1,
    marginLeft: 10,
  },
  profileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F1F5F9',
    fontFamily: 'Inter',
  },
  profileVehicle: {
    fontSize: 10,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 1,
    fontFamily: 'Inter',
  },
  logoutBtn: {
    padding: 6,
    borderRadius: 6,
    marginLeft: 6,
  },

  // ─── Mobile Bottom Navigation Bar Styles ─────────────────────────────────────
  mobileBottomNav: {
    backgroundColor: '#24272B', // MotoTrack Charcoal
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    zIndex: 999,
    ...Platform.select({
      web: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.18)',
      },
    }),
  },
  mobileNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  mobileNavItemActive: {
    // Subtle lift for active tab
  },
  mobileIconWrap: {
    position: 'relative',
    marginBottom: 3,
  },
  mobileNavLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    fontFamily: 'Inter',
  },
  mobileNavLabelActive: {
    fontWeight: '700',
    color: '#EA580C', // Racing Orange Active Tab
  },
  mobileBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EA580C',
    borderRadius: 999,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  mobileBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'Inter',
  },
});

