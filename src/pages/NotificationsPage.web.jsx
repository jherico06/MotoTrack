import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { BootstrapIcon } from '../components/common';
import { notificationService, stripEmojis } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import ProfilePage from './ProfilePage.web';

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
  const cat = String(notif.category || notif.type || '').toLowerCase();

  if (cat.includes('booking') || cat.includes('service') || cat.includes('garage') || cat.includes('pit')) {
    return {
      label: 'Booking',
      icon: 'calendar-check',
      bg: '#FDF4E7',
      color: '#D97706',
    };
  }
  if (cat.includes('order') || cat.includes('dispatch') || cat.includes('ship')) {
    return {
      label: 'Order',
      icon: 'box-seam',
      bg: '#EFF6FF',
      color: '#2563EB',
    };
  }
  if (cat.includes('payment') || cat.includes('paid') || cat.includes('spend')) {
    return {
      label: 'Payment',
      icon: 'credit-card-2-front',
      bg: '#ECFDF5',
      color: '#059669',
    };
  }
  if (cat.includes('stock') || cat.includes('inventory') || cat.includes('restock')) {
    return {
      label: 'Inventory',
      icon: 'exclamation-diamond',
      bg: '#FEF2F2',
      color: '#DC2626',
    };
  }
  if (cat.includes('security') || cat.includes('system') || cat.includes('alert')) {
    return {
      label: 'System',
      icon: 'shield-exclamation',
      bg: '#F3E8FF',
      color: '#7C3AED',
    };
  }
  if (cat.includes('promo') || cat.includes('discount')) {
    return {
      label: 'Promotion',
      icon: 'ticket-perforated',
      bg: '#FEF3C7',
      color: '#D97706',
    };
  }
  return {
    label: notif.categoryLabel || 'Notice',
    icon: 'bell',
    bg: '#F4F3F0',
    color: '#6B6862',
  };
}

export default function NotificationsPage({
  isAdmin: propIsAdmin = false,
  isDarkMode = false,
  onNavigateBack,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToShop,
  onNavigateToAdmin,
  onNavigateToInventory,
  onNavigateToSuppliers,
  onNavigateToUsers,
  onNavigateToSettings,
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { currentUser } = useAuth();
  const isAdmin = propIsAdmin || currentUser?.role === 'admin';

  const [notifications, setNotifications] = useState(() =>
    isAdmin
      ? notificationService.getAdminNotifications()
      : notificationService.getCustomerNotifications(currentUser?.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());
  const [dbAlertCount, setDbAlertCount] = useState(() =>
    isAdmin ? notificationService.getDatabaseAlertsCount() : 0
  );

  const handleSyncDatabase = async (isManual = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await notificationService.syncFromDatabase({ force: true });
      if (isAdmin) {
        const fresh = notificationService.getAdminNotifications();
        setNotifications(fresh);
        const count = notificationService.getDatabaseAlertsCount();
        setDbAlertCount(count);
        if (isManual) {
          showToast(`✓ Database synchronized: ${count} live alerts active`);
        }
      }
    } catch (err) {
      console.warn('[NotificationsPage.web] sync error:', err);
      if (isManual) {
        showToast('⚠️ Sync complete with cached system events');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearSampleAlerts = async () => {
    if (!isAdmin) return;
    const remaining = await notificationService.clearSampleNotifications();
    setNotifications(remaining);
    const count = notificationService.getDatabaseAlertsCount();
    setDbAlertCount(count);
    showToast(`✓ Mock notifications removed (${count} live database alerts remaining)`);
  };

  useEffect(() => {
    const unsub = notificationService.subscribe((data) => {
      if (isAdmin) {
        setNotifications(data?.admin || notificationService.getAdminNotifications());
        setDbAlertCount(notificationService.getDatabaseAlertsCount());
      } else {
        setNotifications(
          data?.customer || notificationService.getCustomerNotifications(currentUser?.id)
        );
      }
    });
    return () => unsub?.();
  }, [isAdmin, currentUser?.id]);

  useEffect(() => {
    if (isAdmin) {
      handleSyncDatabase(false);
    }
  }, [isAdmin]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleMarkAllRead = async () => {
    if (isAdmin) {
      await notificationService.markAllAdminAsRead();
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.markAllCustomerAsRead(currentUser?.id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
    showToast('✓ All notifications marked as read');
  };

  const handleMarkSingleRead = async (id) => {
    if (isAdmin) {
      await notificationService.markAdminAsRead(id);
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.markCustomerAsRead(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
  };

  const handleDeleteSingle = async (id, e) => {
    e?.stopPropagation?.();
    if (isAdmin) {
      await notificationService.deleteAdminNotification(id);
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.deleteCustomerNotification(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
    showToast('Notification dismissed');
  };

  const toggleCardExpanded = (id, notif) => {
    if (notif && notif.status === 'unread') {
      handleMarkSingleRead(id);
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

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeFilter === 'unread' && notif.status !== 'unread') return false;

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

  // Chronologically grouped sections (e.g., THIS WEEK, THIS MONTH, EARLIER)
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

  const totalUnread = useMemo(
    () => notifications.filter((n) => n.status === 'unread').length,
    [notifications]
  );

  return (
    <SafeAreaView style={[styles.pageWrapper, { backgroundColor: isDarkMode ? '#0E1311' : '#F9F8F6' }]}>
      {/* Toast Alert */}
      {Boolean(toastMessage) && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Top Action Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            {onNavigateBack && (
              <TouchableOpacity style={styles.backBtn} onPress={onNavigateBack} activeOpacity={0.7}>
                <BootstrapIcon name="chevron-left" size={14} color="#52525B" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            <View style={styles.pageTitleGroup}>
              <Text style={[styles.pageTitle, { color: isDarkMode ? '#F4F4F5' : '#18181B' }]}>
                Notifications
              </Text>
              {totalUnread > 0 && (
                <View style={styles.unreadBadgePill}>
                  <Text style={styles.unreadBadgePillText}>{totalUnread} UNREAD</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.pillActionBtn}
              onPress={() => handleSyncDatabase(true)}
              disabled={isSyncing}
              activeOpacity={0.7}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#18181B" />
              ) : (
                <BootstrapIcon name="arrow-repeat" size={13} color="#52525B" />
              )}
              <Text style={styles.pillActionBtnText}>{isSyncing ? 'Syncing...' : 'Sync Data'}</Text>
            </TouchableOpacity>

            {notifications.length > 0 && (
              <TouchableOpacity style={styles.pillActionBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
                <BootstrapIcon name="check2-all" size={14} color="#52525B" />
                <Text style={styles.pillActionBtnText}>Mark all read</Text>
              </TouchableOpacity>
            )}

            {statsHaveMock(notifications) && (
              <TouchableOpacity style={styles.pillActionBtn} onPress={handleClearSampleAlerts} activeOpacity={0.7}>
                <BootstrapIcon name="trash3" size={13} color="#D97706" />
                <Text style={[styles.pillActionBtnText, { color: '#D97706' }]}>Clear Mock</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.controlsBar}>
          <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#18181B' : '#FFFFFF' }]}>
            <BootstrapIcon name="search" size={14} color="#A1A1AA" />
            <TextInput
              style={[styles.searchInput, { color: isDarkMode ? '#F4F4F5' : '#18181B' }]}
              placeholder="Search notifications..."
              placeholderTextColor="#A1A1AA"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <BootstrapIcon name="x-circle-fill" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterPills}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
                All ({notifications.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'unread' && styles.filterPillActive]}
              onPress={() => setActiveFilter('unread')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, activeFilter === 'unread' && styles.filterPillTextActive]}>
                Unread ({totalUnread})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Grouped Notifications List */}
        {groupedSections.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <BootstrapIcon name="bell-slash" size={26} color="#A1A1AA" />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up.</Text>
          </View>
        ) : (
          groupedSections.map((section) => (
            <View key={section.key} style={styles.sectionContainer}>
              {/* Group Section Header matching Reference Screenshot 1 */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionBadgeCircle}>
                  <Text style={styles.sectionBadgeText}>{section.count}</Text>
                </View>
              </View>

              {/* List of Large Expandable Notification Cards */}
              <View style={styles.cardsList}>
                {section.items.map((notif) => {
                  const isExpanded = expandedCardIds.has(notif.id);
                  const isUnread = notif.status === 'unread';
                  const config = getCategoryConfig(notif);

                  return (
                    <View
                      key={notif.id}
                      style={[
                        styles.cardContainer,
                        isUnread && styles.cardUnread,
                        { backgroundColor: isDarkMode ? '#18181B' : '#FFFFFF' },
                      ]}
                    >
                      {/* Top Clickable Header Row */}
                      <TouchableOpacity
                        style={styles.cardHeaderRow}
                        onPress={() => toggleCardExpanded(notif.id, notif)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardHeaderLeft}>
                          {/* Soft circular icon container */}
                          <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                            <BootstrapIcon name={config.icon} size={15} color={config.color} />
                          </View>

                          <View style={styles.cardTitleWrap}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
                                {stripEmojis(notif.title)}
                              </Text>
                              {isUnread && <View style={styles.unreadDot} />}
                            </View>

                            {!isExpanded && (
                              <Text style={styles.cardPreviewText} numberOfLines={1}>
                                {stripEmojis(notif.message)}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.cardHeaderRight}>
                          <Text style={styles.relativeTimeText}>
                            {formatRelativeTime(notif.created_at)}
                          </Text>
                          <View style={styles.chevronWrap}>
                            <BootstrapIcon
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={14}
                              color="#8E8E93"
                            />
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded Card Body */}
                      {isExpanded && (
                        <View style={styles.cardExpandedBody}>
                          <Text style={styles.cardFullMessage}>{stripEmojis(notif.message)}</Text>

                          {/* Subtle Divider Line */}
                          <View style={styles.cardDivider} />

                          {/* Footer */}
                          <View style={styles.cardFooterRow}>
                            <Text style={styles.cardMetadataText}>
                              {formatFullDate(notif.created_at)} · {config.label}
                            </Text>

                            <TouchableOpacity
                              style={styles.dismissBtn}
                              onPress={(e) => handleDeleteSingle(notif.id, e)}
                              activeOpacity={0.7}
                            >
                              <BootstrapIcon name="trash3" size={13} color="#71717A" />
                              <Text style={styles.dismissBtnText}>Dismiss</Text>
                            </TouchableOpacity>
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

function statsHaveMock(notifs) {
  return notifs.some((n) => !n.isDatabaseLive && (!n.id || !String(n.id).startsWith('db-')));
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContainer: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
  },
  pageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  unreadBadgePill: {
    backgroundColor: '#18181B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadBadgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  pillActionBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3F3F46',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    outlineStyle: 'none',
  },
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#E4E4E7',
  },
  filterPillActive: {
    backgroundColor: '#18181B',
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#52525B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.8,
  },
  sectionBadgeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#52525B',
  },
  cardsList: {
    gap: 14,
  },
  cardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: '#D4D4D8',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 18,
    gap: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
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
    gap: 12,
    flexShrink: 0,
    marginTop: 4,
  },
  relativeTimeText: {
    fontSize: 12.5,
    color: '#8E8E93',
  },
  chevronWrap: {
    padding: 2,
  },
  cardExpandedBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 0,
  },
  cardFullMessage: {
    fontSize: 14,
    color: '#3F3F46',
    lineHeight: 22,
    marginTop: 4,
    paddingLeft: 52,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F4F4F5',
    marginVertical: 14,
    marginLeft: 52,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 52,
  },
  cardMetadataText: {
    fontSize: 12,
    color: '#8E8E93',
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
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
  },
  emptyCard: {
    padding: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181B',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 4,
  },
});
