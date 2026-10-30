import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { BootstrapIcon, BrandLogo, Skeleton } from '../common';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * MotoTrack Enterprise Admin Sidebar
 *
 * Retains MotoTrack's signature dark green (#EA580C) brand identity.
 * Features:
 * - Clean, compact visual hierarchy matching modern enterprise dashboards
 * - 6 distinct navigation groups (Operations, Store Management, Garage & Services, User Management, System & Settings, Quick Links)
 * - 38-40px menu-item heights with 8-10px rounded corners and 16-18px outline icons
 * - Darker green surface (#143124) with a slim emerald-green (#10B981) left accent for active state
 * - Subtle green-tinted hover & focus micro-interactions (150-180ms)
 * - Compact right-aligned count and warning badges (orange #EA580C for COD / Low Stock)
 * - Independent scroll area with anchored bottom footer (System Live & Synced + Profile Card)
 * - Desktop collapsible behavior (240px expanded / 68px collapsed) with icon tooltips
 * - Mobile slide-out drawer with backdrop overlay
 */
export default function AdminSidebar({
  isLoading = false,
  loading = false,
  isOffline = false,
  isLagging = false,
  activeNav,
  setActiveNav,
  isDarkMode = false,
  tokens = {},
  styles = {},
  onNavigateToStore,
  onOpenBrandModal,
  onOpenProfileModal,
  currentUser,
  orders = [],
  pendingCodCount = 0,
  invStats = { lowStockCount: 0 },
  posCart = [],
  products = [],
  suppliers = [],
  garageBookings = [],
  garageMechanics = [],
  deliveryRiders = [],
  auditLogs = [],
  newReportsCount = 0,
  onBackToStorefront,
  isCollapsed: externalCollapsed,
  setIsCollapsed: externalSetIsCollapsed,
  isMobile = false,
  isMobileOpen = false,
  onCloseMobile = () => { },
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = !isMobile && (externalCollapsed !== undefined ? externalCollapsed : internalCollapsed);
  const setIsCollapsed = externalSetIsCollapsed || setInternalCollapsed;

  const [isCollapseHovered, setIsCollapseHovered] = useState(false);
  const [isProfileHovered, setIsProfileHovered] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const auth = useAuth?.();
  const activeUser = currentUser || auth?.currentUser;
  const userAvatarUri = useMemo(() => {
    const raw =
      activeUser?.avatar ||
      activeUser?.photoUri ||
      activeUser?.profile_image ||
      activeUser?.avatar_url ||
      '';
    if (
      typeof raw === 'string' &&
      raw.trim().length > 0 &&
      !raw.includes('ui-avatars.com')
    ) {
      return raw.trim();
    }
    return null;
  }, [
    activeUser?.avatar,
    activeUser?.photoUri,
    activeUser?.profile_image,
    activeUser?.avatar_url,
  ]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [userAvatarUri]);

  // ─── Theme Colors: MotoTrack Charcoal (#24272B) + Racing Orange (#EA580C) ───
  const theme = useMemo(() => {
    return {
      bg: '#24272B', // Charcoal sidebar
      border: 'rgba(255, 255, 255, 0.10)',
      divider: 'rgba(255, 255, 255, 0.10)',
      activeBg: 'rgba(234, 88, 12, 0.16)', // Warm dark charcoal with orange undertone
      activeAccent: '#EA580C', // Deep racing orange accent
      activeIcon: '#EA580C', // Orange icon when active
      activeText: '#FFFFFF',
      textPrimary: '#FFFFFF',
      textSecondary: '#FFFFFF', // White icons and text for inactive navigation items
      sectionLabel: '#9CA3AF', // Muted section label
      hoverBg: 'rgba(255, 255, 255, 0.08)',
      profileBg: 'rgba(255, 255, 255, 0.08)',
      profileHoverBg: 'rgba(255, 255, 255, 0.14)',
      profileBorder: 'rgba(255, 255, 255, 0.12)',
      badgeBg: 'rgba(255, 255, 255, 0.14)',
      badgeActiveBg: 'rgba(255, 255, 255, 0.25)',
      badgeBorder: 'rgba(255, 255, 255, 0.20)',
      badgeText: '#FFFFFF',
      warningBg: '#EA580C',
      dangerBg: '#EF4444',
    };
  }, [isDarkMode]);

  // If skeleton loading is active, return skeleton after all hooks have safely executed
  if (isLoading || loading) {
    return (
      <AdminSidebarSkeleton
        isCollapsed={isCollapsed}
        isDarkMode={isDarkMode}
        isMobile={isMobile}
        isMobileOpen={isMobileOpen}
        onCloseMobile={onCloseMobile}
        isOffline={isOffline}
        isLagging={isLagging}
      />
    );
  }

  // ─── Cleanly Structured Navigation Groups ───
  const navGroups = [
    {
      id: 'operations',
      heading: 'OPERATIONS',
      items: [
        {
          id: 'overview',
          label: 'Dashboard',
          icon: 'grid-1x2',
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: 'receipt',
          needsAttention: pendingCodCount > 0 || orders.some((o) => o.status === 'Pending' || o.status === 'pending'),
          attentionTitle: pendingCodCount > 0 ? `${pendingCodCount} Pending COD Orders` : 'Orders need review',
        },
        {
          id: 'inventory',
          label: 'Inventory',
          icon: 'box-seam',
          needsAttention: (invStats?.lowStockCount || 0) > 0,
          attentionTitle: `${invStats?.lowStockCount || 0} Low Stock Products`,
        },
        {
          id: 'pos',
          label: 'POS Cashier',
          icon: 'cart-check',
          needsAttention: posCart.length > 0,
          attentionTitle: `${posCart.length} item(s) in register cart`,
        },
        {
          id: 'analytics',
          label: 'Reports',
          icon: 'graph-up-arrow',
        },
        {
          id: 'forecast',
          label: 'Forecast',
          icon: 'clipboard-data',
        },
        {
          id: 'moto_models',
          label: 'Moto Models',
          icon: 'bicycle',
        },
      ],
    },
    {
      id: 'store',
      heading: 'STORE MANAGEMENT',
      items: [
        {
          id: 'products',
          label: 'Products',
          icon: 'tag',
        },
        {
          id: 'promos',
          label: 'Promos',
          icon: 'ticket-perforated',
        },
        {
          id: 'suppliers',
          label: 'Supplier',
          icon: 'truck',
        },
      ],
    },
    {
      id: 'garage',
      heading: 'GARAGE & SERVICES',
      items: [
        {
          id: 'garage',
          label: 'Bookings',
          icon: 'tools',
          needsAttention: garageBookings.some((b) => b.status === 'pending' || b.status === 'Pending' || b.status === 'waiting'),
          attentionTitle: 'Pending service bookings',
        },
        {
          id: 'mechanics',
          label: 'Mechanics',
          icon: 'person-badge',
        },
        {
          id: 'riders',
          label: 'Riders',
          icon: 'bicycle',
        },
      ],
    },
    {
      id: 'users',
      heading: 'USER MANAGEMENT',
      items: [
        {
          id: 'users',
          label: 'Users',
          icon: 'people',
        },
        {
          id: 'ratings_reports',
          label: 'Ratings & reports',
          icon: 'star',
          needsAttention: newReportsCount > 0,
          attentionTitle: `${newReportsCount} new customer reports/reviews`,
        },
        {
          id: 'profile',
          label: 'Profile & Logs',
          icon: 'person-gear',
        },
      ],
    },
    {
      id: 'system',
      heading: 'SYSTEM & SETTINGS',
      items: [
        {
          id: 'supabase',
          label: 'Database',
          icon: 'database',
        },
        {
          id: 'audit',
          label: 'Activity Logs',
          icon: 'journal-text',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: 'gear',
        },
      ],
    },
    {
      id: 'quick',
      heading: 'QUICK LINKS',
      items: [
        {
          id: 'live_store',
          label: 'Live Storefront',
          icon: 'shop',
          isAction: true,
          onAction: onBackToStorefront,
          customColor: isDarkMode ? '#34D399' : '#6EE7B7',
        },
      ],
    },
  ];

  const adminInitial = (currentUser?.name || currentUser?.fullName || 'A').charAt(0).toUpperCase();

  // Navigation Item Click Handler
  const handleItemPress = (item) => {
    if (item.isAction) {
      item.onAction?.();
    } else {
      setActiveNav(item.id);
    }
    if (isMobile) {
      onCloseMobile?.();
    }
  };

  // ─── Inner Sidebar Content (Shared between Desktop & Mobile Drawer) ───
  const sidebarContent = (
    <View
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      {/* ─── 1. HEADER ROW ─── */}
      <View
        style={{
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          paddingBottom: 13,
          marginBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.divider,
        }}
      >
        {!isCollapsed ? (
          <>
            {/* Logo and Brand Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingLeft: 2 }}>
              <BrandLogo
                size={34}
                textSize={15.5}
                textColor="#FFFFFF"
                accentColor={isDarkMode ? '#34D399' : '#6EE7B7'}
              />
            </View>

            {/* Quick Actions: Collapse/Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>

              {isMobile ? (
                /* Mobile Close Drawer Button */
                <TouchableOpacity
                  onPress={onCloseMobile}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    backgroundColor: 'rgba(255, 255, 255, 0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.8}
                  title="Close Navigation Drawer"
                  aria-label="Close Navigation Drawer"
                >
                  <BootstrapIcon name="x-lg" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                /* Desktop Collapse Button */
                <TouchableOpacity
                  onPress={() => setIsCollapsed(true)}
                  onMouseEnter={() => setIsCollapseHovered(true)}
                  onMouseLeave={() => setIsCollapseHovered(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    backgroundColor: isCollapseHovered ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: isCollapseHovered ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transform: [{ scale: isCollapseHovered ? 1.05 : 1 }],
                    transition: 'all 180ms ease',
                  }}
                  activeOpacity={0.8}
                  title="Collapse Sidebar"
                  aria-label="Collapse Sidebar"
                >
                  <BootstrapIcon
                    name="chevron-bar-left"
                    size={14}
                    color={isCollapseHovered ? '#FFFFFF' : theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          /* Collapsed Header: Monogram / Expand Button */
          <TouchableOpacity
            onPress={() => setIsCollapsed(false)}
            onMouseEnter={() => setIsCollapseHovered(true)}
            onMouseLeave={() => setIsCollapseHovered(false)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: isCollapseHovered ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.10)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 180ms ease',
            }}
            activeOpacity={0.8}
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
          >
            <BootstrapIcon name="chevron-bar-right" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── 2. SCROLLABLE NAVIGATION AREA ─── */}
      <ScrollView
        style={{
          flex: 1,
          marginHorizontal: isCollapsed ? -4 : -8,
          paddingHorizontal: isCollapsed ? 4 : 8,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 14 }}
      >
        {navGroups.map((group, groupIdx) => (
          <View key={group.id} style={{ marginBottom: 10 }}>
            {/* Section Heading or Divider */}
            {!isCollapsed ? (
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                  color: theme.sectionLabel,
                  marginTop: groupIdx === 0 ? 3 : 13,
                  marginBottom: 5,
                  paddingHorizontal: 9,
                  fontFamily: Platform.select({
                    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    default: undefined,
                  }),
                }}
              >
                {group.heading}
              </Text>
            ) : groupIdx > 0 ? (
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.divider,
                  marginVertical: 7,
                  marginHorizontal: 6,
                }}
              />
            ) : null}

            {/* Nav Items List */}
            <View style={{ gap: 2.5 }}>
              {group.items.map((item) => {
                const isActive = activeNav === item.id;
                const hasAttention = Boolean(
                  item.needsAttention ||
                  (item.warningCount && item.warningCount > 0)
                );

                return (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    isActive={isActive}
                    isCollapsed={isCollapsed}
                    hasAttention={hasAttention}
                    theme={theme}
                    onPress={() => handleItemPress(item)}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ─── 3. ANCHORED STICKY FOOTER ─── */}
      <View
        style={{
          flexShrink: 0,
          paddingTop: 10,
          paddingBottom: 2,
          borderTopWidth: 1,
          borderTopColor: theme.divider,
          justifyContent: 'center',
        }}
      >
        {/* Administrator Profile Row */}
        <TouchableOpacity
          onPress={() => {
            if (onOpenProfileModal) {
              onOpenProfileModal();
            } else {
              setActiveNav('profile');
            }
            if (isMobile) {
              onCloseMobile?.();
            }
          }}
          onMouseEnter={() => setIsProfileHovered(true)}
          onMouseLeave={() => setIsProfileHovered(false)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: 10,
            minHeight: 40,
            paddingVertical: 6,
            paddingLeft: isCollapsed ? 0 : 4,
            paddingRight: 0,
            borderRadius: 8,
            backgroundColor: isProfileHovered ? theme.hoverBg : 'transparent',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
          }}
          activeOpacity={0.85}
          title={isCollapsed ? 'Administrator - System Manager' : 'View Administrator Profile Settings'}
          aria-label="View Administrator Profile Settings"
        >
          {/* Avatar Circle with User Profile Picture or Fallback Person Icon */}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255, 255, 255, 0.09)',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              borderWidth: userAvatarUri && !avatarLoadError ? 1.5 : 0,
              borderColor: 'rgba(255, 255, 255, 0.22)',
            }}
          >
            {userAvatarUri && !avatarLoadError ? (
              <Image
                source={{ uri: userAvatarUri }}
                onError={() => setAvatarLoadError(true)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                }}
                resizeMode="cover"
              />
            ) : (
              <BootstrapIcon
                name="person"
                size={16}
                color="#FFFFFF"
              />
            )}
          </View>

          {!isCollapsed && (
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: 12.5,
                  letterSpacing: 0.15,
                  lineHeight: 16,
                  fontFamily: Platform.select({
                    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    default: undefined,
                  }),
                }}
                numberOfLines={1}
              >
                Administrator
              </Text>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 10,
                  fontWeight: '500',
                  lineHeight: 13,
                  marginTop: 1,
                  fontFamily: Platform.select({
                    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    default: undefined,
                  }),
                }}
                numberOfLines={1}
              >
                System Manager
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── 4A. MOBILE DRAWER RENDERING (Slide-out Drawer with Backdrop) ───
  if (isMobile) {
    if (!isMobileOpen) return null;

    return (
      <View
        style={{
          position: Platform.OS === 'web' ? 'fixed' : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          flexDirection: 'row',
        }}
      >
        {/* Backdrop Overlay */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}),
          }}
          onPress={onCloseMobile}
          activeOpacity={1}
          accessibilityLabel="Close Navigation Drawer"
        />

        {/* Drawer Content Surface */}
        <View
          style={{
            width: 270,
            maxWidth: '85%',
            height: '100%',
            backgroundColor: theme.bg,
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
            paddingHorizontal: 12,
            paddingTop: 16,
            paddingBottom: 14,
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)',
          }}
          role="navigation"
          aria-label="Admin Navigation Drawer"
        >
          {sidebarContent}
        </View>
      </View>
    );
  }

  // ─── 4B. DESKTOP SIDEBAR RENDERING ───
  return (
    <View
      className="mototrack-sidebar"
      style={{
        width: isCollapsed ? 68 : 240,
        flexShrink: 0,
        backgroundColor: theme.bg,
        borderRightWidth: 1,
        borderRightColor: theme.border,
        paddingHorizontal: isCollapsed ? 8 : 12,
        paddingTop: 16,
        paddingBottom: 14,
        height: Platform.OS === 'web' ? '100vh' : '100%',
        maxHeight: Platform.OS === 'web' ? '100vh' : '100%',
        position: Platform.OS === 'web' ? 'sticky' : 'relative',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 100,
        transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1), padding 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      role="navigation"
      aria-label="Admin Navigation"
    >
      {sidebarContent}
    </View>
  );
}

/**
 * Individual reusable Navigation Item component with hover & active states.
 */
function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
  hasAttention,
  hasWarning,
  theme,
  onPress,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showAttentionDot = Boolean(hasAttention || hasWarning || item.needsAttention || (item.warningCount && item.warningCount > 0));

  return (
    <TouchableOpacity
      className={`mototrack-nav-item ${isActive ? 'mototrack-nav-item-active' : ''}`}
      onPress={onPress}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      activeOpacity={0.85}
      style={{
        minHeight: 40,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: isCollapsed ? 6 : 12,
        backgroundColor: isActive
          ? theme.activeBg
          : isHovered
            ? theme.hoverBg
            : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: isCollapsed ? 0 : 10,
        transition: 'all 180ms ease',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      title={isCollapsed ? item.label : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      {/* Active Left Curved Orange Accent Strip */}
      {isActive && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: '#EA580C',
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
          }}
        />
      )}

      {/* 16-18px Outline Icon with 2px shift on hover */}
      <View
        style={{
          width: isCollapsed ? '100%' : 20,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: !isActive && isHovered && !isCollapsed ? 2 : 0 }],
          transition: 'transform 180ms ease',
        }}
      >
        <BootstrapIcon
          name={item.icon}
          size={17}
          color={
            item.customColor
              ? item.customColor
              : isActive
                ? '#EA580C'
                : isHovered
                  ? '#FFFFFF'
                  : theme.textSecondary
          }
        />
      </View>

      {/* Item Label (Hidden when collapsed) */}
      {!isCollapsed && (
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: isActive ? '600' : '500',
            color: item.customColor
              ? item.customColor
              : isActive || isHovered
                ? '#FFFFFF'
                : theme.textSecondary,
            fontFamily: Platform.select({
              web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              default: undefined,
            }),
            transition: 'color 180ms ease',
            ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}),
          }}
        >
          {item.label}
        </Text>
      )}

      {/* Right side Attention Dot (Only shown if module needs attention, NO numbers) */}
      {!isCollapsed && showAttentionDot && (
        <View
          style={{
            marginLeft: 'auto',
            paddingRight: 4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={item.attentionTitle || item.warningTitle || 'Needs attention'}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#EA580C',
              boxShadow: '0 0 6px rgba(234, 88, 12, 0.65)',
            }}
          />
        </View>
      )}

      {/* Collapsed Attention Dot */}
      {isCollapsed && showAttentionDot && (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 10,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: '#EA580C',
            boxShadow: '0 0 5px rgba(234, 88, 12, 0.65)',
          }}
          title={item.attentionTitle || item.warningTitle || 'Needs attention'}
        />
      )}
    </TouchableOpacity>
  );
}

/**
 * Admin Sidebar Skeleton Loading Animation
 * Matches the exact visual hierarchy, spacing, badges, and brand green identity of MotoTrack Admin Sidebar.
 */
export function AdminSidebarSkeleton({
  isCollapsed = false,
  isDarkMode = false,
  isMobile = false,
  isMobileOpen = false,
  onCloseMobile = () => { },
  isOffline = false,
  isLagging = false,
  style,
}) {
  const theme = useMemo(() => {
    return {
      bg: '#24272B', // Charcoal
      border: 'rgba(255, 255, 255, 0.10)',
      divider: 'rgba(255, 255, 255, 0.10)',
      baseColor: 'rgba(255, 255, 255, 0.15)',
      highlightColor: 'rgba(255, 255, 255, 0.30)',
      activePill: '#EA580C',
      activeAccent: '#EA580C',
      badgeBg: 'rgba(255, 255, 255, 0.22)',
    };
  }, [isDarkMode]);

  // Section templates reflecting the exact UI hierarchy
  const skeletonSections = [
    {
      headingWidth: 74,
      items: [
        { titleWidth: 76, hasActiveBg: true }, // Dashboard (active)
        { titleWidth: 50, hasAttentionDot: true }, // Orders
        { titleWidth: 68 }, // Inventory
        { titleWidth: 76 }, // POS Cashier
        { titleWidth: 54 }, // Reports
        { titleWidth: 60 }, // Forecast
        { titleWidth: 80 }, // Moto Models
      ],
    },
    {
      headingWidth: 112,
      items: [
        { titleWidth: 64 }, // Products
        { titleWidth: 52 }, // Promos
        { titleWidth: 58 }, // Supplier
      ],
    },
    {
      headingWidth: 118,
      items: [
        { titleWidth: 66, hasAttentionDot: true }, // Bookings
        { titleWidth: 74 }, // Mechanics
      ],
    },
  ];

  const content = (
    <View
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      {/* ─── 1. HEADER ROW ─── */}
      <View
        style={{
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          paddingBottom: 13,
          marginBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.divider,
        }}
      >
        {!isCollapsed ? (
          <>
            {/* Brand Logo & Wordmark Skeleton */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 2 }}>
              <Skeleton
                width={34}
                height={34}
                borderRadius={8}
                baseColor={theme.baseColor}
                highlightColor={theme.highlightColor}
              />
              <Skeleton
                width={105}
                height={17}
                borderRadius={4}
                baseColor={theme.baseColor}
                highlightColor={theme.highlightColor}
              />
            </View>

            {/* Collapse Button Skeleton */}
            <Skeleton
              width={30}
              height={30}
              borderRadius={7}
              baseColor={theme.baseColor}
              highlightColor={theme.highlightColor}
            />
          </>
        ) : (
          <Skeleton
            width={36}
            height={36}
            borderRadius={8}
            baseColor={theme.baseColor}
            highlightColor={theme.highlightColor}
          />
        )}
      </View>

      {/* ─── 2. SCROLLABLE NAVIGATION ITEMS SKELETON ─── */}
      <ScrollView
        style={{
          flex: 1,
          marginHorizontal: isCollapsed ? -4 : -8,
          paddingHorizontal: isCollapsed ? 4 : 8,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 14 }}
      >
        {skeletonSections.map((section, sIdx) => (
          <View key={sIdx} style={{ marginBottom: 12 }}>
            {/* Section Heading or Divider */}
            {!isCollapsed ? (
              <View
                style={{
                  marginTop: sIdx === 0 ? 4 : 14,
                  marginBottom: 6,
                  paddingHorizontal: 9,
                }}
              >
                <Skeleton
                  width={section.headingWidth}
                  height={9}
                  borderRadius={3}
                  baseColor={theme.baseColor}
                  highlightColor={theme.highlightColor}
                />
              </View>
            ) : sIdx > 0 ? (
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.divider,
                  marginVertical: 7,
                  marginHorizontal: 6,
                }}
              />
            ) : null}

            {/* Nav Items List */}
            <View style={{ gap: 3 }}>
              {section.items.map((item, iIdx) => {
                if (isCollapsed) {
                  return (
                    <View
                      key={iIdx}
                      style={{
                        height: 38,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: item.hasActiveBg ? theme.activePill : 'transparent',
                      }}
                    >
                      <Skeleton
                        width={20}
                        height={20}
                        borderRadius={5}
                        baseColor={theme.baseColor}
                        highlightColor={theme.highlightColor}
                      />
                    </View>
                  );
                }

                return (
                  <View
                    key={iIdx}
                    style={{
                      height: 38,
                      borderRadius: 9,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 10,
                      backgroundColor: item.hasActiveBg
                        ? theme.activePill
                        : item.hasPillBg
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'transparent',
                      borderLeftWidth: item.hasActiveBg ? 3 : 0,
                      borderLeftColor: item.hasActiveBg ? theme.activeAccent : 'transparent',
                    }}
                  >
                    {/* Icon + Title */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
                      <Skeleton
                        width={18}
                        height={18}
                        borderRadius={4}
                        baseColor={theme.baseColor}
                        highlightColor={theme.highlightColor}
                      />
                      <Skeleton
                        width={item.titleWidth}
                        height={13}
                        borderRadius={4}
                        baseColor={theme.baseColor}
                        highlightColor={theme.highlightColor}
                      />
                    </View>

                    {/* Attention dot skeleton */}
                    {item.hasAttentionDot && (
                      <View style={{ marginLeft: 'auto', paddingRight: 4 }}>
                        <Skeleton
                          circle
                          size={8}
                          baseColor="rgba(234, 88, 12, 0.4)"
                          highlightColor="#EA580C"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>



      {/* ─── 3. ANCHORED STICKY FOOTER PROFILE ─── */}
      <View
        style={{
          flexShrink: 0,
          paddingTop: 10,
          paddingBottom: 2,
          borderTopWidth: 1,
          borderTopColor: theme.divider,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: 10,
            minHeight: 40,
            paddingVertical: 6,
            paddingLeft: isCollapsed ? 0 : 4,
            paddingRight: 0,
          }}
        >
          {/* Avatar Skeleton */}
          <Skeleton
            circle
            size={32}
            baseColor={theme.baseColor}
            highlightColor={theme.highlightColor}
          />

          {!isCollapsed && (
            <View style={{ flex: 1, gap: 5, justifyContent: 'center' }}>
              <Skeleton
                width={95}
                height={14}
                borderRadius={4}
                baseColor={theme.baseColor}
                highlightColor={theme.highlightColor}
              />
              <Skeleton
                width={86}
                height={11}
                borderRadius={3}
                baseColor={theme.baseColor}
                highlightColor={theme.highlightColor}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // Mobile Drawer Container
  if (isMobile) {
    if (!isMobileOpen) return null;

    return (
      <View
        style={{
          position: Platform.OS === 'web' ? 'fixed' : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          flexDirection: 'row',
        }}
      >
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}),
          }}
          onPress={onCloseMobile}
          activeOpacity={1}
          accessibilityLabel="Close Navigation Drawer"
        />
        <View
          style={[
            {
              width: 270,
              maxWidth: '85%',
              height: '100%',
              backgroundColor: theme.bg,
              zIndex: 100000,
              display: 'flex',
              flexDirection: 'column',
              paddingHorizontal: 12,
              paddingTop: 16,
              paddingBottom: 14,
              boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)',
            },
            style,
          ]}
          role="status"
          aria-label="Loading admin navigation drawer"
        >
          {content}
        </View>
      </View>
    );
  }

  // Desktop Container
  return (
    <View
      className="mototrack-sidebar mototrack-sidebar-skeleton"
      style={[
        {
          width: isCollapsed ? 68 : 240,
          flexShrink: 0,
          backgroundColor: theme.bg,
          borderRightWidth: 1,
          borderRightColor: theme.border,
          paddingHorizontal: isCollapsed ? 8 : 12,
          paddingTop: 16,
          paddingBottom: 14,
          height: Platform.OS === 'web' ? '100vh' : '100%',
          maxHeight: Platform.OS === 'web' ? '100vh' : '100%',
          position: Platform.OS === 'web' ? 'sticky' : 'relative',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 100,
          transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1), padding 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
        style,
      ]}
      role="status"
      aria-label="Loading admin navigation"
    >
      {content}
    </View>
  );
}

AdminSidebar.Skeleton = AdminSidebarSkeleton;
