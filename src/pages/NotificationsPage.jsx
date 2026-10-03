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
import { BootstrapIcon } from '../components/common';
import { StatusBar } from 'expo-status-bar';
import { notificationService, stripEmojis } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { ANDROID_TOP_INSET } from '../utils/safeArea';

function getNotificationIcon(type) {
  switch (type) {
    case 'booking':
      return { icon: 'tools', color: '#1D4533', bg: '#DCFCE7' };
    case 'order':
      return { icon: 'box-seam', color: '#2563EB', bg: '#DBEAFE' };
    case 'promo':
    case 'welcome':
      return { icon: 'lightning-charge', color: '#D97706', bg: '#FEF3C7' };
    case 'security':
    case 'system':
      return { icon: 'shield-lock', color: '#7C3AED', bg: '#EDE9FE' };
    default:
      return { icon: 'bell', color: '#1D4533', bg: '#E8F0EC' };
  }
}

function formatNotificationTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch (_e) {
    return '';
  }
}

export default function NotificationsPage({
  isAdmin: propIsAdmin = false,
  onNavigateBack,
  onNavigateToOrders,
  onNavigateToGarage,
  onNavigateToShop,
}) {
  const { currentUser } = useAuth();
  const isAdmin = propIsAdmin || currentUser?.role === 'admin';
  const [notifications, setNotifications] = useState(() =>
    isAdmin
      ? notificationService.getAdminNotifications()
      : notificationService.getCustomerNotifications(currentUser?.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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
        return (notif.title || '').toLowerCase().includes(q) || (notif.message || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.status === 'unread').length;
  }, [notifications]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {onNavigateBack && (
            <TouchableOpacity onPress={onNavigateBack} style={styles.backBtn} activeOpacity={0.7}>
              <BootstrapIcon name="chevron-left" size={18} color="#0F172A" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={{ fontSize: 11.5, color: '#1D4533', fontWeight: '700' }}>
                {unreadCount} unread alert{unreadCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.readAllBtn} activeOpacity={0.7}>
            <Text style={styles.readAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <BootstrapIcon name="search" size={14} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search alerts and updates..."
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

      {/* Filter Tabs */}
      <View style={styles.filtersScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'order', label: 'Orders' },
            { id: 'booking', label: 'Bookings' },
            { id: 'promo', label: 'Promos' },
          ].map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <BootstrapIcon name="bell-slash" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No notifications match your search query.'
                : activeFilter === 'unread'
                ? "You're all caught up! No unread alerts."
                : 'Order updates, pit bookings, and special promos will appear here.'}
            </Text>
            {onNavigateToShop && (
              <TouchableOpacity style={styles.emptyActionBtn} onPress={onNavigateToShop} activeOpacity={0.85}>
                <Text style={styles.emptyActionText}>Explore MotoTrack Store</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredNotifications.map((notif) => {
            const iconMeta = getNotificationIcon(notif.type);
            const isUnread = notif.status === 'unread';
            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.card, isUnread && styles.cardUnread]}
                onPress={() => handleNotificationPress(notif)}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: iconMeta.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name={iconMeta.icon} size={18} color={iconMeta.color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, isUnread && { fontWeight: '800', color: '#0F172A' }]}>
                        {stripEmojis(notif.title)}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.cardMessage}>{stripEmojis(notif.message)}</Text>
                    
                    <View style={styles.cardFooter}>
                      <Text style={styles.timeText}>{formatNotificationTime(notif.created_at)}</Text>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={(e) => handleDeleteNotification(notif.id, e)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <BootstrapIcon name="trash" size={12} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: ANDROID_TOP_INSET },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  readAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E8F0EC',
  },
  readAllText: { fontSize: 12, fontWeight: '700', color: '#1D4533' },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
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
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#1D4533',
    borderColor: '#1D4533',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: '#A7F3D0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#1D4533',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D4533' },
  cardMessage: { fontSize: 12.5, color: '#475569', lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  timeText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  deleteBtn: { padding: 4 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: '#1D4533',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

