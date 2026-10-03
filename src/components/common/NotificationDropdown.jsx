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

function getCategoryInfo(item) {
  const cat = String(item.category || item.type || '').toLowerCase();
  
  if (cat.includes('booking') || cat.includes('service') || cat.includes('garage')) {
    return {
      label: 'BOOKING',
      icon: 'calendar-check',
      bg: '#FEF3C7',
      color: '#D97706',
    };
  }
  if (cat.includes('order') || cat.includes('dispatch') || cat.includes('ship')) {
    return {
      label: 'ORDER',
      icon: 'bag-check-fill',
      bg: '#E0F2FE',
      color: '#0284C7',
    };
  }
  if (cat.includes('payment') || cat.includes('sales') || cat.includes('spend')) {
    return {
      label: 'PAYMENT',
      icon: 'wallet2',
      bg: '#DCFCE7',
      color: '#16A34A',
    };
  }
  if (cat.includes('stock') || cat.includes('inventory') || cat.includes('restock')) {
    return {
      label: 'IMPORTANT',
      icon: 'exclamation-triangle-fill',
      bg: '#FEE2E2',
      color: '#DC2626',
    };
  }
  if (cat.includes('promo') || cat.includes('discount')) {
    return {
      label: 'PROMOTION',
      icon: 'tag-fill',
      bg: '#F3E8FF',
      color: '#9333EA',
    };
  }
  return {
    label: item.categoryLabel || item.type?.toUpperCase() || 'STUDIO NOTICE',
    icon: 'bell-fill',
    bg: '#F5F4F0',
    color: '#856839',
  };
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  onNavigateToScreen,
  currentUser,
  isAdmin: propIsAdmin = false,
}) {
  const containerRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const isAdmin = propIsAdmin || currentUser?.role === 'admin';

  const [notifications, setNotifications] = useState(() =>
    isAdmin
      ? notificationService.getAdminNotifications()
      : notificationService.getCustomerNotifications(currentUser?.id)
  );
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    const unsub = notificationService.subscribe((data) => {
      if (isAdmin) {
        setNotifications(data?.admin || notificationService.getAdminNotifications());
      } else {
        setNotifications(
          data?.customer || notificationService.getCustomerNotifications(currentUser?.id)
        );
      }
    });
    return () => unsub?.();
  }, [isAdmin, currentUser?.id]);

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
      await notificationService.markAllCustomerAsRead(currentUser?.id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
  };

  const handleClearRead = async () => {
    const unreadOnly = notifications.filter((n) => n.status === 'unread');
    if (isAdmin) {
      notificationService.adminNotifications = unreadOnly;
      await notificationService.persist();
      notificationService.notify();
      setNotifications(unreadOnly);
    } else {
      notificationService.customerNotifications = unreadOnly;
      await notificationService.persist();
      notificationService.notify();
      setNotifications(unreadOnly);
    }
  };

  const handleDeleteNotification = async (id, e) => {
    e?.stopPropagation?.();
    if (isAdmin) {
      await notificationService.deleteAdminNotification(id);
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.deleteCustomerNotification(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
  };

  const handleNotificationPress = async (item) => {
    if (item.status === 'unread') {
      if (isAdmin) {
        await notificationService.markAdminAsRead(item.id);
        setNotifications(notificationService.getAdminNotifications());
      } else {
        await notificationService.markCustomerAsRead(item.id);
        setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
      }
    }
    onClose?.();
    if (onNavigateToScreen) {
      onNavigateToScreen('notifications');
    }
  };

  const dropdownWidth = Math.min(410, windowWidth - 24);

  return (
    <>
      {/* Invisible backdrop */}
      <TouchableWithoutFeedback onPress={() => onClose?.()}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Floating Notification Panel */}
      <View ref={containerRef} style={[styles.dropdownContainer, { width: dropdownWidth }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.headerIconWrap}>
              <BootstrapIcon name="bell-fill" size={16} color="#856839" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={handleClearRead}
              activeOpacity={0.7}
              title="Clear notifications"
            >
              <BootstrapIcon name="trash3" size={15} color="#8E8B85" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={onClose}
              activeOpacity={0.7}
              title="Close panel"
            >
              <BootstrapIcon name="x-lg" size={14} color="#8E8B85" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs: All (Count) / Unread (Count) */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeFilter === 'all' && styles.tabPillActive]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeFilter === 'all' && styles.tabPillTextActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeFilter === 'unread' && styles.tabPillActive]}
            onPress={() => setActiveFilter('unread')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeFilter === 'unread' && styles.tabPillTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* List of Notifications */}
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {displayedNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <BootstrapIcon name="bell" size={24} color="#A19E95" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </Text>
              <Text style={styles.emptySub}>You're all caught up.</Text>
            </View>
          ) : (
            displayedNotifications.map((item) => {
              const catInfo = getCategoryInfo(item);
              const isUnread = item.status === 'unread';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemRow, isUnread && styles.itemRowUnread]}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.itemIconBadge, { backgroundColor: catInfo.bg }]}>
                    <BootstrapIcon name={catInfo.icon} size={15} color={catInfo.color} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                      <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
                        {stripEmojis(item.title)}
                      </Text>
                      <Text style={styles.itemTime}>{getRelativeTime(item.created_at)}</Text>
                    </View>

                    <Text style={styles.itemMessage} numberOfLines={2}>
                      {stripEmojis(item.message)}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={[styles.categoryTag, { color: catInfo.color }]}>
                        {catInfo.label}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footerRow}>
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
            <Text style={styles.viewAllBtnText}>View all notifications</Text>
            <BootstrapIcon name="arrow-right" size={13} color="#856839" />
          </TouchableOpacity>

          <Text style={styles.hoverNoticeText}>Hover notice to read</Text>
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
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAE8E3',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.14)',
    zIndex: 9999,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#8E8B85',
    marginTop: 1,
  },
  headerActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  tabPillActive: {
    backgroundColor: '#0F172A',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollList: {
    maxHeight: 380,
  },
  scrollContent: {
    paddingVertical: 0,
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  itemRowUnread: {
    backgroundColor: '#FAF9F6',
  },
  itemIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  itemTitleUnread: {
    fontWeight: '700',
    color: '#0F172A',
  },
  itemTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  itemMessage: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  categoryTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1D4533',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F4F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewAllBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#856839',
  },
  hoverNoticeText: {
    fontSize: 11.5,
    color: '#A19E95',
  },
});
