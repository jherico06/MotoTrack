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
import LiveOrderTrackingMapModal from '../../../components/modals/LiveOrderTrackingMapModal.jsx';
import {
  RiderTopHeader,
  RiderProfileMenuModal,
  RiderNotificationsModal,
} from '../../../components/mobile/rider/RiderHeaderAndMenus.jsx';
import RiderOrderCard from '../../../components/mobile/rider/RiderOrderCard.jsx';
import RiderOrderDetailsSheet from '../../../components/mobile/rider/RiderOrderDetailsSheet.jsx';
import RiderHomeDeliveryMapCard from '../../../components/mobile/rider/RiderHomeDeliveryMapCard.jsx';
import RiderEarningsView from '../../../components/mobile/rider/RiderEarningsView.jsx';
import RiderAccountView from '../../../components/mobile/rider/RiderAccountView.jsx';
import {
  RIDER_FONT,
  cardShadowStyle,
  getRiderPalette,
  isDeliveredOrder,
  isNeedsPickupOrder,
  formatOrderCode,
} from '../../../components/mobile/rider/riderTheme.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
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

export default function RiderDashboard({ onLogout, initialConfirmToken }) {
  const { currentUser, updateProfile, changeEmail, changePassword } = useAuth();
  const { isDarkMode, setDarkMode } = useTheme();
  const palette = useMemo(() => getRiderPalette(isDarkMode), [isDarkMode]);

  // Stable primitive user identifiers (prevent-usage-burn compliance)
  const userUid = String(currentUser?.id || currentUser?.user_id || '');
  const userEmail = String(currentUser?.email || '');
  const userUsername = String(currentUser?.username || '');
  const sessionRiderId = String(currentUser?.rider_id || '');

  // Navigation & Modal State
  const [mainTab, setMainTab] = useState('home'); // 'home' | 'orders' | 'earnings' | 'account'
  const [accountTab, setAccountTab] = useState('profile'); // 'profile' | 'preferences' | 'security'
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  // Order Filter & Search State ('all' | 'to_confirm' | 'delivered')
  const [orderFilter, setOrderFilter] = useState('all');
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
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);

  const scanOpenTimerRef = useRef(null);
  const subscribeDebounceRef = useRef(null);
  const scanOrderRef = useRef(scanOrder);
  scanOrderRef.current = scanOrder;
  const consumedInitialTokenRef = useRef('');

  const prefsStorageKey = useMemo(
    () => `mototrack_rider_prefs_${userUid || sessionRiderId || 'default'}`,
    [userUid, sessionRiderId]
  );

  const readNotifsStorageKey = useMemo(
    () => `mototrack_rider_read_notifs_${userUid || sessionRiderId || 'default'}`,
    [userUid, sessionRiderId]
  );

  // Hydrate persisted rider preferences & read notification IDs
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
    } catch (_e) {}
  }, [prefsStorageKey, readNotifsStorageKey]);

  const showFeedback = useCallback((text, isError = false) => {
    if (!text) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedbackToast({ text, isError });
    toastTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (scanOpenTimerRef.current) clearTimeout(scanOpenTimerRef.current);
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
      if (profileMenuOpen) {
        setProfileMenuOpen(false);
        return true;
      }
      if (notificationsOpen) {
        setNotificationsOpen(false);
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
  }, [profileMenuOpen, notificationsOpen, selectedOrder, mainTab]);

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

      const rows = await deliveryService.getMyDeliveries(id);
      setDeliveries(rows || []);

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
      } catch (_e) {}

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
      } catch (_e) {}

      // Sync GPS watcher for active Out for Delivery jobs
      const activeOut = (rows || []).find((d) =>
        String(d.deliveryStatus || '')
          .toLowerCase()
          .includes('out for delivery')
      );
      if (activeOut?.orderId && id) {
        const session = riderGpsTrackingService.getActiveSession();
        if (!session || session.orderId !== activeOut.orderId) {
          riderGpsTrackingService
            .start({ orderId: activeOut.orderId, riderId: id })
            .catch(() => {});
        }
      } else if (!activeOut && riderGpsTrackingService.isTracking()) {
        riderGpsTrackingService.stop({ clearDb: true }).catch(() => {});
      }
    } catch (e) {
      setError(e?.message || 'Unable to load your deliveries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveRiderId, userUid, userEmail, userUsername]);

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
      } catch (_e) {}
    });

    return () => {
      unsubDeliveries?.();
      unsubRiders?.();
      unsubNotifs?.();
      if (subscribeDebounceRef.current) {
        clearTimeout(subscribeDebounceRef.current);
      }
      riderGpsTrackingService.stop({ clearDb: false }).catch(() => {});
    };
  }, [load, userUid, userEmail, userUsername]);

  // Derived Order Collections
  const needConfirmationOrders = useMemo(
    () => deliveries.filter((d) => !isDeliveredOrder(d)),
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

  const outForDeliveryCount = useMemo(
    () =>
      needConfirmationOrders.filter((d) =>
        String(d.deliveryStatus || '').toLowerCase().includes('out')
      ).length,
    [needConfirmationOrders]
  );

  const assignedCount = useMemo(
    () =>
      needConfirmationOrders.filter((d) => {
        const s = String(d.deliveryStatus || '').toLowerCase();
        return s.includes('assigned') || s.includes('ready');
      }).length,
    [needConfirmationOrders]
  );

  const needsPickupOrders = useMemo(
    () => needConfirmationOrders.filter((d) => isNeedsPickupOrder(d)),
    [needConfirmationOrders]
  );

  const filteredOrders = useMemo(() => {
    let list = [];
    if (orderFilter === 'needs_pickup') {
      list = needsPickupOrders;
    } else if (orderFilter === 'to_confirm') {
      list = needConfirmationOrders;
      if (mainTab === 'orders' && ordersSubFilter === 'out') {
        list = list.filter((d) =>
          String(d.deliveryStatus || '').toLowerCase().includes('out')
        );
      } else if (mainTab === 'orders' && ordersSubFilter === 'assigned') {
        list = list.filter((d) => {
          const s = String(d.deliveryStatus || '').toLowerCase();
          return s.includes('assigned') || s.includes('ready');
        });
      }
    } else if (orderFilter === 'delivered') {
      list = deliveredOrders;
    } else {
      list = [...needConfirmationOrders, ...deliveredOrders];
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
    return groupByArea(filteredOrders);
  }, [groupByAreaMode, filteredOrders]);

  // Unified Notifications Feed (merges service notifications + active dispatch alerts)
  const notificationFeed = useMemo(() => {
    const items = [];
    (rawNotifications || []).forEach((n, idx) => {
      const id = String(n.id || `svc-notif-${idx}`);
      const isUnread =
        (n.status === 'unread' || n.read === false) && !readNotifIds.has(id);
      items.push({
        id,
        title: n.title || 'MotoTrack Update',
        message: n.message || '',
        orderId: n.meta?.orderId || '',
        icon: 'bell',
        unread: isUnread,
        timeLabel: n.time || n.createdAt || 'Recent',
      });
    });

    needConfirmationOrders.slice(0, 6).forEach((d) => {
      const id = `dispatch-${d.orderId}`;
      if (items.some((x) => x.orderId && x.orderId === d.orderId)) return;
      items.push({
        id,
        title: String(d.deliveryStatus || '').toLowerCase().includes('out')
          ? 'Active drop-off awaiting QR scan'
          : 'New delivery assigned to you',
        message: `${d.customerName || 'Customer'} · ${d.customerAddress || 'Tap to view route'}`,
        orderId: d.orderId,
        icon: 'truck',
        unread: !readNotifIds.has(id),
        timeLabel: 'Today',
      });
    });

    return items;
  }, [rawNotifications, needConfirmationOrders, readNotifIds]);

  const unreadNotifCount = useMemo(
    () => notificationFeed.filter((n) => n.unread).length,
    [notificationFeed]
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
    } catch (_e) {}
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
    const settleMs = Platform.OS === 'ios' ? 340 : 160;
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
      const gps = await riderGpsTrackingService.start({
        orderId: d.orderId,
        riderId,
      });
      if (!gps.success) {
        showFeedback(
          `${formatOrderCode(d.orderId)} is Out for Delivery (GPS unavailable).`
        );
      } else {
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
            .catch(() => {});
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
      } catch (_e) {}
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
      } catch (_e) {}
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
      } catch (_e) {}
    }

    return { success: true };
  };

  const riderFullName =
    riderProfile?.name || currentUser?.name || 'Jherico Maurin';
  const riderAvatar = riderProfile?.avatar || currentUser?.avatar || '';
  const [mapOrder, setMapOrder] = useState(null);

  const openOrderMap = useCallback(
    (delivery) => {
      if (!delivery) return;
      setSelectedOrder(null);
      setMapOrder({
        id: delivery.orderId,
        order_id: delivery.orderId,
        status: delivery.deliveryStatus || 'Assigned',
        customer_name: delivery.customerName || 'Customer',
        customer_address: delivery.customerAddress || '',
        shipping_address: delivery.customerAddress || '',
        customer_phone: delivery.customerPhone || '',
        delivery_lat: delivery.lat,
        delivery_lng: delivery.lng,
        total: delivery.totalAmount,
        grand_total: delivery.totalAmount,
        payment_method: delivery.paymentMethod,
        items: delivery.items,
        items_summary: delivery.itemsSummary,
        rider_name: riderFullName,
        rider_phone: riderProfile?.phone || currentUser?.phone || '',
        rider_vehicle: riderProfile?.vehicleInfo || '',
        rider_plate: riderProfile?.plateNumber || '',
        rider_avatar: riderAvatar || '',
      });
    },
    [riderFullName, riderProfile, currentUser, riderAvatar]
  );

  // Reusable Filter Tabs & Search Block (Customer Orders layout: Search bar above horizontal status pills)
  const renderFiltersAndSearch = (showSearchInput = true, showAreaToggle = false) => {
    const tabs = [
      { id: 'all', label: 'All', count: deliveries.length },
      {
        id: 'needs_pickup',
        label: 'Needs pickup',
        count: needsPickupOrders.length,
      },
      {
        id: 'to_confirm',
        label: 'To confirm',
        count: needConfirmationOrders.length,
      },
      { id: 'delivered', label: 'Delivered', count: deliveredOrders.length },
    ];

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
            const active = orderFilter === t.id;
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
                  setOrderFilter(t.id);
                  setOrdersSubFilter('all');
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    {
                      color: active
                        ? '#FFFFFF'
                        : palette.isDark
                          ? '#E5E7EB'
                          : '#52525B',
                      fontWeight: active ? '600' : '500',
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
                  {
                    color: groupByAreaMode
                      ? palette.orangeText
                      : palette.isDark
                        ? '#E5E7EB'
                        : '#52525B',
                    fontWeight: '600',
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

  const renderOrderCardsList = () => {
    if (filteredOrders.length === 0) {
      return (
        <View style={styles.emptyDarkBanner}>
          <View style={styles.emptyDarkIconOuter}>
            <View style={styles.emptyDarkIconInner}>
              <BootstrapIcon
                name={orderFilter === 'delivered' ? 'check-circle' : 'bag-check-fill'}
                size={18}
                color="#38BDF8"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyDarkTitle}>
              {searchQuery.trim()
                ? 'No matching orders'
                : orderFilter === 'needs_pickup'
                  ? 'No orders needing pickup'
                  : orderFilter === 'delivered'
                    ? 'No delivered orders'
                    : orderFilter === 'to_confirm'
                      ? 'All deliveries confirmed'
                      : 'No related orders'}
            </Text>
            <Text style={styles.emptyDarkSub}>
              {searchQuery.trim()
                ? 'Try searching a different order number, customer, or area'
                : orderFilter === 'needs_pickup'
                  ? 'Assigned orders waiting for rider pickup appear here'
                  : orderFilter === 'delivered'
                    ? 'Orders you scan and confirm at drop-off appear here'
                    : 'New MotoTrack dispatches assigned to you will appear here'}
            </Text>
          </View>
        </View>
      );
    }

    if (mainTab === 'orders' && groupByAreaMode && areaGroups.length > 0) {
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
                setPodPhoto(null);
                setSelectedOrder(order);
                setVerified(null);
              }}
              onScanConfirm={(order) => {
                setVerified(null);
                setScanOrder(order);
              }}
            />
          ))}
        </View>
      ));
    }

    return filteredOrders.map((d) => (
      <RiderOrderCard
        key={d.orderId}
        delivery={d}
        palette={palette}
        onViewMap={openOrderMap}
        onViewDetails={(order) => {
          setPodPhoto(null);
          setSelectedOrder(order);
          setVerified(null);
        }}
        onScanConfirm={(order) => {
          setVerified(null);
          setScanOrder(order);
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
      <SafeAreaView
        style={[
          styles.safeTop,
          {
            backgroundColor: palette.bgHeader,
            paddingTop: ANDROID_TOP_INSET,
          },
        ]}
      >
        <StatusBar
          style={palette.isDark ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />

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
            setOrderFilter((prev) =>
              prev === 'all'
                ? 'to_confirm'
                : prev === 'to_confirm'
                  ? 'delivered'
                  : 'all'
            );
            setOrdersSubFilter('all');
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
          style={[styles.flexOne, { backgroundColor: palette.bgCanvas }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                {/* Interactive Map of Orders That Need to Be Delivered */}
                <RiderHomeDeliveryMapCard
                  deliveries={needConfirmationOrders}
                  palette={palette}
                  riderName={riderFullName}
                  onOpenFullMap={openOrderMap}
                  onScanConfirm={(order) => {
                    setVerified(null);
                    setScanOrder(order);
                  }}
                  onViewDetails={(order) => {
                    setPodPhoto(null);
                    setSelectedOrder(order);
                    setVerified(null);
                  }}
                />

                {/* Today's Orders Rounded Surface */}
                <View
                  style={[
                    styles.ordersSheetContainer,
                    {
                      backgroundColor: palette.bgSheet,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={styles.ordersSheetHead}>
                    <Text
                      style={[
                        styles.ordersSheetTitle,
                        { color: palette.textPrimary },
                      ]}
                    >
                      Today&apos;s orders
                    </Text>
                    <View
                      style={[
                        styles.orderCountChip,
                        { backgroundColor: palette.bgMuted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.orderCountChipText,
                          { color: palette.textPrimary },
                        ]}
                      >
                        {filteredOrders.length}{' '}
                        {filteredOrders.length === 1 ? 'order' : 'orders'}
                      </Text>
                    </View>
                  </View>

                  {renderFiltersAndSearch(false)}
                  {renderOrderCardsList()}
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
                              label: `Assigned (${assignedCount})`,
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
                preferences={preferences}
                onUpdatePreference={handleUpdatePreference}
                isDarkMode={isDarkMode}
                onToggleDarkMode={setDarkMode}
                onSavePersonalInfo={handleSavePersonalInfo}
                onChangePassword={changePassword}
                onLogout={onLogout}
                onShowFeedback={showFeedback}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating QR Scan Button (Thumb-Accessible Above Floating Pill Nav) */}
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

      {/* Customer-Style Floating Charcoal Pill Bottom Navigation */}
      <MobileBottomNavBar
        activeTab={mainTab}
        onTabChange={(nextId) => setMainTab(String(nextId).toLowerCase())}
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
            label:
              needConfirmationOrders.length > 0
                ? `Orders (${needConfirmationOrders.length})`
                : 'Orders',
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
        onLogout={onLogout}
      />

      {/* Notifications Bottom Sheet */}
      <RiderNotificationsModal
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        palette={palette}
        notifications={notificationFeed}
        unreadCount={unreadNotifCount}
        onMarkAllRead={handleMarkAllNotifsRead}
        onSelectOrderFromNotif={(notif) => {
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

      {/* Customer-Style Live Route & Tracking Map Modal */}
      <LiveOrderTrackingMapModal
        visible={Boolean(mapOrder)}
        order={mapOrder}
        onClose={() => setMapOrder(null)}
        showToast={showFeedback}
        isDarkMode={isDarkMode}
      />
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
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '500',
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
    fontFamily: RIDER_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
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
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  ordersSheetContainer: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    minHeight: 340,
  },
  ordersSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  ordersSheetTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  orderCountChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  orderCountChipText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 16,
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
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '400',
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
    fontFamily: RIDER_FONT,
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  emptyDarkSub: {
    fontFamily: RIDER_FONT,
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
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  areaCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  areaCountText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '700',
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
    fontFamily: RIDER_FONT,
    fontSize: 14,
    fontWeight: '600',
  },
});
