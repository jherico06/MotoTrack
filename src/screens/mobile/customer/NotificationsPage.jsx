import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../../../components/common';
import { StatusBar } from 'expo-status-bar';
import { notificationService, stripEmojis } from '../../../services/notifications/notificationService.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { ANDROID_TOP_INSET } from '../../../utils/safeArea.js';

function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    const diffMs = Date.now() - d.getTime();
    if (isNaN(diffMs)) return 'Recently';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (_e) {
    return 'Recent';
  }
}

function formatFullDate(isoString) {
  if (!isoString) return 'Recent';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (_e) {
    return 'Recent';
  }
}

function getCategoryConfig(notif) {
  if (!notif) return { label: 'Notice', icon: 'bell', bg: '#F4F3F0', color: '#6B6862' };
  const cat = String(notif.category || notif.type || '').toLowerCase();
  const title = String(notif.title || '').toLowerCase();
  const msg = String(notif.message || '').toLowerCase();

  // Cancelled order or booking
  if (title.includes('cancel') || msg.includes('cancel') || cat.includes('cancel')) {
    return {
      label: 'Order Cancelled',
      icon: 'x-circle-fill',
      bg: '#FEF2F2',
      color: '#DC2626',
    };
  }
  // Delivered order
  if (title.includes('deliver') || msg.includes('deliver') || cat.includes('deliver')) {
    return {
      label: 'Delivered',
      icon: 'check-circle-fill',
      bg: '#ECFDF5',
      color: '#059669',
    };
  }
  // Out for delivery / in transit
  if (title.includes('out for delivery') || msg.includes('out for delivery') || title.includes('shipped') || msg.includes('shipped')) {
    return {
      label: 'In Transit',
      icon: 'truck',
      bg: '#EFF6FF',
      color: '#2563EB',
    };
  }
  // Pitstop / Garage Booking
  if (cat.includes('booking') || cat.includes('service') || cat.includes('garage') || cat.includes('pit')) {
    return {
      label: 'Booking',
      icon: 'calendar-check',
      bg: '#FDF4E7',
      color: '#D97706',
    };
  }
  // Order general / dispatch
  if (cat.includes('order') || cat.includes('dispatch') || cat.includes('ship')) {
    return {
      label: 'Order',
      icon: 'box-seam',
      bg: '#EFF6FF',
      color: '#2563EB',
    };
  }
  // Payment
  if (cat.includes('payment') || cat.includes('paid') || cat.includes('spend')) {
    return {
      label: 'Payment',
      icon: 'credit-card-2-front',
      bg: '#ECFDF5',
      color: '#059669',
    };
  }
  // Stock / Inventory
  if (cat.includes('stock') || cat.includes('inventory') || cat.includes('restock')) {
    return {
      label: 'Inventory',
      icon: 'exclamation-diamond',
      bg: '#FEF2F2',
      color: '#DC2626',
    };
  }
  // System / Security
  if (cat.includes('security') || cat.includes('system') || cat.includes('alert')) {
    return {
      label: 'System',
      icon: 'shield-exclamation',
      bg: '#F3E8FF',
      color: '#7C3AED',
    };
  }
  // Promotion / Discount
  if (cat.includes('promo') || cat.includes('discount') || cat.includes('welcome')) {
    return {
      label: 'Promotion',
      icon: 'ticket-perforated',
      bg: '#FEF3C7',
      color: '#D97706',
    };
  }
  return {
    label: notif.categoryLabel || 'Notice',
    icon: notif.icon || 'bell',
    bg: '#F4F3F0',
    color: '#6B6862',
  };
}

export default function NotificationsPage({
  isAdmin: propIsAdmin = false,
  onNavigateBack,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToShop,
}) {
  const { isDarkMode = false } = useTheme?.() || {};
  const { currentUser } = useAuth();
  const isAdmin = propIsAdmin || currentUser?.role === 'admin';
  const [notifications, setNotifications] = useState(() =>
    isAdmin
      ? notificationService.getAdminNotifications()
      : notificationService.getCustomerNotifications(currentUser?.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedCardIds, setExpandedCardIds] = useState(() => new Set());

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      if (isAdmin) {
        setNotifications(notificationService.getAdminNotifications());
      } else {
        setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
      }
    });
    return () => unsub?.();
  }, [isAdmin, currentUser?.id]);

  useEffect(() => {
    notificationService.syncFromDatabase().catch(() => {});
  }, [isAdmin]);

  const handleMarkAllRead = async () => {
    if (isAdmin) {
      await notificationService.markAllAdminAsRead();
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.markAllCustomerAsRead(currentUser?.id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
  };

  const toggleCardExpanded = (id, notif) => {
    if (notif && notif.status === 'unread') {
      notificationService.markAsRead(id);
      if (isAdmin) {
        setNotifications(notificationService.getAdminNotifications());
      } else {
        setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
      }
    }
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNotificationPress = async (notif) => {
    if (notif.status === 'unread') {
      await notificationService.markAsRead(notif.id);
      if (isAdmin) {
        setNotifications(notificationService.getAdminNotifications());
      } else {
        setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
      }
    }

    if (notif.link === 'orders' || notif.type === 'order') {
      onNavigateToOrders?.();
    } else if (notif.link === 'garage' || notif.link === 'bookings' || notif.type === 'booking') {
      onNavigateToGarage?.();
    } else if (notif.link === 'shop' || notif.type === 'promo') {
      onNavigateToShop?.();
    }
  };

  const handleDeleteNotification = async (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    await notificationService.deleteNotification(id);
    if (isAdmin) {
      setNotifications(notificationService.getAdminNotifications());
    } else {
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeFilter === 'unread' && notif.status !== 'unread') return false;
      if (activeFilter === 'booking' && notif.type !== 'booking') return false;
      if (activeFilter === 'order' && notif.type !== 'order') return false;
      if (activeFilter === 'promo' && notif.type !== 'promo' && notif.type !== 'welcome') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (notif.title || '').toLowerCase();
        const m = (notif.message || '').toLowerCase();
        const c = (notif.category || '').toLowerCase();
        return t.includes(q) || m.includes(q) || c.includes(q);
      }
      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  const groupedSections = useMemo(() => {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    const buckets = {
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };

    filteredNotifications.forEach((n) => {
      const timeVal = n.created_at || n.timestamp || n.date;
      const itemTime = timeVal ? new Date(timeVal).getTime() : now;
      const diff = now - itemTime;

      if (isNaN(diff) || diff <= oneWeekMs) {
        buckets.thisWeek.push(n);
      } else if (diff <= oneMonthMs) {
        buckets.thisMonth.push(n);
      } else {
        buckets.earlier.push(n);
      }
    });

    const sections = [];
    if (buckets.thisWeek.length > 0) {
      sections.push({
        key: 'thisWeek',
        title: 'THIS WEEK',
        count: buckets.thisWeek.length,
        items: buckets.thisWeek,
      });
    }
    if (buckets.thisMonth.length > 0) {
      sections.push({
        key: 'thisMonth',
        title: 'THIS MONTH',
        count: buckets.thisMonth.length,
        items: buckets.thisMonth,
      });
    }
    if (buckets.earlier.length > 0) {
      sections.push({
        key: 'earlier',
        title: 'EARLIER',
        count: buckets.earlier.length,
        items: buckets.earlier,
      });
    }

    if (sections.length === 0 && filteredNotifications.length > 0) {
      sections.push({
        key: 'all',
        title: 'ALL NOTIFICATIONS',
        count: filteredNotifications.length,
        items: filteredNotifications,
      });
    }

    return sections;
  }, [filteredNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.status === 'unread').length;
  }, [notifications]);

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#24272B' }]}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* Top Header (Matching Garage Native Header) */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#24272B' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {onNavigateBack && (
            <TouchableOpacity onPress={onNavigateBack} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Back">
              <BootstrapIcon name="chevron-left" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Notifications</Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.readAllBtn} activeOpacity={0.7} accessibilityLabel="Mark all read">
            <BootstrapIcon name="check2-all" size={13} color="#EA580C" />
            <Text style={styles.readAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar matching Web */}
      <View style={[styles.searchWrapper, isDarkMode && { backgroundColor: '#181A1D' }]}>
        <View style={[styles.searchContainer, isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' }]}>
          <BootstrapIcon name="search" size={14} color="#94A3B8" />
          <TextInput
            style={[styles.searchInput, isDarkMode && { color: '#F9FAFB' }]}
            placeholder="Search notifications..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs matching Web */}
      <View style={[styles.filtersScroll, isDarkMode && { backgroundColor: '#181A1D', borderBottomColor: '#2B3035' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {[
            { id: 'all', label: `All (${notifications.length})` },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'order', label: 'Orders' },
            { id: 'booking', label: 'Pitstop' },
            { id: 'promo', label: 'Offers' },
          ].map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterChip,
                  isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' },
                  isActive && (isDarkMode ? { backgroundColor: '#EA580C', borderColor: '#EA580C' } : styles.filterChipActive),
                ]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isDarkMode && { color: '#94A3B8' },
                    isActive && (isDarkMode ? { color: '#FFFFFF', fontWeight: '700' } : styles.filterChipTextActive),
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Grouped Notifications List matching Web */}
      <ScrollView
        style={{ flex: 1, backgroundColor: isDarkMode ? '#121518' : '#F8FAFC' }}
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, backgroundColor: isDarkMode ? '#121518' : '#F8FAFC' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {groupedSections.length === 0 ? (
          <View style={[styles.emptyContainer, isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' }]}>
            <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: '#23272B' }]}>
              <BootstrapIcon name="bell-slash" size={26} color="#94A3B8" />
            </View>
            <Text style={[styles.emptyTitle, isDarkMode && { color: '#F9FAFB' }]}>No notifications</Text>
            <Text style={[styles.emptySubtitle, isDarkMode && { color: '#94A3B8' }]}>
              {searchQuery
                ? 'No notifications match your search query.'
                : activeFilter === 'unread'
                ? "You're all caught up! No unread messages."
                : activeFilter !== 'all'
                ? `No ${activeFilter} notifications available.`
                : 'Live order updates, pit bookings, and special promos will appear here.'}
            </Text>
            {onNavigateToShop && (
              <TouchableOpacity style={styles.emptyActionBtn} onPress={onNavigateToShop} activeOpacity={0.85}>
                <Text style={styles.emptyActionText}>Explore Store</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          groupedSections.map((section) => (
            <View key={section.key} style={{ marginBottom: 16 }}>
              {/* Section Header */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && { color: '#94A3B8' }]}>{section.title}</Text>
                <View style={[styles.sectionBadgeCircle, isDarkMode && { backgroundColor: '#2B3035' }]}>
                  <Text style={[styles.sectionBadgeText, isDarkMode && { color: '#E2E8F0' }]}>{section.count}</Text>
                </View>
              </View>

              {/* Cards List */}
              <View style={{ gap: 12 }}>
                {section.items.map((notif) => {
                  const isExpanded = expandedCardIds.has(notif.id);
                  const isUnread = notif.status === 'unread';
                  const config = getCategoryConfig(notif);

                  return (
                    <View
                      key={notif.id}
                      style={[
                        styles.card,
                        isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' },
                        isUnread && (isDarkMode ? { borderColor: '#EA580C' } : styles.cardUnread),
                      ]}
                    >
                      {/* Top Clickable Header Row */}
                      <TouchableOpacity
                        style={styles.cardHeaderRow}
                        onPress={() => toggleCardExpanded(notif.id, notif)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardHeaderLeft}>
                          {/* Circular icon badge */}
                          <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#23272B' : config.bg }]}>
                            <BootstrapIcon name={config.icon} size={15} color={config.color} />
                          </View>

                          <View style={styles.cardTitleWrap}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text
                                style={[
                                  styles.cardTitle,
                                  isDarkMode && { color: '#F9FAFB' },
                                  isUnread && (isDarkMode ? { color: '#FFFFFF', fontWeight: '700' } : styles.cardTitleUnread),
                                ]}
                              >
                                {stripEmojis(notif.title)}
                              </Text>
                              {isUnread && <View style={[styles.unreadDot, isDarkMode && { backgroundColor: '#EA580C' }]} />}
                            </View>

                            {!isExpanded && (
                              <Text style={[styles.cardPreviewText, isDarkMode && { color: '#94A3B8' }]} numberOfLines={1}>
                                {stripEmojis(notif.message)}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.cardHeaderRight}>
                          <Text style={[styles.relativeTimeText, isDarkMode && { color: '#64748B' }]}>
                            {formatRelativeTime(notif.created_at || notif.timestamp || notif.date)}
                          </Text>
                          <View style={{ padding: 2 }}>
                            <BootstrapIcon
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={13}
                              color={isDarkMode ? '#94A3B8' : '#8E8E93'}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded Card Body */}
                      {isExpanded && (
                        <View style={styles.cardExpandedBody}>
                          <Text style={[styles.cardFullMessage, isDarkMode && { color: '#E2E8F0' }]}>
                            {stripEmojis(notif.message)}
                          </Text>

                          {/* Subtle Divider Line */}
                          <View style={[styles.cardDivider, isDarkMode && { backgroundColor: '#2B3035' }]} />

                          {/* Footer */}
                          <View style={styles.cardFooterRow}>
                            <Text style={[styles.cardMetadataText, isDarkMode && { color: '#64748B' }]}>
                              {formatFullDate(notif.created_at || notif.timestamp || notif.date)} · {config.label}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              {(notif.link || notif.type === 'order' || notif.type === 'booking') && (
                                <TouchableOpacity
                                  style={[styles.actionBtn, isDarkMode && { backgroundColor: 'rgba(234, 88, 12, 0.15)' }]}
                                  onPress={() => handleNotificationPress(notif)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.actionBtnText}>
                                    {notif.type === 'order' ? 'View Order' : notif.type === 'booking' ? 'View Bay' : 'Open'}
                                  </Text>
                                  <BootstrapIcon name="chevron-right" size={10} color="#EA580C" />
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                style={styles.dismissBtn}
                                onPress={(e) => handleDeleteNotification(notif.id, e)}
                                activeOpacity={0.7}
                              >
                                <BootstrapIcon name="trash3" size={12} color={isDarkMode ? '#94A3B8' : '#71717A'} />
                                <Text style={[styles.dismissBtnText, isDarkMode && { color: '#94A3B8' }]}>Dismiss</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#24272B', paddingTop: ANDROID_TOP_INSET },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#24272B',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E2124',
    borderWidth: 1,
    borderColor: '#363C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  unreadPillBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadPillBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E2124',
    borderWidth: 1,
    borderColor: '#363C44',
  },
  readAllText: { fontSize: 12, fontWeight: '700', color: '#EA580C' },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 4,
  },
  filtersScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  filtersRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.8,
  },
  sectionBadgeCircle: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E4E4E7',
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#52525B',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardUnread: {
    borderColor: '#CBD5E1',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#27272A',
    lineHeight: 20,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: '#09090B',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#18181B',
  },
  cardPreviewText: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 4,
    lineHeight: 18,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    marginTop: 4,
  },
  relativeTimeText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  cardExpandedBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  cardFullMessage: {
    fontSize: 13.5,
    color: '#3F3F46',
    lineHeight: 21,
    paddingLeft: 50,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F4F4F5',
    marginVertical: 12,
    marginLeft: 50,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 50,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardMetadataText: {
    fontSize: 11.5,
    color: '#8E8E93',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dismissBtnText: {
    fontSize: 11.5,
    color: '#71717A',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#18181B' },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#EA580C',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  emptyActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
