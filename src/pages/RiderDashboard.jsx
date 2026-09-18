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
} from 'react-native';
import BootstrapIcon from '../components/common/BootstrapIcon';
import ExternalLink from '../components/common/ExternalLink';
import RiderQrScanSheet from '../components/modals/RiderQrScanSheet';
import RiderConfirmDeliverySheet from '../components/modals/RiderConfirmDeliverySheet';
import { useAuth } from '../context/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { riderService } from '../services/riderService';
import { extractConfirmToken } from '../services/riderAccessService';
import { areaFromAddress, googleMapsNavigateUrl } from '../utils/geo';
import { colors } from '../styles/theme';

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
  if (s.includes('out') || s.includes('reported')) {
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
  const [confirmToken, setConfirmToken] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('active'); // 'active' | 'history'

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
    } catch (e) {
      setError(e?.message || 'Unable to load your deliveries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveRiderId]);

  useEffect(() => {
    load();
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
      setNotice(`Order #${d.orderId} is now Out for Delivery`);
      await load();
      setSelected((prev) =>
        prev?.orderId === d.orderId ? { ...prev, deliveryStatus: 'Out for Delivery' } : prev
      );
    } finally {
      setBusyId('');
    }
  };

  const handleScanned = async (raw) => {
    const order = scanOrder;
    setScanOrder(null);
    setNotice('');
    setBusyId(order?.orderId || 'scan');
    try {
      const token = extractConfirmToken(raw);
      if (!token) {
        setVerified(null);
        setConfirmOpen(false);
        setConfirmToken('');
        setNotice('Could not read a delivery QR code. Scan the packing label again.');
        return;
      }

      const res = await deliveryService.riderVerifyDeliveryQr({
        riderId,
        orderId: order?.orderId || null,
        scannedRaw: raw,
      });
      if (!res.success) {
        setVerified(null);
        setConfirmOpen(false);
        setConfirmToken('');
        setNotice(res.error || 'QR did not match this order');
        return;
      }

      setVerified({ ...res.delivery, scannedRaw: raw, confirmToken: token });
      setSelected(res.delivery);
      setConfirmToken(token);
      setConfirmOpen(true);
      setNotice(`QR verified for order #${res.delivery.orderId}.`);
    } finally {
      setBusyId('');
    }
  };

  const closeConfirmPopup = () => {
    setConfirmOpen(false);
    setConfirmToken('');
  };

  const handleConfirmFinished = async () => {
    setNotice('Delivery reported. The store can see the update.');
    setVerified(null);
    setSelected(null);
    closeConfirmPopup();
    await load();
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
          <View style={styles.topRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.brand}>MotoTrack Rider</Text>
              <Text style={styles.title}>Hi, {currentUser?.name || 'Rider'}</Text>
              <Text style={styles.sub}>Your route summary for this week</Text>
            </View>
            <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} accessibilityLabel="Log out">
              <BootstrapIcon name="box-arrow-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

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
              <TouchableOpacity style={styles.scanFab} onPress={() => setScanOrder(selected || {})}>
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
                          <Text style={styles.address} numberOfLines={2}>
                            {d.customerAddress || 'No address on file'}
                          </Text>
                          <Text style={styles.meta}>
                            {formatPhpExact(d.totalAmount)} · {d.paymentStatus}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.actions}>
                          <ExternalLink href={googleMapsNavigateUrl(d.lat, d.lng, d.customerAddress)}>
                            <View style={styles.navBtn}>
                              <BootstrapIcon name="geo-alt-fill" size={13} color={colors.white} />
                              <Text style={styles.navBtnText}>Navigate</Text>
                            </View>
                          </ExternalLink>
                          <TouchableOpacity
                            style={styles.ghostBtn}
                            onPress={() => {
                              setSelected(d);
                              setVerified(null);
                            }}
                          >
                            <Text style={styles.ghostBtnText}>Details</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.scanCardBtn}
                            onPress={() => {
                              setSelected(d);
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
        order={scanOrder}
        onClose={() => setScanOrder(null)}
        onScanned={handleScanned}
      />

      <RiderConfirmDeliverySheet
        visible={confirmOpen && Boolean(confirmToken)}
        token={confirmToken}
        onClose={closeConfirmPopup}
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

              {detail.deliveryStatus !== 'Delivered' ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScanOrder(detail)}>
                  <BootstrapIcon name="qr-code" size={16} color={colors.brand} />
                  <Text style={styles.secondaryBtnText}>Scan order QR</Text>
                </TouchableOpacity>
              ) : null}

              {verified?.orderId === detail.orderId && confirmToken ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setConfirmOpen(true)}>
                  <Text style={styles.primaryBtnText}>Open Confirm Delivery</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
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
  warn: { fontSize: 13, fontWeight: '700', color: colors.dangerText, marginVertical: 8 },
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
  orderId: { fontSize: 13, fontWeight: '900', color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  customer: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6 },
  address: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  navBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  ghostBtnText: { fontWeight: '800', color: colors.textSecondary, fontSize: 12 },
  scanCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
});
