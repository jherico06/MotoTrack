import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  RefreshControl,
  Image,
} from 'react-native';
import BootstrapIcon from '../../../components/common/BootstrapIcon.jsx';
import { StatusBar } from 'expo-status-bar';
import ExternalLink from '../../../components/common/ExternalLink.jsx';
import RiderQrScanSheet from '../../../components/modals/RiderQrScanSheet.jsx';
import RiderDeliveryConfirmSheet from '../../../components/modals/RiderDeliveryConfirmSheet.jsx';
import StaffAccountSettingsModal from '../../../components/modals/StaffAccountSettingsModal.jsx';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { deliveryService } from '../../../services/delivery/deliveryService.js';
import { riderService } from '../../../services/staff/riderService.js';
import { riderGpsTrackingService } from '../../../services/delivery/riderGpsTrackingService.js';
import { ANDROID_TOP_INSET } from '../../../utils/safeArea.js';
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
    return { bg: colors.successSoft, text: colors.successText, label: 'Delivered' };
  }
  if (s.includes('report')) {
    return { bg: colors.successSoft, text: colors.successText, label: 'Reported — awaiting store' };
  }
  if (s.includes('out')) {
    return { bg: colors.infoSoftAlt, text: colors.info, label: 'Out for Delivery' };
  }
  if (s.includes('assigned') || s.includes('ready')) {
    return { bg: colors.warningSoftAlt, text: colors.warningText, label: 'Assigned' };
  }
  if (s.includes('issue') || s.includes('fail')) {
    return { bg: colors.dangerSoft, text: colors.dangerText, label: status };
  }
  return { bg: colors.bgSubtle, text: colors.textSecondary, label: status || 'Assigned' };
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

function DeliveryDateRow({ start, end }) {
  const info = describeRiderDeliveryDate(start, end);
  if (!info) return null;
  const tone =
    info.tone === 'overdue'
      ? { bg: colors.warningSoft, text: colors.warningText, icon: 'exclamation-triangle' }
      : info.tone === 'today'
        ? { bg: colors.accentSoft, text: colors.accentDark, icon: 'calendar-event' }
        : info.tone === 'tomorrow'
          ? { bg: colors.infoSoft, text: colors.info, icon: 'calendar-event' }
          : { bg: colors.bgSubtle, text: colors.textSecondary, icon: 'calendar-event' };
  return (
    <View style={[styles.dateRow, { backgroundColor: tone.bg }]}>
      <BootstrapIcon name={tone.icon} size={14} color={tone.text} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.dateKicker, { color: tone.text }]}>{info.title}</Text>
        <Text style={[styles.dateValue, { color: tone.text }]}>{info.dateLabel}</Text>
        {info.timeLabel ? (
          <Text style={[styles.dateTime, { color: tone.text }]}>Scheduled: {info.timeLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

function StatCard({ accent, iconBg, iconColor, icon, label, value, sub, valueColor, wide }) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide, { borderLeftColor: accent }]}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <BootstrapIcon name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor || accent }]}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

export default function RiderDashboard({ onLogout }) {
  const { currentUser } = useAuth();
  const [riderId, setRiderId] = useState(currentUser?.rider_id || '');
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [scanOrder, setScanOrder] = useState(null);
  const [verified, setVerified] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingScan, setCheckingScan] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmed, setConfirmed] = useState(null);
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('active'); // 'active' | 'history'
  const [podPhoto, setPodPhoto] = useState(null);   // staged photo for current detail
  const [podBusy, setPodBusy] = useState(false);    // uploading indicator
  const [accountOpen, setAccountOpen] = useState(false);

  const resolveRiderId = useCallback(async () => {
    if (currentUser?.rider_id) return currentUser.rider_id;
    await riderService.fetchRiders();
    const byUser = riderService.getRiderByUserId(currentUser?.id || currentUser?.user_id);
    if (byUser?.id) return byUser.id;
    const byName = riderService.getRiderByUsername(currentUser?.username || currentUser?.email);
    return byName?.id || '';
  }, [currentUser]);

  const load = useCallback(async () => {
    setError('');
    const id = await resolveRiderId();
    setRiderId(id);
    if (!id) {
      setDeliveries([]);
      setWeekEarnings(0);
      setError('This login is not linked to a rider profile. Ask the admin to recreate the rider account.');
      setLoading(false);
      return;
    }
    try {
      const rows = await deliveryService.getMyDeliveries(id);
      setDeliveries(rows);

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

      // Resume GPS only for an already-active Out for Delivery job
      const activeOut = (rows || []).find((d) =>
        String(d.deliveryStatus || '')
          .toLowerCase()
          .includes('out for delivery')
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
      setRefreshing(false);
    }
  }, [resolveRiderId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const unsub = deliveryService.subscribe(() => {
      load();
    });
    const unsubRiders = riderService.subscribe(() => {
      load();
    });
    return () => {
      unsub?.();
      unsubRiders?.();
      // Stop GPS watcher when leaving rider dashboard (keeps last DB point until delivered)
      riderGpsTrackingService.stop({ clearDb: false }).catch(() => {});
    };
  }, [load]);

  const undelivered = useMemo(
    () => deliveries.filter((d) => String(d.deliveryStatus || '').toLowerCase() !== 'delivered'),
    [deliveries]
  );
  const completed = useMemo(() => {
    return deliveries
      .filter((d) => String(d.deliveryStatus || '').toLowerCase() === 'delivered')
      .slice()
      .sort((a, b) => {
        const at = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const bt = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return bt - at;
      });
  }, [deliveries]);
  const groups = useMemo(() => groupByArea(undelivered), [undelivered]);

  const handleOutForDelivery = async (d) => {
    setBusyId(d.orderId);
    setNotice('');
    try {
      const res = await deliveryService.riderMarkOutForDelivery({
        riderId,
        orderId: d.orderId,
        riderUser: currentUser,
      });
      if (!res.success) {
        setNotice(res.error || 'Could not update status');
        return;
      }
      const gps = await riderGpsTrackingService.start({
        orderId: d.orderId,
        riderId,
      });
      if (!gps.success) {
        setNotice(
          `Order #${d.orderId} is Out for Delivery. GPS: ${gps.error || 'unavailable'}`
        );
      } else {
        setNotice(`Order #${d.orderId} is now Out for Delivery — live GPS tracking active`);
      }
      await load();
      setSelected((prev) =>
        prev?.orderId === d.orderId ? { ...prev, deliveryStatus: 'Out for Delivery' } : prev
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
      return prev.map((row) => (row.orderId === card.orderId ? { ...row, ...card } : row));
    });
  };

  const handleScanned = async (raw) => {
    const hintOrderId = scanOrder?.orderId || null;
    setScanOrder(null);
    setNotice('');
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
        setNotice(`${title}${res.error || 'Unable to verify this QR.'}`);
        return;
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
      setNotice('Unable to verify the order. Please check your connection and try again.');
    } finally {
      setCheckingScan(false);
      setBusyId('');
    }
  };

  const closeConfirmPopup = () => {
    if (confirming) return;
    setConfirmOpen(false);
    setConfirmError('');
    setVerified(null);
    setConfirmed(null);
  };

  const handleConfirmDelivery = async () => {
    if (confirming || !verified?.orderId) return;
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await deliveryService.riderConfirmDeliveredByQr({
        riderId,
        riderUser: currentUser,
        orderId: verified.orderId,
        scannedRaw: verified.scannedRaw,
      });
      if (!res.success) {
        const title = res.title ? `${res.title}. ` : '';
        setConfirmError(`${title}${res.error || 'Unable to confirm the delivery. Please check your connection and try again.'}`);
        return;
      }
      applyDeliveredLocally(res.delivery);
      setConfirmed(res.delivery);
      setVerified(null);
      setSelected(null);
      setPodPhoto(null);
      await riderGpsTrackingService.stop({
        clearDb: true,
        orderId: res.delivery.orderId,
        riderId,
      });
    } catch (_e) {
      setConfirmError('Unable to confirm the delivery. Please check your connection and try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmFinished = async () => {
    setConfirmOpen(false);
    setConfirmed(null);
    setVerified(null);
    setSelected(null);
    setPodPhoto(null);
    await load();
  };

  const handlePickPodPhoto = async () => {
    const res = await pickImageFromFile();
    if (res.success) setPodPhoto(res.uri);
    else if (res.error && res.error !== 'No file selected' && res.error !== 'Selection cancelled')
      setNotice(res.error);
  };

  const handleSavePodPhoto = async () => {
    if (!podPhoto || !detail) return;
    setPodBusy(true);
    try {
      const res = await deliveryService.riderUploadProofPhoto({
        riderId,
        orderId: detail.orderId,
        photoUri: podPhoto,
      });
      if (res.success) {
        setNotice('Proof photo saved successfully.');
        // Patch the selected delivery card with the photo so the preview persists
        setSelected((prev) => prev ? { ...prev, deliveryPhoto: podPhoto } : prev);
        setPodPhoto(null);
        await load();
      } else {
        setNotice(res.error || 'Could not save photo.');
      }
    } finally {
      setPodBusy(false);
    }
  };

  const detail = selected;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Loading your deliveries…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" translucent backgroundColor="transparent" />

        {/* ─── FIXED MOBILE RIDER HEADER (CHARCOAL) ─── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rider Dashboard</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setAccountOpen(true)}
              style={styles.headerIconBtn}
              accessibilityLabel="My Account"
            >
              <BootstrapIcon name="gear" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout} style={styles.headerIconBtn} accessibilityLabel="Log out">
              <BootstrapIcon name="box-arrow-right" size={16} color="#F87171" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >

          {undelivered.length > 0 ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryValue}>{undelivered.length}</Text>
                <Text style={styles.summaryLabel}>To deliver</Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryValue}>{completed.length}</Text>
                <Text style={styles.summaryLabel}>Delivered</Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryValue}>{formatPhp(weekEarnings)}</Text>
                <Text style={styles.summaryLabel}>This week</Text>
              </View>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                accent={colors.accent}
                iconBg={colors.accentSoft}
                iconColor={colors.accentDark}
                icon="cash-stack"
                label="Weekly earnings"
                value={formatPhp(weekEarnings)}
                sub="Shipping fees earned this week"
                wide
              />
              <StatCard
                accent={colors.info}
                iconBg={colors.infoSoft}
                iconColor={colors.info}
                icon="truck"
                label="Undelivered"
                value={String(undelivered.length)}
                sub="Still on your active route"
              />
              <StatCard
                accent={colors.brand}
                iconBg={colors.brandLight}
                iconColor={colors.brand}
                icon="bag-check-fill"
                label="Delivered"
                value={String(completed.length)}
                valueColor={colors.text}
                sub="Completed assignments"
              />
            </View>
          )}

          {error ? <Text style={styles.warn}>{error}</Text> : null}
          {notice ? (
            <Text
              style={
                /invalid|cannot|not assigned|not belong|error|unable/i.test(notice)
                  ? styles.warn
                  : styles.ok
              }
            >
              {notice}
            </Text>
          ) : null}

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
              onPress={() => setTab('active')}
            >
              <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
                To deliver{undelivered.length ? ` · ${undelivered.length}` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
              onPress={() => setTab('history')}
            >
              <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
                History{completed.length ? ` · ${completed.length}` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'active' ? (
            <>
              <TouchableOpacity style={styles.scanFab} onPress={() => setScanOrder({ unbound: true })}>
                <BootstrapIcon name="qr-code-scan" size={16} color={colors.white} />
                <Text style={styles.scanFabText}>Scan order QR</Text>
              </TouchableOpacity>

              <Text style={styles.sectionHead}>Active route</Text>

              {groups.length === 0 ? (
                <View style={styles.empty}>
                  <BootstrapIcon name="inbox" size={26} color={colors.textSubtle} />
                  <Text style={styles.emptyTitle}>Nothing to deliver</Text>
                  <Text style={styles.muted}>
                    New assignments show up here. Finished ones move to History.
                  </Text>
                </View>
              ) : null}

              {groups.map(([area, stops]) => (
                <View key={area} style={styles.areaBlock}>
                  <View style={styles.areaHead}>
                    <BootstrapIcon name="geo-alt-fill" size={13} color={colors.brand} />
                    <Text style={styles.areaTitle}>{area}</Text>
                    <Text style={styles.areaCount}>{stops.length}</Text>
                  </View>
                  {stops.map((d) => {
                    const tone = statusTone(d.deliveryStatus);
                    return (
                      <View key={d.orderId} style={styles.card}>
                        <TouchableOpacity
                          onPress={() => {
                            setSelected(d);
                            setVerified(null);
                          }}
                          activeOpacity={0.85}
                        >
                          <View style={styles.cardTop}>
                            <Text style={styles.orderId}>#{d.orderId}</Text>
                            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                              <Text style={[styles.badgeText, { color: tone.text }]}>{tone.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.customer}>{d.customerName}</Text>
                          <View style={styles.addressRow}>
                            <BootstrapIcon name="geo-alt" size={13} color={colors.textMuted} />
                            <Text style={[styles.address, styles.addressFlex]} numberOfLines={3}>
                              {d.customerAddress || 'No address on file'}
                            </Text>
                          </View>
                          <DeliveryDateRow start={d.expectedDeliveryAt} end={d.expectedDeliveryEndAt} />
                          <Text style={styles.meta}>
                            {formatPhpExact(d.totalAmount)} · {d.paymentStatus}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.actions}>
                          <ExternalLink
                            href={googleMapsNavigateUrl(d.lat, d.lng, d.customerAddress)}
                            style={styles.actionSlot}
                          >
                            <View style={styles.navBtn}>
                              <BootstrapIcon name="geo-alt-fill" size={13} color={colors.white} />
                              <Text style={styles.navBtnText}>Navigate</Text>
                            </View>
                          </ExternalLink>
                          <TouchableOpacity
                            style={[styles.ghostBtn, styles.actionSlot]}
                            onPress={() => {
                              setSelected(d);
                              setVerified(null);
                            }}
                          >
                            <Text style={styles.ghostBtnText}>Details</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.scanCardBtn, styles.actionSlot]}
                            onPress={() => {
                              setVerified(null);
                              setScanOrder(d);
                            }}
                          >
                            <BootstrapIcon name="qr-code-scan" size={13} color={colors.brand} />
                            <Text style={styles.scanCardBtnText}>Scan</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.sectionHead}>Delivery history</Text>
              {completed.length === 0 ? (
                <View style={styles.empty}>
                  <BootstrapIcon name="clock-history" size={26} color={colors.textSubtle} />
                  <Text style={styles.emptyTitle}>No deliveries yet</Text>
                  <Text style={styles.muted}>
                    Confirmed deliveries will appear here after you finish a stop.
                  </Text>
                </View>
              ) : (
                completed.map((d) => (
                  <TouchableOpacity
                    key={d.orderId}
                    style={styles.doneCard}
                    onPress={() => setSelected(d)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.historyIcon}>
                      <BootstrapIcon name="bag-check-fill" size={16} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderId}>#{d.orderId}</Text>
                      <Text style={styles.customer}>{d.customerName}</Text>
                      <Text style={styles.address} numberOfLines={1}>
                        {d.customerAddress || 'No address on file'}
                      </Text>
                    </View>
                    <View style={styles.historyMeta}>
                      <Text style={styles.doneMeta}>
                        {d.deliveredAt
                          ? new Date(d.deliveredAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Delivered'}
                      </Text>
                      <Text style={styles.historyEarn}>
                        {formatPhp(d.riderEarning || d.shippingFee || 0)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <RiderQrScanSheet
        visible={Boolean(scanOrder)}
        order={scanOrder?.orderId ? scanOrder : null}
        onClose={() => setScanOrder(null)}
        onScanned={handleScanned}
      />

      <Modal visible={checkingScan} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.checkingScrim}>
          <View style={styles.checkingCard}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.checkingText}>Checking order...</Text>
          </View>
        </View>
      </Modal>

      <RiderDeliveryConfirmSheet
        visible={confirmOpen && Boolean(verified || confirmed)}
        delivery={confirmed || verified}
        hintMismatch={Boolean(verified?.hintMismatch)}
        confirming={confirming}
        error={confirmError}
        success={confirmed}
        onCancel={closeConfirmPopup}
        onConfirm={handleConfirmDelivery}
        onDone={handleConfirmFinished}
      />

      <Modal
        visible={Boolean(detail) && !scanOrder && !confirmOpen}
        animationType="slide"
        onRequestClose={() => {
          setSelected(null);
          setVerified(null);
        }}
      >
        {detail ? (
          <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Order #{detail.orderId}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelected(null);
                    setVerified(null);
                  }}
                  style={styles.closeBtn}
                >
                  <BootstrapIcon name="x-lg" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: statusTone(detail.deliveryStatus).bg,
                    alignSelf: 'flex-start',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: statusTone(detail.deliveryStatus).text }]}>
                  {statusTone(detail.deliveryStatus).label}
                </Text>
              </View>

              <Text style={styles.section}>Customer</Text>
              <Text style={styles.customer}>{detail.customerName}</Text>
              <Text style={styles.phone}>{detail.customerPhone || 'No phone'}</Text>
              <Text style={styles.section}>Delivery address</Text>
              <Text style={styles.address}>{detail.customerAddress || 'No address on file'}</Text>
              <DeliveryDateRow start={detail.expectedDeliveryAt} end={detail.expectedDeliveryEndAt} />
              {detail.landmark ? <Text style={styles.landmark}>Landmark: {detail.landmark}</Text> : null}

              <Text style={styles.section}>Items</Text>
              {(detail.items || []).length ? (
                detail.items.map((it, idx) => (
                  <Text key={idx} style={styles.itemLine}>
                    {(it.name || it.product_name || 'Item')} × {it.quantity || 1}
                  </Text>
                ))
              ) : (
                <Text style={styles.address}>{detail.itemsSummary || '—'}</Text>
              )}

              <Text style={styles.section}>Payment</Text>
              <Text style={styles.meta}>{formatPhpExact(detail.totalAmount)}</Text>
              <Text style={styles.muted}>
                {detail.paymentMethod} · {detail.paymentStatus}
              </Text>

              <View style={styles.actions}>
                <ExternalLink href={googleMapsNavigateUrl(detail.lat, detail.lng, detail.customerAddress)}>
                  <View style={styles.navBtn}>
                    <BootstrapIcon name="geo-alt-fill" size={14} color={colors.white} />
                    <Text style={styles.navBtnText}>Navigate</Text>
                  </View>
                </ExternalLink>
                {detail.customerPhone ? (
                  <ExternalLink href={`tel:${String(detail.customerPhone).replace(/[^\d+]/g, '')}`}>
                    <View style={styles.ghostBtn}>
                      <Text style={styles.ghostBtnText}>Call</Text>
                    </View>
                  </ExternalLink>
                ) : null}
              </View>

              {detail.deliveryStatus === 'Assigned' ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, busyId === detail.orderId && { opacity: 0.7 }]}
                  disabled={busyId === detail.orderId}
                  onPress={() => handleOutForDelivery(detail)}
                >
                  <Text style={styles.primaryBtnText}>Start — Out for Delivery</Text>
                </TouchableOpacity>
              ) : null}

              {detail.deliveryStatus === 'Reported' ? (
                <View style={[styles.secondaryBtn, { opacity: 0.95 }]}>
                  <BootstrapIcon name="check-circle-fill" size={16} color={colors.successText || colors.brand} />
                  <Text style={styles.secondaryBtnText}>Reported — waiting for store confirm</Text>
                </View>
              ) : null}

              {detail.deliveryStatus !== 'Delivered' && detail.deliveryStatus !== 'Reported' ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScanOrder(detail)}>
                  <BootstrapIcon name="qr-code" size={16} color={colors.brand} />
                  <Text style={styles.secondaryBtnText}>Scan order QR</Text>
                </TouchableOpacity>
              ) : null}

              {/* ── PROOF OF DELIVERY PHOTO ── */}
              {detail.deliveryStatus !== 'Delivered' ? (
                <View style={styles.podSection}>
                  <Text style={styles.section}>Proof of Delivery Photo</Text>

                  {/* Existing saved photo */}
                  {detail.deliveryPhoto && !podPhoto ? (
                    <View style={styles.podPhotoWrap}>
                      <Image
                        source={{ uri: detail.deliveryPhoto }}
                        style={styles.podPhotoPreview}
                        resizeMode="cover"
                      />
                      <Text style={styles.podPhotoLabel}>Photo on file</Text>
                      <TouchableOpacity
                        style={styles.podChangeBtn}
                        onPress={handlePickPodPhoto}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="camera" size={12} color={colors.brand} />
                        <Text style={styles.podChangeBtnText}>Change photo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* New staged photo preview */}
                  {podPhoto ? (
                    <View style={styles.podPhotoWrap}>
                      <Image
                        source={{ uri: podPhoto }}
                        style={styles.podPhotoPreview}
                        resizeMode="cover"
                      />
                      <Text style={styles.podPhotoLabel}>New photo selected — not saved yet</Text>
                    </View>
                  ) : null}

                  {/* Pick photo button (shown when no staged photo) */}
                  {!podPhoto ? (
                    <TouchableOpacity
                      style={styles.podPickBtn}
                      onPress={handlePickPodPhoto}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="camera" size={14} color={colors.info} />
                      <Text style={styles.podPickBtnText}>
                        {detail.deliveryPhoto ? 'Replace Photo' : 'Add Proof Photo'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Save / Cancel row */}
                  {podPhoto ? (
                    <View style={styles.podActions}>
                      <TouchableOpacity
                        style={[styles.podSaveBtn, podBusy && { opacity: 0.6 }]}
                        onPress={handleSavePodPhoto}
                        disabled={podBusy}
                        activeOpacity={0.85}
                      >
                        {podBusy ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <>
                            <BootstrapIcon name="cloud-upload" size={14} color={colors.white} />
                            <Text style={styles.podSaveBtnText}>Save Photo</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.podCancelBtn}
                        onPress={() => setPodPhoto(null)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.podCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Delivered — show saved photo read-only */}
              {detail.deliveryStatus === 'Delivered' && detail.deliveryPhoto ? (
                <View style={styles.podSection}>
                  <Text style={styles.section}>Proof of Delivery</Text>
                  <Image
                    source={{ uri: detail.deliveryPhoto }}
                    style={styles.podPhotoPreview}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      <StaffAccountSettingsModal
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSaved={() => setAccountOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, backgroundColor: '#24272B', paddingTop: ANDROID_TOP_INSET },
  header: {
    backgroundColor: '#24272B',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E2124',
    borderWidth: 1,
    borderColor: '#363C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16, paddingBottom: 56, maxWidth: 560, width: '100%', alignSelf: 'center', backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 12, fontWeight: '800', color: colors.textChip },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 148,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderLeftWidth: 4,
    minHeight: 148,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    justifyContent: 'space-between',
  },
  statCardWide: {
    flexBasis: '100%',
    minWidth: '100%',
    minHeight: 132,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statSub: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSubtle,
    fontWeight: '400',
    marginTop: 6,
  },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  ok: { fontSize: 13, fontWeight: '700', color: colors.successText, marginVertical: 8 },
  warn: { fontSize: 13, fontWeight: '700', color: colors.dangerText, marginVertical: 8, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.borderSoft,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.brand },
  scanFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    marginBottom: 18,
  },
  scanFabText: { color: colors.white, fontWeight: '800' },
  sectionHead: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 10,
  },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  areaBlock: { marginBottom: 16 },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  areaTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textChip,
    textTransform: 'uppercase',
  },
  areaCount: { fontSize: 12, fontWeight: '800', color: colors.brand },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: 10,
  },
  doneCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMeta: { alignItems: 'flex-end', gap: 4 },
  doneMeta: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  historyEarn: { fontSize: 13, fontWeight: '800', color: colors.success },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { flex: 1, fontSize: 13, fontWeight: '900', color: colors.text, marginRight: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  customer: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6 },
  address: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  addressFlex: { flex: 1, marginTop: 0 },
  landmark: { fontSize: 12, color: colors.warningText, marginTop: 4, fontWeight: '700' },
  phone: { fontSize: 13, color: colors.brand, marginTop: 4, fontWeight: '700' },
  meta: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 6 },
  itemLine: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionSlot: { flex: 1 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  dateValue: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  dateTime: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 11,
    minHeight: 40,
    paddingHorizontal: 8,
  },
  navBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 11,
    minHeight: 40,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ghostBtnText: { fontWeight: '800', color: colors.textSecondary, fontSize: 12 },
  scanCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: 11,
    minHeight: 40,
    paddingHorizontal: 8,
    backgroundColor: colors.accentSoft,
  },
  scanCardBtnText: { fontWeight: '800', color: colors.brand, fontSize: 12 },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryBtnText: { color: colors.white, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: 14,
    minHeight: 46,
    marginTop: 10,
  },
  secondaryBtnText: { color: colors.brand, fontWeight: '800' },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Proof of Delivery photo styles ──
  podSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  podPhotoWrap: {
    marginTop: 10,
    marginBottom: 4,
    gap: 6,
  },
  podPhotoPreview: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    backgroundColor: colors.bgSubtle,
  },
  podPhotoLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  podPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.info,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.infoSoft,
  },
  podPickBtnText: { color: colors.info, fontWeight: '800', fontSize: 13 },
  podChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  podChangeBtnText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  podActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  podSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
  },
  podSaveBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  podCancelBtn: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  podCancelBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  checkingScrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  checkingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 12,
    minWidth: 200,
  },
  checkingText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
