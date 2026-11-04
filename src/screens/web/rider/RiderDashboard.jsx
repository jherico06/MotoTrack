import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import BootstrapIcon from '../../../components/common/BootstrapIcon.jsx';
import RiderNavBar from '../../../components/web/rider/RiderNavBar.jsx';
import ExternalLink from '../../../components/common/ExternalLink.jsx';
import RiderQrScanSheet from '../../../components/modals/RiderQrScanSheet.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { deliveryService, DELIVERY_STATUSES } from '../../../services/delivery/deliveryService.js';
import { riderService, RIDER_STATUSES } from '../../../services/staff/riderService.js';
import { userService } from '../../../services/staff/userService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { riderGpsTrackingService } from '../../../services/delivery/riderGpsTrackingService.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { describeRiderDeliveryDate } from '../../../utils/deliveryDate.js';
import { areaFromAddress, googleMapsNavigateUrl } from '../../../utils/geo.js';
import { colors } from '../../../styles/theme.js';

function formatPhp(amount) {
  const n = Number(amount) || 0;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPhpExact(amount) {
  const n = Number(amount) || 0;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered') {
    return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC', label: 'Delivered', icon: 'check-circle-fill' };
  }
  if (s.includes('out')) {
    return { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD', label: 'Out for Delivery', icon: 'truck' };
  }
  if (s.includes('accepted')) {
    return { bg: '#CCFBF1', text: '#0F766E', border: '#5EEAD4', label: 'Accepted by Rider', icon: 'check2-square' };
  }
  if (s.includes('assigned') || s.includes('ready')) {
    return { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74', label: 'Assigned to Rider', icon: 'person-badge' };
  }
  if (s.includes('report')) {
    return { bg: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE', label: 'Delivery Reported', icon: 'clipboard-check' };
  }
  if (s.includes('issue') || s.includes('fail')) {
    return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5', label: 'Delivery Failed', icon: 'exclamation-triangle-fill' };
  }
  return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', label: status || 'Assigned', icon: 'box-seam' };
}

function DeliveryDateBadge({ start, end }) {
  const info = describeRiderDeliveryDate(start, end);
  if (!info) return null;
  const isOverdue = info.tone === 'overdue';
  const isToday = info.tone === 'today';

  const tone = isOverdue
    ? { bg: '#FEF2F2', text: '#DC2626', icon: 'exclamation-triangle' }
    : isToday
      ? { bg: '#FFF7ED', text: '#EA580C', icon: 'calendar-event-fill' }
      : { bg: '#F8FAFC', text: '#64748B', icon: 'calendar-event' };

  return (
    <View style={[styles.dateBadge, { backgroundColor: tone.bg }]}>
      <BootstrapIcon name={tone.icon} size={12} color={tone.text} />
      <Text style={[styles.dateBadgeText, { color: tone.text }]}>
        {info.title}: {info.dateLabel}
      </Text>
    </View>
  );
}

export default function RiderDashboardWeb({ onLogout }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'deliveries' | 'history' | 'notifications' | 'account'

  const [riderProfile, setRiderProfile] = useState(null);
  const effectiveRiderAvatar = riderProfile?.avatar || currentUser?.avatar || currentUser?.photoUri || '';
  const [riderId, setRiderId] = useState(currentUser?.rider_id || '');
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  // Selected Order for Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [scanOrder, setScanOrder] = useState(null);
  const [podPhoto, setPodPhoto] = useState(null);
  const [podBusy, setPodBusy] = useState(false);

  // Filters on My Deliveries Tab
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'assigned' | 'accepted' | 'out' | 'delivered'
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  // Account Settings Form
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdNotice, setPwdNotice] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Resolve Rider Identity
  const resolveRiderId = useCallback(async () => {
    if (currentUser?.rider_id) return currentUser.rider_id;
    await riderService.fetchRiders();
    const byUser = riderService.getRiderByUserId(currentUser?.id || currentUser?.user_id);
    if (byUser?.id) return byUser.id;
    const byName = riderService.getRiderByUsername(currentUser?.username || currentUser?.email);
    return byName?.id || '';
  }, [currentUser]);

  // Load deliveries and notifications
  const loadData = useCallback(async () => {
    setError('');
    const id = await resolveRiderId();
    setRiderId(id);

    if (!id) {
      setDeliveries([]);
      setWeekEarnings(0);
      setError('This login is not linked to an active rider profile. Please contact the administrator.');
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Rider Profile
      await riderService.fetchRiders();
      const r = riderService.getRiderById(id);
      if (r) setRiderProfile(r);

      // 2. Fetch Deliveries
      const rows = await deliveryService.getMyDeliveries(id);
      setDeliveries(rows);

      // 3. Compute Earnings
      const weekStart = startOfWeek();
      let earned = 0;
      try {
        const ledger = await riderService.getRiderEarnings(id, { limit: 200 });
        earned = (ledger || []).reduce((sum, row) => {
          const at = row?.created_at ? new Date(row.created_at) : null;
          if (!at || at < weekStart) return sum;
          return sum + (Number(row.amount) || 0);
        }, 0);
      } catch (_e) {}

      if (earned <= 0) {
        earned = (rows || []).reduce((sum, d) => {
          if (String(d.deliveryStatus || '').toLowerCase() !== 'delivered') return sum;
          const at = d.deliveredAt ? new Date(d.deliveredAt) : null;
          if (!at || at < weekStart) return sum;
          return sum + (Number(d.riderEarning || d.shippingFee) || 0);
        }, 0);
      }
      setWeekEarnings(earned);

      // 4. Notifications
      const notifs = notificationService.getCustomerNotifications(
        currentUser?.id || currentUser?.user_id,
        currentUser?.email,
        currentUser?.username
      );
      setNotifications(notifs || []);
      const unread = (notifs || []).filter((n) => n.status === 'unread' || n.read === false).length;
      setUnreadNotifsCount(unread);

      // 5. Sync active GPS tracking
      const activeOut = (rows || []).find((d) =>
        String(d.deliveryStatus || '').toLowerCase().includes('out for delivery')
      );
      if (activeOut?.orderId && id) {
        const session = riderGpsTrackingService.getActiveSession();
        if (!session || session.orderId !== activeOut.orderId) {
          riderGpsTrackingService.start({ orderId: activeOut.orderId, riderId: id }).catch(() => {});
        }
      } else if (!activeOut && riderGpsTrackingService.isTracking()) {
        riderGpsTrackingService.stop({ clearDb: true }).catch(() => {});
      }
    } catch (e) {
      setError(e?.message || 'Unable to load your deliveries.');
    } finally {
      setLoading(false);
    }
  }, [resolveRiderId, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubDel = deliveryService.subscribe(() => loadData());
    const unsubRiders = riderService.subscribe(() => loadData());
    const unsubNotifs = notificationService.subscribe?.(() => {
      const notifs = notificationService.getCustomerNotifications(
        currentUser?.id || currentUser?.user_id,
        currentUser?.email,
        currentUser?.username
      );
      setNotifications(notifs || []);
      const unread = (notifs || []).filter((n) => n.status === 'unread' || n.read === false).length;
      setUnreadNotifsCount(unread);
    });

    return () => {
      unsubDel?.();
      unsubRiders?.();
      unsubNotifs?.();
      riderGpsTrackingService.stop({ clearDb: false }).catch(() => {});
    };
  }, [loadData, currentUser]);

  // Derived lists
  const assignedOrders = useMemo(() => {
    return deliveries.filter((d) => {
      const s = String(d.deliveryStatus || '').toLowerCase();
      return s.includes('assigned') || s.includes('ready');
    });
  }, [deliveries]);

  const acceptedOrders = useMemo(() => {
    return deliveries.filter((d) => {
      const s = String(d.deliveryStatus || '').toLowerCase();
      return s.includes('accepted');
    });
  }, [deliveries]);

  const outForDeliveryOrders = useMemo(() => {
    return deliveries.filter((d) => {
      const s = String(d.deliveryStatus || '').toLowerCase();
      return s.includes('out') || s.includes('transit');
    });
  }, [deliveries]);

  const deliveredOrders = useMemo(() => {
    return deliveries
      .filter((d) => String(d.deliveryStatus || '').toLowerCase() === 'delivered')
      .slice()
      .sort((a, b) => {
        const at = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const bt = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return bt - at;
      });
  }, [deliveries]);

  const activeJobs = useMemo(() => {
    return deliveries.filter((d) => String(d.deliveryStatus || '').toLowerCase() !== 'delivered');
  }, [deliveries]);

  // Filtered deliveries list for My Deliveries view
  const displayedDeliveries = useMemo(() => {
    let list = deliveries;
    if (filterStatus === 'assigned') {
      list = assignedOrders;
    } else if (filterStatus === 'accepted') {
      list = acceptedOrders;
    } else if (filterStatus === 'out') {
      list = outForDeliveryOrders;
    } else if (filterStatus === 'delivered') {
      list = deliveredOrders;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (d) =>
          String(d.orderId || '').toLowerCase().includes(q) ||
          String(d.customerName || '').toLowerCase().includes(q) ||
          String(d.customerAddress || '').toLowerCase().includes(q) ||
          String(d.customerPhone || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [deliveries, filterStatus, searchQuery, assignedOrders, acceptedOrders, outForDeliveryOrders, deliveredOrders]);

  // Toggle Rider Duty Status
  const handleToggleDuty = async () => {
    if (!riderId) return;
    const current = riderProfile?.status || RIDER_STATUSES.AVAILABLE;
    const next =
      current.toLowerCase() === RIDER_STATUSES.OFF_DUTY.toLowerCase()
        ? RIDER_STATUSES.AVAILABLE
        : RIDER_STATUSES.OFF_DUTY;
    try {
      await riderService.setRiderStatus(riderId, next);
      setRiderProfile((prev) => (prev ? { ...prev, status: next } : prev));
      setNotice(`Duty status updated to ${next}.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (_e) {
      setError('Could not update status.');
    }
  };

  // ─── ACTION 1: CONFIRM ORDER / ACCEPT DELIVERY ──────────────────────────────
  const handleAcceptDelivery = async (d) => {
    const targetOrderId = d.orderId || d.order_id;
    if (!targetOrderId || !riderId) return;

    setBusyId(targetOrderId);
    setNotice('');
    setError('');

    try {
      const res = await deliveryService.riderAcceptDelivery({
        orderId: targetOrderId,
        riderId,
        riderUser: currentUser,
        notes: 'Confirmed and accepted by rider via Rider Dashboard',
      });

      if (!res.success) {
        setError(res.error || 'Failed to accept delivery.');
        return;
      }

      setNotice(`Order #${targetOrderId} accepted successfully! Ready to start delivery.`);
      setTimeout(() => setNotice(''), 5000);

      // Refresh local view
      await loadData();
      if (selectedOrder?.orderId === targetOrderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, deliveryStatus: 'Accepted by Rider' } : prev));
      }
    } catch (e) {
      setError(e?.message || 'Error accepting order.');
    } finally {
      setBusyId('');
    }
  };

  // ─── ACTION 2: START ROUTE / OUT FOR DELIVERY ───────────────────────────────
  const handleStartRoute = async (d) => {
    const targetOrderId = d.orderId || d.order_id;
    if (!targetOrderId || !riderId) return;

    setBusyId(targetOrderId);
    setNotice('');
    setError('');

    try {
      const res = await deliveryService.riderMarkOutForDelivery({
        riderId,
        orderId: targetOrderId,
        riderUser: currentUser,
      });

      if (!res.success) {
        setError(res.error || 'Could not start delivery.');
        return;
      }

      // Start GPS
      await riderGpsTrackingService.start({ orderId: targetOrderId, riderId }).catch(() => {});

      setNotice(`Order #${targetOrderId} is now Out for Delivery. Live tracking active.`);
      setTimeout(() => setNotice(''), 5000);

      await loadData();
      if (selectedOrder?.orderId === targetOrderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, deliveryStatus: 'Out for Delivery' } : prev));
      }
    } catch (e) {
      setError(e?.message || 'Error starting delivery route.');
    } finally {
      setBusyId('');
    }
  };

  // ─── ACTION 3: CONFIRM DELIVERED ───────────────────────────────────────────
  const handleConfirmDelivered = async (d) => {
    const targetOrderId = d.orderId || d.order_id;
    if (!targetOrderId || !riderId) return;

    setBusyId(targetOrderId);
    setNotice('');
    setError('');

    try {
      const res = await deliveryService.riderConfirmOrderDelivery({
        orderId: targetOrderId,
        riderId,
        riderUser: currentUser,
        photoUri: podPhoto || d.deliveryPhoto,
        notes: 'Delivery completed and confirmed by rider',
      });

      if (!res.success) {
        setError(res.error || 'Could not confirm delivery.');
        return;
      }

      setNotice(`Order #${targetOrderId} successfully marked Delivered! Earning credited.`);
      setTimeout(() => setNotice(''), 5000);

      setSelectedOrder(null);
      setPodPhoto(null);
      await loadData();
    } catch (e) {
      setError(e?.message || 'Error confirming delivery.');
    } finally {
      setBusyId('');
    }
  };

  // ─── ACTION 4: REPORT DELIVERY FAILED / ISSUE ──────────────────────────────
  const handleReportIssue = async (d) => {
    const targetOrderId = d.orderId || d.order_id;
    if (!targetOrderId || !riderId) return;

    setBusyId(targetOrderId);
    setNotice('');
    setError('');

    try {
      const res = await deliveryService.riderReportDeliveryIssue({
        orderId: targetOrderId,
        riderId,
        riderUser: currentUser,
        notes: 'Delivery attempt failed / issue reported by rider',
      });

      if (!res.success) {
        setError(res.error || 'Could not report issue.');
        return;
      }

      setNotice(`Delivery issue reported for Order #${targetOrderId}.`);
      setTimeout(() => setNotice(''), 5000);

      setSelectedOrder(null);
      await loadData();
    } catch (e) {
      setError(e?.message || 'Error reporting delivery issue.');
    } finally {
      setBusyId('');
    }
  };

  // Proof of delivery photo
  const handlePickPodPhoto = async () => {
    const res = await pickImageFromFile();
    if (res.success && res.uri) {
      setPodPhoto(res.uri);
    } else if (res.error && res.error !== 'No file selected' && res.error !== 'Selection cancelled') {
      setError(res.error);
    }
  };

  // Change password handler
  const handleChangePassword = async () => {
    setPwdError('');
    setPwdNotice('');
    if (!pwdCurrent.trim() || !pwdNew.trim() || !pwdConfirm.trim()) {
      setPwdError('Please fill in all password fields.');
      return;
    }
    if (pwdNew.length < 6) {
      setPwdError('New password must be at least 6 characters long.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError('New password and confirmation do not match.');
      return;
    }

    setPwdBusy(true);
    try {
      const uid = currentUser?.id || currentUser?.user_id;
      const res = await userService.changePassword(uid, {
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
      });

      if (!res.success) {
        setPwdError(res.error || 'Failed to update password.');
      } else {
        setPwdNotice('Password changed successfully.');
        setPwdCurrent('');
        setPwdNew('');
        setPwdConfirm('');
      }
    } catch (e) {
      setPwdError(e?.message || 'Could not update password.');
    } finally {
      setPwdBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.racingOrange} />
        <Text style={styles.loadingText}>Loading Rider Portal…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ─── DESKTOP / TABLET SIDEBAR NAVIGATION ─── */}
      {!isMobile && (
        <RiderNavBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          assignedCount={assignedOrders.length}
          unreadNotifsCount={unreadNotifsCount}
          riderName={riderProfile?.name || currentUser?.name || 'Rider'}
          riderVehicle={riderProfile?.vehicleInfo || ''}
          riderAvatar={effectiveRiderAvatar}
          dutyStatus={riderProfile?.status || RIDER_STATUSES.AVAILABLE}
          onToggleDuty={handleToggleDuty}
          onLogout={onLogout}
          isTablet={isTablet}
        />
      )}

      {/* ─── MAIN CONTENT VIEWPORT ─── */}
      <View style={styles.mainViewport}>
        {/* MOBILE TOP BAR (Charcoal) */}
        {isMobile && (
          <View style={styles.mobileHeader} className="web-header" dataSet={{ webHeader: true }} accessibilityRole="header">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {effectiveRiderAvatar ? (
                <Image
                  source={{ uri: effectiveRiderAvatar }}
                  style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#EA580C' }}
                />
              ) : (
                <View style={styles.mobileAvatar}>
                  <Text style={styles.mobileAvatarText}>
                    {String(riderProfile?.name || currentUser?.name || 'R').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.mobileHeaderTitle}>{riderProfile?.name || 'Rider'}</Text>
                <TouchableOpacity onPress={handleToggleDuty} activeOpacity={0.7}>
                  <Text style={styles.mobileDutyLabel}>
                    Status:{' '}
                    <Text style={{ color: (riderProfile?.status || '').toLowerCase() === 'available' ? '#10B981' : '#94A3B8' }}>
                      {riderProfile?.status || 'Available'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={onLogout} style={styles.mobileLogoutBtn}>
              <BootstrapIcon name="box-arrow-right" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* NOTICES AND ALERTS */}
        {notice ? (
          <View style={styles.noticeAlert}>
            <BootstrapIcon name="check-circle-fill" size={16} color="#15803D" />
            <Text style={styles.noticeAlertText}>{notice}</Text>
            <TouchableOpacity onPress={() => setNotice('')} style={{ marginLeft: 'auto' }}>
              <BootstrapIcon name="x-lg" size={12} color="#15803D" />
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorAlert}>
            <BootstrapIcon name="exclamation-octagon-fill" size={16} color="#B91C1C" />
            <Text style={styles.errorAlertText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')} style={{ marginLeft: 'auto' }}>
              <BootstrapIcon name="x-lg" size={12} color="#B91C1C" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* SCROLLABLE TAB CONTENT */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[
            styles.contentContainer,
            isMobile && { paddingBottom: 80 }, // clearance for mobile bottom bar
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ══════════════════════════════════════════════════════════════════════
              VIEW 1: DASHBOARD OVERVIEW
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <View style={styles.tabSection}>
              {/* WELCOME BANNER */}
              <View style={styles.welcomeBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeGreeting}>
                    Welcome back, {riderProfile?.shortName || riderProfile?.name || 'Rider'} 👋
                  </Text>
                  <Text style={styles.welcomeDate}>
                    {new Date().toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.quickDutyToggle,
                    (riderProfile?.status || '').toLowerCase() === 'available'
                      ? styles.quickDutyAvailable
                      : styles.quickDutyOff,
                  ]}
                  onPress={handleToggleDuty}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.dutyDot,
                      (riderProfile?.status || '').toLowerCase() === 'available'
                        ? styles.dutyDotAvailable
                        : styles.dutyDotOff,
                    ]}
                  />
                  <Text
                    style={[
                      styles.quickDutyText,
                      (riderProfile?.status || '').toLowerCase() === 'available'
                        ? { color: '#047857' }
                        : { color: '#64748B' },
                    ]}
                  >
                    {(riderProfile?.status || '').toLowerCase() === 'available' ? 'On Duty' : 'Off Duty'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 4 KPI CARDS */}
              <View style={styles.kpiGrid}>
                {/* 1. Assigned Deliveries (Pending Confirmation) */}
                <TouchableOpacity
                  style={[styles.kpiCard, { borderTopColor: '#EA580C' }]}
                  onPress={() => {
                    setFilterStatus('assigned');
                    setActiveTab('deliveries');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#FFEDD5' }]}>
                    <BootstrapIcon name="person-badge" size={18} color="#EA580C" />
                  </View>
                  <Text style={styles.kpiLabel}>Assigned Orders</Text>
                  <Text style={[styles.kpiValue, { color: '#EA580C' }]}>{assignedOrders.length}</Text>
                  <Text style={styles.kpiSub}>Awaiting confirmation</Text>
                </TouchableOpacity>

                {/* 2. Accepted / In Transit */}
                <TouchableOpacity
                  style={[styles.kpiCard, { borderTopColor: '#2563EB' }]}
                  onPress={() => {
                    setFilterStatus('out');
                    setActiveTab('deliveries');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#DBEAFE' }]}>
                    <BootstrapIcon name="truck" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.kpiLabel}>Out for Delivery</Text>
                  <Text style={[styles.kpiValue, { color: '#2563EB' }]}>
                    {acceptedOrders.length + outForDeliveryOrders.length}
                  </Text>
                  <Text style={styles.kpiSub}>Active in transit</Text>
                </TouchableOpacity>

                {/* 3. Completed Deliveries */}
                <TouchableOpacity
                  style={[styles.kpiCard, { borderTopColor: '#10B981' }]}
                  onPress={() => setActiveTab('history')}
                  activeOpacity={0.85}
                >
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <BootstrapIcon name="bag-check-fill" size={18} color="#10B981" />
                  </View>
                  <Text style={styles.kpiLabel}>Completed</Text>
                  <Text style={[styles.kpiValue, { color: '#10B981' }]}>{deliveredOrders.length}</Text>
                  <Text style={styles.kpiSub}>Delivered deliveries</Text>
                </TouchableOpacity>

                {/* 4. Weekly Earnings */}
                <View style={[styles.kpiCard, { borderTopColor: '#24272B' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#F1F5F9' }]}>
                    <BootstrapIcon name="cash-stack" size={18} color="#24272B" />
                  </View>
                  <Text style={styles.kpiLabel}>This Week's Earnings</Text>
                  <Text style={[styles.kpiValue, { color: '#24272B' }]}>{formatPhp(weekEarnings)}</Text>
                  <Text style={styles.kpiSub}>Shipping commission</Text>
                </View>
              </View>

              {/* ACTIVE DELIVERIES SPOTLIGHT */}
              {activeJobs.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionBlockHeader}>
                    <Text style={styles.sectionBlockTitle}>Active Deliveries</Text>
                    <TouchableOpacity onPress={() => setActiveTab('deliveries')}>
                      <Text style={styles.sectionBlockAction}>View All ({activeJobs.length})</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardList}>
                    {activeJobs.slice(0, 3).map((d) => {
                      const tone = statusTone(d.deliveryStatus);
                      const isAssigned = String(d.deliveryStatus || '').toLowerCase().includes('assigned') || String(d.deliveryStatus || '').toLowerCase().includes('ready');
                      const isAccepted = String(d.deliveryStatus || '').toLowerCase().includes('accepted');
                      const isOut = String(d.deliveryStatus || '').toLowerCase().includes('out');

                      return (
                        <View key={d.orderId} style={styles.deliveryCard}>
                          <View style={styles.cardHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.cardOrderId}>#{d.orderId}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                                <BootstrapIcon name={tone.icon} size={11} color={tone.text} />
                                <Text style={[styles.statusBadgeText, { color: tone.text }]}>{tone.label}</Text>
                              </View>
                            </View>
                            <Text style={styles.cardAmount}>{formatPhpExact(d.totalAmount)}</Text>
                          </View>

                          <Text style={styles.cardCustomerName}>{d.customerName}</Text>
                          <Text style={styles.cardAddress} numberOfLines={2}>
                            {d.customerAddress || 'No address on file'}
                          </Text>

                          <DeliveryDateBadge start={d.expectedDeliveryAt} end={d.expectedDeliveryEndAt} />

                          {/* ACTION BUTTONS */}
                          <View style={styles.cardActionsRow}>
                            <TouchableOpacity
                              style={styles.detailsBtn}
                              onPress={() => setSelectedOrder(d)}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="eye" size={13} color="#475569" />
                              <Text style={styles.detailsBtnText}>Details</Text>
                            </TouchableOpacity>

                            <ExternalLink
                              href={googleMapsNavigateUrl(d.lat, d.lng, d.customerAddress)}
                              style={{ flex: 1 }}
                            >
                              <View style={styles.mapsBtn}>
                                <BootstrapIcon name="geo-alt-fill" size={13} color="#2563EB" />
                                <Text style={styles.mapsBtnText}>Navigate</Text>
                              </View>
                            </ExternalLink>

                            {/* PRIORITY 1: CONFIRM ORDER / ACCEPT DELIVERY BUTTON */}
                            {isAssigned && (
                              <TouchableOpacity
                                style={[styles.actionPrimaryBtn, busyId === d.orderId && { opacity: 0.7 }]}
                                onPress={() => handleAcceptDelivery(d)}
                                disabled={busyId === d.orderId}
                                activeOpacity={0.85}
                              >
                                {busyId === d.orderId ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <>
                                    <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                                    <Text style={styles.actionPrimaryBtnText}>Confirm Order</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}

                            {/* ACTION: START ROUTE */}
                            {isAccepted && (
                              <TouchableOpacity
                                style={[styles.actionStartBtn, busyId === d.orderId && { opacity: 0.7 }]}
                                onPress={() => handleStartRoute(d)}
                                disabled={busyId === d.orderId}
                                activeOpacity={0.85}
                              >
                                {busyId === d.orderId ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <>
                                    <BootstrapIcon name="play-fill" size={14} color="#FFFFFF" />
                                    <Text style={styles.actionStartBtnText}>Start Route</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}

                            {/* ACTION: CONFIRM DROP-OFF */}
                            {isOut && (
                              <TouchableOpacity
                                style={[styles.actionDeliveredBtn, busyId === d.orderId && { opacity: 0.7 }]}
                                onPress={() => setSelectedOrder(d)}
                                disabled={busyId === d.orderId}
                                activeOpacity={0.85}
                              >
                                <BootstrapIcon name="check-circle-fill" size={14} color="#FFFFFF" />
                                <Text style={styles.actionDeliveredBtnText}>Confirm Delivery</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <BootstrapIcon name="check2-circle" size={32} color="#10B981" />
                  <Text style={styles.emptyStateTitle}>All caught up!</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    You have no pending deliveries at this moment. Stay on duty to receive new orders.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              VIEW 2: MY DELIVERIES (FILTER, DETAILS, CONFIRM ORDER)
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'deliveries' && (
            <View style={styles.tabSection}>
              <View style={styles.tabHeaderRow}>
                <View>
                  <Text style={styles.tabTitle}>My Deliveries</Text>
                  <Text style={styles.tabSubtitle}>Review assigned orders, confirm acceptance, and update route progress.</Text>
                </View>
              </View>

              {/* SEARCH & FILTER BAR */}
              <View style={styles.filterBar}>
                <View style={styles.searchWrap}>
                  <BootstrapIcon name="search" size={14} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by order ID, customer name, phone, or address…"
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* FILTER PILLS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  <View style={styles.pillsRow}>
                    {[
                      { id: 'all', label: `All (${deliveries.length})` },
                      { id: 'assigned', label: `Assigned (${assignedOrders.length})` },
                      { id: 'accepted', label: `Accepted (${acceptedOrders.length})` },
                      { id: 'out', label: `Out for Delivery (${outForDeliveryOrders.length})` },
                      { id: 'delivered', label: `Delivered (${deliveredOrders.length})` },
                    ].map((pill) => {
                      const isActive = filterStatus === pill.id;
                      return (
                        <TouchableOpacity
                          key={pill.id}
                          style={[styles.filterPill, isActive && styles.filterPillActive]}
                          onPress={() => setFilterStatus(pill.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                            {pill.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* LIST OF DELIVERIES */}
              {displayedDeliveries.length > 0 ? (
                <View style={styles.cardList}>
                  {displayedDeliveries.map((d) => {
                    const tone = statusTone(d.deliveryStatus);
                    const isAssigned = String(d.deliveryStatus || '').toLowerCase().includes('assigned') || String(d.deliveryStatus || '').toLowerCase().includes('ready');
                    const isAccepted = String(d.deliveryStatus || '').toLowerCase().includes('accepted');
                    const isOut = String(d.deliveryStatus || '').toLowerCase().includes('out');
                    const isDelivered = String(d.deliveryStatus || '').toLowerCase() === 'delivered';

                    return (
                      <View key={d.orderId} style={styles.deliveryCard}>
                        <View style={styles.cardHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.cardOrderId}>#{d.orderId}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                              <BootstrapIcon name={tone.icon} size={11} color={tone.text} />
                              <Text style={[styles.statusBadgeText, { color: tone.text }]}>{tone.label}</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.cardAmount}>{formatPhpExact(d.totalAmount)}</Text>
                            <Text style={styles.cardPaymentMethod}>
                              {d.paymentMethod} · {d.paymentStatus}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.cardCustomerName}>{d.customerName}</Text>
                        <View style={styles.addressRow}>
                          <BootstrapIcon name="geo-alt" size={13} color="#64748B" />
                          <Text style={styles.cardAddress} numberOfLines={2}>
                            {d.customerAddress || 'No address on file'}
                          </Text>
                        </View>

                        <DeliveryDateBadge start={d.expectedDeliveryAt} end={d.expectedDeliveryEndAt} />

                        {d.itemsSummary ? (
                          <Text style={styles.cardItemsSummary} numberOfLines={2}>
                            Items: {d.itemsSummary}
                          </Text>
                        ) : null}

                        {/* ACTION BUTTONS */}
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity
                            style={styles.detailsBtn}
                            onPress={() => setSelectedOrder(d)}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="eye" size={13} color="#475569" />
                            <Text style={styles.detailsBtnText}>Details</Text>
                          </TouchableOpacity>

                          <ExternalLink
                            href={googleMapsNavigateUrl(d.lat, d.lng, d.customerAddress)}
                            style={{ flex: 1 }}
                          >
                            <View style={styles.mapsBtn}>
                              <BootstrapIcon name="geo-alt-fill" size={13} color="#2563EB" />
                              <Text style={styles.mapsBtnText}>Navigate</Text>
                            </View>
                          </ExternalLink>

                          {/* 1. PRIORITY BUTTON: CONFIRM ORDER / ACCEPT DELIVERY */}
                          {isAssigned && (
                            <TouchableOpacity
                              style={[styles.actionPrimaryBtn, busyId === d.orderId && { opacity: 0.7 }]}
                              onPress={() => handleAcceptDelivery(d)}
                              disabled={busyId === d.orderId}
                              activeOpacity={0.85}
                            >
                              {busyId === d.orderId ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                                  <Text style={styles.actionPrimaryBtnText}>Confirm Order</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {/* 2. START ROUTE */}
                          {isAccepted && (
                            <TouchableOpacity
                              style={[styles.actionStartBtn, busyId === d.orderId && { opacity: 0.7 }]}
                              onPress={() => handleStartRoute(d)}
                              disabled={busyId === d.orderId}
                              activeOpacity={0.85}
                            >
                              {busyId === d.orderId ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <BootstrapIcon name="play-fill" size={14} color="#FFFFFF" />
                                  <Text style={styles.actionStartBtnText}>Start Route</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {/* 3. CONFIRM DELIVERED */}
                          {isOut && (
                            <TouchableOpacity
                              style={[styles.actionDeliveredBtn, busyId === d.orderId && { opacity: 0.7 }]}
                              onPress={() => setSelectedOrder(d)}
                              disabled={busyId === d.orderId}
                              activeOpacity={0.85}
                            >
                              <BootstrapIcon name="check-circle-fill" size={14} color="#FFFFFF" />
                              <Text style={styles.actionDeliveredBtnText}>Confirm Drop-off</Text>
                            </TouchableOpacity>
                          )}

                          {isDelivered && (
                            <View style={styles.deliveredCheckBadge}>
                              <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
                              <Text style={styles.deliveredCheckText}>Delivered</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <BootstrapIcon name="inbox" size={32} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>No deliveries found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    {searchQuery ? 'No deliveries match your search query.' : 'There are no orders matching this filter.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              VIEW 3: DELIVERY HISTORY
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'history' && (
            <View style={styles.tabSection}>
              <View style={styles.tabHeaderRow}>
                <View>
                  <Text style={styles.tabTitle}>Delivery History</Text>
                  <Text style={styles.tabSubtitle}>Previously completed deliveries, delivery dates, and earnings record.</Text>
                </View>
                <View style={styles.earningsSummaryBadge}>
                  <Text style={styles.earningsSummaryLabel}>Total Delivered</Text>
                  <Text style={styles.earningsSummaryValue}>{deliveredOrders.length} orders</Text>
                </View>
              </View>

              {deliveredOrders.length > 0 ? (
                <View style={styles.cardList}>
                  {deliveredOrders.map((d) => (
                    <TouchableOpacity
                      key={d.orderId}
                      style={styles.historyCard}
                      onPress={() => setSelectedOrder(d)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.historyIconWrap}>
                        <BootstrapIcon name="bag-check-fill" size={18} color="#10B981" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.cardOrderId}>#{d.orderId}</Text>
                          <Text style={styles.historyDeliveredDate}>
                            {d.deliveredAt
                              ? new Date(d.deliveredAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Delivered'}
                          </Text>
                        </View>

                        <Text style={styles.cardCustomerName}>{d.customerName}</Text>
                        <Text style={styles.cardAddress} numberOfLines={1}>
                          {d.customerAddress || 'No address on file'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={styles.historyEarnTag}>
                          +{formatPhp(d.riderEarning || d.shippingFee || 0)}
                        </Text>
                        <Text style={styles.historyTotal}>{formatPhpExact(d.totalAmount)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <BootstrapIcon name="clock-history" size={32} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>No delivery history yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Completed orders will appear here along with your delivery timestamps and shipping earnings.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              VIEW 4: NOTIFICATIONS
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <View style={styles.tabSection}>
              <View style={styles.tabHeaderRow}>
                <View>
                  <Text style={styles.tabTitle}>Notifications</Text>
                  <Text style={styles.tabSubtitle}>Receive new delivery assignments, order status updates, and announcements.</Text>
                </View>
                {notifications.length > 0 && (
                  <TouchableOpacity
                    style={styles.markAllReadBtn}
                    onPress={() => {
                      notificationService.markAllCustomerRead?.(currentUser?.id || currentUser?.user_id);
                      setUnreadNotifsCount(0);
                      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read', read: true })));
                    }}
                  >
                    <Text style={styles.markAllReadText}>Mark all as read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {notifications.length > 0 ? (
                <View style={styles.cardList}>
                  {notifications.map((notif, idx) => (
                    <View
                      key={notif.id || idx}
                      style={[styles.notifCard, notif.status === 'unread' && styles.notifCardUnread]}
                    >
                      <View style={styles.notifIconWrap}>
                        <BootstrapIcon
                          name={notif.type?.includes('order') ? 'box-seam' : 'bell-fill'}
                          size={16}
                          color="#EA580C"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.notifTitle}>{notif.title || 'Notification'}</Text>
                          <Text style={styles.notifTime}>
                            {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Recent'}
                          </Text>
                        </View>
                        <Text style={styles.notifMessage}>{notif.message || notif.body || ''}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <BootstrapIcon name="bell-slash" size={32} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>No notifications yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    When an order is assigned to you or updated by the store, alerts will show here.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              VIEW 5: ACCOUNT & SECURITY
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'account' && (
            <View style={styles.tabSection}>
              <View style={styles.tabHeaderRow}>
                <View>
                  <Text style={styles.tabTitle}>Rider Account</Text>
                  <Text style={styles.tabSubtitle}>Manage your courier profile, duty status, and account password.</Text>
                </View>
              </View>

              <View style={styles.accountGrid}>
                {/* 1. RIDER PROFILE CARD */}
                <View style={styles.accountCard}>
                  <Text style={styles.accountCardTitle}>Courier Profile</Text>

                  <View style={styles.profileHeaderBox}>
                    {effectiveRiderAvatar ? (
                      <Image source={{ uri: effectiveRiderAvatar }} style={styles.profileAvatarLarge} />
                    ) : (
                      <View style={styles.profileAvatarPlaceholderLarge}>
                        <Text style={styles.profileAvatarTextLarge}>
                          {String(riderProfile?.name || currentUser?.name || 'R').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Text style={styles.profileFullName}>{riderProfile?.name || currentUser?.name || 'Rider'}</Text>
                      <Text style={styles.profileVehicleDetail}>
                        {riderProfile?.vehicleInfo || 'Motorcycle'} · Plate: {riderProfile?.plateNumber || 'N/A'}
                      </Text>
                      <View style={styles.ratingRow}>
                        <BootstrapIcon name="star-fill" size={13} color="#F59E0B" />
                        <Text style={styles.ratingText}>{Number(riderProfile?.rating || 5.0).toFixed(1)} Rating</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.accountInfoList}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone Number</Text>
                      <Text style={styles.infoValue}>{riderProfile?.phone || currentUser?.phone || 'Not provided'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Email / Username</Text>
                      <Text style={styles.infoValue}>{riderProfile?.email || currentUser?.email || currentUser?.username || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Courier ID</Text>
                      <Text style={styles.infoValue}>{riderId || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current Duty Status</Text>
                      <TouchableOpacity onPress={handleToggleDuty} style={styles.dutySwitchBtn}>
                        <Text style={styles.dutySwitchText}>{riderProfile?.status || 'Available'} (Click to change)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* 2. CHANGE PASSWORD FORM */}
                <View style={styles.accountCard}>
                  <Text style={styles.accountCardTitle}>Change Password</Text>
                  <Text style={styles.accountCardSubtitle}>
                    Ensure your account is protected by setting a secure password.
                  </Text>

                  {pwdNotice ? (
                    <View style={styles.noticeAlert}>
                      <BootstrapIcon name="check-circle-fill" size={14} color="#15803D" />
                      <Text style={styles.noticeAlertText}>{pwdNotice}</Text>
                    </View>
                  ) : null}

                  {pwdError ? (
                    <View style={styles.errorAlert}>
                      <BootstrapIcon name="exclamation-octagon-fill" size={14} color="#B91C1C" />
                      <Text style={styles.errorAlertText}>{pwdError}</Text>
                    </View>
                  ) : null}

                  <View style={styles.pwdForm}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Current Password</Text>
                      <TextInput
                        style={styles.textInput}
                        secureTextEntry
                        placeholder="Enter current password"
                        placeholderTextColor="#94A3B8"
                        value={pwdCurrent}
                        onChangeText={setPwdCurrent}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>New Password</Text>
                      <TextInput
                        style={styles.textInput}
                        secureTextEntry
                        placeholder="Enter new password (min. 6 characters)"
                        placeholderTextColor="#94A3B8"
                        value={pwdNew}
                        onChangeText={setPwdNew}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Confirm New Password</Text>
                      <TextInput
                        style={styles.textInput}
                        secureTextEntry
                        placeholder="Confirm new password"
                        placeholderTextColor="#94A3B8"
                        value={pwdConfirm}
                        onChangeText={setPwdConfirm}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.savePwdBtn, pwdBusy && { opacity: 0.7 }]}
                      onPress={handleChangePassword}
                      disabled={pwdBusy}
                      activeOpacity={0.85}
                    >
                      {pwdBusy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <BootstrapIcon name="shield-lock-fill" size={14} color="#FFFFFF" />
                          <Text style={styles.savePwdBtnText}>Update Password</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.logoutSection}>
                    <TouchableOpacity style={styles.accountLogoutBtn} onPress={onLogout} activeOpacity={0.85}>
                      <BootstrapIcon name="box-arrow-right" size={15} color="#EF4444" />
                      <Text style={styles.accountLogoutText}>Log out of Rider Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════════
          UNIVERSAL ORDER DETAILS MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <Modal
          visible={Boolean(selectedOrder)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalDialog}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle}>Order #{selectedOrder.orderId}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusTone(selectedOrder.deliveryStatus).bg,
                        borderColor: statusTone(selectedOrder.deliveryStatus).border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusTone(selectedOrder.deliveryStatus).text },
                      ]}
                    >
                      {statusTone(selectedOrder.deliveryStatus).label}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedOrder(null)}
                  style={styles.modalCloseBtn}
                  accessibilityLabel="Close"
                >
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* CUSTOMER INFORMATION */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Customer & Address</Text>
                  <Text style={styles.modalCustomerName}>{selectedOrder.customerName}</Text>

                  <View style={styles.modalInfoRow}>
                    <BootstrapIcon name="telephone" size={13} color="#64748B" />
                    <Text style={styles.modalInfoText}>{selectedOrder.customerPhone || 'No phone'}</Text>
                    {selectedOrder.customerPhone ? (
                      <ExternalLink
                        href={`tel:${String(selectedOrder.customerPhone).replace(/[^\d+]/g, '')}`}
                        style={{ marginLeft: 8 }}
                      >
                        <Text style={styles.callLink}>Call</Text>
                      </ExternalLink>
                    ) : null}
                  </View>

                  <View style={styles.modalInfoRow}>
                    <BootstrapIcon name="geo-alt" size={13} color="#64748B" />
                    <Text style={[styles.modalInfoText, { flex: 1 }]}>
                      {selectedOrder.customerAddress || 'No address on file'}
                    </Text>
                  </View>

                  {selectedOrder.landmark ? (
                    <Text style={styles.modalLandmark}>Landmark / Notes: {selectedOrder.landmark}</Text>
                  ) : null}

                  <DeliveryDateBadge start={selectedOrder.expectedDeliveryAt} end={selectedOrder.expectedDeliveryEndAt} />

                  <ExternalLink
                    href={googleMapsNavigateUrl(selectedOrder.lat, selectedOrder.lng, selectedOrder.customerAddress)}
                  >
                    <View style={styles.modalNavBtn}>
                      <BootstrapIcon name="geo-alt-fill" size={13} color="#FFFFFF" />
                      <Text style={styles.modalNavBtnText}>Open in Google Maps Navigation</Text>
                    </View>
                  </ExternalLink>
                </View>

                {/* ITEMS */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Order Items</Text>
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((it, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemName}>
                          {it.name || it.product_name || 'Item'} x {it.quantity || 1}
                        </Text>
                        <Text style={styles.itemPrice}>
                          {formatPhpExact((Number(it.price) || 0) * (Number(it.quantity) || 1))}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.modalInfoText}>{selectedOrder.itemsSummary || 'Standard package'}</Text>
                  )}
                </View>

                {/* PAYMENT */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Payment Details</Text>
                  <View style={styles.itemRow}>
                    <Text style={styles.infoLabel}>Total Amount</Text>
                    <Text style={[styles.itemPrice, { fontSize: 15, fontWeight: '700', color: '#EA580C' }]}>
                      {formatPhpExact(selectedOrder.totalAmount)}
                    </Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.infoLabel}>Payment Method</Text>
                    <Text style={styles.infoValue}>{selectedOrder.paymentMethod || 'Cash on Delivery'}</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.infoLabel}>Payment Status</Text>
                    <Text style={[styles.infoValue, { fontWeight: '600' }]}>{selectedOrder.paymentStatus}</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.infoLabel}>Rider Shipping Fee</Text>
                    <Text style={[styles.infoValue, { color: '#16A34A', fontWeight: '700' }]}>
                      +{formatPhp(selectedOrder.riderEarning || selectedOrder.shippingFee || 0)}
                    </Text>
                  </View>
                </View>

                {/* PROOF OF DELIVERY PHOTO */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Proof of Delivery Photo</Text>
                  {podPhoto || selectedOrder.deliveryPhoto ? (
                    <View style={styles.podPhotoPreviewBox}>
                      <Image
                        source={{ uri: podPhoto || selectedOrder.deliveryPhoto }}
                        style={styles.podPhotoImg}
                      />
                    </View>
                  ) : null}

                  {String(selectedOrder.deliveryStatus).toLowerCase() !== 'delivered' && (
                    <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPodPhoto} activeOpacity={0.8}>
                      <BootstrapIcon name="camera" size={14} color="#EA580C" />
                      <Text style={styles.addPhotoBtnText}>
                        {podPhoto || selectedOrder.deliveryPhoto ? 'Replace Photo' : 'Add Proof Photo from Device'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>

              {/* MODAL ACTIONS FOOTER */}
              <View style={styles.modalFooter}>
                {/* 1. ASSIGNED: CONFIRM ORDER / ACCEPT DELIVERY */}
                {(String(selectedOrder.deliveryStatus || '').toLowerCase().includes('assigned') ||
                  String(selectedOrder.deliveryStatus || '').toLowerCase().includes('ready')) && (
                  <TouchableOpacity
                    style={[styles.modalActionAcceptBtn, busyId === selectedOrder.orderId && { opacity: 0.7 }]}
                    onPress={() => handleAcceptDelivery(selectedOrder)}
                    disabled={busyId === selectedOrder.orderId}
                    activeOpacity={0.85}
                  >
                    {busyId === selectedOrder.orderId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon name="check2-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.modalActionAcceptText}>Confirm Order / Accept Delivery</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* 2. ACCEPTED: START ROUTE */}
                {String(selectedOrder.deliveryStatus || '').toLowerCase().includes('accepted') && (
                  <TouchableOpacity
                    style={[styles.modalActionStartBtn, busyId === selectedOrder.orderId && { opacity: 0.7 }]}
                    onPress={() => handleStartRoute(selectedOrder)}
                    disabled={busyId === selectedOrder.orderId}
                    activeOpacity={0.85}
                  >
                    {busyId === selectedOrder.orderId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon name="play-fill" size={16} color="#FFFFFF" />
                        <Text style={styles.modalActionStartText}>Start Delivery Route</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* 3. OUT FOR DELIVERY: CONFIRM DELIVERED & REPORT ISSUE */}
                {String(selectedOrder.deliveryStatus || '').toLowerCase().includes('out') && (
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.modalActionIssueBtn, busyId === selectedOrder.orderId && { opacity: 0.7 }]}
                      onPress={() => handleReportIssue(selectedOrder)}
                      disabled={busyId === selectedOrder.orderId}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="exclamation-triangle" size={14} color="#B91C1C" />
                      <Text style={styles.modalActionIssueText}>Delivery Failed</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modalActionDeliverBtn,
                        { flex: 1 },
                        busyId === selectedOrder.orderId && { opacity: 0.7 },
                      ]}
                      onPress={() => handleConfirmDelivered(selectedOrder)}
                      disabled={busyId === selectedOrder.orderId}
                      activeOpacity={0.85}
                    >
                      {busyId === selectedOrder.orderId ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <BootstrapIcon name="check-circle-fill" size={16} color="#FFFFFF" />
                          <Text style={styles.modalActionDeliverText}>Confirm Delivered</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* QR SCAN SHEET MODAL */}
      {scanOrder && (
        <RiderQrScanSheet
          visible={Boolean(scanOrder)}
          onClose={() => setScanOrder(null)}
          onScan={(raw) => {
            setScanOrder(null);
            handleConfirmDelivered(scanOrder);
          }}
          orderId={scanOrder.orderId}
          customerName={scanOrder.customerName}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    ...Platform.select({
      web: {
        minHeight: '100vh',
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter',
  },
  mainViewport: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#F3F4F6',
  },
  mobileHeader: {
    backgroundColor: '#24272B', // MotoTrack Charcoal
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  mobileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  mobileHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  mobileDutyLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Inter',
  },
  mobileLogoutBtn: {
    padding: 8,
  },
  noticeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
  },
  noticeAlertText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
  },
  errorAlertText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  tabSection: {
    gap: 20,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tabTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  tabSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter',
  },

  // Welcome Banner
  welcomeBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      },
    }),
  },
  welcomeGreeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  welcomeDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  quickDutyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  quickDutyAvailable: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  quickDutyOff: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDutyText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Inter',
  },
  dutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dutyDotAvailable: {
    backgroundColor: '#10B981',
  },
  dutyDotOff: {
    backgroundColor: '#94A3B8',
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopWidth: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      },
    }),
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    fontFamily: 'Inter',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 4,
    fontFamily: 'Inter',
  },
  kpiSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Inter',
  },

  // Sections
  sectionBlock: {
    gap: 12,
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  sectionBlockAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
    fontFamily: 'Inter',
  },

  // Delivery Cards
  cardList: {
    gap: 12,
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  cardPaymentMethod: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Inter',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cardCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    fontFamily: 'Inter',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardAddress: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  cardItemsSummary: {
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    fontFamily: 'Inter',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: 'Inter',
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  mapsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    fontFamily: 'Inter',
  },

  // PRIMARY BUTTON: CONFIRM ORDER / ACCEPT DELIVERY
  actionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#EA580C', // Racing Orange
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(234, 88, 12, 0.28)',
      },
    }),
  },
  actionPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },

  // START ROUTE BUTTON
  actionStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  actionStartBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },

  // CONFIRM DROP-OFF BUTTON
  actionDeliveredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },
  actionDeliveredBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  deliveredCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
  },
  deliveredCheckText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
    fontFamily: 'Inter',
  },

  // Filter Bar
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontFamily: 'Inter',
    outlineStyle: 'none',
  },
  pillsScroll: {
    flexDirection: 'row',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#EA580C',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    fontFamily: 'Inter',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // History Tab Cards
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyDeliveredDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Inter',
  },
  historyEarnTag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
    fontFamily: 'Inter',
  },
  historyTotal: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  earningsSummaryBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  earningsSummaryLabel: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Inter',
  },
  earningsSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },

  // Notifications
  markAllReadBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: 'Inter',
  },
  notifCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#EA580C',
    backgroundColor: '#FFFBF7',
  },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  notifTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Inter',
  },
  notifMessage: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
    fontFamily: 'Inter',
  },

  // Account Tab
  accountGrid: {
    gap: 16,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  accountCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  accountCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter',
  },
  profileHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileAvatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#EA580C',
  },
  profileAvatarPlaceholderLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#24272B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#EA580C',
  },
  profileAvatarTextLarge: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  profileFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  profileVehicleDetail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    fontFamily: 'Inter',
  },
  accountInfoList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  dutySwitchBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  dutySwitchText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
    fontFamily: 'Inter',
  },
  pwdForm: {
    gap: 10,
    marginTop: 4,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    fontFamily: 'Inter',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  savePwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#24272B', // Charcoal
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  savePwdBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  logoutSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 8,
  },
  accountLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  accountLogoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    fontFamily: 'Inter',
  },

  // Empty State Card
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 19,
    fontFamily: 'Inter',
  },

  // Modal Dialog
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter',
  },
  modalCustomerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalInfoText: {
    fontSize: 13,
    color: '#334155',
    fontFamily: 'Inter',
  },
  callLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    fontFamily: 'Inter',
  },
  modalLandmark: {
    fontSize: 12,
    color: '#B45309',
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },
  modalNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 9,
    borderRadius: 6,
    marginTop: 6,
  },
  modalNavBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 13,
    color: '#334155',
    fontFamily: 'Inter',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'Inter',
  },
  podPhotoPreviewBox: {
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  podPhotoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EA580C',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: '#FFF7ED',
  },
  addPhotoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
    fontFamily: 'Inter',
  },

  // Modal Footer Actions
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  modalActionAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EA580C', // Racing Orange
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  modalActionAcceptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  modalActionStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  modalActionStartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  modalActionDeliverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalActionDeliverText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  modalActionIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalActionIssueText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
});
