import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import { RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import {
  RIDER_BRAND,
  RIDER_FONT,
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
              onNavigateAccountTab('preferences');
            }}
            activeOpacity={0.75}
          >
            <BootstrapIcon
              name="sliders"
              size={16}
              color={palette.textSecondary}
            />
            <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>
              Notifications & dark mode
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

export function RiderNotificationsModal({
  visible,
  onClose,
  palette,
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  onSelectOrderFromNotif,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetOverlay, { backgroundColor: palette.scrim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.notifSheet,
            {
              backgroundColor: palette.bgSheet,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[styles.dragHandle, { backgroundColor: palette.borderStrong }]}
          />

          <View
            style={[
              styles.notifSheetHeader,
              { borderBottomColor: palette.border },
            ]}
          >
            <View style={styles.notifHeaderLeft}>
              <View
                style={[
                  styles.notifHeaderIcon,
                  {
                    backgroundColor: palette.orangeSoft,
                    borderColor: palette.orangeBorder,
                  },
                ]}
              >
                <BootstrapIcon name="bell" size={17} color={palette.orange} />
              </View>
              <View>
                <Text
                  style={[styles.notifTitle, { color: palette.textPrimary }]}
                >
                  Dispatch notifications
                </Text>
                <Text
                  style={[styles.notifSubtitle, { color: palette.textMuted }]}
                >
                  {unreadCount > 0
                    ? `${unreadCount} unread delivery update${unreadCount === 1 ? '' : 's'}`
                    : 'You are all caught up'}
                </Text>
              </View>
            </View>

            <View style={styles.notifHeaderRight}>
              {unreadCount > 0 ? (
                <TouchableOpacity
                  onPress={onMarkAllRead}
                  style={[
                    styles.markReadBtn,
                    { backgroundColor: palette.orangeSoft },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.markReadText, { color: palette.orangeText }]}
                  >
                    Mark read
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: palette.bgMuted },
                ]}
                onPress={onClose}
                activeOpacity={0.75}
              >
                <BootstrapIcon
                  name="x-lg"
                  size={14}
                  color={palette.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.notifList}
            contentContainerStyle={styles.notifListContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifs}>
                <View
                  style={[
                    styles.emptyNotifIcon,
                    { backgroundColor: palette.bgMuted },
                  ]}
                >
                  <BootstrapIcon
                    name="bell"
                    size={22}
                    color={palette.textSubtle}
                  />
                </View>
                <Text
                  style={[
                    styles.emptyNotifTitle,
                    { color: palette.textPrimary },
                  ]}
                >
                  No notifications yet
                </Text>
                <Text
                  style={[styles.emptyNotifSub, { color: palette.textMuted }]}
                >
                  New MotoTrack delivery assignments and payout confirmations
                  will appear here.
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                const isUnread = Boolean(item.unread);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notifRow,
                      {
                        backgroundColor: isUnread
                          ? palette.orangeSoft
                          : palette.bgCard,
                        borderColor: isUnread
                          ? palette.orangeBorder
                          : palette.border,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      onSelectOrderFromNotif?.(item);
                    }}
                  >
                    <View
                      style={[
                        styles.notifRowIcon,
                        {
                          backgroundColor: isUnread
                            ? palette.orange
                            : palette.bgMuted,
                        },
                      ]}
                    >
                      <BootstrapIcon
                        name={item.icon || 'truck'}
                        size={15}
                        color={isUnread ? '#FFFFFF' : palette.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notifRowTop}>
                        <Text
                          style={[
                            styles.notifRowTitle,
                            { color: palette.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {item.orderId ? (
                          <Text
                            style={[
                              styles.notifOrderTag,
                              { color: palette.orangeText },
                            ]}
                          >
                            {formatOrderCode(item.orderId)}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.notifRowBody,
                          { color: palette.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {item.message}
                      </Text>
                      <Text
                        style={[
                          styles.notifRowTime,
                          { color: palette.textMuted },
                        ]}
                      >
                        {item.timeLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
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
    fontWeight: '400',
    fontFamily: RIDER_FONT,
  },
  shopGreetingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  shopUserName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    fontFamily: RIDER_FONT,
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
    fontSize: 8.5,
    fontWeight: '700',
    fontFamily: RIDER_FONT,
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
    fontWeight: '400',
    fontFamily: RIDER_FONT,
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
    fontFamily: RIDER_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerPageTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
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
    fontFamily: RIDER_FONT,
    fontWeight: '600',
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
    fontFamily: RIDER_FONT,
    fontSize: 14.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  menuRiderId: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '500',
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
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
  },
  menuDutyAction: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
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
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '500',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  notifSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  notifSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  notifHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  notifHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 16,
    fontWeight: '700',
  },
  notifSubtitle: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  notifHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markReadText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifList: {
    paddingHorizontal: 16,
  },
  notifListContent: {
    paddingVertical: 14,
    gap: 10,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  notifRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  notifRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notifRowTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '600',
    flex: 1,
  },
  notifOrderTag: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  notifRowBody: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
    marginTop: 3,
  },
  notifRowTime: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  emptyNotifs: {
    alignItems: 'center',
    paddingVertical: 38,
    paddingHorizontal: 24,
  },
  emptyNotifIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyNotifTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyNotifSub: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
});

