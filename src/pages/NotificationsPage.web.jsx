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
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../components/common';
import { notificationService, stripEmojis } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

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
  const isDesktop = width >= 768;
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

  const handleClearRead = async () => {
    if (isAdmin) {
      const unreadOnly = notifications.filter((n) => n.status === 'unread');
      notificationService.adminNotifications = unreadOnly;
      await notificationService.persist();
      notificationService.notify();
      setNotifications(unreadOnly);
    } else {
      const unreadOnly = notifications.filter((n) => n.status === 'unread');
      notificationService.customerNotifications = unreadOnly;
      await notificationService.persist();
      notificationService.notify();
      setNotifications(unreadOnly);
    }
    showToast('✓ Cleared read notifications');
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

  const handleMarkSingleUnread = async (id) => {
    if (isAdmin) {
      await notificationService.markAdminAsUnread(id);
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.markCustomerAsUnread(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
  };

  const handleDeleteSingle = async (id) => {
    if (isAdmin) {
      await notificationService.deleteAdminNotification(id);
      setNotifications(notificationService.getAdminNotifications());
    } else {
      await notificationService.deleteCustomerNotification(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
    showToast('Notification removed');
  };

  // ─── STATS & COUNTERS ───
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => n.status === 'unread').length;

    if (isAdmin) {
      const orders = notifications.filter(
        (n) =>
          n.category === 'order_placed' ||
          n.category === 'payment_confirmed' ||
          n.category === 'order_status' ||
          n.type === 'order' ||
          n.type === 'payment'
      ).length;

      const inventory = notifications.filter(
        (n) =>
          n.category === 'low_stock' ||
          n.category === 'out_of_stock' ||
          n.category === 'restock_attention' ||
          n.category === 'restock_recommendation' ||
          n.type === 'inventory' ||
          n.type === 'procurement'
      ).length;

      const bookings = notifications.filter(
        (n) =>
          n.category === 'booking_new' ||
          n.category === 'booking_cancelled' ||
          n.category === 'service_approaching' ||
          n.category === 'service_completed' ||
          n.type === 'booking'
      ).length;

      const customers = notifications.filter(
        (n) =>
          n.category === 'customer_registered' ||
          n.category === 'review_submitted' ||
          n.type === 'user' ||
          n.type === 'review'
      ).length;

      const system = notifications.filter(
        (n) =>
          n.category === 'sales_update' ||
          n.category === 'security_activity' ||
          n.type === 'system' ||
          n.type === 'sales'
      ).length;

      return { total, unread, orders, inventory, bookings, customers, system };
    }

    const bookings = notifications.filter((n) => n.type === 'booking').length;
    const orders = notifications.filter((n) => n.type === 'order').length;
    return { total, unread, bookings, orders };
  }, [notifications, isAdmin]);

  // ─── FILTERED NOTIFICATIONS FEED ───
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeFilter === 'unread' && notif.status !== 'unread') return false;

      if (isAdmin) {
        if (activeFilter === 'orders') {
          const match =
            notif.category === 'order_placed' ||
            notif.category === 'payment_confirmed' ||
            notif.category === 'order_status' ||
            notif.type === 'order' ||
            notif.type === 'payment';
          if (!match) return false;
        }

        if (activeFilter === 'inventory') {
          const match =
            notif.category === 'low_stock' ||
            notif.category === 'out_of_stock' ||
            notif.category === 'restock_attention' ||
            notif.category === 'restock_recommendation' ||
            notif.type === 'inventory' ||
            notif.type === 'procurement';
          if (!match) return false;
        }

        if (activeFilter === 'garage') {
          const match =
            notif.category === 'booking_new' ||
            notif.category === 'booking_cancelled' ||
            notif.category === 'service_approaching' ||
            notif.category === 'service_completed' ||
            notif.type === 'booking';
          if (!match) return false;
        }

        if (activeFilter === 'customers') {
          const match =
            notif.category === 'customer_registered' ||
            notif.category === 'review_submitted' ||
            notif.type === 'user' ||
            notif.type === 'review';
          if (!match) return false;
        }

        if (activeFilter === 'system') {
          const match =
            notif.category === 'sales_update' ||
            notif.category === 'security_activity' ||
            notif.type === 'system' ||
            notif.type === 'sales' ||
            notif.type === 'security';
          if (!match) return false;
        }
      } else {
        if (activeFilter === 'booking' && notif.type !== 'booking') return false;
        if (activeFilter === 'order' && notif.type !== 'order') return false;
        if (activeFilter === 'promo' && notif.type !== 'promo') return false;
        if (
          activeFilter === 'system' &&
          notif.type !== 'security' &&
          notif.type !== 'system'
        )
          return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (notif.title || '').toLowerCase();
        const m = (notif.message || '').toLowerCase();
        const c = (notif.category || '').toLowerCase();
        return t.includes(q) || m.includes(q) || c.includes(q);
      }
      return true;
    });
  }, [notifications, activeFilter, searchQuery, isAdmin]);

  const formatTimestamp = (isoString) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      const diffMs = Date.now() - d.getTime();
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
  };

  const getTypeMeta = (notif) => {
    const cat = notif.category || '';
    const type = notif.type || '';

    switch (cat) {
      case 'order_placed':
        return {
          icon: 'bag-check-fill',
          color: '#2563EB',
          bg: isDarkMode ? '#1E293B' : '#DBEAFE',
          label: 'New Order',
          priorityLabel: 'ORDER',
          priorityColor: '#2563EB',
        };
      case 'payment_confirmed':
        return {
          icon: 'credit-card-2-front-fill',
          color: '#059669',
          bg: isDarkMode ? '#132A26' : '#D1FAE5',
          label: 'Payment Verified',
          priorityLabel: 'PAID',
          priorityColor: '#059669',
        };
      case 'order_status':
        return {
          icon: 'truck',
          color: '#2563EB',
          bg: isDarkMode ? '#1E293B' : '#DBEAFE',
          label: 'Order Update',
          priorityLabel: 'STATUS',
          priorityColor: '#2563EB',
        };
      case 'low_stock':
        return {
          icon: 'exclamation-diamond-fill',
          color: '#D97706',
          bg: isDarkMode ? '#2D2012' : '#FEF3C7',
          label: 'Low Stock',
          priorityLabel: 'REORDER',
          priorityColor: '#D97706',
        };
      case 'out_of_stock':
        return {
          icon: 'x-octagon-fill',
          color: '#DC2626',
          bg: isDarkMode ? '#341515' : '#FEE2E2',
          label: 'Out of Stock',
          priorityLabel: 'CRITICAL',
          priorityColor: '#DC2626',
        };
      case 'booking_new':
        return {
          icon: 'wrench-adjustable-circle-fill',
          color: '#0C6258',
          bg: isDarkMode ? '#132A26' : '#D1ECE6',
          label: 'New Booking',
          priorityLabel: 'PIT BAY',
          priorityColor: '#0C6258',
        };
      case 'booking_cancelled':
        return {
          icon: 'calendar-x-fill',
          color: '#DC2626',
          bg: isDarkMode ? '#341515' : '#FEE2E2',
          label: 'Booking Cancelled',
          priorityLabel: 'CANCELLED',
          priorityColor: '#DC2626',
        };
      case 'service_approaching':
        return {
          icon: 'clock-history',
          color: '#0C6258',
          bg: isDarkMode ? '#132A26' : '#D1ECE6',
          label: 'Service Due',
          priorityLabel: 'TODAY',
          priorityColor: '#0C6258',
        };
      case 'service_completed':
        return {
          icon: 'check-circle-fill',
          color: '#059669',
          bg: isDarkMode ? '#132A26' : '#D1FAE5',
          label: 'Service Complete',
          priorityLabel: 'READY',
          priorityColor: '#059669',
        };
      case 'customer_registered':
        return {
          icon: 'person-plus-fill',
          color: '#4F46E5',
          bg: isDarkMode ? '#1E1B4B' : '#EEF2FF',
          label: 'New Customer',
          priorityLabel: 'USER',
          priorityColor: '#4F46E5',
        };
      case 'review_submitted':
        return {
          icon: 'star-fill',
          color: '#D97706',
          bg: isDarkMode ? '#2D2012' : '#FEF3C7',
          label: 'Product Review',
          priorityLabel: 'REVIEW',
          priorityColor: '#D97706',
        };
      case 'restock_attention':
        return {
          icon: 'boxes',
          color: '#DC2626',
          bg: isDarkMode ? '#341515' : '#FEE2E2',
          label: 'Restock Needed',
          priorityLabel: 'ACTION',
          priorityColor: '#DC2626',
        };
      case 'restock_recommendation':
        return {
          icon: 'cpu-fill',
          color: '#7C3AED',
          bg: isDarkMode ? '#281A42' : '#EDE9FE',
          label: 'AI Suggestion',
          priorityLabel: 'AI PLAN',
          priorityColor: '#7C3AED',
        };
      case 'sales_update':
        return {
          icon: 'graph-up-arrow',
          color: '#059669',
          bg: isDarkMode ? '#132A26' : '#D1FAE5',
          label: 'Sales Benchmark',
          priorityLabel: 'SALES',
          priorityColor: '#059669',
        };
      case 'security_activity':
        return {
          icon: 'shield-lock-fill',
          color: '#DC2626',
          bg: isDarkMode ? '#341515' : '#FEE2E2',
          label: 'Security Alert',
          priorityLabel: 'SECURITY',
          priorityColor: '#DC2626',
        };
      default:
        break;
    }

    switch (type) {
      case 'booking':
        return {
          icon: 'tools',
          color: '#0C6258',
          bg: isDarkMode ? '#132A26' : '#D1ECE6',
          label: 'Pit Bay',
        };
      case 'order':
        return {
          icon: 'box-seam-fill',
          color: '#2563EB',
          bg: isDarkMode ? '#1E293B' : '#DBEAFE',
          label: 'Order',
        };
      case 'inventory':
      case 'stock':
        return {
          icon: 'exclamation-triangle-fill',
          color: '#DC2626',
          bg: isDarkMode ? '#341515' : '#FEE2E2',
          label: 'Stock Alert',
        };
      case 'security':
      case 'system':
        return {
          icon: 'shield-lock-fill',
          color: '#7C3AED',
          bg: isDarkMode ? '#281A42' : '#EDE9FE',
          label: 'Security',
        };
      case 'promo':
        return {
          icon: 'ticket-perforated-fill',
          color: '#D97706',
          bg: isDarkMode ? '#2D2012' : '#FEF3C7',
          label: 'Promotion',
        };
      default:
        return {
          icon: 'bell-fill',
          color: '#0C6258',
          bg: isDarkMode ? '#132A26' : '#D1ECE6',
          label: 'Notification',
        };
    }
  };

  const getActionButtonLabel = (notif) => {
    if (!isAdmin) {
      if (notif.type === 'booking') return 'View Booking →';
      if (notif.type === 'order') return 'Track Order →';
      if (notif.type === 'promo') return 'View Deals →';
      return 'View Details →';
    }

    switch (notif.category) {
      case 'order_placed':
      case 'order_status':
        return 'View Order →';
      case 'payment_confirmed':
        return 'Inspect Order →';
      case 'low_stock':
      case 'out_of_stock':
      case 'restock_recommendation':
        return 'Manage Stock →';
      case 'booking_new':
      case 'service_approaching':
        return 'Pit Bay Queue →';
      case 'booking_cancelled':
      case 'service_completed':
        return 'View Booking →';
      case 'customer_registered':
        return 'View Customer →';
      case 'review_submitted':
        return 'Moderate Reviews →';
      case 'restock_attention':
        return 'Review PO →';
      case 'sales_update':
        return 'View Sales →';
      case 'security_activity':
        return 'Security Settings →';
      default:
        return 'Open →';
    }
  };

  const handleCardAction = (notif) => {
    handleMarkSingleRead(notif.id);

    if (isAdmin) {
      if (
        notif.link === 'orders' ||
        notif.category === 'order_placed' ||
        notif.category === 'payment_confirmed' ||
        notif.category === 'order_status'
      ) {
        if (onNavigateToOrders) return onNavigateToOrders();
      }
      if (
        notif.link === 'garage' ||
        notif.category === 'booking_new' ||
        notif.category === 'booking_cancelled' ||
        notif.category === 'service_approaching' ||
        notif.category === 'service_completed'
      ) {
        if (onNavigateToGarage) return onNavigateToGarage();
      }
      if (
        notif.link === 'inventory' ||
        notif.category === 'low_stock' ||
        notif.category === 'out_of_stock' ||
        notif.category === 'restock_recommendation'
      ) {
        if (onNavigateToInventory) return onNavigateToInventory();
      }
      if (notif.link === 'users' || notif.category === 'customer_registered') {
        if (onNavigateToUsers) return onNavigateToUsers();
      }
      if (notif.link === 'suppliers' || notif.category === 'restock_attention') {
        if (onNavigateToSuppliers) return onNavigateToSuppliers();
      }
      if (notif.link === 'settings' || notif.category === 'security_activity') {
        if (onNavigateToSettings) return onNavigateToSettings();
      }
      if (notif.link === 'overview' || notif.category === 'sales_update') {
        if (onNavigateToAdmin) return onNavigateToAdmin();
      }
      if (onNavigateToAdmin) return onNavigateToAdmin();
    } else {
      if (notif.link === 'bookings' || notif.link === 'garage') {
        if (onNavigateToGarage) onNavigateToGarage();
      } else if (notif.link === 'orders') {
        if (onNavigateToOrders) onNavigateToOrders();
      } else {
        if (onNavigateToShop) onNavigateToShop();
      }
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' },
      ]}
    >
      {/* Toast Alert */}
      {Boolean(toastMessage) && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* ─── COMPACT TOP NAVBAR ─── */}
      <View
        style={[
          styles.navbar,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.navLeft}>
          {onNavigateBack && !isAdmin && (
            <TouchableOpacity
              style={[
                styles.backBtn,
                { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
              ]}
              onPress={onNavigateBack}
              activeOpacity={0.7}
            >
              <BootstrapIcon
                name="chevron-left"
                size={14}
                color={isDarkMode ? '#F8FAFC' : '#0F172A'}
              />
              <Text
                style={[
                  styles.backBtnText,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.headerTitleWrap}>
            <View
              style={[
                styles.bellIconCircle,
                {
                  backgroundColor: isDarkMode ? '#132A26' : '#E6F4F1',
                },
              ]}
            >
              <BootstrapIcon name="bell-fill" size={16} color="#0C6258" />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {isAdmin ? 'Alerts & Notifications' : 'Notifications'}
                </Text>
                {stats.unread > 0 && (
                  <View
                    style={{
                      backgroundColor: '#E11D48',
                      paddingHorizontal: 7,
                      paddingVertical: 1.5,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: '#FFFFFF',
                      }}
                    >
                      {stats.unread} NEW
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {isAdmin
                  ? 'Real-time alerts across orders, pit bays, stock levels, and security'
                  : 'Updates on your orders, pit bay bookings, and promotions'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity
            style={[
              styles.actionBtnOutline,
              {
                backgroundColor: isDarkMode ? '#132A26' : '#FFFFFF',
                borderColor: '#0C6258',
              },
            ]}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <BootstrapIcon name="check2-all" size={13} color="#0C6258" />
            <Text style={[styles.actionBtnOutlineText, { color: '#0C6258' }]}>
              Mark all read
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtnGhost,
              { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
            ]}
            onPress={handleClearRead}
            activeOpacity={0.7}
          >
            <BootstrapIcon name="trash3" size={12} color="#64748B" />
            <Text
              style={[
                styles.actionBtnGhostText,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Clear read
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ─── STREAMLINED STATS BAR (EXECUTIVE DESIGN) ─── */}
        {isAdmin && (
          <View
            style={[
              styles.statsBar,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            {/* Total */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'all' && {
                  backgroundColor: isDarkMode ? 'rgba(12, 98, 88, 0.2)' : '#E6F4F1',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <BootstrapIcon name="layers-fill" size={14} color="#64748B" />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.total}
                </Text>
                <Text style={styles.statLabel}>Total Alerts</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
              ]}
            />

            {/* Unread */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'unread' && {
                  backgroundColor: isDarkMode ? 'rgba(225, 29, 72, 0.15)' : '#FFE4E6',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('unread')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: stats.unread > 0 ? '#FFE4E6' : isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <BootstrapIcon
                  name="bell-fill"
                  size={14}
                  color={stats.unread > 0 ? '#E11D48' : '#64748B'}
                />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: stats.unread > 0 ? '#E11D48' : isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.unread}
                </Text>
                <Text style={styles.statLabel}>Action Required</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
              ]}
            />

            {/* Orders */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'orders' && {
                  backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#DBEAFE',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('orders')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#DBEAFE' },
                ]}
              >
                <BootstrapIcon name="box-seam-fill" size={14} color="#2563EB" />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.orders}
                </Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
              ]}
            />

            {/* Inventory */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'inventory' && {
                  backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('inventory')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: isDarkMode ? '#2D2012' : '#FEF3C7' },
                ]}
              >
                <BootstrapIcon name="boxes" size={14} color="#D97706" />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.inventory}
                </Text>
                <Text style={styles.statLabel}>Stock Alerts</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
              ]}
            />

            {/* Garage */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'garage' && {
                  backgroundColor: isDarkMode ? 'rgba(12, 98, 88, 0.2)' : '#D1ECE6',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('garage')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: isDarkMode ? '#132A26' : '#D1ECE6' },
                ]}
              >
                <BootstrapIcon name="wrench" size={14} color="#0C6258" />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.bookings}
                </Text>
                <Text style={styles.statLabel}>Pit Bay</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
              ]}
            />

            {/* Customers */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'customers' && {
                  backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.15)' : '#EEF2FF',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('customers')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' },
                ]}
              >
                <BootstrapIcon name="people" size={14} color="#4F46E5" />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.customers}
                </Text>
                <Text style={styles.statLabel}>Customers</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
              ]}
            />

            {/* System */}
            <TouchableOpacity
              style={[
                styles.statTile,
                activeFilter === 'system' && {
                  backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.15)' : '#EDE9FE',
                  borderRadius: 10,
                },
              ]}
              onPress={() => setActiveFilter('system')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: isDarkMode ? '#281A42' : '#EDE9FE' },
                ]}
              >
                <BootstrapIcon name="shield-check" size={14} color="#7C3AED" />
              </View>
              <View>
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {stats.system}
                </Text>
                <Text style={styles.statLabel}>Security</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── SEARCH INPUT BAR ─── */}
        <View style={styles.filterSection}>
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <BootstrapIcon name="search" size={14} color="#64748B" />
            <TextInput
              style={[
                styles.searchInput,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
              placeholder="Search notifications by keyword, order #, item, customer..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94A3B8"
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── NOTIFICATIONS FEED LIST ─── */}
        <View
          style={[
            styles.feedCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <BootstrapIcon name="bell-slash" size={28} color="#94A3B8" />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
                ]}
              >
                No Notifications
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {searchQuery
                  ? 'No alerts match your keyword search.'
                  : 'You are completely caught up in this section.'}
              </Text>
            </View>
          ) : (
            filteredNotifications.map((notif, index) => {
              const isUnread = notif.status === 'unread';
              const meta = getTypeMeta(notif);

              return (
                <View
                  key={notif.id || index}
                  style={[
                    styles.notifItem,
                    {
                      borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
                      backgroundColor: isUnread
                        ? isDarkMode
                          ? 'rgba(12, 98, 88, 0.08)'
                          : '#F7FBFA'
                        : 'transparent',
                    },
                    isUnread && {
                      borderLeftWidth: 3,
                      borderLeftColor: '#0C6258',
                    },
                    index === filteredNotifications.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  {/* Left Type Icon */}
                  <View
                    style={[
                      styles.typeIconBox,
                      { backgroundColor: meta.bg },
                    ]}
                  >
                    <BootstrapIcon name={meta.icon} size={16} color={meta.color} />
                  </View>

                  {/* Body */}
                  <View style={styles.notifBody}>
                    <View style={styles.notifHeaderRow}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          flex: 1,
                        }}
                      >
                        <Text
                          style={[
                            styles.notifCategoryBadge,
                            {
                              color: meta.color,
                              backgroundColor: meta.bg,
                            },
                          ]}
                        >
                          {meta.label}
                        </Text>
                        {isUnread && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifTimeText}>
                        {formatTimestamp(notif.created_at)}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text
                      style={[
                        styles.notifTitle,
                        {
                          color: isDarkMode ? '#F8FAFC' : '#0F172A',
                          fontWeight: isUnread ? '700' : '600',
                        },
                      ]}
                    >
                      {stripEmojis(notif.title)}
                    </Text>

                    {/* Message */}
                    <Text
                      style={[
                        styles.notifMessage,
                        { color: isDarkMode ? '#CBD5E1' : '#475569' },
                      ]}
                    >
                      {stripEmojis(notif.message)}
                    </Text>

                    {/* Selected context chips (clean & uncluttered) */}
                    {Boolean(notif.meta && Object.keys(notif.meta).length > 0) && (
                      <View style={styles.metaRow}>
                        {Object.entries(notif.meta)
                          .filter(([k]) => ['order_id', 'booking_id', 'product_name', 'customer_name', 'plate', 'item', 'role'].includes(k.toLowerCase()) || !k.includes('_at'))
                          .slice(0, 3)
                          .map(([k, v]) => {
                            if (v === null || v === undefined) return null;
                            const label = k.replace(/_/g, ' ');
                            return (
                              <View
                                key={k}
                                style={[
                                  styles.metaChip,
                                  {
                                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                                  },
                                ]}
                              >
                                <Text style={styles.metaChipLabel}>{label}:</Text>
                                <Text
                                  style={[
                                    styles.metaChipVal,
                                    { color: isDarkMode ? '#E2E8F0' : '#0F172A' },
                                  ]}
                                >
                                  {String(v)}
                                </Text>
                              </View>
                            );
                          })}
                      </View>
                    )}

                    {/* Action Row */}
                    <View style={styles.itemActionsRow}>
                      <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => handleCardAction(notif)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.primaryActionText}>
                          {getActionButtonLabel(notif)}
                        </Text>
                      </TouchableOpacity>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.actionIconBtn,
                            {
                              backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                            },
                          ]}
                          onPress={() =>
                            isUnread
                              ? handleMarkSingleRead(notif.id)
                              : handleMarkSingleUnread(notif.id)
                          }
                          title={isUnread ? 'Mark as read' : 'Mark as unread'}
                        >
                          <BootstrapIcon
                            name={isUnread ? 'envelope-open' : 'envelope'}
                            size={12}
                            color={isDarkMode ? '#94A3B8' : '#64748B'}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.actionIconBtn,
                            {
                              backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                            },
                          ]}
                          onPress={() => handleDeleteSingle(notif.id)}
                          title="Delete notification"
                        >
                          <BootstrapIcon name="trash3" size={12} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: '#0C6258',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  navbar: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 260,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnGhostText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  filterSection: {
    gap: 10,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    outlineStyle: 'none',
  },
  feedCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyState: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
  notifItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    gap: 14,
    alignItems: 'flex-start',
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifCategoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0C6258',
  },
  notifTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  notifTitle: {
    fontSize: 13.5,
    marginTop: 1,
  },
  notifMessage: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  metaChipLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metaChipVal: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  itemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  primaryActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C6258',
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
