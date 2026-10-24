import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import { notificationService, stripEmojis } from '../../services/notifications/notificationService.js';
import { getThemeTokens } from '../../styles/theme.js';

// Ensure custom orange pill scrollbar indicator styles are injected on web
if (
  Platform.OS === 'web' &&
  typeof document !== 'undefined' &&
  !document.getElementById('mototrack-orange-scrollbar-style')
) {
  const scrollStyle = document.createElement('style');
  scrollStyle.id = 'mototrack-orange-scrollbar-style';
  scrollStyle.textContent = `
    [data-notif-scroll="true"]::-webkit-scrollbar,
    .mototrack-orange-scroll::-webkit-scrollbar {
      width: 6px !important;
      height: 6px !important;
    }
    [data-notif-scroll="true"]::-webkit-scrollbar-track,
    .mototrack-orange-scroll::-webkit-scrollbar-track {
      background: transparent !important;
    }
    [data-notif-scroll="true"]::-webkit-scrollbar-thumb,
    .mototrack-orange-scroll::-webkit-scrollbar-thumb {
      background: #EA580C !important;
      border-radius: 9999px !important;
    }
    [data-notif-scroll="true"]::-webkit-scrollbar-thumb:hover,
    .mototrack-orange-scroll::-webkit-scrollbar-thumb:hover {
      background: #C2410C !important;
    }
    [data-notif-scroll="true"],
    .mototrack-orange-scroll {
      scrollbar-width: thin !important;
      scrollbar-color: #EA580C transparent !important;
    }
  `;
  document.head.appendChild(scrollStyle);
}

function getRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  const now = Date.now();
  const time = new Date(dateString).getTime();
  if (isNaN(time)) return 'Recently';

  const diffMinutes = Math.floor((now - time) / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getCategoryInfo(item, isDark = false) {
  const cat = String(item.category || item.type || '').toLowerCase();
  
  if (cat.includes('booking') || cat.includes('service') || cat.includes('garage')) {
    return {
      label: 'BOOKING',
      icon: 'calendar-check',
      bg: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
      color: isDark ? '#FBBF24' : '#D97706',
    };
  }
  if (cat.includes('order') || cat.includes('dispatch') || cat.includes('ship')) {
    return {
      label: 'ORDER',
      icon: 'bag-check-fill',
      bg: isDark ? 'rgba(56, 189, 248, 0.16)' : '#E0F2FE',
      color: isDark ? '#7DD3FC' : '#0284C7',
    };
  }
  if (cat.includes('payment') || cat.includes('sales') || cat.includes('spend')) {
    return {
      label: 'PAYMENT',
      icon: 'wallet2',
      bg: isDark ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7',
      color: isDark ? '#6EE7B7' : '#16A34A',
    };
  }
  if (cat.includes('stock') || cat.includes('inventory') || cat.includes('restock')) {
    return {
      label: 'IMPORTANT',
      icon: 'exclamation-triangle-fill',
      bg: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
      color: isDark ? '#F87171' : '#DC2626',
    };
  }
  if (cat.includes('promo') || cat.includes('discount')) {
    return {
      label: 'PROMOTION',
      icon: 'tag-fill',
      bg: isDark ? 'rgba(167, 139, 250, 0.18)' : '#F3E8FF',
      color: isDark ? '#C4B5FD' : '#9333EA',
    };
  }
  return {
    label: item.categoryLabel || item.type?.toUpperCase() || 'STUDIO NOTICE',
    icon: 'bell-fill',
    bg: isDark ? 'rgba(52, 211, 153, 0.14)' : '#F5F4F0',
    color: isDark ? '#34D399' : '#856839',
  };
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  onNavigateToScreen,
  currentUser,
  isAdmin: propIsAdmin = false,
  isDark = false,
}) {
  const containerRef = useRef(null);
  const hoverTimersRef = useRef(new Map());
  const { width: windowWidth } = useWindowDimensions();
  const isAdmin = propIsAdmin || currentUser?.role === 'admin';

  const [notifications, setNotifications] = useState(() =>
    isAdmin
      ? notificationService.getAdminNotifications()
      : notificationService.getCustomerNotifications(currentUser)
  );
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    const updateList = () => {
      if (isAdmin) {
        setNotifications(notificationService.getAdminNotifications());
      } else {
        setNotifications(notificationService.getCustomerNotifications(currentUser));
      }
    };
    updateList();
    const unsub = notificationService.subscribe(updateList);
    if (isOpen) {
      notificationService.syncFromDatabase().catch(() => {});
    }
    return () => unsub?.();
  }, [isOpen, isAdmin, currentUser?.id, currentUser?.customer_id, currentUser?.email]);

  useEffect(() => {
    return () => {
      hoverTimersRef.current.forEach((t) => clearTimeout(t));
      hoverTimersRef.current.clear();
    };
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.status === 'unread').length;
  }, [notifications]);

  const displayedNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => n.status === 'unread');
    }
    return notifications;
  }, [notifications, activeFilter]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!target) return;

      if (typeof target.closest === 'function' && target.closest('[data-notification-button]')) {
        return;
      }

      if (containerRef.current) {
        let node = containerRef.current;
        if (node && typeof node.contains !== 'function') {
          if (typeof node.getScrollableNode === 'function') {
            node = node.getScrollableNode();
          } else if (typeof node.getNode === 'function') {
            node = node.getNode();
          }
        }
        if (node && typeof node.contains === 'function' && !node.contains(target)) {
          onClose?.();
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }, 40);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    if (isAdmin) {
      await notificationService.markAllAdminAsRead();
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.markAllCustomerAsRead(currentUser);
      setNotifications(notificationService.getCustomerNotifications(currentUser));
    }
  };

  const handleClearRead = async () => {
    if (isAdmin) {
      const unreadOnly = notifications.filter((n) => n.status === 'unread');
      notificationService.adminNotifications = unreadOnly;
      await notificationService.persist();
      notificationService.notify();
      setNotifications(unreadOnly);
    } else {
      await notificationService.clearCustomerReadNotifications(currentUser);
      setNotifications(notificationService.getCustomerNotifications(currentUser));
    }
  };

  const handleDeleteNotification = async (id, e) => {
    e?.stopPropagation?.();
    if (isAdmin) {
      await notificationService.deleteAdminNotification(id);
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.deleteCustomerNotification(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser));
    }
  };

  const handleNotificationPress = async (item) => {
    if (item.status === 'unread') {
      if (isAdmin) {
        await notificationService.markAdminAsRead(item.id);
        setNotifications(notificationService.getAdminNotifications());
      } else {
        await notificationService.markCustomerAsRead(item.id);
        setNotifications(notificationService.getCustomerNotifications(currentUser));
      }
    }
    onClose?.();
    if (onNavigateToScreen) {
      const link = (item.link || item.type || '').toLowerCase();
      if (link.includes('booking') || link.includes('garage')) {
        onNavigateToScreen('profile', { tab: 'bookings' });
      } else if (link.includes('order')) {
        onNavigateToScreen('profile', { tab: 'orders' });
      } else if (link.includes('customizer')) {
        onNavigateToScreen('customizer');
      } else {
        onNavigateToScreen('notifications');
      }
    }
  };

  const handleMouseEnterItem = (item) => {
    if (item.status !== 'unread') return;
    if (hoverTimersRef.current.has(item.id)) {
      clearTimeout(hoverTimersRef.current.get(item.id));
    }
    const timer = setTimeout(async () => {
      if (isAdmin) {
        await notificationService.markAdminAsRead(item.id);
        setNotifications(notificationService.getAdminNotifications());
      } else {
        await notificationService.markCustomerAsRead(item.id);
        setNotifications(notificationService.getCustomerNotifications(currentUser));
      }
      hoverTimersRef.current.delete(item.id);
    }, 450);
    hoverTimersRef.current.set(item.id, timer);
  };

  const handleMouseLeaveItem = (item) => {
    if (hoverTimersRef.current.has(item.id)) {
      clearTimeout(hoverTimersRef.current.get(item.id));
      hoverTimersRef.current.delete(item.id);
    }
  };

  const dropdownWidth = Math.min(335, windowWidth - 24);
  const t = getThemeTokens(isDark);
  const accentIcon = isDark ? t.accentBrand : '#856839';
  const mutedIcon = isDark ? t.textMuted : '#8E8B85';

  return (
    <>
      {/* Invisible backdrop */}
      <TouchableWithoutFeedback onPress={() => onClose?.()}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Floating Notification Panel */}
      <View
        ref={containerRef}
        style={[
          styles.dropdownContainer,
          {
            width: dropdownWidth,
            backgroundColor: t.bgCard,
            borderColor: t.border,
            boxShadow: isDark
              ? '0 12px 32px -4px rgba(0, 0, 0, 0.45)'
              : '0 12px 32px -4px rgba(0, 0, 0, 0.14)',
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View
              style={[
                styles.headerIconWrap,
                {
                  backgroundColor: isDark ? t.accentBg : '#F5F2EB',
                },
              ]}
            >
              <BootstrapIcon name="bell-fill" size={15} color={accentIcon} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Notifications</Text>
              <Text style={[styles.headerSubtitle, { color: t.textMuted }]}>
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={handleMarkAllRead}
                activeOpacity={0.7}
                title="Mark all as read"
                accessibilityLabel="Mark all as read"
              >
                <BootstrapIcon name="check2-all" size={15} color={accentIcon} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={handleClearRead}
              activeOpacity={0.7}
              title="Clear read notifications"
              accessibilityLabel="Clear read notifications"
            >
              <BootstrapIcon name="trash3" size={14} color={mutedIcon} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={onClose}
              activeOpacity={0.7}
              title="Close panel"
              accessibilityLabel="Close panel"
            >
              <BootstrapIcon name="x-lg" size={13} color={mutedIcon} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs: All (Count) / Unread (Count) */}
        <View style={[styles.tabsRow, { borderBottomColor: t.border }]}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              { backgroundColor: isDark ? t.bgSub : '#F1F5F9' },
              activeFilter === 'all' && {
                backgroundColor: isDark ? '#1A2622' : '#0F172A',
              },
            ]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                { color: t.textMuted },
                activeFilter === 'all' && styles.tabPillTextActive,
              ]}
            >
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              { backgroundColor: isDark ? t.bgSub : '#F1F5F9' },
              activeFilter === 'unread' && {
                backgroundColor: isDark ? '#1A2622' : '#0F172A',
              },
            ]}
            onPress={() => setActiveFilter('unread')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                { color: t.textMuted },
                activeFilter === 'unread' && styles.tabPillTextActive,
              ]}
            >
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* List of Notifications */}
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          {...(Platform.OS === 'web'
            ? {
                dataSet: { notifScroll: 'true' },
                className: 'mototrack-orange-scroll',
              }
            : {})}
        >
          {displayedNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIconWrap,
                  { backgroundColor: isDark ? t.bgSub : '#F5F4F0' },
                ]}
              >
                <BootstrapIcon name="bell" size={24} color={mutedIcon} />
              </View>
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
                {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </Text>
              <Text style={[styles.emptySub, { color: t.textMuted }]}>You're all caught up.</Text>
            </View>
          ) : (
            displayedNotifications.map((item) => {
              const catInfo = getCategoryInfo(item, isDark);
              const isUnread = item.status === 'unread';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemRow,
                    {
                      backgroundColor: t.bgCard,
                      borderBottomColor: t.border,
                    },
                    isUnread && {
                      backgroundColor: isDark ? t.bgSubtle : '#FAF9F6',
                    },
                  ]}
                  onPress={() => handleNotificationPress(item)}
                  {...(Platform.OS === 'web'
                    ? {
                        onMouseEnter: () => handleMouseEnterItem(item),
                        onMouseLeave: () => handleMouseLeaveItem(item),
                      }
                    : {})}
                  activeOpacity={0.8}
                >
                  <View style={[styles.itemIconBadge, { backgroundColor: catInfo.bg }]}>
                    <BootstrapIcon name={catInfo.icon} size={15} color={catInfo.color} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                      <Text
                        style={[
                          styles.itemTitle,
                          { color: t.textSecondary },
                          isUnread && { fontWeight: '700', color: t.textPrimary },
                        ]}
                        numberOfLines={1}
                      >
                        {stripEmojis(item.title)}
                      </Text>
                      <Text style={[styles.itemTime, { color: t.textMuted }]}>
                        {getRelativeTime(item.created_at)}
                      </Text>
                    </View>

                    <Text style={[styles.itemMessage, { color: t.textMuted }]} numberOfLines={2}>
                      {stripEmojis(item.message)}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={[styles.categoryTag, { color: catInfo.color }]}>
                        {catInfo.label}
                      </Text>
                      {isUnread && (
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={async (e) => {
                            e.stopPropagation?.();
                            if (isAdmin) {
                              await notificationService.markAdminAsRead(item.id);
                              setNotifications(notificationService.getAdminNotifications());
                            } else {
                              await notificationService.markCustomerAsRead(item.id);
                              setNotifications(notificationService.getCustomerNotifications(currentUser));
                            }
                          }}
                          title="Mark as read"
                          accessibilityLabel="Mark this notification as read"
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.unreadDot,
                              { backgroundColor: isDark ? t.accentBrand : '#EA580C' },
                            ]}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={[
            styles.footerRow,
            {
              backgroundColor: t.bgCard,
              borderTopColor: t.border,
            },
          ]}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            onPress={() => {
              onClose?.();
              if (onNavigateToScreen) {
                onNavigateToScreen('notifications');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllBtnText, { color: accentIcon }]}>
              View all notifications
            </Text>
            <BootstrapIcon name="arrow-right" size={12} color={accentIcon} />
          </TouchableOpacity>

          <Text style={[styles.hoverNoticeText, { color: t.textSubtle }]}>Hover notice to read</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    backgroundColor: 'transparent',
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE8E3',
    boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.14), 0 6px 12px -4px rgba(0, 0, 0, 0.05)',
    zIndex: 9999,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8E8B85',
    marginTop: 1,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  headerActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingBottom: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
  },
  tabPillActive: {
    backgroundColor: '#0F172A',
  },
  tabPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollList: {
    maxHeight: 330,
    ...(Platform.OS === 'web'
      ? {
          scrollbarWidth: 'thin',
          scrollbarColor: '#EA580C transparent',
        }
      : {}),
  },
  scrollContent: {
    paddingVertical: 0,
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 13,
    paddingVertical: 9.5,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  itemRowUnread: {
    backgroundColor: '#FAF9F6',
  },
  itemIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  itemTitleUnread: {
    fontWeight: '700',
    color: '#0F172A',
  },
  itemTime: {
    fontSize: 10.5,
    color: '#94A3B8',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  itemMessage: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  categoryTag: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5F4F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  emptySub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#856839',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  hoverNoticeText: {
    fontSize: 10.5,
    color: '#A19E95',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
});
