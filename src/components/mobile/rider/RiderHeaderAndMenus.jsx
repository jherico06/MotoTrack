import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
  riderName,
  riderAvatar,
  unreadCount = 0,
  onPressLogo,
  onPressNotifications,
  onPressProfile,
}) {
  const [settings, setSettings] = useState(() =>
    systemSettingsService.getSettings()
  );
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      if (updated) setSettings(updated);
    });
    return unsub;
  }, []);

  const storeName = (settings?.storeName || RIDER_BRAND.name).trim();
  const hubName = settings?.hubName ? settings.hubName.trim() : '';
  const customLogoUrl =
    !logoFailed && settings?.storeLogoUrl ? settings.storeLogoUrl.trim() : '';

  return (
    <View
      style={[
        styles.headerWrap,
        {
          backgroundColor: palette.bgHeader,
          borderBottomColor: palette.headerBorder || palette.border,
        },
      ]}
    >
      {/* Left: Logo & App/Shop Name */}
      <TouchableOpacity
        style={styles.brandBtn}
        onPress={onPressLogo}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${storeName} Home`}
      >
        <View
          style={[
            styles.logoBox,
            {
              backgroundColor: customLogoUrl ? 'transparent' : palette.orange,
              borderColor: customLogoUrl
                ? palette.headerBtnBorder
                : 'transparent',
              borderWidth: customLogoUrl ? 1 : 0,
            },
          ]}
        >
          {customLogoUrl ? (
            <Image
              source={{ uri: customLogoUrl }}
              style={styles.logoImage}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Image
              source={require('../../../../assets/emblem.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.brandTextColumn}>
          <View style={styles.brandNameRow}>
            {storeName.toLowerCase() === 'mototrack' ? (
              <Text style={styles.brandWordmark}>
                <Text style={{ color: '#FFFFFF' }}>Moto</Text>
                <Text style={{ color: palette.orange }}>Track</Text>
              </Text>
            ) : (
              <Text
                style={[
                  styles.brandWordmark,
                  { color: palette.headerText || '#FFFFFF' },
                ]}
                numberOfLines={1}
              >
                {storeName}
              </Text>
            )}
            <View
              style={[
                styles.riderPill,
                {
                  backgroundColor: palette.orangeSoft,
                  borderColor: palette.orangeBorder,
                },
              ]}
            >
              <Text
                style={[styles.riderPillText, { color: palette.orangeText }]}
              >
                RIDER
              </Text>
            </View>
          </View>

          {hubName ? (
            <Text
              style={[styles.shopSubtitle, { color: palette.textMuted }]}
              numberOfLines={1}
            >
              {hubName}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[
            styles.notifBtn,
            {
              backgroundColor: palette.headerBtnBg || '#2C3134',
              borderColor: palette.headerBtnBorder || '#3A4044',
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
            color={palette.headerBtnIcon || '#FFFFFF'}
          />
          {unreadCount > 0 ? (
            <View
              style={[
                styles.unreadDot,
                {
                  backgroundColor: palette.orange,
                  borderColor: palette.bgHeader,
                },
              ]}
            />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPressProfile}
          activeOpacity={0.8}
          style={styles.avatarTouch}
          accessibilityRole="button"
          accessibilityLabel="Open rider profile menu"
        >
          <RiderAvatar
            uri={riderAvatar}
            name={riderName}
            size={38}
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
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  brandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    flex: 1,
    marginRight: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 30,
    height: 30,
  },
  brandTextColumn: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandWordmark: {
    fontFamily: RIDER_FONT,
    fontSize: 17.5,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  riderPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  riderPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shopSubtitle: {
    fontFamily: RIDER_FONT,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: -0.1,
    marginTop: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  avatarTouch: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
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

