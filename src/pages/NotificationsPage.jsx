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
import { notificationService, stripEmojis } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

function getNotificationIcon(type) {
  switch (type) {
    case 'booking':
      return { icon: 'tools', color: '#0C6258', bg: '#DCFCE7' };
    case 'order':
      return { icon: 'box-seam', color: '#2563EB', bg: '#DBEAFE' };
    case 'promo':
      return { icon: 'lightning-charge', color: '#D97706', bg: '#FEF3C7' };
    case 'security':
    case 'system':
      return { icon: 'shield-lock', color: '#7C3AED', bg: '#EDE9FE' };
    default:
      return { icon: 'bell', color: '#0C6258', bg: '#E6F4F1' };
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
    const unsub = notificationService.subscribe((data) => {
      if (isAdmin) {
        setNotifications(data?.admin || notificationService.getAdminNotifications());
      } else {
        setNotifications(data?.customer || notificationService.getCustomerNotifications(currentUser?.id));
      }
    });
    return () => unsub?.();
  }, [isAdmin, currentUser?.id]);

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
    if (isAdmin) {
      await notificationService.clearAllAdmin();
      setNotifications([]);
    } else {
      await notificationService.clearAllCustomer(currentUser?.id);
      setNotifications([]);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeFilter === 'unread' && notif.status !== 'unread') return false;
      if (activeFilter === 'booking' && notif.type !== 'booking') return false;
      if (activeFilter === 'order' && notif.type !== 'order') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (notif.title || '').toLowerCase().includes(q) || (notif.message || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {onNavigateBack && (
            <TouchableOpacity onPress={onNavigateBack} style={styles.backBtn}>
              <BootstrapIcon name="chevron-left" size={18} color="#0F172A" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity onPress={handleMarkAllRead} style={styles.readAllBtn}>
          <Text style={styles.readAllText}>Mark read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filteredNotifications.map((notif) => {
          const iconMeta = getNotificationIcon(notif.type);
          return (
            <View key={notif.id} style={styles.card}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: iconMeta.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name={iconMeta.icon} size={17} color={iconMeta.color} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{stripEmojis(notif.title)}</Text>
                    {notif.status === 'unread' && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardMessage}>{stripEmojis(notif.message)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 6 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  readAllBtn: { padding: 6 },
  readAllText: { fontSize: 13, fontWeight: '600', color: '#0C6258' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E11D48' },
  cardMessage: { fontSize: 12.5, color: '#64748B', lineHeight: 17 },
});
