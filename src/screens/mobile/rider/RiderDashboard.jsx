import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  RefreshControl,
  KeyboardAvoidingView,
  BackHandler,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon } from '../../../components/common/BootstrapIcon.jsx';
import MobileBottomNavBar from '../../../components/mobile/customer/MobileBottomNavBar.jsx';
import RiderQrScanSheet from '../../../components/modals/RiderQrScanSheet.jsx';
import RiderDeliveryConfirmSheet from '../../../components/modals/RiderDeliveryConfirmSheet.jsx';
import ConfirmModal from '../../../components/modals/ConfirmModal.jsx';
import {
  RiderTopHeader,
  RiderProfileMenuModal,
  RiderNotificationsModal,
} from '../../../components/mobile/rider/RiderHeaderAndMenus.jsx';
import RiderOrderCard from '../../../components/mobile/rider/RiderOrderCard.jsx';
import RiderOrderDetailsSheet from '../../../components/mobile/rider/RiderOrderDetailsSheet.jsx';
import RiderHomeDeliveryMapCard from '../../../components/mobile/rider/RiderHomeDeliveryMapCard.jsx';
import RiderCustomerTrackModal, {
  prefetchRiderOrderRoute,
} from '../../../components/mobile/rider/RiderCustomerTrackModal.jsx';
import RiderEarningsView from '../../../components/mobile/rider/RiderEarningsView.jsx';
import RiderAccountView from '../../../components/mobile/rider/RiderAccountView.jsx';
import RiderSettingsView from '../../../components/mobile/rider/RiderSettingsView.jsx';
import {
  riderFont,
  cardShadowStyle,
  getRiderPalette,
  isDeliveredOrder,
  isCancelledOrder,
  isNeedsPickupOrder,
  reconcileDeliveryWithOrderStatus,
  formatOrderCode,
} from '../../../components/mobile/rider/riderTheme.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { supabaseManager } from '../../../lib/supabase.js';
import { orderService } from '../../../services/orders/orderService.js';
import { deliveryService } from '../../../services/delivery/deliveryService.js';
import {
  riderService,
  RIDER_STATUSES,
} from '../../../services/staff/riderService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { riderGpsTrackingService } from '../../../services/delivery/riderGpsTrackingService.js';
import { appStorage } from '../../../services/system/storageAdapter.js';
import {
  ANDROID_TOP_INSET,
  ANDROID_BOTTOM_INSET,
} from '../../../utils/safeArea.js';
import { areaFromAddress } from '../../../utils/geo.js';

const DEFAULT_PREFS = {
  pushNotifications: true,
  soundNotification: true,
  vibration: true,
  emailUpdates: true,
  twoFactorEnabled: false,
  homeAddress: '',
};

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

function groupByArea(deliveries) {
  const map = new Map();
  (deliveries || []).forEach((d) => {
    const area = areaFromAddress(d.customerAddress);
    if (!map.has(area)) map.set(area, []);
    map.get(area).push(d);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function matchesOrderSearch(delivery, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return (
    String(delivery?.orderId || '').toLowerCase().includes(q) ||
    String(delivery?.customerName || '').toLowerCase().includes(q) ||
    String(delivery?.customerAddress || '').toLowerCase().includes(q) ||
    String(delivery?.customerPhone || '').toLowerCase().includes(q)
  );
}

export default function RiderDashboard({ onLogout, initialConfirmToken }) {
  const { currentUser, updateProfile, changeEmail, changePassword, logout } =
    useAuth();
  const { isDarkMode, setDarkMode } = useTheme();
  const palette = useMemo(() => getRiderPalette(isDarkMode), [isDarkMode]);

  // Stable primitive user identifiers (prevent-usage-burn compliance)
  const userUid = String(currentUser?.id || currentUser?.user_id || '');
  const userEmail = String(currentUser?.email || '');
  const userUsername = String(currentUser?.username || '');
  const sessionRiderId = String(currentUser?.rider_id || '');

  // Navigation & Modal State
  const [mainTab, setMainTab] = useState('home'); // 'home' | 'orders' | 'earnings' | 'account' | 'settings'
  const [accountTab, setAccountTab] = useState('profile'); // 'profile' | 'preferences' | 'security'
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState(null);

  // Rider Data State
  const [riderId, setRiderId] = useState(sessionRiderId);
  const [riderProfile, setRiderProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [earningsLedger, setEarningsLedger] = useState([]);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [prevWeekEarnings, setPrevWeekEarnings] = useState(0);
  const [error, setError] = useState('');

  // Order Filter & Search State
  const [homeFilter, setHomeFilter] = useState('all'); // 'all' | 'needs_pickup' | 'out'
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'needs_pickup' | 'to_confirm' | 'delivered'
  const [ordersSubFilter, setOrdersSubFilter] = useState('all'); // 'all' | 'out' | 'assigned'
  const [groupByAreaMode, setGroupByAreaMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Order Detail, QR Scan, Confirm & Proof Photo State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [scanOrder, setScanOrder] = useState(null);
  const [verified, setVerified] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingScan, setCheckingScan] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmed, setConfirmed] = useState(null);
  const [podPhoto, setPodPhoto] = useState(null);
  const [podBusy, setPodBusy] = useState(false);

  // Toast / Save Confirmation Feedback
  const [feedbackToast, setFeedbackToast] = useState(null); // { text, isError }
  const toastTimerRef = useRef(null);

  // Notifications & Local Rider Preferences
  const [rawNotifications, setRawNotifications] = useState([]);
  const [readNotifIds, setReadNotifIds] = useState(() => new Set());
  const [dismissedNotifIds, setDismissedNotifIds] = useState(() => new Set());
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);

  const scrollViewRef = useRef(null);
  const scanOpenTimerRef = useRef(null);
  const logoutModalTimerRef = useRef(null);
  const subscribeDebounceRef = useRef(null);
  const scanOrderRef = useRef(scanOrder);
  scanOrderRef.current = scanOrder;
  const consumedInitialTokenRef = useRef('');
  const gpsSyncErrorShownRef = useRef(false);

  const prefsStorageKey = useMemo(
    () => `mototrack_rider_prefs_${userUid || sessionRiderId || 'default'}`,
    [userUid, sessionRiderId]
  );

  const readNotifsStorageKey = useMemo(
    () => `mototrack_rider_read_notifs_${userUid || sessionRiderId || 'default'}`,
    [userUid, sessionRiderId]
  );

  const dismissedNotifsStorageKey = useMemo(
    () =>
      `mototrack_rider_dismissed_notifs_${userUid || sessionRiderId || 'default'}`,
    [userUid, sessionRiderId]
  );

  // Hydrate persisted rider preferences, read IDs & dismissed notification IDs
  useEffect(() => {
    try {
      const savedPrefs = appStorage.getItem(prefsStorageKey);
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        if (parsed && typeof parsed === 'object') {
          setPreferences({ ...DEFAULT_PREFS, ...parsed });
        }
      }
      const savedRead = appStorage.getItem(readNotifsStorageKey);
      if (savedRead) {
        const arr = JSON.parse(savedRead);
        if (Array.isArray(arr)) setReadNotifIds(new Set(arr));
      }
      const savedDismissed = appStorage.getItem(dismissedNotifsStorageKey);
      if (savedDismissed) {
        const arr = JSON.parse(savedDismissed);
        if (Array.isArray(arr)) setDismissedNotifIds(new Set(arr));
      }
    } catch (_e) { }
  }, [prefsStorageKey, readNotifsStorageKey, dismissedNotifsStorageKey]);

  const showFeedback = useCallback((text, isError = false) => {
    if (!text) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedbackToast({ text, isError });
    toastTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, isError ? 5200 : 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (scanOpenTimerRef.current) clearTimeout(scanOpenTimerRef.current);
      if (logoutModalTimerRef.current) {
        clearTimeout(logoutModalTimerRef.current);
      }
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (subscribeDebounceRef.current) {
        clearTimeout(subscribeDebounceRef.current);
      }
    };
  }, []);

  // Android Hardware Back Button Handling
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (logoutConfirmOpen) {
        setLogoutConfirmOpen(false);
        return true;
      }
      if (profileMenuOpen) {
        setProfileMenuOpen(false);
        return true;
      }
      if (notificationsOpen) {
        setNotificationsOpen(false);
        return true;
      }
      if (trackOrderId) {
        setTrackOrderId(null);
        return true;
      }
      if (selectedOrder) {
        setSelectedOrder(null);
        return true;
      }
      if (mainTab !== 'home') {
        setMainTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [
    logoutConfirmOpen,
    profileMenuOpen,
    notificationsOpen,
    trackOrderId,
    selectedOrder,
    mainTab,
  ]);

  const requestLogout = useCallback(() => {
    if (logoutModalTimerRef.current) {
      clearTimeout(logoutModalTimerRef.current);
      logoutModalTimerRef.current = null;
    }
    if (profileMenuOpen) {
      setProfileMenuOpen(false);
      const settleMs = Platform.OS === 'ios' ? 280 : 120;
      logoutModalTimerRef.current = setTimeout(() => {
        logoutModalTimerRef.current = null;
        setLogoutConfirmOpen(true);
      }, settleMs);
      return;
    }
    setLogoutConfirmOpen(true);
  }, [profileMenuOpen]);

  const handleConfirmLogout = useCallback(() => {
    setLogoutConfirmOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      logout?.();
    }
  }, [onLogout, logout]);

  const resolveRiderId = useCallback(async () => {
    if (sessionRiderId) return sessionRiderId;
    await riderService.fetchRiders();
    const byUser = riderService.getRiderByUserId(userUid);
    if (byUser?.id) return byUser.id;
    const byName = riderService.getRiderByUsername(userUsername || userEmail);
    return byName?.id || '';
  }, [sessionRiderId, userUid, userUsername, userEmail]);

  const load = useCallback(async () => {
    setError('');
    const id = await resolveRiderId();
    setRiderId(id);
    if (!id) {
      setDeliveries([]);
      setEarningsLedger([]);
      setWeekEarnings(0);
      setPrevWeekEarnings(0);
      setError(
        'This login is not linked to a rider profile. Ask the MotoTrack admin to link your rider account.'
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const profile = riderService.getRiderById(id);
      if (profile) setRiderProfile(profile);

      const rawRows = (await deliveryService.getMyDeliveries(id)) || [];
      const orderStatusMap = new Map();
      (orderService.getLocalOrders?.() || []).forEach((o) => {
        const oid = String(o?.order_id || o?.id || '').trim();
        if (oid && o?.status) orderStatusMap.set(oid, o.status);
      });
      const orderIds = [
        ...new Set(rawRows.map((r) => r?.orderId).filter(Boolean)),
      ];
      const sbClient = supabaseManager.getClient?.();
      if (sbClient && orderIds.length > 0) {
        try {
          const { data: orderRows } = await sbClient
            .from('orders')
            .select('order_id,status')
            .in('order_id', orderIds);
          (orderRows || []).forEach((o) => {
            if (o?.order_id && o?.status) {
              orderStatusMap.set(String(o.order_id), o.status);
            }
          });
        } catch (_e) { }
      }
      const rows = rawRows
        .map((row) =>
          reconcileDeliveryWithOrderStatus(
            row,
            orderStatusMap.get(String(row.orderId))
          )
        )
        .filter((row) => !isCancelledOrder(row));
      setDeliveries(rows);

      const weekStart = startOfWeek();
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);

      let earnedThisWeek = 0;
      let earnedLastWeek = 0;
      let ledgerRows = [];

      try {
        ledgerRows = (await riderService.getRiderEarnings(id, { limit: 200 })) || [];
        setEarningsLedger(ledgerRows);
        ledgerRows.forEach((row) => {
          const at = row?.created_at ? new Date(row.created_at) : null;
          const amt = Number(row?.amount) || 0;
          if (!at) return;
          if (at >= weekStart) {
            earnedThisWeek += amt;
          } else if (at >= prevWeekStart && at < weekStart) {
            earnedLastWeek += amt;
          }
        });
      } catch (_e) { }

      if (earnedThisWeek <= 0) {
        (rows || []).forEach((d) => {
          if (!isDeliveredOrder(d)) return;
          const at = d.deliveredAt ? new Date(d.deliveredAt) : null;
          const amt = Number(d.riderEarning || d.shippingFee) || 0;
          if (!at) return;
          if (at >= weekStart) {
            earnedThisWeek += amt;
          } else if (at >= prevWeekStart && at < weekStart) {
            earnedLastWeek += amt;
          }
        });
      }

      setWeekEarnings(earnedThisWeek);
      setPrevWeekEarnings(earnedLastWeek);

      // Notifications
      try {
        const notifs =
          notificationService.getCustomerNotifications?.(
            userUid,
            userEmail,
            userUsername
          ) || [];
        setRawNotifications(notifs);
      } catch (_e) { }

      // Sync GPS watcher across all active Out for Delivery jobs
      const activeOutIds = (rows || [])
        .filter(
          (d) =>
            !isCancelledOrder(d) &&
            !isNeedsPickupOrder(d) &&
            String(d.deliveryStatus || '')
              .toLowerCase()
              .includes('out')
        )
        .map((d) => d.orderId)
        .filter(Boolean);
      if (activeOutIds.length > 0 && id) {
        const gpsRes = await riderGpsTrackingService
          .start({ orderIds: activeOutIds, riderId: id })
          .catch((gpsErr) => ({
            success: false,
            error: gpsErr?.message || 'Unable to start GPS tracking.',
          }));
        const gpsErrMsg =
          gpsRes?.syncError || (!gpsRes?.success ? gpsRes?.error : '');
        if (gpsErrMsg) {
          if (!gpsSyncErrorShownRef.current) {
            gpsSyncErrorShownRef.current = true;
            showFeedback(`GPS sync error: ${gpsErrMsg}`, true);
          }
        } else if (gpsRes?.success && !gpsRes?.already) {
          gpsSyncErrorShownRef.current = false;
        }
      } else if (activeOutIds.length === 0 && riderGpsTrackingService.isTracking()) {
        gpsSyncErrorShownRef.current = false;
        riderGpsTrackingService.stop({ clearDb: true }).catch(() => { });
      }

      // Warm OSRM route cache for the top active delivery so Track Customer opens instantly
      const topActiveDelivery =
        (rows || []).find(
          (d) =>
            !isCancelledOrder(d) &&
            !isDeliveredOrder(d) &&
            !isNeedsPickupOrder(d) &&
            String(d.deliveryStatus || '').toLowerCase().includes('out')
        ) ||
        (rows || []).find(
          (d) => !isCancelledOrder(d) && !isDeliveredOrder(d)
        );
      if (topActiveDelivery) {
        prefetchRiderOrderRoute(topActiveDelivery);
      }
    } catch (e) {
      setError(e?.message || 'Unable to load your deliveries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveRiderId, userUid, userEmail, userUsername, showFeedback]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced subscription listeners (prevent-usage-burn compliance)
  useEffect(() => {
    const scheduleReload = () => {
      if (subscribeDebounceRef.current) {
        clearTimeout(subscribeDebounceRef.current);
      }
      subscribeDebounceRef.current = setTimeout(() => {
        subscribeDebounceRef.current = null;
        load();
      }, 400);
    };

    const unsubDeliveries = deliveryService.subscribe(scheduleReload);
    const unsubRiders = riderService.subscribe(scheduleReload);
    const unsubNotifs = notificationService.subscribe?.(() => {
      try {
        const notifs =
          notificationService.getCustomerNotifications?.(
            userUid,
            userEmail,
            userUsername
          ) || [];
        setRawNotifications(notifs);
      } catch (_e) { }
    });

    return () => {
      unsubDeliveries?.();
      unsubRiders?.();
      unsubNotifs?.();
      if (subscribeDebounceRef.current) {
        clearTimeout(subscribeDebounceRef.current);
      }
      riderGpsTrackingService.stop({ clearDb: false }).catch(() => { });
    };
  }, [load, userUid, userEmail, userUsername]);

  // Derived Order Collections
  const needConfirmationOrders = useMemo(
    () => deliveries.filter((d) => !isDeliveredOrder(d) && !isCancelledOrder(d)),
    [deliveries]
  );

  const deliveredOrders = useMemo(() => {
    return deliveries
      .filter((d) => isDeliveredOrder(d))
      .slice()
      .sort((a, b) => {
        const at = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const bt = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return bt - at;
      });
  }, [deliveries]);

  const needsPickupOrders = useMemo(
    () => needConfirmationOrders.filter((d) => isNeedsPickupOrder(d)),
    [needConfirmationOrders]
  );

  const outForDeliveryCount = useMemo(
    () =>
      needConfirmationOrders.filter(
        (d) =>
          !isNeedsPickupOrder(d) &&
          String(d.deliveryStatus || '').toLowerCase().includes('out')
      ).length,
    [needConfirmationOrders]
  );

  const assignedCount = needsPickupOrders.length;

  const homeOrders = useMemo(() => {
    let list = needConfirmationOrders;
    if (homeFilter === 'needs_pickup') {
      list = needsPickupOrders;
    } else if (homeFilter === 'out') {
      list = needConfirmationOrders.filter(
        (d) =>
          !isNeedsPickupOrder(d) &&
          String(d.deliveryStatus || '').toLowerCase().includes('out')
      );
    }
    return list.filter((d) => matchesOrderSearch(d, searchQuery));
  }, [homeFilter, searchQuery, needsPickupOrders, needConfirmationOrders]);

  const filteredOrders = useMemo(() => {
    let list = [];
    if (orderFilter === 'needs_pickup') {
      list = needsPickupOrders;
    } else if (orderFilter === 'to_confirm') {
      list = needConfirmationOrders;
      if (mainTab === 'orders' && ordersSubFilter === 'out') {
        list = list.filter(
          (d) =>
            !isNeedsPickupOrder(d) &&
            String(d.deliveryStatus || '').toLowerCase().includes('out')
        );
      } else if (mainTab === 'orders' && ordersSubFilter === 'assigned') {
        list = list.filter((d) => isNeedsPickupOrder(d));
      }
    } else if (orderFilter === 'delivered') {
      list = deliveredOrders;
    } else {
      list = [...needConfirmationOrders, ...deliveredOrders];
    }

    return list.filter((d) => matchesOrderSearch(d, searchQuery));
  }, [
    orderFilter,
    ordersSubFilter,
    mainTab,
    searchQuery,
    needsPickupOrders,
    needConfirmationOrders,
    deliveredOrders,
  ]);

  const areaGroups = useMemo(() => {
    if (!groupByAreaMode) return [];
    return groupByArea(mainTab === 'home' ? homeOrders : filteredOrders);
  }, [groupByAreaMode, mainTab, homeOrders, filteredOrders]);

  // Unified Notifications Feed (merges service notifications + active dispatch alerts)
  const notificationFeed = useMemo(() => {
    const items = [];
    (rawNotifications || []).forEach((n, idx) => {
      const id = String(n.id || `svc-notif-${idx}`);
      if (dismissedNotifIds.has(id)) return;
      const isUnread =
        (n.status === 'unread' || n.read === false) && !readNotifIds.has(id);
      const rawType = String(n.type || n.category || 'order').toLowerCase();
      items.push({
        id,
        title: n.title || 'MotoTrack Update',
        message: n.message || '',
        orderId: n.meta?.orderId || '',
        type: rawType,
        category: n.category || n.type || 'Order Update',
        rawStatus: String(n.meta?.deliveryStatus || n.meta?.status || ''),
        icon: rawType.includes('ear') || rawType.includes('pay')
          ? 'wallet2'
          : rawType.includes('sys') || rawType.includes('account')
            ? 'shield-check'
            : 'bell',
        unread: isUnread,
        timestamp: n.created_at || n.timestamp || n.date || n.createdAt || null,
        timeLabel: n.time || n.createdAt || n.created_at || 'Recent',
        isDispatch: false,
      });
    });

    needConfirmationOrders.slice(0, 6).forEach((d) => {
      const id = `dispatch-${d.orderId}`;
      if (dismissedNotifIds.has(id)) return;
      if (items.some((x) => x.orderId && String(x.orderId) === String(d.orderId)))
        return;
      const statusLower = String(d.deliveryStatus || '').toLowerCase();
      const isOut = !isNeedsPickupOrder(d) && statusLower.includes('out');
      items.push({
        id,
        title: isOut
          ? 'Active drop-off awaiting QR scan'
          : 'Order needs pickup at store hub',
        message: `${d.customerName || 'Customer'} · ${d.customerAddress || 'Tap to view route'}`,
        orderId: d.orderId,
        type: isOut ? 'out_for_delivery' : 'pickup',
        category: isOut ? 'In Transit' : 'Need to pick up',
        rawStatus: String(d.deliveryStatus || ''),
        icon: isOut ? 'truck' : 'box-seam',
        unread: !readNotifIds.has(id),
        timestamp: d.updatedAt || d.createdAt || d.expectedDeliveryAt || null,
        timeLabel: d.expectedDeliveryTime || 'Today',
        isDispatch: true,
      });
    });

    return items;
  }, [rawNotifications, needConfirmationOrders, readNotifIds, dismissedNotifIds]);

  const unreadNotifCount = useMemo(
    () => notificationFeed.filter((n) => n.unread).length,
    [notificationFeed]
  );

  const handleMarkNotifRead = useCallback(
    (notif) => {
      const id = String(notif?.id || '');
      if (!id || readNotifIds.has(id)) return;
      const next = new Set(readNotifIds);
      next.add(id);
      setReadNotifIds(next);
      try {
        appStorage.setItem(readNotifsStorageKey, JSON.stringify([...next]));
        if (!id.startsWith('dispatch-')) {
          notificationService.markAsRead?.(id);
        }
      } catch (_e) { }
    },
    [readNotifIds, readNotifsStorageKey]
  );

  const handleDismissNotif = useCallback(
    (notif) => {
      const id = String(notif?.id || '');
      if (!id) return;
      const nextDismissed = new Set(dismissedNotifIds);
      nextDismissed.add(id);
      setDismissedNotifIds(nextDismissed);

      const nextRead = new Set(readNotifIds);
      nextRead.add(id);
      setReadNotifIds(nextRead);

      try {
        appStorage.setItem(
          dismissedNotifsStorageKey,
          JSON.stringify([...nextDismissed])
        );
        appStorage.setItem(readNotifsStorageKey, JSON.stringify([...nextRead]));
        if (!id.startsWith('dispatch-')) {
          setRawNotifications((prev) =>
            (prev || []).filter((item) => String(item.id) !== id)
          );
          notificationService.deleteNotification?.(id);
        }
      } catch (_e) { }
    },
    [
      dismissedNotifIds,
      dismissedNotifsStorageKey,
      readNotifIds,
      readNotifsStorageKey,
    ]
  );

  const handleMarkAllNotifsRead = useCallback(() => {
    const next = new Set(readNotifIds);
    notificationFeed.forEach((n) => next.add(n.id));
    setReadNotifIds(next);
    try {
      appStorage.setItem(readNotifsStorageKey, JSON.stringify([...next]));
      if (userUid) {
        notificationService.markAllAsRead?.(userUid);
      }
    } catch (_e) { }
    showFeedback('All notifications marked as read.');
  }, [
    readNotifIds,
    notificationFeed,
    readNotifsStorageKey,
    userUid,
    showFeedback,
  ]);

  // Weekly Earnings State cleanup — kept prevWeekEarnings/weekEarnings for RiderEarningsView

  // QR Scanner & Delivery Confirmation Handlers
  const openScannerFromDetail = useCallback((targetOrder) => {
    if (!targetOrder) return;
    setVerified(null);
    setSelectedOrder(null);
    if (scanOpenTimerRef.current) {
      clearTimeout(scanOpenTimerRef.current);
    }
    const settleMs = Platform.OS === 'ios' ? 340 : 280;
    scanOpenTimerRef.current = setTimeout(() => {
      scanOpenTimerRef.current = null;
      setScanOrder(targetOrder);
    }, settleMs);
  }, []);

  const handleScanned = useCallback(
    async (raw) => {
      const currentScanOrder = scanOrderRef.current;
      const hintOrderId = currentScanOrder?.orderId || null;
      const hadScannerModal = Boolean(currentScanOrder);
      const dismissStartedAt = Date.now();
      setScanOrder(null);
      setSelectedOrder(null);
      setConfirmError('');
      setConfirmed(null);
      setCheckingScan(true);
      setBusyId('scan');
      try {
        const res = await deliveryService.riderVerifyDeliveryQr({
          riderId,
          orderId: hintOrderId,
          scannedRaw: raw,
        });
        if (!res.success) {
          setVerified(null);
          setConfirmOpen(false);
          const title = res.title ? `${res.title}. ` : '';
          showFeedback(
            `${title}${res.error || 'Unable to verify this QR code.'}`,
            true
          );
          return;
        }
        if (hadScannerModal) {
          const minDismissMs = Platform.OS === 'ios' ? 360 : 180;
          const remainingMs = minDismissMs - (Date.now() - dismissStartedAt);
          if (remainingMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingMs));
          }
        }
        setVerified({
          ...res.delivery,
          scannedRaw: raw,
          hintMismatch: Boolean(res.hintMismatch),
        });
        setConfirmOpen(true);
      } catch (_e) {
        setVerified(null);
        setConfirmOpen(false);
        showFeedback(
          'Unable to verify the order. Please check your connection and try again.',
          true
        );
      } finally {
        setCheckingScan(false);
        setBusyId('');
      }
    },
    [riderId, showFeedback]
  );

  useEffect(() => {
    if (
      initialConfirmToken &&
      !loading &&
      riderId &&
      consumedInitialTokenRef.current !== initialConfirmToken
    ) {
      consumedInitialTokenRef.current = initialConfirmToken;
      handleScanned(initialConfirmToken);
    }
  }, [initialConfirmToken, loading, riderId, handleScanned]);

  const handleOutForDelivery = async (d) => {
    setBusyId(d.orderId);
    try {
      const res = await deliveryService.riderMarkOutForDelivery({
        riderId,
        orderId: d.orderId,
        riderUser: currentUser,
      });
      if (!res.success) {
        showFeedback(res.error || 'Could not update delivery status.', true);
        return;
      }
      const otherActiveOutIds = (deliveries || [])
        .filter(
          (item) =>
            item?.orderId &&
            item.orderId !== d.orderId &&
            !isCancelledOrder(item) &&
            !isNeedsPickupOrder(item) &&
            String(item.deliveryStatus || '').toLowerCase().includes('out')
        )
        .map((item) => item.orderId);
      const gps = await riderGpsTrackingService.start({
        orderIds: [d.orderId, ...otherActiveOutIds],
        riderId,
      });
      if (!gps.success) {
        showFeedback(
          `${formatOrderCode(d.orderId)} is Out for Delivery (GPS unavailable).`
        );
      } else if (gps.syncError) {
        showFeedback(
          `${formatOrderCode(d.orderId)} is Out for Delivery · GPS sync failed: ${gps.syncError}`,
          true
        );
      } else {
        gpsSyncErrorShownRef.current = false;
        showFeedback(
          `${formatOrderCode(d.orderId)} is Out for Delivery · Live GPS active.`
        );
      }
      await load();
      setSelectedOrder((prev) =>
        prev?.orderId === d.orderId
          ? { ...prev, deliveryStatus: 'Out for Delivery' }
          : prev
      );
    } finally {
      setBusyId('');
    }
  };

  const applyDeliveredLocally = (card) => {
    if (!card?.orderId) return;
    setDeliveries((prev) => {
      const exists = prev.some((row) => row.orderId === card.orderId);
      if (!exists) return [card, ...prev];
      return prev.map((row) =>
        row.orderId === card.orderId ? { ...row, ...card } : row
      );
    });
  };

  const closeConfirmPopup = () => {
    if (confirming) return;
    setConfirmOpen(false);
    setConfirmError('');
    setVerified(null);
    setConfirmed(null);
  };

  const handleConfirmDelivery = async () => {
    const target = verified || selectedOrder;
    if (confirming || !target?.orderId) return;
    const activeProofPhoto = podPhoto || target.deliveryPhoto || null;
    if (!activeProofPhoto) {
      setConfirmError('Please attach a proof of delivery photo before confirming.');
      return;
    }
    setConfirming(true);
    setConfirmError('');
    try {
      let res;
      if (target.scannedRaw) {
        res = await deliveryService.riderConfirmDeliveredByQr({
          riderId,
          riderUser: currentUser,
          orderId: target.orderId,
          scannedRaw: target.scannedRaw,
        });
        if (res.success && podPhoto) {
          await deliveryService
            .riderUploadProofPhoto({
              riderId,
              orderId: res.delivery?.orderId || target.orderId,
              photoUri: podPhoto,
            })
            .catch(() => { });
        }
      } else {
        res = await deliveryService.riderConfirmOrderDelivery({
          riderId,
          riderUser: currentUser,
          orderId: target.orderId,
          notes: 'Delivered by rider via MotoTrack mobile confirmation',
          photoUri: activeProofPhoto,
        });
      }
      if (!res.success) {
        const title = res.title ? `${res.title}. ` : '';
        setConfirmError(
          `${title}${res.error || 'Unable to confirm delivery. Please try again.'}`
        );
        return;
      }
      const deliveredRecord = {
        ...res.delivery,
        deliveryPhoto: res.delivery?.deliveryPhoto || activeProofPhoto,
      };
      applyDeliveredLocally(deliveredRecord);
      setConfirmed(deliveredRecord);
      setVerified(null);
      setSelectedOrder(null);
      setPodPhoto(null);
      await riderGpsTrackingService.stop({
        clearDb: true,
        orderId: deliveredRecord.orderId,
        riderId,
      });
    } catch (_e) {
      setConfirmError(
        'Unable to confirm delivery. Please check your connection and try again.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmFinished = async () => {
    setConfirmOpen(false);
    setConfirmed(null);
    setVerified(null);
    setSelectedOrder(null);
    setPodPhoto(null);
    showFeedback('Delivery confirmed and earnings credited.');
    await load();
  };

  // Proof of Delivery Photo Handlers
  const handlePickPodPhoto = async () => {
    const res = await pickImageFromFile();
    if (res.success) {
      setPodPhoto(res.uri);
    } else if (
      res.error &&
      res.error !== 'No file selected' &&
      res.error !== 'Selection cancelled'
    ) {
      showFeedback(res.error, true);
    }
  };

  const handleSavePodPhoto = async () => {
    if (!podPhoto || !selectedOrder) return;
    setPodBusy(true);
    try {
      const res = await deliveryService.riderUploadProofPhoto({
        riderId,
        orderId: selectedOrder.orderId,
        photoUri: podPhoto,
      });
      if (res.success) {
        showFeedback('Proof of delivery photo saved.');
        setSelectedOrder((prev) =>
          prev ? { ...prev, deliveryPhoto: podPhoto } : prev
        );
        setPodPhoto(null);
        await load();
      } else {
        showFeedback(res.error || 'Could not save photo.', true);
      }
    } finally {
      setPodBusy(false);
    }
  };

  // Account & Availability Handlers
  const availabilityStatus =
    riderProfile?.status || RIDER_STATUSES.AVAILABLE;

  const handleSelectAvailability = async (nextStatus) => {
    if (!nextStatus) return;
    setRiderProfile((prev) =>
      prev
        ? { ...prev, status: nextStatus }
        : { id: riderId, status: nextStatus }
    );
    if (riderId) {
      try {
        await riderService.setRiderStatus(riderId, nextStatus);
      } catch (_e) { }
    }
    showFeedback(`Availability updated to ${nextStatus}.`);
  };

  const handleCycleAvailability = () => {
    const cur = String(availabilityStatus).toLowerCase();
    const next =
      cur === 'available'
        ? RIDER_STATUSES.OFF_DUTY
        : RIDER_STATUSES.AVAILABLE;
    handleSelectAvailability(next);
  };

  const handleUpdatePreference = (key, value, feedbackMessage) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      try {
        appStorage.setItem(prefsStorageKey, JSON.stringify(next));
      } catch (_e) { }
      return next;
    });
    if (feedbackMessage) showFeedback(feedbackMessage);
  };

  const handleSavePersonalInfo = async ({
    name,
    phone,
    email,
    emailChanged,
    currentPassword,
    address,
    avatar,
  }) => {
    if (emailChanged) {
      const emailRes = await changeEmail({
        newEmail: email,
        currentPassword,
      });
      if (!emailRes?.success) {
        return {
          success: false,
          error: emailRes?.error || 'Could not update email address.',
        };
      }
    }

    const profRes = await updateProfile({
      name,
      phone,
      address,
      avatar: avatar || undefined,
    });
    if (!profRes?.success) {
      return {
        success: false,
        error: profRes?.error || 'Could not update profile.',
      };
    }

    // Persist home address in local rider prefs & sync rider roster record
    handleUpdatePreference('homeAddress', address);

    if (riderId) {
      try {
        const rRes = await riderService.updateRider(riderId, {
          name,
          shortName: name.split(' ')[0],
          phone,
          avatar: avatar || riderProfile?.avatar,
        });
        if (rRes?.rider) setRiderProfile(rRes.rider);
      } catch (_e) { }
    }

    return { success: true };
  };

  const riderFullName =
    riderProfile?.name || currentUser?.name || 'Jherico Maurin';
  const riderAvatar = riderProfile?.avatar || currentUser?.avatar || '';

  const trackedDelivery = useMemo(() => {
    if (!trackOrderId) return null;
    return (
      deliveries.find((d) => String(d.orderId) === String(trackOrderId)) || null
    );
  }, [trackOrderId, deliveries]);

  const openOrderMap = useCallback((delivery) => {
    if (!delivery?.orderId) return;
    prefetchRiderOrderRoute(delivery);
    setSelectedOrder((prev) => {
      const hadDetailSheet = Boolean(prev);
      if (hadDetailSheet && Platform.OS === 'ios') {
        setTimeout(() => setTrackOrderId(delivery.orderId), 260);
      } else {
        setTrackOrderId(delivery.orderId);
      }
      return null;
    });
  }, []);

  // Reusable Filter Tabs & Search Block (Customer Orders layout: Search bar above horizontal status pills)
  const renderFiltersAndSearch = (
    showSearchInput = true,
    showAreaToggle = false,
    homeOnly = false
  ) => {
    const tabs = homeOnly
      ? [
        { id: 'all', label: 'All', count: needConfirmationOrders.length },
        {
          id: 'needs_pickup',
          label: 'Need to pick up',
          count: needsPickupOrders.length,
        },
        {
          id: 'out',
          label: 'Out for delivery',
          count: outForDeliveryCount,
        },
      ]
      : [
        { id: 'all', label: 'All', count: deliveries.length },
        {
          id: 'needs_pickup',
          label: 'Need to pick up',
          count: needsPickupOrders.length,
        },
        {
          id: 'to_confirm',
          label: 'To confirm',
          count: needConfirmationOrders.length,
        },
        { id: 'delivered', label: 'Delivered', count: deliveredOrders.length },
      ];
    const currentFilter = homeOnly ? homeFilter : orderFilter;

    return (
      <View style={styles.filtersBlock}>
        {/* Rounded Search Input (Matching Customer Orders) */}
        {showSearchInput ? (
          <View
            style={[
              styles.searchFieldWrap,
              {
                backgroundColor: palette.isDark ? '#1C1F23' : '#FFFFFF',
                borderColor: palette.isDark ? '#2B3035' : '#EDE9E0',
              },
            ]}
          >
            <BootstrapIcon
              name="search"
              size={16}
              color={palette.isDark ? '#94A3B8' : '#9CA3AF'}
            />
            <TextInput
              style={[styles.searchInput, { color: palette.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search order number, customer, or item"
              placeholderTextColor={palette.isDark ? '#6B7280' : '#9CA3AF'}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
                accessibilityLabel="Clear search"
              >
                <BootstrapIcon
                  name="x-circle-fill"
                  size={16}
                  color={palette.isDark ? '#94A3B8' : '#9CA3AF'}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Horizontal Filter Pills Row (Matching Customer Orders) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTrack}
        >
          {tabs.map((t) => {
            const active = currentFilter === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: active
                      ? palette.isDark
                        ? '#EA580C'
                        : '#141414'
                      : palette.isDark
                        ? '#1C1F23'
                        : '#FFFFFF',
                    borderColor: active
                      ? palette.isDark
                        ? '#EA580C'
                        : '#141414'
                      : palette.isDark
                        ? '#2B3035'
                        : '#EDE9E0',
                  },
                ]}
                onPress={() => {
                  if (homeOnly) {
                    setHomeFilter(t.id);
                  } else {
                    setOrderFilter(t.id);
                    setOrdersSubFilter('all');
                  }
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    active && styles.filterTabLabelActive,
                    {
                      color: active
                        ? '#FFFFFF'
                        : palette.isDark
                          ? '#E5E7EB'
                          : '#52525B',
                    },
                  ]}
                >
                  {t.label} ({t.count})
                </Text>
              </TouchableOpacity>
            );
          })}

          {showAreaToggle ? (
            <TouchableOpacity
              style={[
                styles.filterTab,
                {
                  backgroundColor: groupByAreaMode
                    ? palette.orangeSoft
                    : palette.isDark
                      ? '#1C1F23'
                      : '#FFFFFF',
                  borderColor: groupByAreaMode
                    ? palette.orangeBorder
                    : palette.isDark
                      ? '#2B3035'
                      : '#EDE9E0',
                },
              ]}
              onPress={() => setGroupByAreaMode((v) => !v)}
              activeOpacity={0.8}
            >
              <BootstrapIcon
                name="geo-alt"
                size={12}
                color={groupByAreaMode ? palette.orange : palette.textSecondary}
              />
              <Text
                style={[
                  styles.filterTabLabel,
                  styles.filterTabLabelSemi,
                  {
                    color: groupByAreaMode
                      ? palette.orangeText
                      : palette.isDark
                        ? '#E5E7EB'
                        : '#52525B',
                  },
                ]}
              >
                By area
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  const renderOrderCardsList = (homeOnly = false) => {
    const activeList = homeOnly ? homeOrders : filteredOrders;
    const activeFilter = homeOnly ? homeFilter : orderFilter;

    if (activeList.length === 0) {
      return (
        <View style={styles.emptyDarkBanner}>
          <View style={styles.emptyDarkIconOuter}>
            <View style={styles.emptyDarkIconInner}>
              <BootstrapIcon
                name={activeFilter === 'delivered' ? 'check-circle' : 'bag-check-fill'}
                size={18}
                color="#38BDF8"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyDarkTitle}>
              {searchQuery.trim()
                ? 'No matching orders'
                : activeFilter === 'needs_pickup'
                  ? 'No orders needing pickup'
                  : activeFilter === 'out'
                    ? 'No orders out for delivery'
                    : activeFilter === 'delivered'
                      ? 'No delivered orders'
                      : activeFilter === 'to_confirm' || homeOnly
                        ? 'All deliveries completed'
                        : 'No related orders'}
            </Text>
            <Text style={styles.emptyDarkSub}>
              {searchQuery.trim()
                ? 'Try searching a different order number, customer, or area'
                : activeFilter === 'needs_pickup'
                  ? 'Assigned orders waiting for rider pickup appear here'
                  : activeFilter === 'out'
                    ? 'Orders marked Out for Delivery will appear here'
                    : activeFilter === 'delivered'
                      ? 'Orders you scan and confirm at drop-off appear here'
                      : homeOnly
                        ? 'Orders that still need to be delivered will appear here'
                        : 'New MotoTrack dispatches assigned to you will appear here'}
            </Text>
          </View>
        </View>
      );
    }

    if (groupByAreaMode && areaGroups.length > 0) {
      return areaGroups.map(([area, stops]) => (
        <View key={area} style={styles.areaGroupSection}>
          <View style={styles.areaGroupHeader}>
            <BootstrapIcon name="geo-alt" size={13} color={palette.orange} />
            <Text
              style={[styles.areaGroupTitle, { color: palette.textSecondary }]}
            >
              {area}
            </Text>
            <View
              style={[
                styles.areaCountPill,
                { backgroundColor: palette.orangeSoft },
              ]}
            >
              <Text
                style={[styles.areaCountText, { color: palette.orangeText }]}
              >
                {stops.length}
              </Text>
            </View>
          </View>
          {stops.map((d) => (
            <RiderOrderCard
              key={d.orderId}
              delivery={d}
              palette={palette}
              onViewMap={openOrderMap}
              onViewDetails={(order) => {
                prefetchRiderOrderRoute(order);
                setPodPhoto(null);
                setSelectedOrder(order);
                setVerified(null);
              }}
            />
          ))}
        </View>
      ));
    }

    return activeList.map((d) => (
      <RiderOrderCard
        key={d.orderId}
        delivery={d}
        palette={palette}
        onViewMap={openOrderMap}
        onViewDetails={(order) => {
          prefetchRiderOrderRoute(order);
          setPodPhoto(null);
          setSelectedOrder(order);
          setVerified(null);
        }}
      />
    ));
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.loadingSafe,
          {
            backgroundColor: palette.bgCanvas,
            paddingTop: ANDROID_TOP_INSET,
          },
        ]}
      >
        <StatusBar
          style={palette.isDark ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.loadingCenter}>
          <View
            style={[
              styles.loadingLogoBadge,
              { backgroundColor: palette.orange },
            ]}
          >
            <BootstrapIcon name="qr-code-scan" size={22} color="#FFFFFF" />
          </View>
          <ActivityIndicator color={palette.orange} style={{ marginTop: 14 }} />
          <Text style={[styles.loadingLabel, { color: palette.textMuted }]}>
            Loading MotoTrack dispatch...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bgCanvas }]}>
      <StatusBar
        style={mainTab === 'account' || palette.isDark ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      {mainTab !== 'account' ? (
        <SafeAreaView
          style={[
            styles.safeTop,
            {
              backgroundColor: palette.bgHeader,
              paddingTop: ANDROID_TOP_INSET,
            },
          ]}
        >
          {/* Customer-Styled MotoTrack Header */}
          <RiderTopHeader
            palette={palette}
            activeTab={mainTab}
            riderName={riderFullName}
            riderAvatar={riderAvatar}
            unreadCount={unreadNotifCount}
            activeOrderCount={needConfirmationOrders.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCycleFilter={() => {
              if (mainTab === 'home') {
                setHomeFilter((prev) =>
                  prev === 'all'
                    ? 'needs_pickup'
                    : prev === 'needs_pickup'
                      ? 'out'
                      : 'all'
                );
              } else {
                setOrderFilter((prev) =>
                  prev === 'all'
                    ? 'to_confirm'
                    : prev === 'to_confirm'
                      ? 'delivered'
                      : 'all'
                );
                setOrdersSubFilter('all');
              }
            }}
            onPressLogo={() => setMainTab('home')}
            onPressNotifications={() => setNotificationsOpen(true)}
            onPressOrders={() => setMainTab('orders')}
            onPressScanQr={() => {
              setVerified(null);
              setScanOrder({ unbound: true });
            }}
            onPressProfile={() => setProfileMenuOpen(true)}
          />
        </SafeAreaView>
      ) : null}

      {/* Save Confirmation / Feedback Toast */}
      {feedbackToast ? (
        <View
          style={[
            styles.toastBanner,
            {
              backgroundColor: feedbackToast.isError
                ? palette.danger
                : palette.charcoal,
            },
          ]}
          pointerEvents="none"
        >
          <BootstrapIcon
            name={
              feedbackToast.isError
                ? 'exclamation-circle'
                : 'check-circle-fill'
            }
            size={15}
            color={feedbackToast.isError ? '#FFFFFF' : '#FF4D00'}
          />
          <Text style={styles.toastText} numberOfLines={2}>
            {feedbackToast.text}
          </Text>
        </View>
      ) : null}

      {/* Main Content Area */}
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.flexOne, { backgroundColor: palette.bgCanvas }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={mainTab !== 'account'}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={palette.orange}
              colors={[palette.orange]}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          <View style={styles.mobileColumn}>
            {error ? (
              <View
                style={[
                  styles.errorAlert,
                  {
                    backgroundColor: palette.dangerSoft,
                    borderColor: palette.dangerBorder,
                  },
                ]}
              >
                <BootstrapIcon
                  name="exclamation-circle"
                  size={16}
                  color={palette.dangerText}
                />
                <Text
                  style={[styles.errorAlertText, { color: palette.dangerText }]}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* ─── TAB 1: HOME DASHBOARD ─── */}
            {mainTab === 'home' ? (
              <>
                {/* Interactive Map of Active Route */}
                <RiderHomeDeliveryMapCard
                  deliveries={needConfirmationOrders}
                  palette={palette}
                  riderName={riderFullName}
                />

                {/* Active Orders To Deliver (Same Layout as Orders Page) */}
                <View style={[styles.ordersPageWrap, styles.homeOrdersWrap]}>
                  {renderFiltersAndSearch(false, true, true)}
                  {renderOrderCardsList(true)}
                </View>
              </>
            ) : null}

            {/* ─── TAB 2: ORDERS (Matching Customer Orders Screen Layout) ─── */}
            {mainTab === 'orders' ? (
              <View style={styles.ordersPageWrap}>
                {renderFiltersAndSearch(true, true)}

                {orderFilter === 'to_confirm' &&
                  needConfirmationOrders.length > 0 ? (
                  <View style={styles.subChipRow}>
                    {[
                      {
                        id: 'all',
                        label: `All active (${needConfirmationOrders.length})`,
                      },
                      ...(outForDeliveryCount > 0
                        ? [
                          {
                            id: 'out',
                            label: `Out for delivery (${outForDeliveryCount})`,
                          },
                        ]
                        : []),
                      ...(assignedCount > 0
                        ? [
                          {
                            id: 'assigned',
                            label: `Need to pick up (${assignedCount})`,
                          },
                        ]
                        : []),
                    ].map((chip) => {
                      const active = ordersSubFilter === chip.id;
                      return (
                        <TouchableOpacity
                          key={chip.id}
                          style={[
                            styles.subChip,
                            {
                              backgroundColor: active
                                ? palette.charcoal
                                : palette.bgCard,
                              borderColor: active
                                ? palette.charcoal
                                : palette.border,
                            },
                          ]}
                          onPress={() => setOrdersSubFilter(chip.id)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.subChipText,
                              active && styles.subChipTextActive,
                              {
                                color: active
                                  ? '#FFFFFF'
                                  : palette.textSecondary,
                              },
                            ]}
                          >
                            {chip.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {renderOrderCardsList()}
              </View>
            ) : null}

            {/* ─── TAB 3: EARNINGS ─── */}
            {mainTab === 'earnings' ? (
              <RiderEarningsView
                palette={palette}
                deliveredOrders={deliveredOrders}
                earningsLedger={earningsLedger}
                weekEarnings={weekEarnings}
                totalRiderEarnings={riderProfile?.totalEarnings || 0}
                onSelectOrder={(order) => {
                  setPodPhoto(null);
                  setSelectedOrder(order);
                }}
              />
            ) : null}

            {/* ─── TAB 4: ACCOUNT MANAGEMENT ─── */}
            {mainTab === 'account' ? (
              <RiderAccountView
                palette={palette}
                accountTab={accountTab}
                onChangeAccountTab={setAccountTab}
                currentUser={currentUser}
                riderProfile={riderProfile}
                riderId={riderId}
                availabilityStatus={availabilityStatus}
                onSelectAvailability={handleSelectAvailability}
                onCycleAvailability={handleCycleAvailability}
                unreadNotifCount={unreadNotifCount}
                deliveredCount={deliveredOrders.length}
                activeCount={needConfirmationOrders.length}
                weekEarnings={weekEarnings}
                onOpenNotifications={() => setNotificationsOpen(true)}
                onOpenMenu={() => setProfileMenuOpen(true)}
                onOpenSettings={() => {
                  setMainTab('settings');
                  scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                }}
                onNavigateMainTab={(tab) => setMainTab(tab)}
                onScrollToSection={(y) => scrollViewRef.current?.scrollTo({ y, animated: true })}
                preferences={preferences}
                onUpdatePreference={handleUpdatePreference}
                isDarkMode={isDarkMode}
                onToggleDarkMode={setDarkMode}
                onSavePersonalInfo={handleSavePersonalInfo}
                onChangePassword={changePassword}
                onLogout={requestLogout}
                onShowFeedback={showFeedback}
              />
            ) : null}

            {/* ─── TAB 5: RIDER SETTINGS ─── */}
            {mainTab === 'settings' ? (
              <RiderSettingsView
                palette={palette}
                riderName={riderFullName}
                riderEmail={userEmail}
                riderId={riderId}
                preferences={preferences}
                onUpdatePreference={handleUpdatePreference}
                isDarkMode={isDarkMode}
                onToggleDarkMode={setDarkMode}
                onChangePassword={changePassword}
                onOpenAccountProfile={() => {
                  setAccountTab('profile');
                  setMainTab('account');
                  scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                }}
                onLogout={requestLogout}
                onShowFeedback={showFeedback}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating QR Scan Button (Thumb-Accessible Above Floating Pill Nav) */}
      {mainTab !== 'settings' ? (
        <TouchableOpacity
          style={[
            styles.floatingQrFab,
            {
              backgroundColor: palette.orange,
              borderColor: palette.bgCanvas,
            },
          ]}
          onPress={() => {
            setVerified(null);
            setScanOrder({ unbound: true });
          }}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel="Scan delivery QR code"
        >
          <BootstrapIcon name="qr-code-scan" size={21} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      {/* Customer-Style Floating Charcoal Pill Bottom Navigation */}
      <MobileBottomNavBar
        activeTab={mainTab}
        onTabChange={(nextId) => {
          setMainTab(String(nextId).toLowerCase());
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        }}
        tabs={[
          {
            id: 'home',
            label: 'Home',
            icon: 'house',
            activeIcon: 'house-fill',
            isActive: mainTab === 'home',
          },
          {
            id: 'orders',
            label: 'Orders',
            badge: needConfirmationOrders.length,
            icon: 'box-seam',
            activeIcon: 'box-seam-fill',
            isActive: mainTab === 'orders',
          },
          {
            id: 'earnings',
            label: 'Earnings',
            icon: 'wallet2',
            activeIcon: 'wallet2',
            isActive: mainTab === 'earnings',
          },
          {
            id: 'account',
            label: 'Account',
            icon: 'person',
            activeIcon: 'person-fill',
            isActive: mainTab === 'account',
          },
          {
            id: 'settings',
            label: 'Settings',
            icon: 'gear',
            activeIcon: 'gear-fill',
            isActive: mainTab === 'settings',
          },
        ]}
      />

      {/* Profile Quick Menu */}
      <RiderProfileMenuModal
        visible={profileMenuOpen}
        onClose={() => setProfileMenuOpen(false)}
        palette={palette}
        riderName={riderFullName}
        riderId={riderId}
        riderAvatar={riderAvatar}
        availabilityStatus={availabilityStatus}
        onCycleAvailability={handleCycleAvailability}
        onNavigateAccountTab={(subTab) => {
          setAccountTab(subTab);
          setMainTab('account');
        }}
        onNavigateMainTab={(tab) => setMainTab(tab)}
        onLogout={requestLogout}
      />

      {/* Notifications Modal */}
      <RiderNotificationsModal
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        palette={palette}
        isDark={isDarkMode}
        notifications={notificationFeed}
        unreadCount={unreadNotifCount}
        onMarkRead={handleMarkNotifRead}
        onMarkAllRead={handleMarkAllNotifsRead}
        onDismiss={handleDismissNotif}
        onViewOrders={() => {
          setNotificationsOpen(false);
          setMainTab('orders');
        }}
        onSelectOrderFromNotif={(notif) => {
          handleMarkNotifRead(notif);
          setNotificationsOpen(false);
          if (notif?.orderId) {
            const match = deliveries.find(
              (d) => String(d.orderId) === String(notif.orderId)
            );
            if (match) {
              setPodPhoto(null);
              setSelectedOrder(match);
              return;
            }
          }
          setMainTab('orders');
        }}
      />

      {/* Order Details Bottom Sheet */}
      <RiderOrderDetailsSheet
        visible={
          Boolean(selectedOrder) && !scanOrder && !checkingScan && !confirmOpen
        }
        delivery={selectedOrder}
        palette={palette}
        busyId={busyId}
        podPhoto={podPhoto}
        podBusy={podBusy}
        onClose={() => {
          setSelectedOrder(null);
          setVerified(null);
          setPodPhoto(null);
        }}
        onStartRoute={handleOutForDelivery}
        onScanConfirm={openScannerFromDetail}
        onViewMap={openOrderMap}
        onPickPodPhoto={handlePickPodPhoto}
        onSavePodPhoto={handleSavePodPhoto}
        onClearPodPhoto={() => setPodPhoto(null)}
      />

      {/* QR Code Camera / Scanner Sheet */}
      <RiderQrScanSheet
        visible={Boolean(scanOrder)}
        order={scanOrder?.orderId ? scanOrder : null}
        onClose={() => setScanOrder(null)}
        onScanned={handleScanned}
      />

      {/* Scan Verification Loading Overlay */}
      {checkingScan ? (
        <View
          style={[styles.checkingScrim, { backgroundColor: palette.scrim }]}
          pointerEvents="auto"
        >
          <View
            style={[
              styles.checkingCard,
              {
                backgroundColor: palette.bgCard,
                borderColor: palette.border,
              },
            ]}
          >
            <ActivityIndicator color={palette.orange} />
            <Text style={[styles.checkingText, { color: palette.textPrimary }]}>
              Verifying MotoTrack order...
            </Text>
          </View>
        </View>
      ) : null}

      {/* Delivery Confirmation Sheet */}
      <RiderDeliveryConfirmSheet
        visible={confirmOpen && Boolean(verified || confirmed)}
        delivery={confirmed || verified}
        hintMismatch={Boolean(verified?.hintMismatch)}
        confirming={confirming}
        error={confirmError}
        success={confirmed}
        proofPhoto={podPhoto}
        onPickProofPhoto={handlePickPodPhoto}
        onClearProofPhoto={() => setPodPhoto(null)}
        onCancel={closeConfirmPopup}
        onConfirm={handleConfirmDelivery}
        onDone={handleConfirmFinished}
      />

      {/* Rider Live Route Tracking to Customer Location */}
      <RiderCustomerTrackModal
        visible={Boolean(trackedDelivery)}
        delivery={trackedDelivery}
        palette={palette}
        riderName={riderFullName}
        busyId={busyId}
        onClose={() => setTrackOrderId(null)}
        onStartRoute={handleOutForDelivery}
        onScanConfirm={(targetOrder) => {
          setTrackOrderId(null);
          openScannerFromDetail(targetOrder);
        }}
      />

      {/* Log Out Confirmation Modal (Matches Customer Flow) */}
      {logoutConfirmOpen ? (
        <ConfirmModal
          visible={logoutConfirmOpen}
          title="Log Out Confirmation"
          message="Are you sure you want to log out of your MotoTrack rider account?"
          confirmText="Log Out"
          cancelText="Stay Logged In"
          type="danger"
          confirmIcon="box-arrow-right"
          isDark={isDarkMode}
          onConfirm={handleConfirmLogout}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  safeTop: {
    zIndex: 10,
  },
  loadingSafe: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingLogoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    ...riderFont('500'),
    fontSize: 13.5,
    marginTop: 10,
  },
  toastBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : ANDROID_TOP_INSET + 68,
    left: 16,
    right: 16,
    zIndex: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    flex: 1,
    ...riderFont('600'),
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 132,
  },
  mobileColumn: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorAlertText: {
    flex: 1,
    ...riderFont('500'),
    fontSize: 12.5,
    lineHeight: 18,
  },
  homeOrdersWrap: {
    paddingTop: 0,
  },
  filtersBlock: {
    gap: 14,
    marginBottom: 16,
  },
  filterTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 2,
  },
  filterTab: {
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8.5,
  },
  filterTabLabel: {
    ...riderFont('500'),
    fontSize: 12.5,
    lineHeight: 16,
  },
  filterTabLabelSemi: {
    ...riderFont('600'),
  },
  filterTabLabelActive: {
    ...riderFont('700'),
  },
  searchFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    ...riderFont('400'),
    fontSize: 13.5,
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  emptyDarkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11141C',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1E2536',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  emptyDarkIconOuter: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#161B26',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  emptyDarkIconInner: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDarkTitle: {
    ...riderFont('700'),
    fontSize: 15.5,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  emptyDarkSub: {
    ...riderFont('400'),
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  ordersPageWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  subChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 13,
  },
  subChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  subChipText: {
    ...riderFont('600'),
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  subChipTextActive: {
    ...riderFont('700'),
  },
  areaGroupSection: {
    marginBottom: 10,
  },
  areaGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  areaGroupTitle: {
    flex: 1,
    ...riderFont('700'),
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  areaCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  areaCountText: {
    ...riderFont('700'),
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  floatingQrFab: {
    position: 'absolute',
    right: 18,
    bottom: Platform.OS === 'ios' ? 98 : 88 + ANDROID_BOTTOM_INSET,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 7,
  },
  checkingScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  checkingCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 12,
    minWidth: 210,
  },
  checkingText: {
    ...riderFont('600'),
    fontSize: 14,
  },
});
