import React, { useState, useEffect, useMemo } from 'react';
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
import BootstrapIcon from './BootstrapIcon';
import { notificationService, stripEmojis } from '../../services/notificationService';

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

function getCategoryTheme(type) {
  switch (type) {
    case 'booking':
      return {
        icon: 'tools',
        bg: '#DCFCE7',
        color: '#0C6258',
        badgeBg: '#0C6258',
      };
    case 'order':
      return {
        icon: 'bag-check-fill',
        bg: '#DBEAFE',
        color: '#1D4ED8',
        badgeBg: '#1D4ED8',
      };
    case 'promo':
      return {
        icon: 'lightning-charge-fill',
        bg: '#FEF9C3',
        color: '#B45309',
        badgeBg: '#B45309',
      };
    case 'security':
      return {
        icon: 'shield-lock-fill',
        bg: '#FEE2E2',
        color: '#DC2626',
        badgeBg: '#DC2626',
      };
    default:
      return {
        icon: 'bell-fill',
        bg: '#F1F5F9',
        color: '#0C6258',
        badgeBg: '#0C6258',
      };
  }
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  onNavigateToScreen,
  currentUser,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [notifications, setNotifications] = useState(() =>
    notificationService.getNotifications(currentUser?.id)
  );
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'
  const [activeMenuNotifId, setActiveMenuNotifId] = useState(null);

  useEffect(() => {
    const unsub = notificationService.subscribe((fresh) => {
      const userList = notificationService.getNotifications(currentUser?.id);
      setNotifications(userList || []);
    });
    return () => unsub?.();
  }, [currentUser?.id]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.status === 'unread').length;
  }, [notifications]);

  const displayedNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => n.status === 'unread');
    }
    return notifications;
  }, [notifications, activeFilter]);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead(currentUser?.id);
    setActiveMenuNotifId(null);
  };

  const handleToggleReadStatus = async (item) => {
    if (item.status === 'unread') {
      await notificationService.markAsRead(item.id);
    } else {
      await notificationService.markAsUnread(item.id);
    }
    setActiveMenuNotifId(null);
  };

  const handleDeleteNotification = async (id) => {
    await notificationService.deleteNotification(id);
    setActiveMenuNotifId(null);
  };

  const handleNotificationPress = async (item) => {
    setActiveMenuNotifId(null);
    if (item.status === 'unread') {
      await notificationService.markAsRead(item.id);
    }
    onClose?.();
    if (item.link) {
      if (item.link === 'bookings' || item.link === 'garage') {
        onNavigateToScreen?.('garage');
      } else if (item.link === 'orders') {
        onNavigateToScreen?.('profile', { tab: 'orders' });
      } else if (item.link === 'settings') {
        onNavigateToScreen?.('profile', { tab: 'settings' });
      } else {
        onNavigateToScreen?.(item.link);
      }
    }
  };

  const dropdownWidth = Math.min(390, windowWidth - 24);

  return (
    <>
      {/* Invisible full backdrop to dismiss dropdown on outside click */}
      <TouchableWithoutFeedback
        onPress={() => {
          setActiveMenuNotifId(null);
          onClose?.();
        }}
      >
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Floating Dropdown Card (Facebook Style) */}
      <View style={[styles.dropdownContainer, { width: dropdownWidth }]}>
        {/* Header: Title & Mark All Read */}
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="check2-all" size={13} color="#0C6258" />
              <Text style={styles.markAllBtnText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills: All / Unread */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
            onPress={() => {
              setActiveFilter('all');
              setActiveMenuNotifId(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'all' && styles.filterPillTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === 'unread' && styles.filterPillActive,
            ]}
            onPress={() => {
              setActiveFilter('unread');
              setActiveMenuNotifId(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'unread' && styles.filterPillTextActive,
              ]}
            >
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerDivider} />

        {/* Notifications Scroll List */}
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {displayedNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <BootstrapIcon
                  name={activeFilter === 'unread' ? 'check2-circle' : 'bell-slash'}
                  size={26}
                  color="#94A3B8"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'unread' ? "You're all caught up!" : 'No notifications'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'unread'
                  ? 'No unread notifications right now.'
                  : "We'll notify you about orders, pit bay bookings, and specials."}
              </Text>
            </View>
          ) : (
            displayedNotifications.map((item) => {
              const theme = getCategoryTheme(item.type);
              const isUnread = item.status === 'unread';
              const isMenuOpen = activeMenuNotifId === item.id;

              return (
                <View
                  key={item.id}
                  style={[styles.itemWrapper, isMenuOpen && { zIndex: 120 }]}
                >
                  <TouchableOpacity
                    style={[styles.itemRow, isUnread && styles.itemRowUnread]}
                    onPress={() => handleNotificationPress(item)}
                    activeOpacity={0.7}
                  >
                    {/* Left Category Avatar Badge */}
                    <View style={[styles.avatarBadge, { backgroundColor: theme.bg }]}>
                      <BootstrapIcon name={theme.icon} size={18} color={theme.color} />
                    </View>

                    {/* Center Content */}
                    <View style={styles.itemContent}>
                      <Text
                        style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}
                        numberOfLines={1}
                      >
                        {stripEmojis(item.title)}
                      </Text>
                      <Text style={styles.itemMessage} numberOfLines={2}>
                        {stripEmojis(item.message)}
                      </Text>
                      <Text
                        style={[styles.itemTime, isUnread && styles.itemTimeUnread]}
                      >
                        {getRelativeTime(item.created_at)}
                      </Text>
                    </View>

                    {/* Right Unread Indicator Dot */}
                    {isUnread && <View style={styles.unreadDot} />}
                  </TouchableOpacity>

                  {/* 3-Dot Context Menu Button (Facebook style) */}
                  <TouchableOpacity
                    style={[
                      styles.dotsBtn,
                      isMenuOpen && styles.dotsBtnActive,
                    ]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      setActiveMenuNotifId(isMenuOpen ? null : item.id);
                    }}
                    activeOpacity={0.7}
                    title="Notification options"
                  >
                    <BootstrapIcon
                      name="three-dots"
                      size={14}
                      color={isMenuOpen ? '#0C6258' : '#64748B'}
                    />
                  </TouchableOpacity>

                  {/* 3-Dot Action Popover Menu */}
                  {isMenuOpen && (
                    <>
                      {/* Sub-backdrop for closing 3-dot popover */}
                      <TouchableWithoutFeedback
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          setActiveMenuNotifId(null);
                        }}
                      >
                        <View style={styles.menuBackdrop} />
                      </TouchableWithoutFeedback>

                      <View style={styles.actionPopover}>
                        {/* Option 1: Mark as Read / Unread */}
                        <TouchableOpacity
                          style={styles.popoverItem}
                          onPress={() => handleToggleReadStatus(item)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.popoverIconWrap}>
                            <BootstrapIcon
                              name={isUnread ? 'check-circle' : 'circle-fill'}
                              size={13}
                              color="#0C6258"
                            />
                          </View>
                          <Text style={styles.popoverItemText}>
                            {isUnread ? 'Mark as read' : 'Mark as unread'}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.popoverDivider} />

                        {/* Option 2: Delete Notification */}
                        <TouchableOpacity
                          style={styles.popoverItem}
                          onPress={() => handleDeleteNotification(item.id)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.popoverIconWrap,
                              { backgroundColor: '#FEE2E2' },
                            ]}
                          >
                            <BootstrapIcon
                              name="trash3"
                              size={13}
                              color="#EF4444"
                            />
                          </View>
                          <Text
                            style={[
                              styles.popoverItemText,
                              { color: '#EF4444', fontWeight: '700' },
                            ]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Footer: View Full Notifications in Profile */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => {
              setActiveMenuNotifId(null);
              onClose?.();
              onNavigateToScreen?.('notifications');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.footerBtnText}>See all notifications</Text>
            <BootstrapIcon name="chevron-right" size={11} color="#0C6258" />
          </TouchableOpacity>
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
    zIndex: 1050,
    cursor: 'default',
  },
  menuBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 125,
    cursor: 'default',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 48,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 1100,
    overflow: 'visible',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.2), 0 4px 12px rgba(0,0,0,0.05)',
      },
      default: {
        elevation: 12,
      },
    }),
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerBadge: {
    backgroundColor: '#0C6258',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F7F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  markAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0C6258',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#0C6258',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollList: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 17,
  },
  itemWrapper: {
    position: 'relative',
    marginVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    paddingRight: 42,
    borderRadius: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  itemRowUnread: {
    backgroundColor: '#F3F7F6',
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  itemTitleUnread: {
    color: '#0F172A',
    fontWeight: '800',
  },
  itemMessage: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 3,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  itemTimeUnread: {
    color: '#0C6258',
    fontWeight: '700',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#0C6258',
    marginLeft: 4,
  },
  dotsBtn: {
    position: 'absolute',
    right: 8,
    top: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dotsBtnActive: {
    backgroundColor: '#E6F0EE',
    borderColor: '#0C6258',
  },
  actionPopover: {
    position: 'absolute',
    right: 38,
    top: 10,
    width: 164,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 130,
    paddingVertical: 5,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  popoverIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverItemText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  popoverDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 3,
  },
  footerRow: {
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  footerBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0C6258',
  },
});
