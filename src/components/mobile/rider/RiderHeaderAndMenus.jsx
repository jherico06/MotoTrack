import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  SafeAreaView,
  StyleSheet,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import { RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { stripEmojis } from '../../../services/notifications/notificationService.js';
import { ANDROID_TOP_INSET } from '../../../utils/safeArea.js';
import {
  RIDER_BRAND,
  riderFont,
  getInitials,
  formatOrderCode,
} from './riderTheme.js';

export function RiderAvatar({ uri, name, size = 38, palette }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri && !failed);
  const radius = Math.round(size / 2);

  return (
    <View
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: palette.bgAvatar,
          borderColor: palette.orangeBorder,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.avatarInitials,
            {
              color: palette.avatarText,
              fontSize: Math.max(12, Math.round(size * 0.36)),
            },
          ]}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}

export function RiderTopHeader({
  palette,
  activeTab = 'home',
  riderName,
  riderAvatar,
  unreadCount = 0,
  activeOrderCount = 0,
  searchQuery = '',
  onSearchChange,
  onCycleFilter,
  onPressLogo,
  onPressNotifications,
  onPressOrders,
  onPressScanQr,
  onPressProfile,
}) {
  const [settings, setSettings] = useState(() =>
    systemSettingsService.getSettings()
  );

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      if (updated) setSettings(updated);
    });
    return unsub;
  }, []);

  const storeName = (settings?.storeName || RIDER_BRAND.name).trim();
  const isHomeTab = activeTab === 'home';
  const headerBg = palette.isDark ? '#24272B' : '#F7F5F0';
  const headerBorder = palette.isDark ? '#1A1D20' : '#EDE9E0';
  const primaryTextColor = palette.isDark ? '#FFFFFF' : '#0F172A';
  const iconColor = palette.isDark ? '#FFFFFF' : '#0F172A';

  if (isHomeTab) {
    return (
      <View
        style={[
          styles.shopHeaderRoot,
          {
            backgroundColor: headerBg,
            borderBottomColor: headerBorder,
            ...(palette.isDark
              ? {}
              : {
                  shadowOpacity: 0.03,
                  elevation: 1,
                }),
          },
        ]}
      >
        <View style={styles.shopHeaderInner}>
          <View style={styles.shopHeaderWrapper}>
            <View style={styles.shopHeaderRow}>
              <TouchableOpacity
                style={styles.shopHeaderLeft}
                onPress={onPressProfile}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Open rider profile menu"
              >
                <View
                  style={[
                    styles.shopAvatarWrap,
                    !palette.isDark && {
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                    },
                  ]}
                >
                  <RiderAvatar
                    uri={riderAvatar}
                    name={riderName}
                    size={35}
                    palette={palette}
                  />
                </View>
                <View style={styles.shopUserGreetingWrap}>
                  <View style={styles.shopGreetingNameRow}>
                    <Text
                      style={[styles.shopUserName, { color: primaryTextColor }]}
                      numberOfLines={1}
                    >
                      {riderName || 'MotoTrack Rider'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.shopHeaderRight}>
                <TouchableOpacity
                  style={styles.shopHeaderIconBtn}
                  onPress={onPressNotifications}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadCount > 0
                      ? `Notifications, ${unreadCount} unread`
                      : 'Notifications'
                  }
                >
                  <BootstrapIcon name="bell" size={18} color={iconColor} />
                  {unreadCount > 0 ? (
                    <View
                      style={[
                        styles.shopBadgeDot,
                        {
                          backgroundColor: '#EF4444',
                          borderColor: headerBg,
                        },
                      ]}
                    >
                      <Text style={styles.shopBadgeDotText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {onPressScanQr ? (
                  <TouchableOpacity
                    style={styles.shopHeaderIconBtn}
                    onPress={onPressScanQr}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Scan QR code"
                  >
                    <BootstrapIcon
                      name="qr-code-scan"
                      size={18}
                      color={iconColor}
                    />
                  </TouchableOpacity>
                ) : null}

                {onPressOrders ? (
                  <TouchableOpacity
                    style={styles.shopHeaderIconBtn}
                    onPress={onPressOrders}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Active delivery orders"
                  >
                    <BootstrapIcon name="box-seam" size={18} color={iconColor} />
                    {activeOrderCount > 0 ? (
                      <View
                        style={[
                          styles.shopBadgeDot,
                          {
                            backgroundColor: '#EA580C',
                            borderColor: headerBg,
                          },
                        ]}
                      >
                        <Text style={styles.shopBadgeDotText}>
                          {activeOrderCount > 9 ? '9+' : activeOrderCount}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {typeof onSearchChange === 'function' ? (
            <View style={styles.shopSearchSection}>
              <View
                style={[
                  styles.shopSearchBarPill,
                  !palette.isDark && {
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                  },
                ]}
              >
                <BootstrapIcon
                  name="search"
                  size={15}
                  color={palette.isDark ? '#FFFFFF' : '#64748B'}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[
                    styles.shopSearchInput,
                    !palette.isDark && { color: '#0F172A' },
                  ]}
                  placeholder="Search orders, customer, or address..."
                  placeholderTextColor={
                    palette.isDark ? 'rgba(255, 255, 255, 0.45)' : '#94A3B8'
                  }
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    style={styles.shopFilterBtnInside}
                    onPress={() => onSearchChange('')}
                    activeOpacity={0.7}
                    accessibilityLabel="Clear search"
                  >
                    <BootstrapIcon
                      name="x-circle-fill"
                      size={15}
                      color={palette.isDark ? '#FFFFFF' : '#64748B'}
                    />
                  </TouchableOpacity>
                ) : null}
                {onCycleFilter ? (
                  <TouchableOpacity
                    style={styles.shopFilterBtnInside}
                    onPress={onCycleFilter}
                    activeOpacity={0.7}
                    accessibilityLabel="Cycle order filter"
                  >
                    <BootstrapIcon
                      name="sliders"
                      size={16}
                      color={palette.isDark ? '#FFFFFF' : '#475569'}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  const pageTitle =
    activeTab === 'orders'
      ? 'Orders'
      : activeTab === 'earnings'
        ? 'Earnings'
        : activeTab === 'settings'
          ? 'Settings'
          : 'Account';

  return (
    <View
      style={[
        styles.headerWrap,
        {
          backgroundColor: palette.bgHeader,
        },
      ]}
    >
      {/* Left: Customer-Style Eyebrow + Page Title */}
      <TouchableOpacity
        style={styles.brandBtn}
        onPress={onPressLogo}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${storeName} ${pageTitle}`}
      >
        <View style={styles.brandTextColumn}>
          <Text style={[styles.headerEyebrow, { color: palette.orange }]}>
            {storeName.toUpperCase()} RIDER
          </Text>
          <Text
            style={[
              styles.headerPageTitle,
              { color: palette.headerText || palette.textPrimary },
            ]}
            numberOfLines={1}
          >
            {pageTitle}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[
            styles.notifBtn,
            {
              backgroundColor: palette.headerBtnBg,
              borderColor: palette.headerBtnBorder,
            },
          ]}
          onPress={onPressNotifications}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <BootstrapIcon
            name="bell"
            size={18}
            color={palette.headerBtnIcon || palette.textPrimary}
          />
          {unreadCount > 0 ? (
            <View
              style={[
                styles.unreadDot,
                {
                  backgroundColor: palette.orange,
                  borderColor: palette.headerBtnBg,
                },
              ]}
            />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPressProfile}
          activeOpacity={0.8}
          style={[
            styles.avatarTouch,
            {
              backgroundColor: palette.headerBtnBg,
              borderColor: palette.headerBtnBorder,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open rider profile menu"
        >
          <RiderAvatar
            uri={riderAvatar}
            name={riderName}
            size={36}
            palette={palette}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function RiderProfileMenuModal({
  visible,
  onClose,
  palette,
  riderName,
  riderId,
  riderAvatar,
  availabilityStatus,
  onCycleAvailability,
  onNavigateAccountTab,
  onNavigateMainTab,
  onLogout,
}) {
  const statusLower = String(availabilityStatus || 'Available').toLowerCase();
  const isAvailable = statusLower === 'available';
  const isOnDelivery = statusLower.includes('delivery');

  const statusDotColor = isAvailable
    ? '#16A34A'
    : isOnDelivery
      ? palette.orange
      : palette.textSubtle;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.menuBackdrop, { backgroundColor: palette.scrim }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.menuCard,
            {
              backgroundColor: palette.bgCard,
              borderColor: palette.border,
            },
          ]}
        >
          {/* Rider Summary */}
          <View style={styles.menuProfileHead}>
            <RiderAvatar
              uri={riderAvatar}
              name={riderName}
              size={46}
              palette={palette}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.menuNameRow}>
                <Text
                  style={[styles.menuRiderName, { color: palette.textPrimary }]}
                  numberOfLines={1}
                >
                  {riderName || 'MotoTrack Rider'}
                </Text>
                <BootstrapIcon
                  name="patch-check-fill"
                  size={14}
                  color={palette.orange}
                />
              </View>
              <Text style={[styles.menuRiderId, { color: palette.textMuted }]}>
                ID: {riderId ? String(riderId).toUpperCase() : 'RDR-UNLINKED'}
              </Text>
            </View>
          </View>

          {/* Quick Availability Switch */}
          <TouchableOpacity
            style={[
              styles.menuDutyRow,
              {
                backgroundColor: palette.bgMuted,
                borderColor: palette.border,
              },
            ]}
            onPress={onCycleAvailability}
            activeOpacity={0.8}
          >
            <View style={styles.menuDutyLeft}>
              <View
                style={[styles.statusDot, { backgroundColor: statusDotColor }]}
              />
              <Text
                style={[styles.menuDutyLabel, { color: palette.textPrimary }]}
              >
                {availabilityStatus || RIDER_STATUSES.AVAILABLE}
              </Text>
            </View>
            <Text style={[styles.menuDutyAction, { color: palette.orange }]}>
              Switch
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.menuDivider, { backgroundColor: palette.border }]}
          />

          {/* Menu Items */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onNavigateAccountTab('profile');
            }}
            activeOpacity={0.75}
          >
            <BootstrapIcon
              name="person"
              size={16}
              color={palette.textSecondary}
            />
            <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>
              Personal information
            </Text>
            <BootstrapIcon
              name="chevron-right"
              size={14}
              color={palette.textSubtle}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onNavigateMainTab('orders');
            }}
            activeOpacity={0.75}
          >
            <BootstrapIcon
              name="receipt"
              size={16}
              color={palette.textSecondary}
            />
            <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>
              My delivery orders
            </Text>
            <BootstrapIcon
              name="chevron-right"
              size={14}
              color={palette.textSubtle}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onNavigateMainTab('settings');
            }}
            activeOpacity={0.75}
          >
            <BootstrapIcon
              name="gear"
              size={16}
              color={palette.textSecondary}
            />
            <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>
              Settings &amp; preferences
            </Text>
            <BootstrapIcon
              name="chevron-right"
              size={14}
              color={palette.textSubtle}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onNavigateAccountTab('security');
            }}
            activeOpacity={0.75}
          >
            <BootstrapIcon
              name="shield-check"
              size={16}
              color={palette.textSecondary}
            />
            <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>
              Security & help center
            </Text>
            <BootstrapIcon
              name="chevron-right"
              size={14}
              color={palette.textSubtle}
            />
          </TouchableOpacity>

          <View
            style={[styles.menuDivider, { backgroundColor: palette.border }]}
          />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onLogout?.();
            }}
            activeOpacity={0.75}
          >
            <BootstrapIcon
              name="box-arrow-right"
              size={16}
              color={palette.danger}
            />
            <Text style={[styles.menuItemText, { color: palette.danger }]}>
              Sign out
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function parseRiderNotifDate(notif) {
  const raw =
    notif?.timestamp || notif?.created_at || notif?.createdAt || notif?.date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRiderRelativeTime(notif) {
  const date = parseRiderNotifDate(notif);
  if (!date) return String(notif?.timeLabel || 'Recent');
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRiderFullDate(notif) {
  const date = parseRiderNotifDate(notif);
  if (!date) return String(notif?.timeLabel || 'Today');
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function getRiderNotifCategoryConfig(notif) {
  const combined = `${notif?.type || ''} ${notif?.category || ''} ${
    notif?.rawStatus || ''
  } ${notif?.title || ''}`.toLowerCase();

  if (combined.includes('deliver') || combined.includes('complete')) {
    return {
      icon: 'check-circle-fill',
      color: '#059669',
      bg: '#ECFDF5',
      label: 'Delivered',
    };
  }
  if (
    combined.includes('cancel') ||
    combined.includes('fail') ||
    combined.includes('issue') ||
    combined.includes('alert')
  ) {
    return {
      icon: 'exclamation-circle',
      color: '#DC2626',
      bg: '#FEF2F2',
      label: 'Alert',
    };
  }
  if (
    combined.includes('out') ||
    combined.includes('transit') ||
    combined.includes('drop-off') ||
    combined.includes('shipped')
  ) {
    return {
      icon: 'truck',
      color: '#2563EB',
      bg: '#EFF6FF',
      label: 'In Transit',
    };
  }
  if (
    combined.includes('pickup') ||
    combined.includes('assign') ||
    combined.includes('ready') ||
    combined.includes('confirm')
  ) {
    return {
      icon: 'box-seam',
      color: '#D97706',
      bg: '#FDF4E7',
      label: 'Needs Pickup',
    };
  }
  if (
    combined.includes('earn') ||
    combined.includes('payout') ||
    combined.includes('remit') ||
    combined.includes('wallet')
  ) {
    return {
      icon: 'wallet2',
      color: '#059669',
      bg: '#ECFDF5',
      label: 'Earnings',
    };
  }
  if (combined.includes('system') || combined.includes('account')) {
    return {
      icon: 'shield-check',
      color: '#0D9488',
      bg: '#F0FDFA',
      label: 'System',
    };
  }
  return {
    icon: 'bell',
    color: '#EA580C',
    bg: '#FFF7ED',
    label: 'Order Update',
  };
}

function matchesRiderNotifFilter(notif, filter) {
  if (filter === 'all') return true;
  if (filter === 'unread') return Boolean(notif?.unread);

  const combined = `${notif?.type || ''} ${notif?.category || ''} ${
    notif?.rawStatus || ''
  } ${notif?.title || ''}`.toLowerCase();

  const isTransit =
    combined.includes('out') ||
    combined.includes('transit') ||
    combined.includes('drop-off') ||
    combined.includes('shipped');
  if (filter === 'transit') return isTransit;

  const isPickup =
    combined.includes('pickup') ||
    combined.includes('assign') ||
    combined.includes('ready') ||
    combined.includes('confirm');
  if (filter === 'pickup') return isPickup;

  return (
    (!isTransit && !isPickup) ||
    combined.includes('deliver') ||
    combined.includes('earn') ||
    combined.includes('payout') ||
    combined.includes('system') ||
    combined.includes('issue') ||
    combined.includes('cancel')
  );
}

function groupRiderNotifsByTime(list) {
  const now = new Date();
  const thisWeek = [];
  const thisMonth = [];
  const earlier = [];

  list.forEach((n) => {
    const date = parseRiderNotifDate(n);
    if (!date) {
      const label = String(n?.timeLabel || '').toLowerCase();
      if (n?.isDispatch || label === 'today' || label === 'recent') {
        thisWeek.push(n);
      } else {
        earlier.push(n);
      }
      return;
    }
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      thisWeek.push(n);
    } else if (diffDays < 30) {
      thisMonth.push(n);
    } else {
      earlier.push(n);
    }
  });

  const sections = [];
  if (thisWeek.length > 0) sections.push({ title: 'THIS WEEK', data: thisWeek });
  if (thisMonth.length > 0)
    sections.push({ title: 'THIS MONTH', data: thisMonth });
  if (earlier.length > 0) sections.push({ title: 'EARLIER', data: earlier });
  if (sections.length === 0 && list.length > 0) {
    sections.push({ title: 'ALL NOTIFICATIONS', data: list });
  }
  return sections;
}

/**
 * Full-screen Rider Notifications modal matching the customer Notifications
 * screen aesthetic, search/filter controls, time grouping, and expandable cards.
 */
export function RiderNotificationsModal({
  visible,
  onClose,
  palette,
  isDark,
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onSelectOrderFromNotif,
  onViewOrders,
}) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState({});

  const resolvedDark =
    typeof isDark === 'boolean'
      ? isDark
      : Boolean(palette?.bg === '#121518' || palette?.bgCanvas === '#121518');

  const theme = useMemo(
    () =>
      resolvedDark
        ? {
            bg: '#121518',
            headerBorder: '#2B3035',
            backBg: '#1E2124',
            backBorder: '#363C44',
            title: '#FFFFFF',
            readAllBg: '#1E2124',
            readAllBorder: '#363C44',
            searchBg: '#23272B',
            searchBorder: '#2B3035',
            searchText: '#FFFFFF',
            chipActiveBg: '#EA580C',
            chipActiveBorder: '#EA580C',
            chipActiveText: '#FFFFFF',
            chipBg: '#23272B',
            chipBorder: '#2B3035',
            chipText: '#94A3B8',
            sectionTitle: '#9CA3AF',
            badgeBg: '#252A30',
            badgeText: '#D1D5DB',
            cardBg: '#1C1F23',
            cardUnreadBg: '#20242B',
            cardBorder: '#2B3035',
            cardUnreadBorder: '#EA580C',
            unreadDot: '#EA580C',
            divider: '#2B3035',
            textPrimary: '#FFFFFF',
            textSecondary: '#D1D5DB',
            textMuted: '#9CA3AF',
            actionBtnBg: 'rgba(234,88,12,0.18)',
            emptyIconBg: '#252A30',
          }
        : {
            bg: '#F7F5F0',
            headerBorder: '#EDE9E0',
            backBg: '#FFFFFF',
            backBorder: '#E2E8F0',
            title: '#0F172A',
            readAllBg: '#FFF7ED',
            readAllBorder: '#FED7AA',
            searchBg: '#FFFFFF',
            searchBorder: '#EDE9E0',
            searchText: '#0F172A',
            chipActiveBg: '#18181B',
            chipActiveBorder: '#18181B',
            chipActiveText: '#FFFFFF',
            chipBg: '#F1F5F9',
            chipBorder: '#E2E8F0',
            chipText: '#475569',
            sectionTitle: '#71717A',
            badgeBg: '#E4E4E7',
            badgeText: '#3F3F46',
            cardBg: '#FFFFFF',
            cardUnreadBg: '#FFFFFF',
            cardBorder: '#E4E4E7',
            cardUnreadBorder: '#CBD5E1',
            unreadDot: '#18181B',
            divider: '#F1F5F9',
            textPrimary: '#18181B',
            textSecondary: '#3F3F46',
            textMuted: '#71717A',
            actionBtnBg: '#FFF7ED',
            emptyIconBg: '#F1F5F9',
          },
    [resolvedDark]
  );

  const filterChips = useMemo(
    () => [
      { key: 'all', label: `All (${notifications.length})` },
      { key: 'unread', label: `Unread (${unreadCount})` },
      { key: 'transit', label: 'In Transit' },
      { key: 'pickup', label: 'Pickup' },
      { key: 'updates', label: 'Updates' },
    ],
    [notifications.length, unreadCount]
  );

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((n) => {
      if (!matchesRiderNotifFilter(n, filter)) return false;
      if (!q) return true;
      const titleMatch = stripEmojis(n?.title || '')
        .toLowerCase()
        .includes(q);
      const msgMatch = stripEmojis(n?.message || '')
        .toLowerCase()
        .includes(q);
      const orderMatch = formatOrderCode(n?.orderId || '')
        .toLowerCase()
        .includes(q);
      return titleMatch || msgMatch || orderMatch;
    });
  }, [notifications, filter, searchQuery]);

  const groupedSections = useMemo(
    () => groupRiderNotifsByTime(filteredList),
    [filteredList]
  );

  const toggleExpand = (notif) => {
    const id = String(notif?.id || '');
    if (!id) return;
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    if (notif?.unread) {
      onMarkRead?.(notif);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.notifSafeArea,
          { backgroundColor: theme.bg, paddingTop: ANDROID_TOP_INSET },
        ]}
      >
        <StatusBar
          style={resolvedDark ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />

        {/* Header */}
        <View
          style={[
            styles.notifScreenHeader,
            { borderBottomColor: theme.headerBorder },
          ]}
        >
          <View style={styles.notifHeaderLeftRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.notifBackBtn,
                {
                  backgroundColor: theme.backBg,
                  borderColor: theme.backBorder,
                },
              ]}
              activeOpacity={0.7}
            >
              <BootstrapIcon
                name="chevron-left"
                size={16}
                color={theme.title}
              />
            </TouchableOpacity>
            <Text style={[styles.notifHeaderTitle, { color: theme.title }]}>
              Notifications
            </Text>
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={onMarkAllRead}
              style={[
                styles.notifReadAllBtn,
                {
                  backgroundColor: theme.readAllBg,
                  borderColor: theme.readAllBorder,
                },
              ]}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="check2-all" size={13} color="#EA580C" />
              <Text style={styles.notifReadAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Search Bar */}
        <View style={styles.notifSearchWrapper}>
          <View
            style={[
              styles.notifSearchBox,
              {
                backgroundColor: theme.searchBg,
                borderColor: theme.searchBorder,
              },
            ]}
          >
            <BootstrapIcon name="search" size={14} color="#94A3B8" />
            <TextInput
              style={[styles.notifSearchInput, { color: theme.searchText }]}
              placeholder="Search notifications..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BootstrapIcon name="x-circle-fill" size={15} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Chips */}
        <View
          style={[
            styles.notifFilterRow,
            { borderBottomColor: theme.headerBorder },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.notifFilterScroll}
          >
            {filterChips.map((chip) => {
              const active = filter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  onPress={() => setFilter(chip.key)}
                  style={[
                    styles.notifFilterChip,
                    {
                      backgroundColor: active
                        ? theme.chipActiveBg
                        : theme.chipBg,
                      borderColor: active
                        ? theme.chipActiveBorder
                        : theme.chipBorder,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.notifFilterChipText,
                      active
                        ? styles.notifFilterChipTextActive
                        : { color: theme.chipText },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Notifications List */}
        <ScrollView
          style={styles.notifScroll}
          contentContainerStyle={styles.notifScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {groupedSections.length === 0 ? (
            <View
              style={[
                styles.notifEmptyContainer,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.notifEmptyIconWrap,
                  { backgroundColor: theme.emptyIconBg },
                ]}
              >
                <BootstrapIcon name="bell-slash" size={24} color="#94A3B8" />
              </View>
              <Text
                style={[styles.notifEmptyTitle, { color: theme.textPrimary }]}
              >
                No notifications
              </Text>
              <Text
                style={[styles.notifEmptySubtitle, { color: theme.textMuted }]}
              >
                {searchQuery.trim()
                  ? `No notifications matching "${searchQuery.trim()}". Try another keyword.`
                  : filter !== 'all'
                  ? `No ${filter} notifications right now.`
                  : "You're all caught up! New delivery assignments, route alerts, and payout confirmations will appear here."}
              </Text>
              {filter === 'all' && !searchQuery.trim() && onViewOrders ? (
                <TouchableOpacity
                  onPress={onViewOrders}
                  style={styles.notifEmptyActionBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.notifEmptyActionText}>View Orders</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            groupedSections.map((section) => (
              <View key={section.title} style={styles.notifSectionGroup}>
                <View style={styles.notifSectionHeader}>
                  <Text
                    style={[
                      styles.notifSectionTitle,
                      { color: theme.sectionTitle },
                    ]}
                  >
                    {section.title}
                  </Text>
                  <View
                    style={[
                      styles.notifSectionBadge,
                      { backgroundColor: theme.badgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.notifSectionBadgeText,
                        { color: theme.badgeText },
                      ]}
                    >
                      {section.data.length}
                    </Text>
                  </View>
                </View>

                {section.data.map((item) => {
                  const id = String(item.id);
                  const isUnread = Boolean(item.unread);
                  const isExpanded = Boolean(expandedIds[id]);
                  const config = getRiderNotifCategoryConfig(item);
                  const cleanTitle = stripEmojis(
                    item.title || 'MotoTrack Update'
                  );
                  const cleanMsg = stripEmojis(item.message || '');
                  const orderTag = item.orderId
                    ? formatOrderCode(item.orderId)
                    : '';

                  return (
                    <View
                      key={id}
                      style={[
                        styles.notifCard,
                        {
                          backgroundColor: isUnread
                            ? theme.cardUnreadBg
                            : theme.cardBg,
                          borderColor: isUnread
                            ? theme.cardUnreadBorder
                            : theme.cardBorder,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => toggleExpand(item)}
                        style={styles.notifCardHeader}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.notifIconCircle,
                            {
                              backgroundColor: resolvedDark
                                ? `${config.color}24`
                                : config.bg,
                            },
                          ]}
                        >
                          <BootstrapIcon
                            name={config.icon}
                            size={16}
                            color={config.color}
                          />
                        </View>

                        <View style={styles.notifCardTitleArea}>
                          <View style={styles.notifTitleLine}>
                            <Text
                              style={[
                                styles.notifCardTitle,
                                isUnread
                                  ? styles.notifCardTitleUnread
                                  : styles.notifCardTitleRead,
                                { color: theme.textPrimary },
                              ]}
                              numberOfLines={isExpanded ? undefined : 1}
                            >
                              {cleanTitle}
                            </Text>
                            {isUnread ? (
                              <View
                                style={[
                                  styles.notifUnreadDot,
                                  { backgroundColor: theme.unreadDot },
                                ]}
                              />
                            ) : null}
                          </View>

                          {!isExpanded ? (
                            <Text
                              style={[
                                styles.notifPreviewMsg,
                                { color: theme.textMuted },
                              ]}
                              numberOfLines={1}
                            >
                              {cleanMsg ||
                                (orderTag
                                  ? `Order ${orderTag}`
                                  : config.label)}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.notifRightMeta}>
                          <Text
                            style={[
                              styles.notifTimeText,
                              { color: theme.textMuted },
                            ]}
                          >
                            {formatRiderRelativeTime(item)}
                          </Text>
                          <BootstrapIcon
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={13}
                            color={theme.textMuted}
                          />
                        </View>
                      </TouchableOpacity>

                      {isExpanded ? (
                        <View style={styles.notifExpandedBody}>
                          {cleanMsg ? (
                            <Text
                              style={[
                                styles.notifFullMessage,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {cleanMsg}
                            </Text>
                          ) : null}

                          <View
                            style={[
                              styles.notifCardDivider,
                              { backgroundColor: theme.divider },
                            ]}
                          />

                          <View style={styles.notifExpandedFooter}>
                            <Text
                              style={[
                                styles.notifFullTimestamp,
                                { color: theme.textMuted },
                              ]}
                              numberOfLines={2}
                            >
                              {`${formatRiderFullDate(item)} · ${config.label}${
                                orderTag ? ` · ${orderTag}` : ''
                              }`}
                            </Text>

                            <View style={styles.notifFooterActions}>
                              {item.orderId ? (
                                <TouchableOpacity
                                  onPress={() => onSelectOrderFromNotif?.(item)}
                                  style={[
                                    styles.notifOrderBtn,
                                    { backgroundColor: theme.actionBtnBg },
                                  ]}
                                  activeOpacity={0.75}
                                >
                                  <Text style={styles.notifOrderBtnText}>
                                    View Order
                                  </Text>
                                  <BootstrapIcon
                                    name="chevron-right"
                                    size={11}
                                    color="#EA580C"
                                  />
                                </TouchableOpacity>
                              ) : null}

                              <TouchableOpacity
                                onPress={() => onDismiss?.(item)}
                                style={styles.notifDeleteBtn}
                                activeOpacity={0.75}
                              >
                                <BootstrapIcon
                                  name="trash3"
                                  size={12}
                                  color={theme.textMuted}
                                />
                                <Text
                                  style={[
                                    styles.notifDeleteText,
                                    { color: theme.textMuted },
                                  ]}
                                >
                                  Dismiss
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shopHeaderRoot: {
    backgroundColor: '#24272B',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D20',
    zIndex: 1000,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.22)' }
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.22,
          shadowRadius: 5,
        }),
    elevation: 8,
  },
  shopHeaderInner: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'web' ? 10 : 4,
    paddingBottom: 10,
  },
  shopHeaderWrapper: {
    backgroundColor: 'transparent',
    paddingTop: 2,
    paddingBottom: 6,
  },
  shopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  shopAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: '#32373D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopUserGreetingWrap: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  shopGreetingSub: {
    fontSize: 11,
    color: '#94A3B8',
    ...riderFont('400'),
  },
  shopGreetingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  shopUserName: {
    fontSize: 16,
    lineHeight: 21,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    ...riderFont('700'),
  },
  shopHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopHeaderIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shopBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#24272B',
  },
  shopBadgeDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    ...riderFont('700'),
  },
  shopSearchSection: {
    marginTop: 6,
    marginBottom: 2,
  },
  shopSearchBarPill: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  shopSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#FFFFFF',
    ...riderFont('400'),
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  shopFilterBtnInside: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0,
  },
  brandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    flex: 1,
    marginRight: 10,
  },
  brandTextColumn: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  headerEyebrow: {
    ...riderFont('700'),
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerPageTitle: {
    ...riderFont('700'),
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  avatarTouch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarInitials: {
    ...riderFont('700'),
    letterSpacing: 0.2,
  },
  menuBackdrop: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 98 : 68,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  menuCard: {
    width: 286,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },
  menuProfileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  menuNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  menuRiderName: {
    ...riderFont('700'),
    fontSize: 15,
    flexShrink: 1,
  },
  menuRiderId: {
    ...riderFont('600'),
    fontSize: 11.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  menuDutyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  menuDutyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuDutyLabel: {
    ...riderFont('700'),
    fontSize: 13,
  },
  menuDutyAction: {
    ...riderFont('700'),
    fontSize: 12.5,
  },
  menuDivider: {
    height: 1,
    marginVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 42,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  menuItemText: {
    flex: 1,
    ...riderFont('600'),
    fontSize: 13.5,
  },
  notifSafeArea: {
    flex: 1,
  },
  notifScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  notifHeaderLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifHeaderTitle: {
    ...riderFont('700'),
    fontSize: 18,
    letterSpacing: -0.3,
  },
  notifReadAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  notifReadAllText: {
    ...riderFont('700'),
    fontSize: 12,
    color: '#EA580C',
  },
  notifSearchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  notifSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    gap: 8,
  },
  notifSearchInput: {
    flex: 1,
    ...riderFont('500'),
    fontSize: 13.5,
    paddingVertical: 0,
  },
  notifFilterRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  notifFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingTop: 4,
  },
  notifFilterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  notifFilterChipText: {
    ...riderFont('600'),
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  notifFilterChipTextActive: {
    ...riderFont('700'),
    color: '#FFFFFF',
  },
  notifScroll: {
    flex: 1,
  },
  notifScrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  notifSectionGroup: {
    gap: 10,
  },
  notifSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  notifSectionTitle: {
    ...riderFont('700'),
    fontSize: 12,
    letterSpacing: 0.8,
  },
  notifSectionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifSectionBadgeText: {
    ...riderFont('700'),
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  notifCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notifCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  notifIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCardTitleArea: {
    flex: 1,
  },
  notifTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifCardTitle: {
    fontSize: 14.5,
    lineHeight: 20,
    flexShrink: 1,
  },
  notifCardTitleUnread: {
    ...riderFont('700'),
  },
  notifCardTitleRead: {
    ...riderFont('600'),
  },
  notifUnreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  notifPreviewMsg: {
    ...riderFont('400'),
    fontSize: 13,
    marginTop: 2,
  },
  notifRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTimeText: {
    ...riderFont('500'),
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  notifExpandedBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 2,
  },
  notifFullMessage: {
    ...riderFont('400'),
    fontSize: 13.5,
    lineHeight: 21,
    paddingLeft: 50,
    marginBottom: 12,
  },
  notifCardDivider: {
    height: 1,
    marginLeft: 50,
    marginBottom: 12,
  },
  notifExpandedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 50,
    gap: 8,
    flexWrap: 'wrap',
  },
  notifFullTimestamp: {
    ...riderFont('500'),
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  notifFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  notifOrderBtnText: {
    ...riderFont('700'),
    fontSize: 12,
    color: '#EA580C',
  },
  notifDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  notifDeleteText: {
    ...riderFont('600'),
    fontSize: 12,
  },
  notifEmptyContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  notifEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  notifEmptyTitle: {
    ...riderFont('700'),
    fontSize: 16,
    marginBottom: 6,
  },
  notifEmptySubtitle: {
    ...riderFont('400'),
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 270,
    marginBottom: 18,
  },
  notifEmptyActionBtn: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
  },
  notifEmptyActionText: {
    ...riderFont('700'),
    fontSize: 13,
    color: '#FFFFFF',
  },
});

